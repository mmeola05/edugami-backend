const realtime = require("../realtime");
const metrics = require("../services/metrics.service");

async function stream(req, res, next) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    "Connection": "keep-alive"
  });

  res.write(`event: hello\ndata: ${JSON.stringify({ connected: true, scope: "root" })}\n\n`);
  realtime.subscribeRootClient(res);

  const timer = setInterval(async () => {
    try {
      const payload = await metrics.overview();
      res.write(`event: metrics\ndata: ${JSON.stringify(payload)}\n\n`);
    } catch {}
  }, 5000);

  req.on("close", () => {
    clearInterval(timer);
    realtime.unsubscribeRootClient(res);
  });
}

async function status(req, res) {
  res.json({
    ok: true,
    data: {
      connectedRootClients: realtime.countRootClients()
    }
  });
}

module.exports = { stream, status };
