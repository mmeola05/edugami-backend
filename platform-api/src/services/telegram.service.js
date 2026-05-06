const { config } = require("../config/config");

async function sendTelegram(text) {
  if (!config.TELEGRAM_ENABLED || !config.TELEGRAM_BOT_TOKEN || !config.TELEGRAM_CHAT_ID) {
    return { delivered: false, reason: "TELEGRAM_NOT_CONFIGURED" };
  }

  const response = await fetch(`https://api.telegram.org/bot${config.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      chat_id: config.TELEGRAM_CHAT_ID,
      text
    })
  });

  const data = await response.json();
  if (!response.ok || !data.ok) throw new Error("TELEGRAM_SEND_FAILED");
  return { delivered: true, providerMessageId: String(data.result?.message_id || "") };
}

module.exports = { sendTelegram };
