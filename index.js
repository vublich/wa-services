/**
 * WhatsApp Bot — View-Once Downloader + Utilities
 * Built with @whiskeysockets/baileys v7
 *
 * Features:
 *  - QR code pairing (scan once, session saved)
 *  - Auto-reconnect on disconnect
 *  - !show   → forward view-once image/video back to sender
 *  - !ping   → latency check
 *  - !help   → command list
 */

import makeWASocket, {
    useMultiFileAuthState,
    DisconnectReason,
    downloadMediaMessage,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore,
    isJidBroadcast,
} from "@whiskeysockets/baileys";

import qrcode from "qrcode-terminal";
import pino from "pino";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { Boom } from "@hapi/boom";

// ─── Paths ────────────────────────────────────────────────────────────────────
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_FOLDER = path.join(__dirname, "auth_info");
const MEDIA_FOLDER = path.join(__dirname, "downloads");

[AUTH_FOLDER, MEDIA_FOLDER].forEach((d) => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// ─── Logger (silent in production, use pino-pretty for dev) ──────────────────
const logger = pino({
    level: process.env.LOG_LEVEL || "silent",
});

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Extract the actual inner message object from a WAMessage,
 * unwrapping viewOnce, ephemeral, associatedChild, etc.
 */
function unwrapMessage(msg) {
    const m = msg.message;
    if (!m) return null;

    // All known wrapper types — ordered by specificity
    return (
        m.viewOnceMessageV2Extension?.message ||
        m.viewOnceMessageV2?.message ||
        m.viewOnceMessage?.message ||
        m.ephemeralMessage?.message ||
        m.documentWithCaptionMessage?.message ||
        m.associatedChildMessage?.message ||
        m.editedMessage?.message ||
        m
    );
}

/**
 * Return true if a message (or its quoted message) is view-once.
 */
function isViewOnce(msg) {
    const m = msg.message;
    if (!m) return false;
    return !!(
        m.viewOnceMessage ||
        m.viewOnceMessageV2 ||
        m.viewOnceMessageV2Extension
    );
}

/**
 * Get the media type string from an inner message object.
 * Returns "image", "video", "audio", or null.
 */
function getMediaType(inner) {
    if (!inner) return null;
    if (inner.imageMessage) return "image";
    if (inner.videoMessage) return "video";
    if (inner.audioMessage) return "audio";
    return null;
}

/**
 * Save a buffer to the downloads folder and return the file path.
 */
function saveMedia(buffer, ext) {
    const filename = `media_${Date.now()}.${ext}`;
    const filepath = path.join(MEDIA_FOLDER, filename);
    fs.writeFileSync(filepath, buffer);
    return filepath;
}

// ─── Command handlers ─────────────────────────────────────────────────────────

/**
 * !show — reply to a view-once message to reveal + forward it
 */
async function handleShow(sock, msg) {
    const jid = msg.key.remoteJid;

    // The user must reply to a view-once message
    const quoted = msg.message?.extendedTextMessage?.contextInfo?.quotedMessage;

    if (!quoted) {
        await sock.sendMessage(jid, {
            text: "⚠️ Reply to a view-once message with *!show* to reveal it.",
        });
        return;
    }

    // Wrap the quoted message into a full WAMessage-like structure
    // so downloadMediaMessage can process it
    const fakeMsg = {
        key: {
            remoteJid: jid,
            id: msg.message.extendedTextMessage.contextInfo.stanzaId,
            fromMe: false,
        },
        message: quoted,
    };

    const inner = unwrapMessage(fakeMsg);
    const mediaType = getMediaType(inner);

    if (!mediaType) {
        await sock.sendMessage(jid, {
            text: "❌ Could not find media in the replied message. Make sure you replied to a view-once image or video.",
        });
        return;
    }

    try {
        await sock.sendMessage(jid, { text: "⏳ Downloading…" });

        const buffer = await downloadMediaMessage(
            fakeMsg,
            "buffer",
            {},
            {
                logger,
                reuploadRequest: sock.updateMediaMessage,
            }
        );

        const ext = mediaType === "video" ? "mp4" : "jpg";
        const caption = `✅ View-once ${mediaType} — revealed by bot`;

        if (mediaType === "image") {
            await sock.sendMessage(jid, {
                image: buffer,
                caption,
            });
        } else if (mediaType === "video") {
            await sock.sendMessage(jid, {
                video: buffer,
                caption,
            });
        } else {
            // Audio / PTT
            await sock.sendMessage(jid, {
                audio: buffer,
                mimetype: "audio/mp4",
            });
        }

        // Optionally save to disk
        const savedPath = saveMedia(buffer, ext);
        console.log(`[show] Saved ${mediaType} → ${savedPath}`);
    } catch (err) {
        console.error("[show] Download error:", err);
        await sock.sendMessage(jid, {
            text: `❌ Failed to download: ${err.message}`,
        });
    }
}

/**
 * !ping — latency check
 */
async function handlePing(sock, msg) {
    const jid = msg.key.remoteJid;
    const start = Date.now();
    await sock.sendMessage(jid, { react: { text: "🏓", key: msg.key } });
    const ms = Date.now() - start;
    await sock.sendMessage(jid, { text: `🏓 Pong! ${ms}ms` });
}

/**
 * !help — command list
 */
async function handleHelp(sock, msg) {
    const jid = msg.key.remoteJid;
    const text = [
        "*📋 Available commands*",
        "",
        "• *!show* — reply to a view-once message to reveal and download it",
        "• *!ping* — check bot latency",
        "• *!help* — show this menu",
    ].join("\n");
    await sock.sendMessage(jid, { text });
}

// ─── Message router ───────────────────────────────────────────────────────────

async function handleMessage(sock, msg) {
    // Ignore status updates, broadcasts and own messages
    if (
        !msg.message ||
        msg.key.fromMe ||
        isJidBroadcast(msg.key.remoteJid) ||
        msg.key.remoteJid === "status@broadcast"
    )
        return;

    // Extract plain text from common message types
    const body =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        msg.message.imageMessage?.caption ||
        msg.message.videoMessage?.caption ||
        "";

    const command = body.trim().toLowerCase().split(/\s+/)[0];

    switch (command) {
        case "!show":
            await handleShow(sock, msg);
            break;
        case "!ping":
            await handlePing(sock, msg);
            break;
        case "!help":
            await handleHelp(sock, msg);
            break;
        default:
            // Not a command — do nothing
            break;
    }
}

// ─── Bot initialisation ───────────────────────────────────────────────────────

async function startBot() {
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`Using WA v${version.join(".")}${isLatest ? " (latest)" : ""}`);

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);

    const sock = makeWASocket({
        version,
        logger,
        auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, logger),
        },
        // Receive full message history on reconnect
        syncFullHistory: false,
        // Mark messages as read automatically
        markOnlineOnConnect: true,
        // Needed to download media reliably
        generateHighQualityLinkPreview: false,
        // Do NOT strip view-once — we need the media keys
        retryRequestDelayMs: 2000,
    });

    // ── Auth & QR ──────────────────────────────────────────────────────────────
    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log("\n📱 Scan the QR code below with WhatsApp:\n");
            qrcode.generate(qr, { small: true });
        }

        if (connection === "close") {
            const reason =
                new Boom(lastDisconnect?.error)?.output?.statusCode;
            const shouldReconnect =
                reason !== DisconnectReason.loggedOut;

            console.log(
                `Connection closed. Reason: ${reason}. Reconnecting: ${shouldReconnect}`
            );

            if (shouldReconnect) {
                setTimeout(startBot, 3000);
            } else {
                console.log(
                    "Logged out. Delete the auth_info folder and restart."
                );
                process.exit(0);
            }
        }

        if (connection === "open") {
            console.log("✅ Connected to WhatsApp!");
        }
    });

    // ── Save credentials whenever they update ─────────────────────────────────
    sock.ev.on("creds.update", saveCreds);

    // ── Incoming messages ─────────────────────────────────────────────────────
    sock.ev.on("messages.upsert", async ({ messages, type }) => {
        // "notify" = new incoming messages, "append" = history
        if (type !== "notify") return;

        for (const msg of messages) {
            try {
                await handleMessage(sock, msg);
            } catch (err) {
                console.error("[router] Unhandled error:", err);
            }
        }
    });

    return sock;
}

// ─── Entry ────────────────────────────────────────────────────────────────────
startBot().catch(console.error);
