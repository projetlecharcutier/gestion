// Historique du chat persistant + resumes de partie.
// Le contenu du chat NE DISPARAIT PAS au redemarrage / a la mise a jour :
// les messages sont appendus dans un fichier JSONL NON TRACKET par git
// (server/data/chat-log.jsonl). Le deploy (deploy/deploy.sh) fait un
// `git reset --hard` SANS `git clean` : les fichiers non trackes survivent
// donc aux mises a jour. 30 derniers messages renvoyes a chaque connexion
// (message "chatHistory").
(function () {
  "use strict";
  var fs = require("fs");
  var path = require("path");

  var DATA_DIR = path.join(__dirname, "data");
  var LOG_FILE = path.join(DATA_DIR, "chat-log.jsonl");

  var HISTORY_MAX = 30;   // messages gardes en memoire + renvoyes au join
  var FILE_MAX = 500;     // lignes gardees sur disque (rotation du fichier)

  var history = []; // [{from, text, at}]

  // Limite de message : 50 caracteres pour un joueur (200 pour le Serveur,
  // qui ecrit les resumes de partie).
  function limit(from) { return from === "Serveur" ? 200 : 50; }

  function load() {
    try {
      var lines = fs.readFileSync(LOG_FILE, "utf8").split("\n");
      var out = [];
      for (var i = 0; i < lines.length; i++) {
        var t = lines[i].trim();
        if (!t) continue;
        try {
          var m = JSON.parse(t);
          if (m && m.from && m.text) {
            out.push({ from: String(m.from).slice(0, 24), text: String(m.text).slice(0, limit(m.from)), at: m.at || 0 });
          }
        } catch (e) { /* ligne corrompue : ignoree */ }
      }
      history = out.slice(-HISTORY_MAX);
    } catch (e) {
      history = [];
    }
  }

  function persist(msg) {
    try {
      if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.appendFileSync(LOG_FILE, JSON.stringify(msg) + "\n");
      // Rotation : garde seulement les FILE_MAX dernieres lignes. Rare et
      // synchrone volontaire (fiabilite > latence ici, le chat est rare).
      var st;
      try { st = fs.statSync(LOG_FILE); } catch (e2) { return; }
      if (st.size > 256 * 1024) {
        var lines = fs.readFileSync(LOG_FILE, "utf8").split("\n").filter(Boolean);
        fs.writeFileSync(LOG_FILE, lines.slice(-FILE_MAX).join("\n") + "\n");
      }
    } catch (e) { /* disque en lecture seule / permissions : le chat reste en memoire */ }
  }

  // Enregistre un message (joueur ou Serveur) : memoire + disque.
  function push(from, text) {
    var f = String(from || "?").slice(0, 24);
    var msg = { from: f, text: String(text || "").slice(0, limit(f)), at: Date.now() };
    history.push(msg);
    if (history.length > HISTORY_MAX) history.shift();
    persist(msg);
    return msg;
  }

  // Les 30 derniers messages (pour le client qui vient d'arriver).
  function last() {
    return history.slice();
  }

  // Ligne d'annonce de deces d'un joueur (diffusee par index.js).
  function deathLine(p, day) {
    var st = p.stats || {};
    return "\uD83D\uDC80 " + p.name + " est mort au jour " + day +
      " \u2014 " + (st.kills || 0) + " zombie(s) tu\u00e9(s), " +
      (st.built || 0) + " construction(s), " + (st.gold || 0) + " or \uD83E\uDEA6";
  }

  // Resume de fin de partie : qui a joue et quand, destinee de chaque
  // joueur, bilan global et des stats marantes (meilleur tueur,
  // precision de la ville). Renvoie les lignes ; index.js les diffuse.
  function gameSummaryLines(st) {
    var gs = st.globalStats || {};
    var d = new Date();
    function p2(n) { return (n < 10 ? "0" : "") + n; }
    var when = p2(d.getDate()) + "/" + p2(d.getMonth() + 1) + " " + p2(d.getHours()) + ":" + p2(d.getMinutes());
    var cause = st.gameOverCause === "mairie"
      ? "\uD83C\uDFDB\uFE0F La mairie est tomb\u00e9e"
      : "\uD83D\uDC80 Plus aucun survivant";
    var out = [cause + " ! La ville a tenu " + st.day +
      " jour(s). Partie du " + when + " \u2014 " + st.players.length + " joueur(s)"];
    var totalKills = 0, totalBuilt = 0, totalGold = 0, totalShots = 0;
    var best = null;
    for (var i = 0; i < st.players.length; i++) {
      var p = st.players[i];
      var s = p.stats || {};
      totalKills += s.kills || 0;
      totalBuilt += s.built || 0;
      totalGold += s.gold || 0;
      totalShots += s.shots || 0;
      if (!best || (s.kills || 0) > (best.stats.kills || 0)) best = { name: p.name, stats: s };
      var fate = p.alive ? "a surv\u00e9cu \uD83C\uDF89" : "est mort \uD83D\uDC80";
      out.push("\uD83C\uDFAE " + p.name + " " + fate + " \u2014 " +
        (s.kills || 0) + " zombie(s), " + (s.built || 0) + " construction(s), " +
        (s.gold || 0) + " or, " + (s.shots || 0) + " tir(s)");
    }
    out.push("\uD83D\uDCCA Bilan : " + totalKills + " zombie(s) tu\u00e9s par les joueurs, " +
      (gs.towerKills || 0) + " par les tours, " + totalBuilt + " construction(s), " +
      totalGold + " or r\u00e9colt\u00e9(s)");
    if (best && (best.stats.kills || 0) > 0) {
      out.push("\uD83C\uDFC6 Meilleur tueur : " + best.name +
        " (" + best.stats.kills + " zombie(s)) \uD83E\uDD13");
    }
    if (totalShots > 0) {
      var pct = Math.round(100 * totalKills / totalShots);
      out.push("\uD83C\uDFAF Pr\u00e9cision de la ville : " + pct +
        "% (" + totalKills + " zombies pour " + totalShots + " tirs) \uD83D\uDE05");
    }
    return out;
  }

  load();

  module.exports = {
    push: push, last: last, HISTORY_MAX: HISTORY_MAX,
    deathLine: deathLine, gameSummaryLines: gameSummaryLines
  };
})();
