/**
 * WhatsApp Bot — Auto View-Once Downloader
 * Built with @whiskeysockets/baileys v7
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const AUTH_FOLDER  = path.join(__dirname, "auth_info");
const MEDIA_FOLDER = path.join(__dirname, "downloads");

[AUTH_FOLDER, MEDIA_FOLDER].forEach((d) => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

const logger = pino({ level: "warn" });

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isViewOnce(msgContent) {
    if (!msgContent) return false;
    if (
        msgContent.viewOnceMessage ||
        msgContent.viewOnceMessageV2 ||
        msgContent.viewOnceMessageV2Extension
    ) return true;
    const inner =
        msgContent.ephemeralMessage?.message ||
        msgContent.associatedChildMessage?.message;
    if (inner) return isViewOnce(inner);
    return false;
}

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

function getMediaType(inner) {
    if (!inner) return null;
    if (inner.imageMessage) return "image";
    if (inner.videoMessage) return "video";
    if (inner.audioMessage) return "audio";
    return null;
}

function saveToDisk(buffer, ext) {
    const filename = `viewonce_${Date.now()}.${ext}`;
    const filepath  = path.join(MEDIA_FOLDER, filename);
    fs.writeFileSync(filepath, buffer);
    return filepath;
}

// ─── Core: auto-download view-once ───────────────────────────────────────────

async function processViewOnce(sock, msg) {
    const jid   = msg.key.remoteJid;
    const inner = unwrapInner(msg.message);
    const type  = getMediaType(inner);

    if (!type) {
        console.log("[view-once] Could not detect media type, skipping.");
        return;
    }

    console.log(`[view-once] Downloading ${type} from ${jid}…`);

    try {
        const buffer = await downloadMediaMessage(
            msg, "buffer", {},
            { logger, reuploadRequest: sock.updateMediaMessage }
        );

        const ext     = type === "video" ? "mp4" : type === "audio" ? "m4a" : "jpg";
        const caption = `👁 View-once ${type} — saved automatically`;

        if (type === "image") {
            await sock.sendMessage(jid, { image: buffer, caption });
        } else if (type === "video") {
            await sock.sendMessage(jid, { video: buffer, caption });
        } else {
            await sock.sendMessage(jid, { audio: buffer, mimetype: "audio/mp4" });
        }

        const saved = saveToDisk(buffer, ext);
        console.log(`[view-once] ✅ Saved → ${saved}`);

    } catch (err) {
        console.error("[view-once] ❌ Download failed:", err.message);
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
    await sock.sendMessage(msg.key.remoteJid, {
        text: [
            "*🤖 Bot info*",
            "",
            "View-once images and videos are saved *automatically*.",
            "",
            "• *!ping* — latency check",
            "• *!help* — this message",
        ].join("\n"),
    });
}

// ─── Message router ───────────────────────────────────────────────────────────

async function handleMessage(sock, msg) {
    const { remoteJid } = msg.key;

    if (!msg.message) return;
    if (isJidBroadcast(remoteJid)) return;
    if (remoteJid === "status@broadcast") return;

    console.log(`[msg] jid=${remoteJid} fromMe=${msg.key.fromMe} keys=${Object.keys(msg.message).join(",")}`);

    // View-once — must be before fromMe filter
    if (isViewOnce(msg.message)) {
        await processViewOnce(sock, msg);
        return;
    }

    // Skip own messages for commands only
    if (msg.key.fromMe) return;

    const body =
        msg.message.conversation ||
        msg.message.extendedTextMessage?.text || "";

    switch (body.trim().toLowerCase().split(/\s+/)[0]) {
        case "!ping": await handlePing(sock, msg); break;
        case "!help": await handleHelp(sock, msg); break;
    }
}

// ─── Bot init ─────────────────────────────────────────────────────────────────

async function startBot() {
    const { version, isLatest } = await fetchLatestBaileysVersion();
    console.log(`Using WA v${version.join(".")}${isLatest ? " ✓" : ""}`);

    const { state, saveCreds } = await useMultiFileAuthState(AUTH_FOLDER);

    const sock = makeWASocket({
        version,
        logger,
        auth: {
            creds: state.creds,
            keys:  makeCacheableSignalKeyStore(state.keys, logger),
        },
        syncFullHistory:                false,
        markOnlineOnConnect:            true,
        generateHighQualityLinkPreview: false,
        retryRequestDelayMs:            2000,
        receivedPendingNotifications:   false,
    });

    sock.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect, qr } = update;

        if (qr) {
            console.log("\n📱 Scan in WhatsApp → Linked Devices:\n");
            qrcode.generate(qr, { small: true });
        }

        if (connection === "close") {
            const code = new Boom(lastDisconnect?.error)?.output?.statusCode;
            console.log(`Connection closed — code ${code}`);
            if (code !== DisconnectReason.loggedOut) {
                setTimeout(startBot, 3000);
            } else {
                console.log("Logged out — delete auth_info/ and restart.");
                process.exit(0);
            }
        }

        if (connection === "open") {
            console.log("✅ Connected! Watching for messages…\n");
        }
    });

    sock.ev.on("creds.update", saveCreds);

    // ── messages.upsert — fires for new messages ──────────────────────────────
    // View-once messages sometimes arrive with null body here — content
    // comes in messages.update instead (see below)
    sock.ev.on("messages.upsert", async ({ messages, type }) => {
        console.log(`[upsert] type=${type} count=${messages.length}`);
        for (const msg of messages) {
            if (!msg.message) {
                console.log(`[upsert] null body — will catch in messages.update`);
                continue;
            }
            try {
                await handleMessage(sock, msg);
            } catch (err) {
                console.error("[upsert] Error:", err);
            }
        }
    });

    // ── messages.update — fires when message content is populated/changed ─────
    // This is where view-once content actually arrives on linked devices
    sock.ev.on("messages.update", async (updates) => {
        console.log(`[update] count=${updates.length}`);
        for (const update of updates) {
            if (!update.update?.message) {
                console.log(`[update] no content, skipping`);
                continue;
            }

            // Reconstruct a full message object from key + updated content
            const msg = {
                key:     update.key,
                message: update.update.message,
            };

            console.log(`[update] jid=${msg.key.remoteJid} keys=${Object.keys(msg.message).join(",")}`);

            try {
                await handleMessage(sock, msg);
            } catch (err) {
                console.error("[update] Error:", err);
            }
        }
    });

    return sock;
}

startBot().catch(console.error);
