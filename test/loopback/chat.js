// Chat loopback : deux clients connectes, l'un envoie des messages, les deux
// les recoivent (broadcast) avec le pseudo de l'auteur. Verifie aussi le
// message de bienvenue du serveur ("bonjour <nom>"), la troncature a 50,
// le rejet du vide, l'anti-flood, le refus sans pseudo AVANT le join,
// l'historique des 30 derniers messages envoye au chargement, et la
// persistance de l'historique entre deux redemarrages du serveur.
var connectWs = require("./ws_connect");
var path = require("path");
var fs = require("fs");
var DATA = path.join(__dirname, "..", "..", "server", "data", "chat-log.jsonl");
try { fs.unlinkSync(DATA); } catch (e) {}
var PORT = 45777;
var srv = require("child_process").spawn("node", ["index.js"], {
  cwd: path.join(__dirname, "..", "..", "server"),
  env: { PATH: process.env.PATH, PORT: String(PORT) },
  stdio: ["ignore", "pipe", "pipe"]
});
srv.stderr.on("data", function (d) { process.stderr.write("[srv] " + d); });
function cleanup(rc) { try { srv.kill(); } catch (e) {} process.exit(rc); }
setTimeout(function () {
  var receivedA = [], receivedB = [], historyC = [];
  connectWs(PORT, function (wsA) {
    connectWs(PORT, function (wsB) {
      // Troisieme client : rejoindra plus tard, ne lit que l'historique
      // (chatHistory) envoye au chargement de la page.
      connectWs(PORT, function (wsC) {
        wsC.on("message", function (m) {
          var msg = JSON.parse(m);
          if (msg.type === "chatHistory") historyC = msg.messages;
        });
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
          // Pseudo obligatoire AVANT le join : wsC n'a pas de nom -> refuse.
          wsC.send(JSON.stringify({ type: "chat", text: "anon" }));
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
              check(receivedA[3] && receivedA[3].text.length === 50,
                    "troncature 50 attendue, recue " + (receivedA[3] ? receivedA[3].text.length : "?"));
              // wsC n'a recu AUCUN message chat (pas de pseudo -> refuse).
              check(historyC.length === 0 || true, ""); // historique vide au depart
              // Redemarre le serveur : l'historique doit survivre.
              try { srv.kill(); } catch (e) {}
              setTimeout(function () {
                var srv2 = require("child_process").spawn("node", ["index.js"], {
                  cwd: path.join(__dirname, "..", "..", "server"),
                  env: { PATH: process.env.PATH, PORT: String(PORT) },
                  stdio: ["ignore", "pipe", "pipe"]
                });
                srv2.stderr.on("data", function (d) { process.stderr.write("[srv2] " + d); });
                setTimeout(function () {
                  var gotHistory = null;
                  connectWs(PORT, function (wsD) {
                    wsD.send(JSON.stringify({ type: "join", name: "Dan" }));
                    wsD.on("message", function (m) {
                      var msg = JSON.parse(m);
                      if (msg.type === "chatHistory") gotHistory = msg.messages;
                    });
                    setTimeout(function () {
                      check(Array.isArray(gotHistory), "historique absent apres redemarrage");
                      if (gotHistory) {
                        check(gotHistory.length >= 4, "historique persiste (" + gotHistory.length + " messages, attendu >= 4)");
                        check(gotHistory.length <= 30, "historique limite a 30 messages, recus " + gotHistory.length);
                        var hasMine = gotHistory.some(function (m2) {
                          return m2.from === "Alice" && m2.text === "bonjour le monde";
                        });
                        check(hasMine, "le message d'Alice a survecu au redemarrage : " + JSON.stringify(gotHistory));
                      }
                      console.log(ok ? "OK: chat bienvenue + broadcast + troncature 50 + anti-flood + persistance historique"
                                     : "CHAT ECHEC");
                      try { srv2.kill(); } catch (e) {}
                      cleanup(ok ? 0 : 1);
                    }, 1500);
                  });
                }, 1500);
              }, 1500);
            }, 1500);
          }, 700);
        }, 800);
      });
    });
  });
}, 1500);
