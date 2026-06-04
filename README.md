# WhatsApp Bot — View-Once Downloader

Automatically recover and re-send WhatsApp **View Once** photos and videos to your own account.

Built with **Baileys** (`@whiskeysockets/baileys`).

---

## Features

* Recover View Once photos and videos
* Automatically forwards recovered media to your own WhatsApp account
* QR-based login
* Persistent authentication
* PM2 support for 24/7 operation
* Automatic reconnection on disconnect

---

## Requirements

* Node.js 18+
* npm

---

# Quick Start

Clone the repository and install dependencies:

```bash
git clone https://github.com/vublich/wa-bot.git
cd wa-bot

npm install
```

Open `index.js` and set your WhatsApp number:

```js
const MY_JID = '11234567890@s.whatsapp.net'
```

Use your number in **international format** without spaces or symbols.

Start the bot:

```bash
npm start
```

On first launch a QR code will appear.

Open WhatsApp on your phone:

**Settings → Linked Devices → Link a Device**

Scan the QR code and wait for:

```text
✅ Connected
```

---

# How It Works

When someone sends a View Once photo or video:

1. Do **not** open the media.
2. Reply to the View Once message.
3. The bot detects the quoted message.
4. The media is downloaded.
5. The recovered file is sent directly to your configured WhatsApp account.

---

# Installation (Manual)

If you prefer creating the project manually:

```bash
mkdir wa-bot
cd wa-bot

npm init -y

npm install @whiskeysockets/baileys pino qrcode-terminal
```

Create `index.js`, paste the bot code, configure your phone number, then run:

```bash
node index.js
```

---

# Running with PM2

Install PM2:

```bash
npm install -g pm2
```

Start the bot:

```bash
pm2 start index.js --name wa-bot
```

Save the process list:

```bash
pm2 save
```

Enable startup on reboot:

```bash
pm2 startup
```

PM2 will output a command similar to:

```bash
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u yourUser
```

Copy and execute the generated command.

Save again:

```bash
pm2 save
```

---

# Monitoring

## Process Status

```bash
pm2 list
```

Example:

| ID | Name   | Mode | Restarts | Status | CPU | Memory |
|----|--------|------|----------|--------|-----|--------|
| 0  | wa-bot | fork | 0        | online | 0%  | 123 MB |

## Live Logs

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

# Configuration

Edit the following value inside `index.js`:

```js
const MY_JID = 'YOUR_NUMBER@s.whatsapp.net'
```

Example:

```js
const MY_JID = '11234567890@s.whatsapp.net'
```

---

# Project Structure

```text
wa-bot/
├── auth/
├── index.js
├── package.json
├── package-lock.json
└── bot.log
```

---

# Notes

* Use your phone number in international format.
* Keep the `auth/` folder safe.
* Deleting the `auth/` folder will require a new QR login.
* PM2 is recommended for VPS and server deployments.

---

# Disclaimer

This project is provided for educational and personal-use purposes only.

Users are responsible for ensuring their usage complies with WhatsApp's Terms of Service and all applicable laws and regulations.

