const BRAND = {
  navy: "#0F172A",
  ink: "#111827",
  muted: "#64748B",
  border: "#E2E8F0",
  surface: "#F8FAFC",
  panel: "#FFFFFF",
  primary: "#2563EB",
  primarySoft: "#EFF6FF",
  success: "#059669",
  warning: "#D97706",
  danger: "#DC2626",
  dangerSoft: "#FEF2F2",
  codeBg: "#0B1220",
  codeText: "#C7D2FE",
};

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeJson(value) {
  try {
    return JSON.stringify(value || {}, null, 2);
  } catch {
    return "{}";
  }
}

function detailRows(rows) {
  return rows
    .filter((row) => row.value !== undefined && row.value !== null && row.value !== "")
    .map(
      (row) => `
        <tr>
          <td style="padding:12px 0;border-bottom:1px solid ${BRAND.border};color:${BRAND.muted};font-size:12px;text-transform:uppercase;letter-spacing:.04em;">${escapeHtml(row.label)}</td>
          <td style="padding:12px 0;border-bottom:1px solid ${BRAND.border};color:${BRAND.ink};font-size:13px;font-weight:700;text-align:right;">${escapeHtml(row.value)}</td>
        </tr>
      `,
    )
    .join("");
}

function statCard(label, value, color = BRAND.primary) {
  return `
    <td style="width:33.33%;padding:0 6px;">
      <div style="background:${BRAND.surface};border:1px solid ${BRAND.border};border-radius:14px;padding:14px 12px;text-align:left;">
        <div style="color:${BRAND.muted};font-size:10px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;">${escapeHtml(label)}</div>
        <div style="color:${color};font-size:20px;font-weight:850;line-height:1.2;margin-top:6px;word-break:break-word;">${escapeHtml(value)}</div>
      </div>
    </td>
  `;
}

function compactCard(title, body, tone = "default") {
  const color = tone === "danger" ? BRAND.danger : tone === "warning" ? BRAND.warning : BRAND.primary;
  const bg = tone === "danger" ? BRAND.dangerSoft : tone === "warning" ? "#FFFBEB" : BRAND.primarySoft;
  return `
    <div style="background:${bg};border:1px solid ${color};border-radius:16px;padding:16px;">
      <div style="color:${color};font-size:12px;font-weight:900;letter-spacing:.07em;text-transform:uppercase;">${escapeHtml(title)}</div>
      <div style="color:${BRAND.ink};font-size:14px;line-height:1.55;margin-top:8px;">${body}</div>
    </div>
  `;
}

function codeBlock(value, tone = "default") {
  const color = tone === "danger" ? "#FDA4AF" : BRAND.codeText;
  return `
    <div style="background:${BRAND.codeBg};border:1px solid #1E293B;border-radius:14px;color:${color};font-family:Consolas,Monaco,'Courier New',monospace;font-size:10px;line-height:1.45;margin-top:10px;max-height:220px;overflow:auto;padding:14px;white-space:pre-wrap;word-break:break-word;">${escapeHtml(value)}</div>
  `;
}

