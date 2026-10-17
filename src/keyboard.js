// Mode clavier ZQSD : version "manette clavier" pour ceux qui n'arrivent
// pas a jouer au trackpad (Espace+souris demande un clic maintenu et une
// precision que le trackpad n'offre pas).
//
// DESACTIVE PAR DEFAUT : un bouton "Clavier" en haut a droite (a cote du
// bouton Mobile) l'active/desactive. Une fois active :
//   - ZQSD / fleches : deplacement DIRECT du personnage (ecran->monde).
//     Aucune touche enfoncee = personnage immobile.
//   - Espace : tir (l'arme tire vers la souris, comme le clic gauche).
//   - B : menu / mode planche (Z sert a MONTER dans ce mode).
//   - Les touches de deplacement pilotent AUSSI le mode build : le
//     rectangle de pose suit la direction enfoncee (ou la derniere),
//     Espace pose la palissade au rectangle.
//   - R : rotation de la palissade (comme la molette en mode planche).
//
// Integration identique a src/touch.js : le module ecrit dans
// state.keys / state.mouse / actionHeld comme le font le clavier et la
// souris - aucune autre couche du jeu n'est modifiee. Le deplacement
// "avancer vers la souris" existant (Espace maintenu hors mode clavier)
// reste la reference tant que le joueur ne demande pas ce mode.
(function () {
  "use strict";
  var G = window.GAME = window.GAME || {};
  var enabled = false;

  // Direction clavier courante en coordonnees ECRAN (-1/0/1 sur 2 axes).
  var dir = { x: 0, y: 0 };
  var lastDir = { x: 0, y: 0 };
  // Placement build pilote par les touches de deplacement.
  var buildTarget = { x: 0, y: 0 };

  function playContext() {
    var s = G.state;
    return s.started && !s.paused && !s.inBuilding && !s.gameOver &&
           !s.bag.open && !s.chestOpen && !s.churchOpen && !s.buildMenuOpen &&
           !s.chatTyping;
  }

  function readDir() {
    var k = G.state.keys;
    var x = 0, y = 0;
    if (k.ArrowLeft || k.KeyQ || k.KeyA) x -= 1;
    if (k.ArrowRight || k.KeyD) x += 1;
    if (k.ArrowUp || k.KeyZ || k.KeyW) y -= 1;
    if (k.ArrowDown || k.KeyS) y += 1;
    return { x: x, y: y };
  }

  // Espace etait-il enfonce a la frame precedente ? (pose one-shot en build)
  var prevSpace = false;

  // Appelle chaque frame AVANT la simulation (via G.keyboardUpdate,
  // branche dans main.js comme G.touchUpdate).
  G.keyboardUpdate = function () {
    if (!enabled) return;
    var s = G.state;
    if (!playContext()) {
      dir.x = 0; dir.y = 0;
      s.actionHeld = false;
      s.keys.space = false;
      prevSpace = !!s.keys.Space;
      return;
    }
    dir = readDir();
    var moving = dir.x !== 0 || dir.y !== 0;
    if (moving) {
      // Deplacement direct : on place la cible "avancer vers ce point"
      // dans la direction des touches, assez loin pour la pleine vitesse
      // (meme mecanique que le joystick mobile). Direction ECRAN -> MONDE :
      // proj donne dsx=(wx-wy)/2, dsy=(wx+wy)/4 -> wx=dsx+2*dsy, wy=2*dsy-dsx.
      var far = 500;
      var dxw = dir.x + 2 * dir.y, dyw = 2 * dir.y - dir.x;
      var n = Math.sqrt(dxw * dxw + dyw * dyw) || 1;
      s.mouse.wx = s.player.x + (dxw / n) * far;
      s.mouse.wy = s.player.y + (dyw / n) * far;
      s.mouse.inside = true;
      s.keys.space = true;
      lastDir.x = dir.x; lastDir.y = dir.y;
    } else {
      // Aucune touche de deplacement : personnage immobile.
      s.keys.space = false;
    }
    if (s.buildMode) {
      // En mode build, les touches pilotent AUSSI l'emplacement de pose :
      // le rectangle de pose suit la direction enfoncee (ou la derniere,
      // pour poser sans bouger). Espace pose au rectangle.
      var bx = moving ? dir.x : lastDir.x, by = moving ? dir.y : lastDir.y;
      if (bx !== 0 || by !== 0) {
        var far2 = 500;
        var mwx = bx + 2 * by, mwy = 2 * by - bx;
        var wn = Math.sqrt(mwx * mwx + mwy * mwy) || 1;
        s.mouse.wx = s.player.x + (mwx / wn) * far2;
        s.mouse.wy = s.player.y + (mwy / wn) * far2;
        s.mouse.inside = true;
        buildTarget.x = bx; buildTarget.y = by;
      }
      s.actionHeld = false;
      // Pose one-shot : Espace vient d'etre enfonce (pas de repetition auto).
      if (s.keys.Space && !prevSpace) buildPlace();
    } else {
      // Tir : Espace maintenu = actionHeld (comme le clic gauche souris).
      s.actionHeld = !!s.keys.Space;
    }
    prevSpace = !!s.keys.Space;
  };

  // Pose en mode build : Espace (unique, pas la repetition auto).
  function buildPlace() {
    var s = G.state;
    var wx = s.mouse.wx, wy = s.mouse.wy;
    if (s.buildSel && s.buildSel !== "palissade") {
      if (G.netConnected && G.netConnected()) s._placeBuild = { wx: wx, wy: wy };
      else G.placeFromBuildMenu(wx, wy);
    } else {
      if (G.netConnected && G.netConnected()) s._buildWall = { wx: wx, wy: wy };
      else G.tryBuildWall(wx, wy);
    }
  }

  // --- Activation ---------------------------------------------------------
  G.keyboardEnabled = function () { return enabled; };
  G.setKeyboardMode = function (on) {
    enabled = !!on;
    // Trois modes de controle exclusifs : activer le clavier coupe le
    // mode mobile (et vice-versa dans touch.js).
    if (enabled && G.touchEnabled && G.touchEnabled()) G.setTouchMode(false);
    var s = G.state;
    if (!enabled) {
      s.actionHeld = false;
      if (!s.keys || !s.keys.Space) s.keys.space = false;
    }
    refreshHints();
    var btn = document.getElementById("keyboardModeBtn");
    if (btn) {
      btn.textContent = enabled ? "\u2328\uFE0F Clavier : ON" : "\u2328\uFE0F Clavier : OFF";
      if (btn.setAttribute) btn.setAttribute("aria-pressed", enabled ? "true" : "false");
    }
    try { window.localStorage.setItem("flexKeyboardMode", enabled ? "1" : "0"); } catch (e) {}
  };
  G.toggleKeyboardMode = function () { G.setKeyboardMode(!enabled); };

  // Aide des commandes : mise a jour quand le mode clavier est actif.
  function refreshHints() {
    var block = document.getElementById("hudHintBlock");
    if (!block) return;
    var mode = enabled ? "kb" : "default";
    if (block.getAttribute("data-mode") === mode) return;
    block.setAttribute("data-mode", mode);
    var lines = enabled ? [
      "ZQSD / fl\u00e8ches = d\u00e9placement \u00b7 Espace = tir \u00b7 immobile si aucune touche",
      "B = menu / mode planche \u00b7 ZQSD d\u00e9place la pose \u00b7 Espace = poser \u00b7 R = rotation",
      "Clic droit = sac (annule le mode planche) \u00b7 \u00c9chap = pause"
    ] : [
      "Espace = avancer \u00b7 Clic gauche = action (tir / hache)",
      "Clic droit = sac (annule le mode planche) \u00b7 Z = Mode planche",
      "Molette = rotation (mode planche) / zoom \u00b7 Mairie = coffre \u00b7 \u00c9chap = pause"
    ];
    while (block.firstChild) block.removeChild(block.firstChild);
    for (var i = 0; i < lines.length; i++) {
      var div = document.createElement("div");
      div.className = "hud__hint-line";
      div.textContent = lines[i];
      block.appendChild(div);
    }
  }

  function init() {
    var btn = document.getElementById("keyboardModeBtn");
    if (btn) btn.addEventListener("click", G.toggleKeyboardMode);
    var saved = null;
    try { saved = window.localStorage.getItem("flexKeyboardMode"); } catch (e) {}
    if (saved === "1") G.setKeyboardMode(true);
  }
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
