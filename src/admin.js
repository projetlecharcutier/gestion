// Panneau admin (menu d'accueil) : mot de passe vérifié CÔTÉ SERVEUR
// (/admin/auth), puis affichage des logs du serveur, de la version déployée
// et déclenchement d'un redémarrage + mise à jour git main.
(function () {
  "use strict";
  var G = window.GAME = window.GAME || {};

  // Le mot de passe est gardé EN MÉMOIRE uniquement (jamais localStorage) :
  // fermer l'onglet déconnecte l'admin.
  var adminPass = null;

  function el(id) { return document.getElementById(id); }

  function show(id, visible) {
    var e = el(id);
    if (e) e.hidden = !visible;
  }

  // Requête admin : le mot de passe part dans l'en-tête X-Admin-Password
  // (POST : pas tracé dans les logs d'URL comme un GET ?password=...).
  function adminFetch(path, opts) {
    opts = opts || {};
    opts.method = opts.method || "GET";
    opts.headers = Object.assign({}, opts.headers || {});
    if (adminPass !== null) opts.headers["X-Admin-Password"] = adminPass;
    return fetch(path, opts);
  }

  function openAdmin() {
    show("adminScreen", true);
    if (adminPass !== null) showLoggedIn();
  }

  function closeAdmin() {
    show("adminScreen", false);
  }

  function showLoggedIn() {
    show("adminLogin", false);
    show("adminPanel", true);
    refreshStatus();
    refreshLogs();
  }

  function fmtUptime(sec) {
    if (sec < 60) return sec + " s";
    if (sec < 3600) return Math.floor(sec / 60) + " min " + (sec % 60) + " s";
    return Math.floor(sec / 3600) + " h " + Math.floor((sec % 3600) / 60) + " min";
  }

  function refreshStatus() {
    adminFetch("/admin/status").then(function (r) {
      if (r.status === 401) { adminPass = null; showLoginAgain(); return; }
      return r.json();
    }).then(function (s) {
      if (!s) return;
      var txt = "Version : " + (s.version || "?") +
        " — " + (s.commitName || "?") +
        " | Déployée : " + (s.updatedAt || "?") +
        " | Uptime : " + fmtUptime(s.uptimeSec || 0) +
        " | Joueurs : " + (s.players !== undefined ? s.players : "?") +
        (s.started ? " | Partie en cours : jour " + s.day + ", " +
          Math.floor(s.clock) + "h" : " | En attente de partie");
      el("adminStatus").textContent = txt;
    }).catch(function () {
      el("adminStatus").textContent = "Serveur injoignable.";
    });
  }

  function refreshLogs() {
    adminFetch("/admin/logs").then(function (r) {
      if (r.status === 401) { adminPass = null; showLoginAgain(); return; }
      return r.json();
    }).then(function (data) {
      if (!data || !data.lines) return;
      // Les plus récentes en bas ; limite l'affichage aux 200 dernières.
      var lines = data.lines.slice(-200);
      el("adminLogs").textContent = lines.length ? lines.join("\n") : "(aucun log)";
      var pre = el("adminLogs");
      pre.scrollTop = pre.scrollHeight;
    }).catch(function () {
      el("adminLogs").textContent = "(serveur injoignable)";
    });
  }

  function showLoginAgain() {
    show("adminLogin", true);
    show("adminPanel", false);
    var err = el("adminError");
    if (err) { err.hidden = false; err.textContent = "Session admin expirée, reconnectez-vous."; }
  }

  function tryLogin() {
    var input = el("adminPassword");
    var pass = input ? input.value : "";
    if (!pass) return;
    fetch("/admin/auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: pass })
    }).then(function (r) {
      if (r.status === 401) {
        show("adminError", true);
        return null;
      }
      return r.json();
    }).then(function (data) {
      if (!data || !data.ok) return;
      adminPass = pass;
      if (input) input.value = "";
      show("adminError", false);
      showLoggedIn();
    }).catch(function () {
      var err = el("adminError");
      if (err) { err.hidden = false; err.textContent = "Serveur injoignable."; }
    });
  }

  function requestRestart() {
    if (!window.confirm("Redémarrer le serveur et mettre à jour git main ?\n" +
      "Tous les joueurs seront déconnectés et la partie repartira à zéro.")) return;
    adminFetch("/admin/restart", { method: "POST" }).then(function (r) {
      return r.json();
    }).then(function (data) {
      if (!data || !data.ok) return;
      show("adminRestartNote", true);
      // Le serveur va s'arrêter puis redémarrer (watcher). On surveille
      // /version.json : quand il répond avec un NOUVEAU bootId, le serveur
      // est de retour -> on recharge la page (partie à zéro, cache frais).
      var tries = 0;
      var timer = setInterval(function () {
        fetch("/version.json", { cache: "no-store" }).then(function (r) {
          if (!r.ok) throw new Error("down");
          return r.json();
        }).then(function (v) {
          if (v && v.bootId) {
            clearInterval(timer);
            window.location.reload();
          }
        }).catch(function () { /* serveur encore arrêté : on réessaie */ });
        tries++;
        if (tries > 300) clearInterval(timer); // ~5 min max
      }, 1000);
    }).catch(function () {
      var note = el("adminRestartNote");
      if (note) { note.hidden = false; note.textContent = "Serveur injoignable (redémarrage en cours ?)."; }
    });
  }

  // Branchement des boutons (le menu d'accueil existe dès le chargement).
  function bind() {
    var b = el("adminBtn");
    if (b) b.addEventListener("click", openAdmin);
    var back = el("adminBack");
    if (back) back.addEventListener("click", closeAdmin);
    var closeB = el("adminClose");
    if (closeB) closeB.addEventListener("click", closeAdmin);
    var loginB = el("adminLoginBtn");
    if (loginB) loginB.addEventListener("click", tryLogin);
    var pw = el("adminPassword");
    if (pw) pw.addEventListener("keydown", function (e) {
      if (e.key === "Enter") { e.preventDefault(); tryLogin(); }
    });
    var restartB = el("adminRestartBtn");
    if (restartB) restartB.addEventListener("click", requestRestart);
    var logsB = el("adminLogsRefresh");
    if (logsB) logsB.addEventListener("click", refreshLogs);
  }

  if (typeof document !== "undefined") {
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", bind);
    } else {
      bind();
    }
  }
})();
