// Menu d'accueil : petit habitant anime en bas de l'ecran.
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
    var i, im;
    for (i = 0; i < FRAMES; i++) {
      im = new Image();
      im.onload = function (k) { return function () { frames.right[k] = im; done(); }; }(i);
      im.onerror = done;
      im.src = DIR + "perso_droite-" + i + ".png";
      im = new Image();
      im.onload = function (k) { return function () { frames.left[k] = im; done(); }; }(i);
      im.onerror = done;
      im.src = DIR + "perso_gauche-" + i + ".png";
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

  G.initMenuRunner = initMenuRunner;

  function boot() { try { initMenuRunner(); } catch (e) { /* decoratif : jamais bloquant */ } }
  if (typeof document !== "undefined" && document.readyState === "loading" && document.addEventListener) {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
