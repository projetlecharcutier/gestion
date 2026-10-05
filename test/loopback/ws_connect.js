// Connexion WebSocket loopback avec reessai : le serveur spawn met ~1-2 s
// a ecouter (generation de la carte), un "new WebSocket" unique a 1 s fixe
// echoue avec ECONNREFUSED. onReady recoit le socket CONNECTE ; tous les
// handlers (message/close) doivent y etre attaches.
var WebSocket = require("../../server/node_modules/ws");
module.exports = function connectWs(port, onReady, tries) {
  if (tries === undefined) tries = 100;
  var ws = new WebSocket("ws://127.0.0.1:" + port);
  ws.on("open", function () { onReady(ws); });
  ws.on("error", function (e) {
    if (e.code !== "ECONNREFUSED") return;
    try { ws.terminate(); } catch (err) {}
    if (tries <= 0) return;
    setTimeout(function () { connectWs(port, onReady, tries - 1); }, 100);
  });
  return ws;
};