function getBaseLayout(title, content, options = {}) {
  const {
    eyebrow = "EDUGAMI PLATFORM",
    subtitle = "Operacion y aprendizaje conectados",
    tone = "default",
    ctaLabel = null,
    ctaUrl = null,
    hideFooter = false,
  } = options;
  const accent = tone === "danger" ? BRAND.danger : tone === "warning" ? BRAND.warning : BRAND.primary;
  const accentSoft = tone === "danger" ? BRAND.dangerSoft : tone === "warning" ? "#FFFBEB" : BRAND.primarySoft;

  return `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>${escapeHtml(title)}</title>
</head>
<body style="margin:0;padding:0;background:${BRAND.surface};font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;color:${BRAND.ink};">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background:${BRAND.surface};padding:20px 12px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="width:100%;">
          <tr>
            <td style="padding:0 0 14px 0;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <div style="display:inline-block;background:${BRAND.navy};border-radius:14px;color:#FFFFFF;font-size:17px;font-weight:800;line-height:44px;text-align:center;width:44px;">E</div>
                    <span style="color:${BRAND.navy};font-size:18px;font-weight:800;margin-left:10px;vertical-align:middle;">EduGami AI</span>
                  </td>
                  <td align="right" style="vertical-align:middle;">
                    <span style="background:${accentSoft};border:1px solid ${accent};border-radius:999px;color:${accent};display:inline-block;font-size:11px;font-weight:800;letter-spacing:.06em;padding:7px 10px;text-transform:uppercase;">${escapeHtml(eyebrow)}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="background:${BRAND.panel};border:1px solid ${BRAND.border};border-radius:22px;box-shadow:0 18px 45px rgba(15,23,42,.08);overflow:hidden;">
              <div style="background:${BRAND.navy};padding:24px 30px;">
                <div style="color:#CBD5E1;font-size:12px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;">${escapeHtml(subtitle)}</div>
                <h1 style="color:#FFFFFF;font-size:26px;font-weight:800;line-height:1.15;margin:8px 0 0;">${escapeHtml(title)}</h1>
              </div>
              <div style="padding:28px 30px 30px;">
                ${content}
                ${
                  ctaLabel && ctaUrl
                    ? `<div style="margin-top:22px;text-align:center;"><a href="${escapeHtml(ctaUrl)}" style="background:${accent};border-radius:12px;color:#FFFFFF;display:inline-block;font-size:14px;font-weight:800;padding:13px 22px;text-decoration:none;">${escapeHtml(ctaLabel)}</a></div>`
                    : ""
                }
              </div>
            </td>
          </tr>
          ${
            hideFooter
              ? ""
              : `<tr>
                  <td style="color:${BRAND.muted};font-size:12px;line-height:1.6;padding:18px 8px;text-align:center;">
                    Enviado por EduGami AI. Este mensaje forma parte de las comunicaciones operativas de la plataforma.<br>
                    ${new Date().getFullYear()} EduGami AI
                  </td>
                </tr>`
          }
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

function magicLinkTemplate(studentName, link) {
  const content = `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr>
        <td style="width:58%;padding-right:12px;vertical-align:top;">
          <p style="color:${BRAND.muted};font-size:15px;line-height:1.65;margin:0;">
            Has sido invitado a EduGami para seguir el progreso educativo de <strong style="color:${BRAND.ink};">${escapeHtml(studentName)}</strong>.
          </p>
          <p style="color:${BRAND.ink};font-size:15px;line-height:1.6;margin:14px 0 0;">
            Tu acceso ya esta preparado. Entra al panel para ver actividad, progreso y comunicaciones importantes.
          </p>
        </td>
        <td style="width:42%;padding-left:12px;vertical-align:top;">
          ${compactCard("Acceso preparado", "Cuenta lista para entrar de forma segura.", "default")}
        </td>
      </tr>
    </table>
    <div style="background:${BRAND.surface};border:1px solid ${BRAND.border};border-radius:14px;margin-top:20px;padding:13px 15px;">
      <div style="color:${BRAND.muted};font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;">Enlace directo</div>
      <a href="${escapeHtml(link)}" style="color:${BRAND.primary};font-size:12px;word-break:break-all;">${escapeHtml(link)}</a>
    </div>
  `;
  return getBaseLayout(`Invitacion para ${studentName}`, content, {
    eyebrow: "INVITACION",
    subtitle: "Acceso familiar EduGami",
    ctaLabel: "Acceder al panel",
    ctaUrl: link,
  });
}

function weeklyDigestTemplate(studentName, stats) {
  const content = `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr>
        <td style="width:50%;padding-right:12px;vertical-align:top;">
          <p style="color:${BRAND.muted};font-size:15px;line-height:1.65;margin:0;">
            Resumen semanal de actividad y progreso de <strong style="color:${BRAND.ink};">${escapeHtml(studentName)}</strong>.
          </p>
        </td>
        <td style="width:50%;padding-left:12px;vertical-align:top;">
          ${compactCard("Lectura rapida", "La constancia es la senal mas importante: usa el detalle para reforzar y celebrar avances.", "default")}
        </td>
      </tr>
    </table>
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin:20px 0 0;">
      <tr>
        ${statCard("Actividades", stats.completed ?? 0, BRAND.primary)}
        ${statCard("Mejor nota", `${stats.bestScore ?? 0}%`, BRAND.success)}
        ${statCard("Tiempo", `${stats.timeMinutes ?? 0}m`, BRAND.warning)}
      </tr>
    </table>
  `;
  return getBaseLayout(`Resumen semanal de ${studentName}`, content, {
    eyebrow: "PROGRESO",
    subtitle: "Informe semanal EduGami",
    ctaLabel: "Ver informe completo",
    ctaUrl: process.env.FRONTEND_URL || process.env.FRONTEND_ROOT_URL || "#",
  });
}

function recoveryTemplate(link) {
  const content = `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
      <tr>
        <td style="width:58%;padding-right:12px;vertical-align:top;">
          <p style="color:${BRAND.muted};font-size:15px;line-height:1.65;margin:0;">
            Hemos recibido una solicitud para restablecer la contrasena de tu cuenta ROOT.
          </p>
          <p style="color:${BRAND.ink};font-size:15px;line-height:1.6;margin:14px 0 0;">
            Usa el boton para elegir una nueva contrasena. El enlace es temporal por seguridad.
          </p>
        </td>
        <td style="width:42%;padding-left:12px;vertical-align:top;">
          ${compactCard("Seguridad", "Si no solicitaste este cambio, ignora el correo. No se aplicara ningun cambio.", "warning")}
        </td>
      </tr>
    </table>
    <div style="background:${BRAND.surface};border:1px solid ${BRAND.border};border-radius:14px;margin-top:20px;padding:13px 15px;">
      <div style="color:${BRAND.muted};font-size:11px;font-weight:800;letter-spacing:.06em;text-transform:uppercase;">Enlace directo</div>
      <a href="${escapeHtml(link)}" style="color:${BRAND.primary};font-size:12px;word-break:break-all;">${escapeHtml(link)}</a>
    </div>
  `;
  return getBaseLayout("Restablecer contrasena", content, {
    eyebrow: "SEGURIDAD",
    subtitle: "Recuperacion de acceso",
    ctaLabel: "Cambiar contrasena",
    ctaUrl: link,
  });
}

function alertTemplate(error, context = {}, timestamp = new Date().toISOString()) {
  let title;
  let message;
  let isTechnical = false;

  if (typeof error === "string") {
    title = error;
    message = context;
    context = {};
  } else {
    title = error.name || "Error del sistema";
    message = error.message || "Se ha producido una excepcion no controlada.";
    isTechnical = true;
  }

  const stackTrace = error && error.stack ? error.stack : "No stack trace available.";
  const contextJson = safeJson(context);
  const moduleName = context.module || context.dependency || "platform-api";
  const env = process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "local";

  const content = `
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom:18px;">
      <tr>
        <td style="width:58%;padding-right:12px;vertical-align:top;">
          <div style="background:${BRAND.dangerSoft};border:1px solid #FECACA;border-radius:18px;padding:18px;">
          <div style="color:${BRAND.danger};font-size:12px;font-weight:900;letter-spacing:.08em;text-transform:uppercase;">Incidente critico</div>
            <div style="color:${BRAND.ink};font-size:20px;font-weight:850;line-height:1.25;margin-top:8px;">${escapeHtml(message)}</div>
            <div style="color:${BRAND.muted};font-size:13px;line-height:1.55;margin-top:10px;">
            ${isTechnical ? "El backend no ha podido completar una operacion critica y requiere intervencion." : "Se ha generado una alerta operativa en la plataforma."}
            </div>
          </div>
        </td>
        <td style="width:42%;padding-left:12px;vertical-align:top;">
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr><td style="padding-bottom:10px;">${compactCard("Entorno", escapeHtml(env), "danger")}</td></tr>
            <tr><td style="padding-bottom:10px;">${compactCard("Modulo", escapeHtml(moduleName), "default")}</td></tr>
            <tr><td>${compactCard("Hora UTC", escapeHtml(timestamp.slice(11, 19)), "warning")}</td></tr>
          </table>
        </td>
      </tr>
    </table>

    ${
      isTechnical
        ? `
          <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
            <tr>
              <td style="width:42%;padding-right:12px;vertical-align:top;">
                <div style="color:${BRAND.ink};font-size:14px;font-weight:850;margin-bottom:4px;">Detalles</div>
                <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse:collapse;">
                  ${detailRows([
                    { label: "Timestamp", value: timestamp },
                    { label: "Tipo", value: title },
                    { label: "Dependencia", value: context.dependency },
                    { label: "Base de datos", value: context.dbName },
                    { label: "Host DB", value: context.dbHost && context.dbPort ? `${context.dbHost}:${context.dbPort}` : context.dbHost },
                  ])}
                </table>
              </td>
              <td style="width:58%;padding-left:12px;vertical-align:top;">
                <div style="color:${BRAND.ink};font-size:14px;font-weight:850;">Contexto tecnico</div>
                ${codeBlock(contextJson)}
              </td>
            </tr>
          </table>
          <div style="margin-top:18px;">
            <div style="color:${BRAND.ink};font-size:14px;font-weight:850;">Stack trace</div>
            ${codeBlock(stackTrace, "danger")}
          </div>
        `
        : `<p style="color:${BRAND.muted};font-size:15px;line-height:1.7;margin-top:20px;">Revisa el panel ROOT para ver el historial y ejecutar acciones correctivas.</p>`
    }
  `;

  return getBaseLayout("Alerta critica de plataforma", content, {
    eyebrow: "CRITICAL",
    subtitle: "Monitorizacion EduGami",
    tone: "danger",
    ctaLabel: "Abrir panel ROOT",
    ctaUrl: process.env.FRONTEND_ROOT_URL || "#",
  });
}

module.exports = {
  magicLinkTemplate,
  weeklyDigestTemplate,
  recoveryTemplate,
  alertTemplate,
};
