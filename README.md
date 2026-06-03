# WhatsApp Bot — View-Once Downloader

Built with [@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys) v7.

## Requirements

- Node.js 18 or higher
- npm

## Install

```bash
npm install
```

## Start

```bash
npm start
```

On first run, a QR code prints in the terminal.  
Open WhatsApp → Linked Devices → Link a Device → scan it.  
The session is saved in `auth_info/` — you won't need to scan again unless you log out.

## Commands

| Command | How to use |
|---------|-----------|
| `!show` | **Reply** to a view-once image or video, then send `!show` |
| `!ping` | Check bot latency |
| `!help` | List all commands |

## Notes

- Downloaded media is saved to `downloads/`
- To reset the session (force re-scan): delete the `auth_info/` folder and restart
- Debug logging: `npm run dev`

## Project structure

```
index.js          ← main bot logic
auth_info/        ← session files (auto-created, do not commit)
downloads/        ← saved media (auto-created)
package.json
README.md
```
