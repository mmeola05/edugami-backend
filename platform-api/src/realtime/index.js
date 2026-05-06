const { subscribeRootClient, unsubscribeRootClient, publishRootEvent, countRootClients } = require("./rootSseHub");
const { userChannelKey, sessionChannelKey, classChannelKey } = require("./channelKeys");

/**
 * Punto único de entrada del tiempo real.
 *
 * Hoy:
 * - ROOT usa SSE
 *
 * Mañana:
 * - usuarios / sesiones / clases podrán usar WebSocket
 */
module.exports = {
  subscribeRootClient,
  unsubscribeRootClient,
  publishRootEvent,
  countRootClients,
  userChannelKey,
  sessionChannelKey,
  classChannelKey
};
