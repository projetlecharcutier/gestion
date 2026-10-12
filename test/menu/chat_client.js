// Simulation client du chat : charge l'ordre de scripts reel d'index.html,
// simule le DOM (chat inclus), la connexion WS au serveur loopback, le join,
// puis verifie : message de bienvenue affiche, panneau non cache, Entree
// ouvre la saisie, Entree envoie, le message revient diffuse a l'auteur.
// Regression du bug historique : un commentaire `//` colle au debut d'une
// longue ligne rendait TOUT src/chat.js inactif (module commente) sans
// erreur syntaxique visible.
var fs = require("fs"), path = require("path");
var ROOT = path.join(__dirname, "..", "..");
var connectWs = require(path.join(ROOT, "test", "loopback", "ws_connect"));
var PORT = 45779;
var srv = require("child_process").spawn("node", ["index.js"], {
  cwd: path.join(ROOT, "server"),
  env: { PATH: process.env.PATH, PORT: String(PORT) },
  stdio: ["ignore", "pipe", "pipe"]
});
srv.stderr.on("data", function (d) { process.stderr.write("[srv] " + d); });
function cleanup(rc) { try { srv.kill(); } catch (e) {} process.exit(rc); }

// ---- Stub DOM minimal mais fidele pour le flux chat/join ----
var elements = {};
function el(id) {
  if (elements[id]) return elements[id];
  elements[id] = {
    id: id, hidden: false, style: {}, value: "", textContent: "",
    children: [], firstChild: null,
    addEventListener: function (ev, fn) { (this._ev = this._ev || {})[ev] = fn; },
    appendChild: function (c) { this.children.push(c); this.firstChild = this.children[0]; return c; },
    removeChild: function (c) {
      var i = this.children.indexOf(c);
      if (i >= 0) this.children.splice(i, 1);
      this.firstChild = this.children[0] || null;
      return c;
    },
    focus: function () { this.focused = true; },
    blur: function () { this.focused = false; },
    scrollTop: 0, scrollHeight: 0,
    getContext: function () {
      return {
        fillStyle: "", strokeStyle: "", lineWidth: 1, font: "",
        globalAlpha: 1, imageSmoothingEnabled: false, textAlign: "", textBaseline: "",
        fillRect: function () {}, strokeRect: function () {}, clearRect: function () {},
        beginPath: function () {}, closePath: function () {}, moveTo: function () {},
        lineTo: function () {}, arc: function () {}, ellipse: function () {},
        fill: function () {}, stroke: function () {}, save: function () {}, restore: function () {},
        translate: function () {}, rotate: function () {}, scale: function () {}, setTransform: function () {},
        drawImage: function () {}, fillText: function () {}, strokeText: function () {},
        measureText: function () { return { width: 10 }; },
        getImageData: function () { return { data: new Uint8ClampedArray(4) }; },
        putImageData: function () {},
        createImageData: function () { return { data: new Uint8ClampedArray(4), width: 1, height: 1 }; },
        quadraticCurveTo: function () {}, bezierCurveTo: function () {},
        rect: function () {}, clip: function () {}, isPointInPath: function () { return false; }
      };
    }
  };
  return elements[id];
}
var windowListeners = [];
global.window = global;
global.devicePixelRatio = 1;
global.document = {
  readyState: "complete",
  getElementById: el,
  createElement: function () { return el("_tmp" + Math.random()); },
  addEventListener: function () {}
};
global.addEventListener = function (ev, fn) { windowListeners.push({ ev: ev, fn: fn }); };
global.Image = function () { return { set src(v) { if (this.onload) this.onload(); }, naturalWidth: 8, naturalHeight: 8 }; };
global.requestAnimationFrame = function () {};
global.performance = { now: function () { return Date.now(); } };
global.sessionStorage = { getItem: function () { return null; }, removeItem: function () {} };
global.alert = function () {};
global.location = { protocol: "http:", host: "127.0.0.1:" + PORT, hostname: "127.0.0.1", port: String(PORT), reload: function () {} };
global.XMLHttpRequest = function () {
  this.open = function () {}; this.send = function () {};
  this.setRequestHeader = function () {}; this.abort = function () {};
  this.responseText = "{}"; this.status = 200; this.readyState = 4;
};
global.Audio = function () { this.play = function () { return { catch: function () {} }; }; this.pause = function () {}; };
global.WebSocket = function (url) {
  var sock = this;
  sock.readyState = 0;
  connectWs(parseInt(url.split(":").pop(), 10), function (real) {
    sock.readyState = 1;
    real.on("message", function (m) { if (sock.onmessage) sock.onmessage({ data: m }); });
    real.on("close", function () { sock.readyState = 3; if (sock.onclose) sock.onclose({}); });
    sock._real = real;
    if (sock.onopen) sock.onopen({});
  });
  this.send = function (d) { if (sock._real) sock._real.send(d); };
  this.close = function () { if (sock._real) sock._real.close(); };
};
global.WebSocket.OPEN = 1;

