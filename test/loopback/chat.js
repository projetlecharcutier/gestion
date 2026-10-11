// Chat loopback : deux clients connectes, l'un envoie des messages, les deux
// les recoivent (broadcast) avec le nom de l'auteur. Verifie aussi le message
// de bienvenue du serveur ("bonjour <nom>"), la troncature a 120, le rejet du
// vide et l'anti-flood (envoi trop rapproche).
var connectWs = require("./ws_connect");
var PORT = 45777;
var srv = require("child_process").spawn("node", ["index.js"], {
  cwd: require("path").join(__dirname, "..", "..", "server"),
  env: { PATH: process.env.PATH, PORT: String(PORT) },
  stdio: ["ignore", "pipe", "pipe"]
});
srv.stderr.on("data", function (d) { process.stderr.write("[srv] " + d); });
function cleanup(rc) { try { srv.kill(); } catch (e) {} process.exit(rc); }

setTimeout(function () {
  var receivedA = [], receivedB = [];
  connectWs(PORT, function (wsA) {
    connectWs(PORT, function (wsB) {
      wsA.send(JSON.stringify({ type: "join", name: "Alice" }));
      wsB.send(JSON.stringify({ type: "join", name: "Bob" }));
      wsA.on("message", function (m) {
        var msg = JSON.parse(m);
        if (msg.type === "chat") receivedA.push(msg);
      });
      wsB.on("message", function (m) {
        var msg = JSON.parse(m);
        if (msg.type === "chat") receivedB.push(msg);
      });
      // Laisse le serveur traiter les joins (noms + messages de bienvenue).
      setTimeout(function () {
        wsA.send(JSON.stringify({ type: "chat", text: "  bonjour le monde  " }));
        wsA.send(JSON.stringify({ type: "chat", text: "spam" }));   // anti-flood : jete
        wsA.send(JSON.stringify({ type: "chat", text: "   " }));   // vide : rejete
        // Attend la fenetre anti-flood (500 ms) pour le message suivant.
        setTimeout(function () {
          wsA.send(JSON.stringify({ type: "chat", text: new Array(200).join("x") }));
          setTimeout(function () {
            var ok = true;
            function check(cond, m) { if (!cond) { ok = false; console.log("FAIL: " + m); } }
            // Messages attendus : bonjour Alice, bonjour Bob (bienvenue serveur,
            // dans l'ordre des joins) puis le message d'Alice et le message
            // tronque (le "spam" anti-flood et le message vide sont jetes).
            check(receivedA.length === 4, "Alice attendait 4 messages, recus " + receivedA.length +
                  " : " + JSON.stringify(receivedA));
            check(receivedB.length === 4, "Bob attendait 4 messages, recus " + receivedB.length);
            check(receivedA[0] && receivedA[0].from === "Serveur" &&
                  receivedA[0].text === "bonjour Alice",
                  "bienvenue 1 attendue (Serveur/bonjour Alice), recue " + JSON.stringify(receivedA[0]));
            check(receivedA[1] && receivedA[1].from === "Serveur" &&
                  receivedA[1].text === "bonjour Bob",
                  "bienvenue 2 attendue (Serveur/bonjour Bob), recue " + JSON.stringify(receivedA[1]));
            check(receivedA[2] && receivedA[2].from === "Alice" &&
                  receivedA[2].text === "bonjour le monde",
                  "message 1 mal valide : " + JSON.stringify(receivedA[2]));
            check(receivedA[3] && receivedA[3].text.length === 120,
                  "troncature 120 attendue, recue " + (receivedA[3] ? receivedA[3].text.length : "?"));
            console.log(ok ? "OK: chat bienvenue serveur + broadcast + troncature + anti-flood"
                          : "CHAT ECHEC");
            cleanup(ok ? 0 : 1);
          }, 1500);
        }, 700);
      }, 800);
    });
  });
}, 1500);
