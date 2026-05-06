const nodemailer = require("nodemailer");
const { config } = require("../config/config");
const { weeklyDigestTemplate } = require("../utils/emailTemplates.util");

function transporter() {
  if (!config.SMTP_HOST) return null;
  return nodemailer.createTransport({
    host: config.SMTP_HOST,
    port: config.SMTP_PORT,
    secure: config.SMTP_SECURE,
    auth: config.SMTP_USER ? { user: config.SMTP_USER, pass: config.SMTP_PASS } : undefined
  });
}

async function sendEmail(to, subject, html) {
  const t = transporter();
  if (!t) return { delivered: false, reason: "SMTP_NOT_CONFIGURED" };
  const info = await t.sendMail({
    from: config.ALERT_EMAIL_FROM,
    to,
    subject,
    html
  });
  return { delivered: true, providerMessageId: info.messageId };
}

async function sendWeeklyDigest(to, studentName, stats) {
  return sendEmail(
    to,
    `Resumen semanal de ${studentName}`,
    weeklyDigestTemplate(studentName, stats)
  );
}

module.exports = { sendEmail, sendWeeklyDigest };