// Charge les scripts du client dans l'ordre d'index.html.
var html = fs.readFileSync(path.join(ROOT, "index.html"), "utf8");
var srcs = html.match(/src="[^"]*\.js"/g).map(function (s) {
  return s.slice(5, -1);
}).filter(function (s) { return !/^https?:/.test(s); });
srcs.forEach(function (f) {
  var code = fs.readFileSync(path.join(ROOT, f), "utf8");
  try { (0, eval)(code); } catch (e) {
    console.log("FAIL: erreur pendant le chargement de " + f + " : " + e.message);
    cleanup(1);
  }
});
var G = global.GAME;
var fails = 0;
function check(cond, m) { if (!cond) { fails++; console.log("FAIL: " + m); } }
function pressEnter() {
  var stopped = false;
  var ev = {
    code: "Enter", key: "Enter",
    preventDefault: function () {},
    stopPropagation: function () { stopped = true; }
  };
  // Comme le navigateur : l'evenement part de l'element FOCUS ; si son
  // handler appelle stopPropagation, window ne le voit PAS.
  var focused = Object.keys(elements).map(function (k) { return elements[k]; })
    .filter(function (e) { return e.focused; })[0];
  if (focused && focused._ev && focused._ev.keydown) focused._ev.keydown(ev);
  if (stopped) return;
  windowListeners.forEach(function (l) { if (l.ev === "keydown") l.fn(ev); });
}
function pressEscape() {
  var ev = { code: "Escape", key: "Escape",
    preventDefault: function () {}, stopPropagation: function () {} };
  var focused = Object.keys(elements).map(function (k) { return elements[k]; })
    .filter(function (e) { return e.focused; })[0];
  if (focused && focused._ev && focused._ev.keydown) focused._ev.keydown(ev);
}
function chatLines() {
  return (elements.chatLog ? elements.chatLog.children : []).map(function (c) {
    return c.children.map(function (x) { return x.textContent; }).join(" ");
  });
}

// Le panneau doit partir CACHE (attribut hidden au chargement) puis devenir
// visible des le join, memes messages serveur affiches.
elements.chat.hidden = true;
// Fidele au HTML reel : tous les overlays (universite, marche, potence,
// admin, ecrans de jeu) demarrent caches — sinon les gardes du chat
// (menus ouverts) bloqueraient Entree a tort.
["universiteScreen", "marcheScreen", "potenceScreen", "adminScreen",
 "loadingScreen", "pauseScreen", "buildingScreen", "chestScreen",
 "buildMenuScreen", "churchScreen", "startScreen"].forEach(function (id) {
  el(id).hidden = true;
});

setTimeout(function () {
  check(!!G, "G expose");
  check(!!G.chatInit, "chatInit expose apres chargement (module chat actif)");
  check(!!G.addChatMessage, "addChatMessage expose");
  G.netConnect();
  var waited = 0;
  (function waitConn() {
    if (G.netConnected && !G.netConnected() && waited < 10000) {
      waited += 250;
      return setTimeout(waitConn, 250);
    }
    G.netJoin("Testeur");
    setTimeout(function () {
      check(!elements.chat.hidden, "panneau chat visible apres join (hidden=" + elements.chat.hidden + ")");
      var lines = chatLines();
      var hasHello = lines.some(function (t) { return t.indexOf("bonjour Testeur") >= 0; });
      check(hasHello, "message de bienvenue affiche, lignes=" + JSON.stringify(lines));
      // Pseudo obligatoire : sans pseudo, l'envoi est refuse avec une
      // ligne d'aide et le champ reste ouvert.
      G.state.started = true;
      elements.chatPseudo.value = "";
      try { delete global.localStorage; } catch (e) {}
      global.localStorage = { getItem: function () { return ""; }, setItem: function () {} };
      G.state.playerName = "";
      pressEnter();
      check(G.state.chatTyping === true, "Entree ouvre la saisie (chatTyping=" + G.state.chatTyping + ")");
      elements.chatInput.value = "sans pseudo";
      pressEnter();
      check(G.state.chatTyping === true, "sans pseudo : envoie refuse, saisie encore ouverte");
      var refused = chatLines().some(function (t) { return t.indexOf("Indiquez un pseudo") >= 0; });
      check(refused, "sans pseudo : message d'aide affiche");
      // Annule la saisie (Echap) puis reouvre avec un pseudo valide.
      pressEscape();
      elements.chatPseudo.value = "Testeur";
      pressEnter();
      check(G.state.chatTyping === true, "Entree ouvre la saisie (chatTyping=" + G.state.chatTyping + ")");
      check(elements.chatInput.focused === true, "champ chat focus");
      elements.chatInput.value = "salut tout le monde";
      pressEnter();
      check(G.state.chatTyping === false, "Entree envoie et referme la saisie");
      setTimeout(function () {
        var lines2 = chatLines();
        var mine = lines2.some(function (t) { return t.indexOf("Testeur") >= 0 && t.indexOf("salut tout le monde") >= 0; });
        check(mine, "message envoye revient diffuse, lignes=" + JSON.stringify(lines2));
        console.log(fails === 0 ? "OK: chat client complet (module actif, bienvenue, Entree, envoi, diffusion)"
                               : "CHAT CLIENT ECHEC (" + fails + " echecs)");
        cleanup(fails === 0 ? 0 : 1);
      }, 800);
    }, 1500);
  })();
}, 2500);
