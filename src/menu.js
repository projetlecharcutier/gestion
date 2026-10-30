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

  // Decor de fond du menu : les PNG du jeu pousses par le vent, de DROITE a
  // GAUCHE (apparaissent hors ecran a droite, disparaissent a gauche), comme
  // des feuilles volantes. TOUS les sprites de assets/sprites/ sont eligibles
  // (liste generee : assets/sprites/sprites-list.json), hors masques techniques
  // (*_mask : donnees de collision rouge/vert) et hors FRAMES D ANIMATION
  // (*-0, *-1... : variantes de la meme image, redondantes a l ecran). MEME
  // ECHELLE de pixel pour tous : chaque PNG est rendu a SA TAILLE NATIVE
  // (1 px PNG = 1 px ecran) -- une ville est donc plus grande qu une potence,
  // les proportions du jeu sont respectees, aucune retouche PNG.
  var BG_LIST = "assets/sprites/sprites-list.json";
  var BG_COUNT = 12;    // sprites simultanement en vol
  var BG_WIND_MIN = 50, BG_WIND_MAX = 130; // px/s, pousse du vent droite->gauche

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  function initMenuBackdrop() {
    if (typeof document === "undefined" || !document.getElementById) return;
    if (typeof fetch !== "function") return;
    var screen = document.getElementById("startScreen");
    if (!screen || typeof document.createElement !== "function" ||
        typeof screen.insertBefore !== "function") return;
    fetch(BG_LIST, { cache: "no-store" }).then(function (r) {
      if (!r.ok) throw new Error("http " + r.status);
      return r.json();
    }).then(function (list) {
      if (!list || !list.length) return;
      // Masques de collision (rouge/vert plein) et frames d animation
      // (*-N.png : la frame de base suffit, inutile de repeter la meme pose).
      var paths = list.filter(function (p) {
        return typeof p === "string" && p.indexOf("_mask") === -1 &&
               !/-\d+\.png$/i.test(p);
      });
      if (!paths.length) return;
      startBackdrop(screen, shuffle(paths));
    }).catch(function () { /* liste indisponible (file://...) : pas de decor */ });
  }

  function startBackdrop(screen, paths) {
    var layer = document.createElement("div");
    layer.className = "menu-backdrop";
    screen.insertBefore(layer, screen.firstChild);

    // Precharge les PNG un par un (chaine douce, le navigateur cache) :
    // le volant pioche parmi les images DEJA chargees, la variete grandit au
    // fil du chargement jusqu'a couvrir tous les sprites.
    var pool = [];      // [{src, img}] charges
    var cursor = 0;
    function preloadNext() {
      if (cursor >= paths.length) return;
      var src = paths[cursor++];
      var im = new Image();
      im.onload = function () {
        if (im.naturalWidth > 0) pool.push({ src: src, img: im });
        preloadNext();
      };
      im.onerror = preloadNext;
      im.src = src;
    }
    preloadNext();
    // Quelques prechargements en parallele pour amorcer la pompe vite.
    for (var k = 0; k < 5 && k < paths.length; k++) preloadNext();

    var W = (typeof innerWidth === "number" && innerWidth > 0) ? innerWidth : 800;
    var H = (typeof innerHeight === "number" && innerHeight > 0) ? innerHeight : 600;
    var flyers = [];
    for (var f = 0; f < BG_COUNT; f++) {
      var el = document.createElement("img");
      el.className = "menu-backdrop__img";
      el.draggable = false;
      el.alt = "";
      layer.appendChild(el);
      flyers.push({ el: el, active: false, x: 0, y: 0, w: 0, h: 0,
                   speed: 0, bobA: 0, bobP: 0, t: Math.random() * 10 });
    }

    // Respecte prefers-reduced-motion : images posees en bande statique.
    var reduced = false;
    try {
      reduced = typeof matchMedia === "function" &&
                matchMedia("(prefers-reduced-motion: reduce)").matches;
    } catch (e) { /* matchMedia indisponible : on anime quand meme */ }

    var raf = (typeof requestAnimationFrame === "function") ? requestAnimationFrame : null;
    var now = (typeof performance !== "undefined" && performance.now)
      ? function () { return performance.now(); } : function () { return Date.now(); };
    var last = now();

    function spawn(fl, initial) {
      var pick = pool[Math.floor(Math.random() * pool.length)];
      if (!pick) return false;
      // Echelle native identique pour tous : 1 px PNG = 1 px ecran. Les
      // proportions du jeu sont conservees (ville >> potence).
      var w = pick.img.naturalWidth, h = pick.img.naturalHeight;
      fl.el.src = pick.src;
      fl.el.style.width = w + "px";
      fl.el.style.height = h + "px";
      fl.w = w; fl.h = h;
      fl.speed = BG_WIND_MIN + Math.random() * (BG_WIND_MAX - BG_WIND_MIN);
      fl.bobA = 6 + Math.random() * 14;              // amplitude du vol (px)
      fl.bobP = 2 * Math.PI * (0.25 + Math.random() * 0.5); // pulsation (rad/s)
      fl.y = Math.random() * Math.max(10, H - h);   // bande de vol
      // Apparition hors ecran a droite ; au demarrage, on seme l'ecran.
      fl.x = initial ? Math.random() * (W + 200) : W + 40 + Math.random() * 260;
      fl.active = true;
      return true;
    }

    function tick(t) {
      var dt = Math.min(0.1, (t - last) / 1000);
      last = t;
      if (!screen.hidden) {
        for (var i = 0; i < flyers.length; i++) {
          var fl = flyers[i];
          if (!fl.active) { spawn(fl, true); continue; }
          if (!reduced) {
            fl.t += dt;
            fl.x -= fl.speed * dt;  // vent : droite -> gauche
          }
          // Sorti a gauche : re-apparait a droite sur un nouveau sprite.
          if (fl.x < -fl.w - 60) { if (!spawn(fl, false)) fl.active = false; continue; }
          var bob = reduced ? 0 : Math.sin(fl.t * fl.bobP) * fl.bobA;
          var rot = reduced ? 0 : Math.sin(fl.t * fl.bobP * 0.7 + 1) * 6;
          fl.el.style.transform =
            "translate(" + Math.round(fl.x) + "px, " + Math.round(fl.y + bob) + "px)" +
            " rotate(" + rot.toFixed(1) + "deg)";
          fl.el.style.opacity = "0.55";
        }
      }
      if (raf) raf(tick);
    }

    if (raf) raf(tick);
    else {
      // Pas de rAF (stubs de test) : une frame statique, sans boucle.
      tick(now());
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
