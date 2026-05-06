const clients = new Set();
function subscribe(res){ clients.add(res); }
function unsubscribe(res){ clients.delete(res); }
function publish(event, data){
  const msg = `event: ${event}
data: ${JSON.stringify(data)}

`;
  for (const c of clients) { try { c.write(msg); } catch {} }
}
function countClients(){ return clients.size; }
module.exports = { subscribe, unsubscribe, publish, countClients };
