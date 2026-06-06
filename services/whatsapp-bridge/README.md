# Jake WhatsApp Bridge

Bridge local para conectar WhatsApp ao backend do Jake.

## Rodar

```powershell
cd services\whatsapp-bridge
npm install
$env:JAKE_TOKEN="cole-um-token-jwt-do-login"
$env:JAKE_WHATSAPP_AUTHORIZED="5531999999999"
npm start
```

O terminal mostra o QR Code do WhatsApp. Depois de conectar, mensagens de numeros
autorizados sao enviadas para `POST /api/chat` e a resposta volta pelo WhatsApp.

Mantenha esse processo separado do backend principal para isolar risco de comandos remotos.
