import makeWASocket, { DisconnectReason, useMultiFileAuthState } from "@whiskeysockets/baileys";
import axios from "axios";
import qrcode from "qrcode-terminal";

const API_URL = process.env.JAKE_API_URL || "http://127.0.0.1:8000/api";
const TOKEN = process.env.JAKE_TOKEN || "";
const AUTHORIZED = new Set(
  (process.env.JAKE_WHATSAPP_AUTHORIZED || "")
    .split(",")
    .map((item) => item.trim().replace(/\D/g, ""))
    .filter(Boolean)
);

if (!TOKEN) {
  console.log("Defina JAKE_TOKEN com um token JWT do Jake antes de iniciar o bridge.");
}

const { state, saveCreds } = await useMultiFileAuthState("./auth");

async function start() {
  const sock = makeWASocket({ auth: state, printQRInTerminal: false });
  sock.ev.on("creds.update", saveCreds);
  sock.ev.on("connection.update", (update) => {
    if (update.qr) qrcode.generate(update.qr, { small: true });
    if (update.connection === "close") {
      const shouldReconnect = update.lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      if (shouldReconnect) start();
    }
    if (update.connection === "open") {
      console.log("Jake WhatsApp bridge conectado.");
    }
  });

  sock.ev.on("messages.upsert", async ({ messages }) => {
    for (const message of messages) {
      const from = message.key.remoteJid || "";
      const phone = from.replace(/\D/g, "");
      if (AUTHORIZED.size && !AUTHORIZED.has(phone)) continue;
      const text =
        message.message?.conversation ||
        message.message?.extendedTextMessage?.text ||
        "";
      if (!text.trim() || !TOKEN) continue;
      try {
        const response = await axios.post(
          `${API_URL}/chat`,
          { message: text, mode: "balanced" },
          { headers: { Authorization: `Bearer ${TOKEN}` } }
        );
        await sock.sendMessage(from, { text: response.data.reply || "OK" });
      } catch (error) {
        await sock.sendMessage(from, { text: "Jake nao conseguiu responder agora." });
      }
    }
  });
}

start();
