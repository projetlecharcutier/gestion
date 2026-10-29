// Menu d'accueil : petit habitant anime en bas de l'ecran + decor de fond.
// Charge les frames PNG de course existantes (perso_droite-0..4 /
// perso_gauche-0..4, 15x20 px) telles quelles — aucune retouche image —
// et fait courir le personnage de gauche a droite en boucle continue,
// avec retour dans l'autre sens. Purement decoratif : le conteneur a
// pointer-events:none et aria-hidden, il ne capte aucun clic ni focus.
// Le module est defensif : sous les stubs DOM des tests (pas de
// requestAnimationFrame fonctionnel, images factices), il s'initialise
// sans erreur et ne boucle pas.
(function () {
  "use strict";
  var G = window.GAME = window.GAME || {};

  var DIR = "assets/sprites/player/";
  var FRAMES = 5;      // perso_droite-0..4 / perso_gauche-0..4
  var SCALE = 3;       // 15x20 px -> 45x60 px, rendu pixelated (CSS)
  var SPEED = 110;     // px/s de deplacement
  var FRAME_MS = 90;   // ~11 fps : rythme de course lisible

  // Images de jeu utilisees pour le decor de fond du menu : chacune avec sa
  // largeur de rendu cible (px). Les MANQUANTES sont ignorees silencieusement
  // (onerror), le bandeau reste juste moins fourni. Aucune retouche PNG.
  var BG_IMAGES = [
    { src: "assets/sprites/tree/foret1s0.png", w: 150 },
    { src: "assets/sprites/tree/foret2s0.png", w: 170 },
    { src: "assets/sprites/tree/foret3s0.png", w: 160 },
    { src: "assets/sprites/building/mairie.png", w: 200 },
    { src: "assets/sprites/church/church.png", w: 170 },
    { src: "assets/sprites/scierie/idle.png", w: 190 },
    { src: "assets/sprites/universite/idle.png", w: 180 },
    { src: "assets/sprites/marche/idle.png", w: 180 },
    { src: "assets/sprites/montgolfiere/idle.png", w: 160 },
    { src: "assets/sprites/player/perso_droite-0.png", w: 90 },
    { src: "assets/sprites/tour/idle.png", w: 160 },
    { src: "assets/sprites/torche/idle.png", w: 130 },
    { src: "assets/sprites/wall/A.png", w: 140 }
  ];

  // Melange (Fisher-Yates) : chaque visite du menu montre une composition
  // differente, dans l'ordre de gauche a droite.
  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  // Pose le bandeau de fond : images chargees puis positionnees en bande
  // ancree par le bas, DERRIERE le panneau de menu (z-index), de gauche a
  // droite. Totalement decoratif : pointer-events none, aria ignore.
  function initMenuBackdrop() {
    if (typeof document === "undefined" || !document.getElementById) return;
    var screen = document.getElementById("startScreen");
    if (!screen || typeof document.createElement !== "function" ||
        typeof screen.insertBefore !== "function") return;
    var layer = document.createElement("div");
    layer.className = "menu-backdrop";
    var order = shuffle(BG_IMAGES.slice());
    var loaded = 0;
    function place() {
      loaded++;
      if (loaded < order.length) return;
      var usable = [];
      for (var i = 0; i < order.length; i++) {
        if (order[i].ok) usable.push(order[i]);
      }
      if (!usable.length) return;
      var W = (typeof innerWidth === "number" && innerWidth > 0) ? innerWidth : 800;
      var H = (typeof innerHeight === "number" && innerHeight > 0) ? innerHeight : 600;
      var x = 0;
      var slot = W / usable.length;
      for (var u = 0; u < usable.length; u++) {
        var it = usable[u];
        var scale = it.w / (it.img.naturalWidth || it.w);
        // Profondeur suggeree : leger desordre vertical (jitter).
        var jitter = (Math.random() * 0.18 - 0.09) * H;
        var el = document.createElement("img");
        el.src = it.img.src;
        el.className = "menu-backdrop__img";
        el.draggable = false;
        el.alt = "";
        el.style.left = Math.round(x + slot * 0.06) + "px";
        el.style.bottom = Math.round(H * 0.06 + jitter) + "px";
        el.style.width = Math.round(it.w) + "px";
        layer.appendChild(el);
        x += slot;
      }
      screen.insertBefore(layer, screen.firstChild);
    }
    for (var i = 0; i < order.length; i++) {
      (function (item) {
        var im = new Image();
        im.onload = function () { item.img = im; item.ok = true; place(); };
        im.onerror = place;
        im.src = item.src;
      })(order[i]);
    }
  }

  function initMenuRunner() {
    if (typeof document === "undefined" || !document.getElementById) return null;
    var screen = document.getElementById("startScreen");
    var actor = document.getElementById("menuRunnerActor");
    var img = document.getElementById("menuRunnerSprite");
    if (!screen || !actor || !img) return null;

    // Charge les 10 frames ; celles qui echouent sont ignorees (le runner
    // reste masque plutot que d'afficher une image cassee).
    var frames = { right: [], left: [] };
    var loaded = 0, total = FRAMES * 2;
    function done() {
      loaded++;
      if (loaded < total) return;
      var usable = frames.right.length === FRAMES && frames.left.length === FRAMES;
      if (!usable) return; // frames manquantes : le runner reste invisible
      start(screen, actor, img, frames);
    }
    var i;
    for (i = 0; i < FRAMES; i++) {
      (function (k) {
        var imR = new Image();
        imR.onload = function () { frames.right[k] = imR; done(); };
        imR.onerror = done;
        imR.src = DIR + "perso_droite-" + k + ".png";
        var imL = new Image();
        imL.onload = function () { frames.left[k] = imL; done(); };
        imL.onerror = done;
        imL.src = DIR + "perso_gauche-" + k + ".png";
      })(i);
    }
    return true;
  }

  function start(screen, actor, img, frames) {
    var raf = (typeof requestAnimationFrame === "function") ? requestAnimationFrame : null;
    var now = (typeof performance !== "undefined" && performance.now) ? function () { return performance.now(); } : function () { return Date.now(); };
    // Respecte prefers-reduced-motion : le personnage reste pose au sol.
    var reduced = false;
    try {
      reduced = typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (e) { /* matchMedia indisponible : on anime quand meme */ }
    if (reduced) {
      img.src = frames.right[0].src;
      actor.style.transform = "translateX(24px)";
      return;
    }
    if (!raf) {
      // Pas de rAF (tests) : un seul pas, pas de boucle.
      img.src = frames.right[0].src;
      return;
    }

    var width = (typeof innerWidth === "number" && innerWidth > 0) ? innerWidth : 800;
    var margin = 24;                 // marge de chaque cote (avant le drapeau)
    var x = -60;                     // hors ecran a gauche au depart
    var dir = 1;                     // 1 = vers la droite, -1 = vers la gauche
    var frameIdx = 0;
    var lastFrame = now();
    var lastTick = now();
    var visible = true;

    function tick(t) {
      var dt = Math.min(0.1, (t - lastTick) / 1000);
      lastTick = t;
      if (visible && !screen.hidden) {
        x += dir * SPEED * dt;
        var min = margin, max = Math.max(margin, width - margin - 45);
        if (x >= max) { x = max; dir = -1; }
        else if (x <= min) { x = min; dir = 1; }
        actor.style.transform = "translateX(" + Math.round(x) + "px)";
        if (t - lastFrame >= FRAME_MS) {
          lastFrame = t;
          frameIdx = (frameIdx + 1) % FRAMES;
          img.src = (dir === 1 ? frames.right : frames.left)[frameIdx].src;
        }
      }
      raf(tick);
    }
    // Reste a l'ecoute de la visibilite du menu (ouverture/fermeture).
    if (typeof MutationObserver === "function") {
      new MutationObserver(function () {
        visible = !screen.hidden;
        if (visible) lastTick = now();
      }).observe(screen, { attributes: true, attributeFilter: ["hidden"] });
    }
    raf(tick);
  }

  // Journal du serveur dans le menu : les 50 derniers messages publics
  // (/server-log.json, sans mot de passe admin). Rafraichi toutes les 15 s
  // tant que le menu est ouvert. Echec silencieux (solo/offline : le bloc
  // reste sur son placeholder).
  function refreshServerLog() {
    if (typeof fetch !== "function") return;
    var el = document.getElementById("serverLogLines");
    if (!el) return;
    fetch("/server-log.json", { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("http " + r.status);
      return r.json();
    }).then(function (data) {
      var lines = (data && data.lines) || [];
      el.textContent = lines.length ? lines.join("\n") : "(aucun message)";
      el.scrollTop = el.scrollHeight;
    }).catch(function () {
      if (!el.textContent || el.textContent.indexOf("Connexion") === 0) {
        el.textContent = "(serveur injoignable)";
      }
    });
  }

  G.refreshServerLog = refreshServerLog;

  G.initMenuRunner = initMenuRunner;

  // --- Menu deroulant "Commandes" (remplace les 2 anciens boutons
  //     Clavier/Mobile qui se chevauchaient en haut a droite) ------------
  // Trois modes exclusifs : default (souris+clavier), keyboard (ZQSD),
  // touch (mobile). Le bouton affiche le mode actif ; clic = deplier la
  // liste ; clic sur une option = appliquer + replier. Ferme aussi au clic
  // ailleurs ou sur Echap.
  var CONTROLS_LABELS = {
    default: "\u2328\ufe0f Commandes : Souris + clavier",
    keyboard: "\u2328\ufe0f Commandes : Clavier (ZQSD)",
    touch: "\U0001f4f1 Commandes : Mobile"
  };
  function currentControlMode() {
    if (G.touchEnabled && G.touchEnabled()) return "touch";
    if (G.keyboardEnabled && G.keyboardEnabled()) return "keyboard";
    return "default";
  }
  function applyControlMode(mode) {
    if (mode === "keyboard" && G.setKeyboardMode) G.setKeyboardMode(true);
    else if (mode === "touch" && G.setTouchMode) G.setTouchMode(true);
    else {
      if (G.setKeyboardMode) G.setKeyboardMode(false);
      if (G.setTouchMode) G.setTouchMode(false);
    }
    refreshControlsBtn();
  }
  function refreshControlsBtn() {
    var btn = document.getElementById("controlsBtn");
    if (!btn) return;
    var mode = currentControlMode();
    btn.textContent = CONTROLS_LABELS[mode] || CONTROLS_LABELS.default;
    var list = document.getElementById("controlsList");
    if (!list) return;
    var opts = list.querySelectorAll ? list.querySelectorAll("[data-mode]") : [];
    for (var i = 0; i < opts.length; i++) {
      var active = opts[i].getAttribute("data-mode") === mode;
      if (opts[i].classList) {
        if (active) opts[i].classList.add("controls-menu__opt--active");
        else opts[i].classList.remove("controls-menu__opt--active");
      }
    }
  }
  function initControlsMenu() {
    if (typeof document === "undefined" || !document.getElementById) return;
    var btn = document.getElementById("controlsBtn");
    var list = document.getElementById("controlsList");
    if (!btn || !list) return;
    btn.addEventListener("click", function (e) {
      if (e && e.stopPropagation) e.stopPropagation();
      var open = list.hidden;
      list.hidden = !open;
      if (btn.setAttribute) btn.setAttribute("aria-expanded", open ? "true" : "false");
    });
    var opts = list.querySelectorAll ? list.querySelectorAll("[data-mode]") : [];
    for (var i = 0; i < opts.length; i++) {
      (function (opt) {
        opt.addEventListener("click", function (e) {
          if (e && e.stopPropagation) e.stopPropagation();
          var mode = opt.getAttribute("data-mode");
          applyControlMode(mode);
          list.hidden = true;
          if (btn.setAttribute) btn.setAttribute("aria-expanded", "false");
        });
      })(opts[i]);
    }
    // Ferme la liste au clic ailleurs.
    if (document.addEventListener) {
      document.addEventListener("click", function (e) {
        if (list.hidden) return;
        var t = e && e.target;
        if (t && list.contains && list.contains(t)) return;
        if (t === btn) return;
        list.hidden = true;
        if (btn.setAttribute) btn.setAttribute("aria-expanded", "false");
      });
    }
    refreshControlsBtn();
  }
  G.initControlsMenu = initControlsMenu;
  G.refreshControlsBtn = refreshControlsBtn;

  // --- Bouton retracter/deplier le chat --------------------------------
  // Le chat est visible par defaut (mode serveur). Le bouton permet de le
  // replier (seul le bouton reste, clic = reouvrir). L'etat est persiste
  // dans localStorage. G.chatSetVisible (chat.js) gere la visibilite reelle
  // du panneau ; ici on ne fait que basculer l'etat et rafraichir le bouton.
  var CHAT_COLLAPSED_KEY = "flexChatCollapsed";
  function chatCollapsed() {
    try { return window.localStorage.getItem(CHAT_COLLAPSED_KEY) === "1"; } catch (e) { return false; }
  }
  function setChatCollapsed(collapsed) {
    try { window.localStorage.setItem(CHAT_COLLAPSED_KEY, collapsed ? "1" : "0"); } catch (e) {}
    var chat = document.getElementById("chat");
    var btn = document.getElementById("chatToggle");
    if (chat) {
      // Ne masque que si le chat etait visible (ne force pas l'ouverture
      // si le jeu ne l'a pas encore affiche).
      if (collapsed && !chat.hidden) {
        chat._wasVisible = true;
        chat._collapsedByUser = true;
        chat.hidden = true;
      } else if (!collapsed && chat._wasVisible) {
        chat.hidden = false;
        chat._wasVisible = false;
        chat._collapsedByUser = false;
      }
      if (chat.classList) {
        if (collapsed) chat.classList.add("chat--collapsed");
        else chat.classList.remove("chat--collapsed");
      }
    }
    if (btn) {
      btn.textContent = collapsed ? "\U0001f4ac Chat \u25b6" : "\U0001f4ac Chat \u25bc";
      if (btn.setAttribute) btn.setAttribute("aria-expanded", collapsed ? "false" : "true");
    }
  }
  function initChatToggle() {
    if (typeof document === "undefined" || !document.getElementById) return;
    var btn = document.getElementById("chatToggle");
    if (!btn) return;
    // Etat initial : repli si sauvegarde, mais seulement apres que le chat
    // soit rendu visible par le jeu (net.js appelle chatSetVisible(true)).
    var wasCollapsed = chatCollapsed();
    btn.addEventListener("click", function () {
      setChatCollapsed(!chatCollapsed());
    });
    // Applique l'etat sauvegarde des que le chat devient visible.
    var chat = document.getElementById("chat");
    if (chat && typeof MutationObserver === "function") {
      new MutationObserver(function () {
        if (!chat.hidden && chatCollapsed()) {
          chat._wasVisible = true;
          chat._collapsedByUser = true;
          chat.hidden = true;
          if (chat.classList) chat.classList.add("chat--collapsed");
          if (btn.setAttribute) btn.setAttribute("aria-expanded", "false");
          btn.textContent = "\U0001f4ac Chat \u25b6";
        }
      }).observe(chat, { attributes: true, attributeFilter: ["hidden"] });
    }
    if (wasCollapsed && btn.setAttribute) btn.setAttribute("aria-expanded", "false");
    if (wasCollapsed) btn.textContent = "\U0001f4ac Chat \u25b6";
  }
  G.initChatToggle = initChatToggle;
  G.setChatCollapsed = setChatCollapsed;

  function boot() {
    try { initMenuBackdrop(); } catch (e) { /* decoratif : jamais bloquant */ }
    try { initMenuRunner(); } catch (e) { /* decoratif : jamais bloquant */ }
    try { initControlsMenu(); } catch (e) { /* jamais bloquant */ }
    try { initChatToggle(); } catch (e) { /* jamais bloquant */ }
    try {
      refreshServerLog();
      if (typeof setInterval === "function") setInterval(refreshServerLog, 15000);
    } catch (e) { /* log serveur indisponible : jamais bloquant */ }
  }
  if (typeof document !== "undefined" && document.readyState === "loading" && document.addEventListener) {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
