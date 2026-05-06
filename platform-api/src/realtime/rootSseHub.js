const rootClients = new Set();

function subscribeRootClient(res) {
  rootClients.add(res);
}

function unsubscribeRootClient(res) {
  rootClients.delete(res);
}

function publishRootEvent(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of rootClients) {
    try {
      client.write(payload);
    } catch {}
  }
}

function countRootClients() {
  return rootClients.size;
}

module.exports = {
  subscribeRootClient,
  unsubscribeRootClient,
  publishRootEvent,
  countRootClients
};
