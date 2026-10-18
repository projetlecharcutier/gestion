// Mode mobile/tactile : controls virtuels pour telephone/tablette.
// DESACTIVE PAR DEFAUT : un bouton "Mobile" en haut a droite (a cote du
// bouton son) l'active/desactive. En mode souris+clavier, rien ne change.
//
// Layout (paysage OU portrait) :
//   - joystick FIXE en bas a GAUCHE : toucher n'importe ou a gauche de
//     l'ecran le pilote (la base reste ancre bas-gauche), remplace
//     Espace+souris pour le deplacement.
//   - moitie DROITE (hors boutons) : tap maintenu = viser + tirer vers ce
//     point ; en mode construction, tap = poser.
//   - action bar bas-droite : hache (toggle), construire (menu/pause du
//     mode planche), sac, rotation (visible en mode planche), zoom +/-.
//   - boutons contextuels bas-centre : n'apparaissent que quand l'action
//     est possible (entrer dans un batiment, coffre, eglise, fantome).
//
// Integration : le module ecrit dans state.keys.space / mouse.wx/wy /
// actionHeld comme le font le clavier et la souris — aucune autre couche
// du jeu n'est modifiee (main.js lit ces champs comme avant).
(function () {
  "use strict";
  var G = window.GAME = window.GAME || {};
  var enabled = false;
  var STICK_RADIUS = 56;    // rayon de la base du joystick (px CSS)
  var MOVE_THRESHOLD = 0.22; // deflexion minimale pour bouger (anti-tremblement)

  // --- DOM -------------------------------------------------------------
  var root = null;       // conteneur des controls tactiles
  var stickBase = null;  // base du joystick (div)
  var stickKnob = null;  // pouce (div)
  var actionFire = null; // zone de tir (moitie gauche)
  var btnAxe = null, btnBuild = null, btnBag = null, btnRotate = null;
  var btnZoomIn = null, btnZoomOut = null, btnGhost = null, btnPause = null;
  var ctxBar = null;     // boutons contextuels (entrer batiment / coffre...)

  // --- Etat du joystick -------------------------------------------------
  var stick = { active: false, id: null, cx: 0, cy: 0, dx: 0, dy: 0 };
  // --- Etat du tir -------------------------------------------------------
  var fireTouch = { active: false, id: null, sx: 0, sy: 0 };
  var pinch = { active: false, dist: 0 };

  function visible() {
    return enabled && G.state.started && !G.state.gameOver &&
           !G.state.paused && !G.state.inBuilding;
  }

  function refresh() {
    if (!root) return;
    root.hidden = !enabled;
    var play = visible();
    stickBase.hidden = !play;
    actionFire.style.display = play ? "block" : "none";
    // Boutons de jeu visibles seulement en partie.
    var btns = [btnAxe, btnBuild, btnBag, btnZoomIn, btnZoomOut, btnPause];
    for (var i = 0; i < btns.length; i++) btns[i].hidden = !play;
    // Rotation : uniquement en mode planche.
    btnRotate.hidden = !(play && G.state.buildMode);
    // Fantome : uniquement apres la mort du joueur local.
    btnGhost.hidden = !(enabled && G.state.started &&
                        G.state.gameOver && G.state.gameOverCause === "player" &&
                        !G.state.spectator);
    updateContextual();
  }

  // Boutons contextuels : "Entrer" pres d'un batiment, "Coffre" pres de
  // la mairie, "Eglise" pres de l'eglise, "Hospital" pour se soigner.
  // Reutilise la logique de proximite du clic souris (input.js) : les
  // memes distances, la meme ouverture de menu.
  function updateContextual() {
    if (!ctxBar) return;
    ctxBar.innerHTML = "";
    if (!visible() || G.state.bag.open || G.state.chestOpen || G.state.churchOpen ||
        G.state.buildMenuOpen || G.state.buildMode) { ctxBar.hidden = true; return; }
    var s = G.state;
    var p = s.player;
    var found = null;
    for (var i = 0; i < s.buildings.length; i++) {
      var b = s.buildings[i];
      if (b.isDecor || b.isTorche) continue;
      var cx = b.x + b.w / 2, cy = b.y + b.h / 2;
      var d = Math.sqrt((p.x - cx) * (p.x - cx) + (p.y - cy) * (p.y - cy));
      var reach = Math.max(b.w, b.h) / 2 + 70;
      if (d < reach) {
        if (b.isMairie) { found = { label: "\uD83D\uDDC0\uFE0F Coffre", fn: function () { G.openMairieChest(); } }; break; }
        if (b.isChurch) { found = { label: "\u26EA D\u00E9poser", fn: function () { G.openChurch(); } }; break; }
        if (b.townBuilding === "marche") { found = { label: "\uD83D\uDED2 March\u00E9", fn: function () { G.openMarche(); } }; break; }
        if (b.townBuilding === "universite") { found = { label: "\uD83C\uDF93 Universit\u00E9", fn: function () { G.openUniversite(); } }; break; }
        if (b.townBuilding === "scierie") { found = { label: "\uD83E\uDE9B Scierie", fn: function () { G.openBuildMenu(); } }; break; }
        if (b.townBuilding === "potence") { found = { label: "\u2697 Potence", fn: function () { G.openPotence(); } }; break; }
        if (b.townBuilding === "montgolfiere") {
          found = { label: "\uD83D\uDEC4 Observation", fn: function () {
            if (G.netConnected && G.netConnected()) G.netInput({ montgolfiere: true });
            else G.triggerMontgolfiere(b);
          } };
          break;
        }
      }
    }
    if (found) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "touch-btn touch-btn--ctx";
      btn.textContent = found.label;
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        found.fn();
      });
      ctxBar.appendChild(btn);
      ctxBar.hidden = false;
    } else {
      ctxBar.hidden = true;
    }
  }

  // --- Joystick flottant -------------------------------------------------
  function stickStart(id, x, y) {
    stick.active = true;
    stick.id = id;
    // Base FIXE en bas a GAUCHE : pouce gauche = deplacement, cote droit
    // = viser/tirer (moitie droite de l'ecran).
    stick.cx = STICK_RADIUS + 24;
    stick.cy = window.innerHeight - STICK_RADIUS - 24;
    stick.dx = 0; stick.dy = 0;
    stickBase.hidden = false;
    stickBase.style.left = (stick.cx - STICK_RADIUS) + "px";
    stickBase.style.top = (stick.cy - STICK_RADIUS) + "px";
    stickKnob.style.transform = "translate(0px, 0px)";
  }
  function stickMove(x, y) {
    var vx = x - stick.cx, vy = y - stick.cy;
    var d = Math.sqrt(vx * vx + vy * vy);
    var cl = Math.min(d, STICK_RADIUS);
    var nx = d > 0 ? vx / d : 0, ny = d > 0 ? vy / d : 0;
    stickKnob.style.transform = "translate(" + (nx * cl) + "px," + (ny * cl) + "px)";
    // Traduit en input "avancer vers ce point" : on place la cible souris
    // (wx/wy) dans la direction du stick, assez loin pour que le joueur
    // avance a pleine vitesse dans cette direction.
    if (d > STICK_RADIUS * MOVE_THRESHOLD) {
      var s = G.state;
      var far = 500;
      // Direction ECRAN -> MONDE : inverse de proj ((wx-wy)/2, (wx+wy)/4).
      // proj : dsx = (wx - wy) / 2, dsy = (wx + wy) / 4 -> wx = dsx + 2dsy, wy = 2dsy - dsx.
      var wx = nx + 2 * ny, wy = 2 * ny - nx;
      var wn = Math.sqrt(wx * wx + wy * wy) || 1;
      s.mouse.wx = s.player.x + (wx / wn) * far;
      s.mouse.wy = s.player.y + (wy / wn) * far;
      s.mouse.inside = true;
      s.keys.space = true;
    } else {
      G.state.keys.space = false;
    }
    stick.dx = nx; stick.dy = ny;
  }
  function stickEnd() {
    stick.active = false;
    stick.id = null;
    stick.dx = 0; stick.dy = 0;
    G.state.keys.space = false;
    stickBase.hidden = true;
  }

  // --- Zone de tir (moitie gauche) --------------------------------------
  function fireStart(id, x, y) {
    var s = G.state;
    fireTouch.active = true;
    fireTouch.id = id;
    fireTouch.sx = x; fireTouch.sy = y;
    var rect = G.canvas.getBoundingClientRect();
    var w = G.unproj(x - rect.left, y - rect.top);
    s.mouse.sx = x - rect.left;
    s.mouse.sy = y - rect.top;
    s.mouse.wx = w[0];
    s.mouse.wy = w[1];
    s.mouse.inside = true;
    if (s.buildMode) {
      // Tap en mode construction : pose (palissade ou batiment selectionne).
      if (s.buildSel && s.buildSel !== "palissade") {
        if (G.netConnected && G.netConnected()) s._placeBuild = { wx: w[0], wy: w[1] };
        else G.placeFromBuildMenu(w[0], w[1]);
      } else {
        if (G.netConnected && G.netConnected()) s._buildWall = { wx: w[0], wy: w[1] };
        else G.tryBuildWall(w[0], w[1]);
      }
    } else if (!s.bag.open && !s.chestOpen && !s.churchOpen) {
      s.actionHeld = true;
    }
  }
  function fireMove(x, y) {
    if (!fireTouch.active) return;
    var s = G.state;
    var rect = G.canvas.getBoundingClientRect();
    var w = G.unproj(x - rect.left, y - rect.top);
    s.mouse.sx = x - rect.left;
    s.mouse.sy = y - rect.top;
    s.mouse.wx = w[0];
    s.mouse.wy = w[1];
    s.mouse.inside = true;
  }
  function fireEnd() {
    fireTouch.active = false;
    fireTouch.id = null;
    G.state.actionHeld = false;
  }

  // --- Pinch to zoom (deux doigts dans la zone de tir) -------------------
  function pinchDist(t1, t2) {
    var dx = t1.clientX - t2.clientX, dy = t1.clientY - t2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // --- Construction du DOM ------------------------------------------------
  function build() {
    if (root) return;
    root = document.createElement("div");
    root.className = "touch-ui";
    root.hidden = true;

    // Base du joystick (position pilotee en JS).
    stickBase = document.createElement("div");
    stickBase.className = "touch-stick";
    stickBase.hidden = true;
    stickKnob = document.createElement("div");
    stickKnob.className = "touch-stick__knob";
    stickBase.appendChild(stickKnob);
    root.appendChild(stickBase);

    // Zone de tir : moitie DROITE (le joystick vit a gauche).
    actionFire = document.createElement("div");
    actionFire.className = "touch-fire";
    actionFire.style.display = "none";
    root.appendChild(actionFire);

    // Action bar bas-droite.
    var bar = document.createElement("div");
    bar.className = "touch-bar";
    btnAxe = mkBtn("\uD83E\uDE93 Hache", function () { toggleAxe(); });
    btnBuild = mkBtn("\uD83D\uDD28 Construire", function () { buildPressed(); });
    btnBag = mkBtn("\uD83C\uDF92 Sac", function () { bagPressed(); });
    btnRotate = mkBtn("\u21BB", function () { rotatePressed(); });
    btnZoomIn = mkBtn("+", function () { zoomBy(1.25); });
    btnZoomOut = mkBtn("\u2212", function () { zoomBy(1 / 1.25); });
    btnPause = mkBtn("\u23F8", function () { if (G.togglePause) G.togglePause(); });
    bar.appendChild(btnAxe);
    bar.appendChild(btnBuild);
    bar.appendChild(btnBag);
    bar.appendChild(btnRotate);
    bar.appendChild(btnZoomIn);
    bar.appendChild(btnZoomOut);
    bar.appendChild(btnPause);
    root.appendChild(bar);

    // Bouton fantome (mort du joueur local).
    btnGhost = mkBtn("\uD83D\uDC7B Spectateur", function () {
      var s = G.state;
      if (s.gameOver && s.gameOverCause === "player" && !s.spectator) {
        s.spectator = true;
        if (!s.ghost) s.ghost = { x: s.player.x, y: s.player.y, bob: 0 };
        var goEl = document.getElementById("gameOverScreen");
        if (goEl) goEl.hidden = true;
        if (G.screen) G.screen.hidden = true;
      }
    });
    btnGhost.className = "touch-btn touch-btn--ghost";
    btnGhost.hidden = true;
    root.appendChild(btnGhost);

    // Boutons contextuels bas-centre.
    ctxBar = document.createElement("div");
    ctxBar.className = "touch-ctx";
    ctxBar.hidden = true;
    root.appendChild(ctxBar);

    document.body.appendChild(root);
    bindTouch();
  }

  function mkBtn(label, fn) {
    var b = document.createElement("button");
    b.type = "button";
    b.className = "touch-btn";
    b.textContent = label;
    b.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      fn();
    });
    // Les boutons ne doivent pas laisser partir un "click" vers le canvas
    // (tir accidentel) : on avale aussi touchend.
    b.addEventListener("touchend", function (e) { e.stopPropagation(); }, { passive: false });
    return b;
  }

  function toggleAxe() {
    var s = G.state;
    if (G.netConnected && G.netConnected()) G.netInput({ axe: true });
    else s.axeEquipped = !s.axeEquipped;
  }
  function buildPressed() {
    var s = G.state;
    if (s.buildMenuOpen) { G.closeBuildMenu(); return; }
    if (s.buildMode) { s.buildMode = false; s.buildSel = null; refresh(); return; }
    if (s.buildSel) { s.buildMode = true; refresh(); return; }
    G.openBuildMenu();
  }
  function bagPressed() {
    var s = G.state;
    if (s.buildMode) { s.buildMode = false; s.buildSel = null; refresh(); return; }
    s.bag.open = !s.bag.open;
  }
  function rotatePressed() {
    G.rotatePlank();
    if (G.netConnected && G.netConnected()) G.netInput({ rotate: G.state.plankRotation });
  }
  function zoomBy(f) {
    G.state.targetZoom = G.clamp(G.state.targetZoom * f, 1, 40);
  }

  // --- Evenements tactiles ------------------------------------------------
  function bindTouch() {
    // Attention : les touches partent du document, pas du canvas — sur
    // mobile le canvas est sous les controles. On ne traite que ce qui
    // n'a pas deja ete avale par un bouton.
    document.addEventListener("touchstart", function (e) {
      if (!enabled || !visible()) return;
      var s = G.state;
      if (s.bag.open || s.chestOpen || s.churchOpen || s.buildMenuOpen) return;
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        // Bouton DOM sous le doigt : il gere son propre click.
        if (t.target && t.target.closest && t.target.closest(".touch-ui .touch-btn, .chat, .hud, .sound-btn")) continue;
        if (t.target && t.target.closest && t.target.closest(".touch-ui .touch-stick")) continue;
        if (t.clientX >= window.innerWidth / 2) {
          // Moitie droite : tir (le joystick vit en bas a gauche).
          if (!fireTouch.active && !pinch.active) {
            fireStart(t.identifier, t.clientX, t.clientY);
            e.preventDefault();
          }
        } else {
          // Moitie gauche : joystick. Deux doigts = pinch (zoom).
          var leftTouches = [];
          for (var j = 0; j < e.touches.length; j++) {
            if (e.touches[j].clientX < window.innerWidth / 2) leftTouches.push(e.touches[j]);
          }
          if (leftTouches.length >= 2) {
            fireEnd();
            pinch.active = true;
            pinch.dist = pinchDist(leftTouches[0], leftTouches[1]);
          } else if (!stick.active) {
            stickStart(t.identifier, t.clientX, t.clientY);
          }
          e.preventDefault();
        }
      }
    }, { passive: false });

    document.addEventListener("touchmove", function (e) {
      if (!enabled) return;
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        if (stick.active && t.identifier === stick.id) {
          stickMove(t.clientX, t.clientY);
          e.preventDefault();
        } else if (fireTouch.active && t.identifier === fireTouch.id) {
          fireMove(t.clientX, t.clientY);
          e.preventDefault();
        }
      }
      if (pinch.active) {
        var leftTouches = [];
        for (var j = 0; j < e.touches.length; j++) {
          if (e.touches[j].clientX < window.innerWidth / 2) leftTouches.push(e.touches[j]);
        }
        if (leftTouches.length >= 2) {
          var d = pinchDist(leftTouches[0], leftTouches[1]);
          if (pinch.dist > 0) zoomBy(d / pinch.dist);
          pinch.dist = d;
          e.preventDefault();
        }
      }
    }, { passive: false });

    function endTouch(e) {
      for (var i = 0; i < e.changedTouches.length; i++) {
        var t = e.changedTouches[i];
        if (stick.active && t.identifier === stick.id) stickEnd();
        if (fireTouch.active && t.identifier === fireTouch.id) fireEnd();
      }
      if (pinch.active) {
        var left = 0;
        for (var j = 0; j < e.touches.length; j++) {
          if (e.touches[j].clientX < window.innerWidth / 2) left++;
        }
        if (left < 2) pinch.active = false;
      }
    }
    document.addEventListener("touchend", endTouch);
    document.addEventListener("touchcancel", endTouch);
  }

  // --- Activation ---------------------------------------------------------
  G.touchEnabled = function () { return enabled; };
  G.setTouchMode = function (on) {
    enabled = !!on;
    // Trois modes de controle exclusifs : activer le mobile coupe le
    // mode clavier (et vice-versa dans keyboard.js).
    if (enabled && G.keyboardEnabled && G.keyboardEnabled()) G.setKeyboardMode(false);
    build();
    if (!enabled) {
      stickEnd();
      fireEnd();
      G.state.keys.space = false;
    }
    refresh();
    // Le bouton "Commandes" (menu deroulant) reflete le mode actif.
    if (G.refreshControlsBtn) G.refreshControlsBtn();
    try { window.localStorage.setItem("flexTouchMode", enabled ? "1" : "0"); } catch (e) {}
  };
  G.toggleTouchMode = function () { G.setTouchMode(!enabled); };

  // Rafraichit la visibilite des controles a chaque frame (peu couteux :
  // que des manipulations de classes/hidden quand l'etat change).
  var lastVisible = null;
  G.touchUpdate = function () {
    if (!enabled || !root) return;
    var v = visible();
    if (v !== lastVisible || v) {
      lastVisible = v;
      refresh();
    } else {
      lastVisible = v;
    }
    // Bouton fantome et contextuels suivent l'etat a chaque frame.
    btnGhost.hidden = !(enabled && G.state.started &&
                        G.state.gameOver && G.state.gameOverCause === "player" &&
                        !G.state.spectator);
    if (G.state.buildMode !== undefined) btnRotate.hidden = !(v && G.state.buildMode);
  };

  // Bouton du menu (a cote du son) : activation/desactivation.
  function init() {
    // Le bouton d'activation est gere par le menu deroulant "Commandes"
    // (src/menu.js) : on restaure juste la preference sauvegardee.
    // Desactive par defaut, MEME si le terminal est tactile : le mode
    // souris+clavier reste la reference tant que le joueur ne demande
    // pas explicitement le mode mobile.
    var saved = null;
    try { saved = window.localStorage.getItem("flexTouchMode"); } catch (e) {}
    if (saved === "1") G.setTouchMode(true);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
