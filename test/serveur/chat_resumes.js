// Resumes de partie dans le chat : annonces de deces (avec stats du defunt)
// et resume de fin de partie (qui a joue, bilan, meilleur tueur, precision).
// Test unitaire de chat-store.js (lignes construites) + verification que
// les lignes passent la limite Serveur de 200 caracteres.
var path = require("path");
var store = require(path.join(__dirname, "..", "..", "server", "chat-store"));
var fails = 0;
function check(cond, m) { if (!cond) { fails++; console.log("FAIL: " + m); } }

// Ligne de deces : pseudo, jour, kills, constructions, or.
var p1 = { name: "José", alive: false, stats: { kills: 100, built: 12, gold: 250, shots: 300, planks: 40 } };
var dl = store.deathLine(p1, 3);
check(dl.indexOf("José") >= 0, "ligne de deces contient le nom : " + dl);
check(dl.indexOf("3") >= 0, "ligne de deces contient le jour : " + dl);
check(dl.indexOf("100") >= 0, "ligne de deces contient les kills : " + dl);
check(dl.indexOf("12") >= 0, "ligne de deces contient les constructions : " + dl);
check(dl.length <= 200, "ligne de deces <= 200 car : " + dl.length);

// Resume de fin de partie : mairie tombee, destinees, bilan, meilleur
// tueur, precision.
var st = {
  day: 5,
  gameOverCause: "mairie",
  players: [
    { name: "Alice", alive: true, stats: { kills: 30, built: 4, gold: 100, shots: 60 } },
    { name: "Bob", alive: false, stats: { kills: 10, built: 9, gold: 50, shots: 40 } }
  ],
  globalStats: { towerKills: 7, playerKills: 40 }
};
var lines = store.gameSummaryLines(st);
var joined = lines.join("\n");
check(lines.length >= 5, "au moins 5 lignes de resume, recues " + lines.length);
check(joined.indexOf("mairie") >= 0, "resume mentionne la mairie : " + lines[0]);
check(joined.indexOf("5 jour(s)") >= 0, "resume mentionne la duree : " + joined);
check(joined.indexOf("Partie du ") >= 0, "resume date la partie");
check(joined.indexOf("Alice a survécu") >= 0, "destinee d'Alice : " + joined);
check(joined.indexOf("Bob est mort") >= 0, "destinee de Bob : " + joined);
check(joined.indexOf("40 zombie") >= 0, "bilan kills joueurs : " + joined);
check(joined.indexOf("7 par les tours") >= 0, "bilan kills tours : " + joined);
check(joined.indexOf("Meilleur tueur : Alice") >= 0, "meilleur tueur : " + joined);
check(joined.indexOf("Précision de la ville : 40%") >= 0, "precision : " + joined);
for (var i = 0; i < lines.length; i++) {
  check(lines[i].length <= 200, "ligne " + i + " <= 200 car (" + lines[i].length + ")");
}

// Cause "player" (plus aucun survivant) : la mairie n'est pas mentionnee.
var st2 = { day: 2, gameOverCause: "player", players: [], globalStats: {} };
var lines2 = store.gameSummaryLines(st2);
check(lines2[0].indexOf("survivant") >= 0, "cause player : " + lines2[0]);

// Persistance : push puis relecture (nouvelle instance du module).
// Le cache require garde la PREMIERE instance (historique du test loopback
// precedent) : on vide le cache pour forcer une relecture du disque, apres
// avoir pose un message sur un fichier VIERGE.
var DATA = path.join(__dirname, "..", "..", "server", "data", "chat-log.jsonl");
try { require("fs").unlinkSync(DATA); } catch (e) {}
var fresh = require(path.join(__dirname, "..", "..", "server", "chat-store"));
fresh.push("Testeur", "message persiste");
delete require.cache[require.resolve(path.join(__dirname, "..", "..", "server", "chat-store"))];
fresh = require(path.join(__dirname, "..", "..", "server", "chat-store"));
var last = fresh.last();
check(last.length === 1, "1 message relu depuis le disque, recus " + last.length);
check(last[0] && last[0].from === "Testeur" && last[0].text === "message persiste",
  "message relu tel quel : " + JSON.stringify(last[0]));
// Limite joueur : 50 caracteres.
fresh.push("Joueur", new Array(200).join("x"));
var last2 = fresh.last();
check(last2[last2.length - 1].text.length === 50,
  "message joueur tronque a 50, recu " + last2[last2.length - 1].text.length);

console.log(fails === 0 ? "OK: resumes deces + fin de partie + persistance chat-store"
                       : "RESUMES CHAT ECHEC (" + fails + ")");
process.exit(fails === 0 ? 0 : 1);
