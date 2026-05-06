const { config } = require("../config/config");

async function sendWhatsApp(text) {
  if (!config.WHATSAPP_ENABLED || !config.WHATSAPP_API_URL || !config.WHATSAPP_TOKEN || !config.WHATSAPP_TO) {
    return { delivered: false, reason: "WHATSAPP_NOT_CONFIGURED" };
  }

  const response = await fetch(config.WHATSAPP_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "authorization": `Bearer ${config.WHATSAPP_TOKEN}`
    },
    body: JSON.stringify({
      to: config.WHATSAPP_TO,
      text
    })
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error("WHATSAPP_SEND_FAILED");
  return { delivered: true, providerMessageId: data.id || data.message_id || "" };
}

module.exports = { sendWhatsApp };
