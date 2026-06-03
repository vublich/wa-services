const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  downloadContentFromMessage,
  DisconnectReason
} = require('@whiskeysockets/baileys')

const P = require('pino')
const qrcode = require('qrcode-terminal')
const fs = require('fs')

/**
 * ✅ SIMPLE LOGGER (console + file)
 */
function log(text) {
  const line = `[${new Date().toISOString()}] ${text}`
  console.log(line)
  fs.appendFileSync('bot.log', line + '\n')
}

/**
 * ✅ Convert stream → buffer
 */
async function streamToBuffer(stream) {
  const chunks = []
  for await (const chunk of stream) {
    chunks.push(chunk)
  }
  return Buffer.concat(chunks)
}

/**
 * ✅ Detect "view once"
 */
function isViewOnce(msg) {
  return !!(
    msg?.viewOnceMessage ||
    msg?.viewOnceMessageV2 ||
    msg?.viewOnceMessageV2Extension
  )
}

/**
 * ✅ Extract inner media
 */
function extractMedia(msg) {
  if (msg.viewOnceMessage) return msg.viewOnceMessage.message
  if (msg.viewOnceMessageV2) return msg.viewOnceMessageV2.message
  if (msg.viewOnceMessageV2Extension) return msg.viewOnceMessageV2Extension.message
  return null
}

/**
 * ✅ Download media
 */
async function downloadMedia(mediaMsg) {
  const type = Object.keys(mediaMsg)[0] // imageMessage, videoMessage...
  const stream = await downloadContentFromMessage(
    mediaMsg[type],
    type.replace('Message', '')
  )
  return await streamToBuffer(stream)
}

/**
 * ✅ Main bot
 */
async function startBot() {
  log('🚀 Starting bot...')

  const { state, saveCreds } = await useMultiFileAuthState('./auth')
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    auth: state,
    logger: P({ level: 'silent' })
  })

  /**
   * ✅ CONNECTION EVENTS
   */
  sock.ev.on('connection.update', ({ connection, qr, lastDisconnect }) => {
    if (qr) {
      log('📱 Scan QR code below')
      qrcode.generate(qr, { small: true })
    }

    if (connection === 'open') {
      log('✅ Connected to WhatsApp')
    }

    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode
      log(`❌ Connection closed (code: ${code})`)

      if (code !== DisconnectReason.loggedOut) {
        log('🔁 Reconnecting...')
        startBot()
      } else {
        log('🚪 Logged out, delete /auth and restart')
      }
    }
  })

  /**
   * ✅ SAVE SESSION
   */
  sock.ev.on('creds.update', saveCreds)

  /**
   * ✅ MESSAGE HANDLER
   */
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return

    for (const msg of messages) {
      try {
        const message = msg.message
        if (!message) continue

        const from = msg.key.remoteJid
        log(`📩 Message from ${from}`)

        // ✅ quoted message (reply)
        const quoted =
          message?.extendedTextMessage?.contextInfo?.quotedMessage

        if (!quoted) {
          log('➡️ No quoted message, skipping')
          continue
        }

        if (!isViewOnce(quoted)) {
          log('➡️ Not a view-once message')
          continue
        }

        log('📸 View-once detected!')

        const mediaMsg = extractMedia(quoted)
        if (!mediaMsg) {
          log('⚠️ Failed to extract media')
          continue
        }

        const buffer = await downloadMedia(mediaMsg)

        log(`✅ Media downloaded (${buffer.length} bytes)`)

        /**
         * ✅ SEND BACK MEDIA
         */
        if (mediaMsg.imageMessage) {
          await sock.sendMessage(from, {
            image: buffer,
            caption: 'Recovered view-once ✅'
          })
          log('📤 Image sent')
        } else if (mediaMsg.videoMessage) {
          await sock.sendMessage(from, {
            video: buffer,
            caption: 'Recovered view-once ✅'
          })
          log('📤 Video sent')
        } else if (mediaMsg.audioMessage) {
          await sock.sendMessage(from, {
            audio: buffer,
            mimetype: 'audio/ogg'
          })
          log('📤 Audio sent')
        } else {
          await sock.sendMessage(from, {
            document: buffer,
            fileName: 'file.bin'
          })
          log('📤 File sent')
        }

      } catch (err) {
        log(`❌ ERROR: ${err.message}`)
      }
    }
  })
}

/**
 * ✅ START
 */
startBot()
