# WhatsApp Bot — View-Once Downloader

Built with [@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys)

## Requirements

- Node.js 18 or higher
- npm

## Install

mkdir wa-bot
cd wa-bot
npm init -y
npm install @whiskeysockets/baileys pino qrcode-terminal

## Index.js

pull Index.js and modify your phone number

**
 * ✅ PUT YOUR NUMBER HERE
 */
const MY_JID = 'YOUR_NUMBER@s.whatsapp.net'

## Start Bot

node index.js
first run will ask QR code association with device

## Install PM2

npm install -g pm2

## Run bot as service also on reboot

pm2 start index.js --name wa-bot
pm2 startup --> it will give  a command like: "sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u yourUser" --> copy + run it

pm2 save

# Check Status

pm2 list --> gives something similar
┌────┬────────────────────┬──────────┬──────┬───────────┬──────────┬──────────┐
│ id │ name               │ mode     │ ↺    │ status    │ cpu      │ memory   │
├────┼────────────────────┼──────────┼──────┼───────────┼──────────┼──────────┤
│ 0  │ wa-bot             │ fork     │ 0    │ online    │ 0%       │ 123.1mb  │
└────┴────────────────────┴──────────┴──────┴───────────┴──────────┴──────────┘

pm2 logs wa-bot to check what the bot is doing when a message arrive.

[2026-06-03T14:07:55.399Z] 🚀 Starting
0|wa-bot   | [2026-06-03T14:07:56.834Z] ✅ Connected

0|wa-bot  | [2026-06-03T14:48:27.908Z] 📩 Message from ###########@lid
0|wa-bot  | [2026-06-03T14:48:27.910Z] 📸 VIEW ONCE DETECTED ✅
0|wa-bot  | [2026-06-03T14:48:27.958Z] ✅ Downloaded (***** bytes)
0|wa-bot  | Closing session: SessionEntry {
0|wa-bot  |   _chains: {
0|wa-bot  |     ##########: { chainKey: [Object], chainType: 2, messageKeys: {} },
0|wa-bot  |     '##########': { chainKey: [Object], chainType: 1, messageKeys: {} }
0|wa-bot  |   },
0|wa-bot  |   registrationId: ############,
0|wa-bot  |   currentRatchet: {
0|wa-bot  |     ephemeralKeyPair: {
0|wa-bot  |       pubKey: <Buffer ########################>,
0|wa-bot  |       privKey: <Buffer #######################>
0|wa-bot  |     },
0|wa-bot  |     lastRemoteEphemeralKey: <Buffer ######################>,
0|wa-bot  |     previousCounter: 0,
0|wa-bot  |     rootKey: <Buffer ##########################################>
0|wa-bot  |   },
0|wa-bot  |   indexInfo: {
0|wa-bot  |     baseKey: <Buffer #####################################>,
0|wa-bot  |     baseKeyType: 1,
0|wa-bot  |     closed: -1,
0|wa-bot  |     used: ###############,
0|wa-bot  |     created: ###################,
0|wa-bot  |     remoteIdentityKey: <Buffer #############################>
0|wa-bot  |   }
0|wa-bot  | }
0|wa-bot  | [2026-06-03T14:48:28.942Z] 📤 Sent to self ✅

# Download ViewOncecMedia

simply reply to the message you want to download without open it directly. 
it will resend to your number after you insert your phone number on index file (international format example: 1 123 123)
