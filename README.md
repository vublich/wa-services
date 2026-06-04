# WhatsApp Bot — View-Once Downloader

A WhatsApp bot built with Baileys that automatically downloads and re-sends view-once media to your own WhatsApp account.

Built with **@whiskeysockets/baileys**.

## Requirements

* Node.js 18 or higher
* npm

---

## Installation

Create a project directory and install the required packages:

```bash
mkdir wa-bot
cd wa-bot

npm init -y

npm install @whiskeysockets/baileys pino qrcode-terminal
```

---

## Configure Your Number

Open `index.js` and replace the placeholder with your WhatsApp number:

```js
/**
 * Put your WhatsApp number here
 */
const MY_JID = 'YOUR_NUMBER@s.whatsapp.net'
```

Example:

```js
const MY_JID = '11234567890@s.whatsapp.net'
```

Use the international format without spaces or symbols.

---

## Start the Bot

Run:

```bash
node index.js
```

On the first launch, a QR code will be displayed.

Scan it with your WhatsApp account:

**WhatsApp → Linked Devices → Link a Device**

Once connected, the bot will remain authenticated.

---

## Install PM2

To keep the bot running in the background:

```bash
npm install -g pm2
```

---

## Run as a Service

Start the bot with PM2:

```bash
pm2 start index.js --name wa-bot
```

Enable automatic startup after server reboot:

```bash
pm2 startup
```

PM2 will display a command similar to:

```bash
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u yourUser
```

Copy and execute the generated command.

Then save the PM2 configuration:

```bash
pm2 save
```

---

## Check Bot Status

View running processes:

```bash
pm2 list
```

Example output:

```text
┌────┬──────────┬──────────┬──────┬─────────┬──────┬─────────┐
│ id │ name     │ mode     │ ↺    │ status  │ cpu  │ memory  │
├────┼──────────┼──────────┼──────┼─────────┼──────┼─────────┤
│ 0  │ wa-bot   │ fork     │ 0    │ online  │ 0%   │ 123 MB  │
└────┴──────────┴──────────┴──────┴─────────┴──────┴─────────┘
```

---

## View Logs

Monitor bot activity in real time:

```bash
pm2 logs wa-bot
```

Example:

```text
[2026-06-03T14:07:55.399Z] 🚀 Starting
[2026-06-03T14:07:56.834Z] ✅ Connected

[2026-06-03T14:48:27.908Z] 📩 Message received
[2026-06-03T14:48:27.910Z] 📸 VIEW ONCE DETECTED
[2026-06-03T14:48:27.958Z] ✅ Media downloaded
[2026-06-03T14:48:28.942Z] 📤 Sent to self
```

---

## Downloading View-Once Media

To save a view-once photo or video:

1. Do **not** open the media.
2. Reply to the view-once message.
3. The bot will detect the media, download it, and resend it to your configured WhatsApp number.

The recovered media will appear in your personal chat automatically.

---

## Notes

* Your WhatsApp number must be configured in `index.js`.
* Use the international phone format.
* Keep your authentication files safe.
* Running with PM2 is recommended for production deployments.

## Disclaimer

This project is intended for educational and personal-use purposes only. Ensure your usage complies with WhatsApp's Terms of Service and applicable laws.
