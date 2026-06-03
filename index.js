const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  downloadContentFromMessage,
  DisconnectReason
} = require('@whiskeysockets/baileys')

const qrcode = require('qrcode-terminal')
const P = require('pino')
const fs = require('fs')

/**
 * ✅ PUT YOUR NUMBER HERE
 */
const MY_JID = 'YOUR_NUMBER@s.whatsapp.net'

function log(text) {
  const line = `[${new Date().toISOString()}] ${text}`
  console.log(line)
  fs.appendFileSync('bot.log', line + '\n')
}

async function streamToBuffer(stream) {
  const chunks = []
  for await (const chunk of stream) chunks.push(chunk)
  return Buffer.concat(chunks)
}

function getQuotedMessage(msg) {
  return msg?.extendedTextMessage?.contextInfo?.quotedMessage
}

function isViewOnce(msg) {
  if (!msg) return false
  return JSON.stringify(msg).includes('viewOnce')
}

/**
 * ✅ FULL UNWRAP (WORKING FIX)
 */
function deepUnwrap(msg) {
  let m = msg

  while (true) {
    if (m?.viewOnceMessage?.message) {
      m = m.viewOnceMessage.message
      continue
    }

    if (m?.viewOnceMessageV2?.message) {
      m = m.viewOnceMessageV2.message
      continue
    }

    if (m?.viewOnceMessageV2Extension?.message) {
      m = m.viewOnceMessageV2Extension.message
      continue
    }

    if (m?.ephemeralMessage?.message) {
      m = m.ephemeralMessage.message
      continue
    }

    if (m?.message) {
      m = m.message
      continue
    }

    break
  }

  return m
}

function getMedia(msg) {
  if (!msg) return null

  for (const key of Object.keys(msg)) {
    if (key.endsWith('Message')) {
      const media = msg[key]
      if (media?.url || media?.directPath) {
        return { key, media }
      }
    }
  }

  return null
}

async function download(mediaObj) {
  const { key, media } = mediaObj
  const type = key.replace('Message', '')
  const stream = await downloadContentFromMessage(media, type)
  return await streamToBuffer(stream)
}

async function startBot() {
  log('🚀 Starting')

  const { state, saveCreds } = await useMultiFileAuthState('./auth')
  const { version } = await fetchLatestBaileysVersion()

  const sock = makeWASocket({
    version,
    auth: state,
    logger: P({ level: 'silent' })
  })

  sock.ev.on('connection.update', ({ connection, qr, lastDisconnect }) => {
    if (qr) {
      log('📱 Scan QR')
      qrcode.generate(qr, { small: true })
    }

    if (connection === 'open') log('✅ Connected')

    if (connection === 'close') {
      const code = lastDisconnect?.error?.output?.statusCode
      log('❌ Closed: ' + code)

      if (code !== DisconnectReason.loggedOut) {
        startBot()
      }
    }
  })

  sock.ev.on('creds.update', saveCreds)

  /**
   * ✅ MESSAGE HANDLER
   */
  sock.ev.on('messages.upsert', async ({ messages, type }) => {
    if (type !== 'notify') return

    for (const msg of messages) {
      try {
        if (!msg.message) continue

        const from = msg.key.remoteJid
        log('📩 Message from ' + from)

        const quoted = getQuotedMessage(msg.message)

        if (!quoted) continue

        if (!isViewOnce(quoted)) {
          log('➡️ Not view-once')
          continue
        }

        log('📸 VIEW ONCE DETECTED ✅')

        const inner = deepUnwrap(quoted)

        const mediaObj = getMedia(inner)

        if (!mediaObj) {
          log('❌ Media not found')
          continue
        }

        const buffer = await download(mediaObj)

        log('✅ Downloaded (' + buffer.length + ' bytes)')

        /**
         * ✅ SEND ONLY TO YOU
         */
        if (mediaObj.key === 'imageMessage') {
          await sock.sendMessage(MY_JID, {
            image: buffer,
            caption: 'Recovered ✅'
          })
        } else if (mediaObj.key === 'videoMessage') {
          await sock.sendMessage(MY_JID, {
            video: buffer,
            caption: 'Recovered ✅'
          })
        } else {
          await sock.sendMessage(MY_JID, {
            document: buffer,
            fileName: 'recovered.bin'
          })
        }

        log('📤 Sent to self ✅')

      } catch (err) {
        log('❌ ' + err.message)
      }
    }
  })
}

startBot()
