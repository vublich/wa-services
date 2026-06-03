/**
 * WhatsApp Bot — Auto View-Once Downloader
 * Built with @whiskeysockets/baileys v7
 *
 * How it works:
 *   - Any view-once image/video received is automatically downloaded
 *     and re-sent back to the same chat — no command needed
 *   - Media is also saved to downloads/ on disk
 *
 * Commands:
 *   !ping  — latency check
 *   !help  — command list
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
const AUTH_FOLDER  = path.join(__dirname, "auth_info");
const MEDIA_FOLDER = path.join(__dirname, "downloads");

[AUTH_FOLDER, MEDIA_FOLDER].forEach((d) => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// ─── Logger ───────────────────────────────────────────────────────────────────
const logger = pino({ level: process.env.LOG_LEVEL || "silent" });

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Detect if a raw message object is a view-once wrapper.
 * Checks all known wrapper key names WhatsApp has used.
 */
function isViewOnce(msgContent) {
    if (!msgContent) return false;
    return !!(
        msgContent.viewOnceMessage ||
        msgContent.viewOnceMessageV2 ||
        msgContent.viewOnceMessageV2Extension
    );
}

/**
 * Unwrap any view-once / ephemeral / associatedChild envelope
 * and return the inner message object (e.g. { imageMessage: {...} }).
 */
function unwrapInner(msgContent) {
    if (!msgContent) return null;
    return (
        msgContent.viewOnceMessageV2Extension?.message ||
        msgContent.viewOnceMessageV2?.message ||
        msgContent.viewOnceMessage?.message ||
        msgContent.ephemeralMessage?.message ||
        msgContent.associatedChildMessage?.message ||
        msgContent.documentWithCaptionMessage?.message ||
        msgContent.editedMessage?.message ||
        msgContent
    );
}

/**
 * Given an unwrapped inner message, return "image" | "video" | "audio" | null.
 */
function getMediaType(inner) {
    if (!inner) return null;
    if (inner.imageMessage) return "image";
    if (inner.videoMessage) return "video";
    if (inner.audioMessage) return "audio";
    return null;
}

/**
 * Save a buffer to downloads/ and return the full path.
 */
function saveToDisk(buffer, ext) {
    const filename = `viewonce_${Date.now()}.${ext}`;
    const filepath  = path.join(MEDIA_FOLDER, filename);
    fs.writeFileSync(filepath, buffer);
    return filepath;
}

// ─── Core: auto-download view-once ───────────────────────────────────────────

/**
 * Called automatically whenever a view-once message arrives.
 * Downloads the media and re-sends it in the same chat.
 */
async function processViewOnce(sock, msg) {
    const jid   = msg.key.remoteJid;
    const inner = unwrapInner(msg.message);
    const type  = getMediaType(inner);

    if (!type) {
        console.log("[view-once] Could not detect media type, skipping.");
        return;
    }

    console.log(`[view-once] Detected ${type} from ${jid} — downloading…`);

    try {
        const buffer = await downloadMediaMessage(
            msg,
            "buffer",
            {},
            {
                logger,
                reuploadRequest: sock.updateMediaMessage,
            }
        );

        const ext     = type === "video" ? "mp4" : type === "audio" ? "m4a" : "jpg";
        const caption = `👁 View-once ${type} — saved automatically`;

        // Re-send the media back into the same chat
        if (type === "image") {
            await sock.sendMessage(jid, { image: buffer, caption });
        } else if (type === "video") {
            await sock.sendMessage(jid, { video: buffer, caption });
        } else {
            await sock.sendMessage(jid, { audio: buffer, mimetype: "audio/mp4" });
        }

        // Save to disk as well
        const saved = saveToDisk(buffer, ext);
        console.log(`[view-once] Saved to disk → ${saved}`);

    } catch (err) {
        console.error("[view-once] Download failed:", err.message);
        await sock.sendMessage(jid, {
            text: `❌ Could not download the view-once ${type}: ${err.message}`,
        });
    }
}

// ─── Commands ─────────────────────────────────────────────────────────────────

async function handlePing(sock, msg) {
    const jid   = msg.key.remoteJid;
    const start = Date.now();
    await sock.sendMessage(jid, { react: { text: "🏓", key: msg.key } });
    await sock.sendMessage(jid, { text: `🏓 Pong! ${Date.now() - start}ms` });
}

async function handleHelp(sock, msg) {
    const jid  = msg.key.remoteJid;
    const text = [
        "*🤖 Bot info*",
        "",
        "View-once images and videos are saved *automatically* — no command needed.",
        "",
        "*Commands*",
        "• *!ping* — check bot latency",
        "• *!help* — show this message",
    ].join("\n");
    await sock.sendMessage(jid, { text });
}

// ─── Message router ───────────────────────────────────────────────────────────

async function handleMessage(sock, msg) {
    const { remoteJid } = msg.key;

    // Ignore broadcasts, status, and messages sent by the bot itself
    if (
        !msg.message ||
        msg.key.fromMe ||
        isJidBroadcast(remoteJid) ||
        remoteJid === "status@broadcast"
    ) return;

    // ── Auto view-once detection ───────────────────────────────────────────────
    if (isViewOnce(msg.message)) {
        await processViewOnce(sock, msg);
        return;
    }

    // ── Text commands ─────────────────────────────────────────────────────────
    const body =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text ||
        "";

    const command = body.trim().toLowerCase().split(/\s+/)[0];

    switch (command) {
        case "!ping": await handlePing(sock, msg); break;
        case "!help": await handleHelp(sock, msg); break;
    }
}

// ─── Bot init ─────────────────────────────────────────────────────────────────

async function startBot() {
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`\nUsing WA v${version.join(".")}${isLatest ? " ✓" : " (outdated)"}`);

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);

    const sock = makeWASocket({
        version,
        logger,
        auth: {
            creds: state.creds,
            keys:  makeCacheableSignalKeyStore(state.keys, logger),
        },
        syncFullHistory:              false,
        markOnlineOnConnect:          true,
        generateHighQualityLinkPreview: false,
        retryRequestDelayMs:          2000,
    });

    // ── QR + connection state ─────────────────────────────────────────────────
    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log("\n📱 Scan this QR code in WhatsApp → Linked Devices:\n");
            qrcode.generate(qr, { small: true });
        }

        if (connection === "close") {
            const code          = new Boom(lastDisconnect?.error)?.output?.statusCode;
            const shouldRestart = code !== DisconnectReason.loggedOut;
            console.log(`Connection closed (code ${code}). Reconnecting: ${shouldRestart}`);
            if (shouldRestart) {
                setTimeout(startBot, 3000);
            } else {
                console.log("Logged out — delete auth_info/ and restart.");
                process.exit(0);
            }
        }

        if (connection === "open") {
            console.log("✅ Bot connected! Watching for view-once messages…\n");
        }
    });

    sock.ev.on("creds.update", saveCreds);

    // ── Incoming messages ─────────────────────────────────────────────────────
    sock.ev.on("messages.upsert", async ({ messages, type }) => {
        if (type !== "notify") return;
        for (const msg of messages) {
            try {
                await handleMessage(sock, msg);
            } catch (err) {
                console.error("[router] Error:", err);
            }
        }
    });

    return sock;
}

startBot().catch(console.error);
