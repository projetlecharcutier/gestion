// Tutoriel de demarrage : suite de bulles style bande dessinee qui
// presentent chaque element de l'ecran (HUD, mairie + son menu de
// construction, eglise, sac, torche, minimap...). Aucune action de jeu
// n'est requise : le joueur avance avec Espace et peut sortir a tout
// moment avec Echap (ou le bouton Passer). Pendant le tuto, les inputs
// de jeu sont neutralises (state.tutoActive, voir input.js / main.js).
// Le tuto n'est propose qu'une fois : l'acceptation ou le passage sont
// memorises dans localStorage (cle flexTutoSeen).
(function () {
  "use strict";
  var G = window.GAME = window.GAME || {};

  var STORAGE_KEY = "flexTutoSeen";
  var MAX_STEPS = 10;

  // Etapes du tour de l'ecran. "target" designe l'ancre de la bulle :
  // "player" (le joueur), "hud" (panneau haut-gauche), "mairie",
  // "eglise", "torche" (poteau le plus proche), "minimap" (bas-droite),
  // "center" (milieu d'ecran).
  var STEPS = [
    {
      key: "accueil", target: "player", title: "Bienvenue dans la réserve !",
      text: "Un petit tour de l'écran ? Espace = bulle suivante · Échap ou ✕ = quitter le tuto à tout moment."
    },
    {
      key: "hud", target: "hud", title: "Le panneau de bord",
      text: "En haut à gauche : ta Vie, les PV de la Mairie, tes Planches et ton Or, ton Arme et ta Hache. L'horloge indique le cycle jour/nuit — la horde sort la nuit. En dessous, les rappels de commandes."
    },
    {
      key: "mairie", target: "mairie", title: "La Mairie",
      text: "Le cœur de la ville. Clique dessus pour ouvrir son coffre commun : l'or et les objets y sont partagés entre habitants. Si ses PV tombent à 0, la partie est perdue !"
    },
    {
      key: "menu", target: "mairie", title: "Le menu de la Mairie",
      text: "C'est ici que la ville se construit : les votes débloquent la Scierie, l'Université, les Tours de défense… Chaque bâtiment se paie en or commun (coffre) + tes planches. La touche Z ouvre aussi le mode planche pour bâtir une palissade."
    },
    {
      key: "eglise", target: "eglise", title: "L'Église",
      text: "Clique dessus pour y déposer une relique : la ville gagne 100 pièces d'or au coffre commun."
    },
    {
      key: "sac", target: "center", title: "Le sac",
      text: "Clic droit = ouvrir/fermer ton sac. Clique un objet du sac pour l'équiper : armes pour te défendre, hache pour récolter des planches. Planches et nourriture y sont rangées."
    },
    {
      key: "torche", target: "torche", title: "Les poteaux de torche",
      text: "Un clic sur un poteau : tu vois 5 fois plus loin pendant 1 minute, même la nuit. La jauge « Torche » en bas de l'écran montre le temps restant."
    },
    {
      key: "minimap", target: "minimap", title: "La minimap",
      text: "En bas à droite : la carte entière de la réserve en losange. Le marqueur blanc, c'est toi. La boussole juste à gauche t'oriente vers la ville."
    },
    {
      key: "fin", target: "player", title: "C'est parti !",
      text: "Espace = avancer · clic gauche = tirer / hacher · Z = construire · Échap = pause. Bonne chance, et garde ton flex !"
    }
  ];

  var idx = -1;
  var activeFlag = false;
  var els = null; // refs DOM du tuto (layer, bubble, ...)

  function lsGet() {
    try {
      if (typeof localStorage === "undefined") return null;
      return localStorage.getItem(STORAGE_KEY);
    } catch (e) { return null; }
  }
  function markSeen() {
    try {
      if (typeof localStorage !== "undefined") localStorage.setItem(STORAGE_KEY, "1");
    } catch (e) { /* stockage indisponible : le tuto sera repropose */ }
  }

  G.tutoSeen = function () { return lsGet() === "1"; };
  G.tutoSteps = function () { return STEPS.slice(); };
  G.tutoActive = function () { return activeFlag && idx >= 0 && idx < STEPS.length; };

  // Construit une seule fois le DOM du tuto (bulle BD + queue + boutons).
  function buildDom() {
    if (els) return els;
    if (typeof document === "undefined" || !document.getElementById) return null;
    var layer = document.getElementById("tutoLayer");
    if (!layer) return null;
    layer.innerHTML = "";
    var bubble = document.createElement("div");
    bubble.className = "tuto-bubble";
    var tail = document.createElement("div");
    tail.className = "tuto-bubble__tail";
    var title = document.createElement("div");
    title.className = "tuto-bubble__title";
    var text = document.createElement("p");
    text.className = "tuto-bubble__text";
    var bar = document.createElement("div");
    bar.className = "tuto-bubble__bar";
    var counter = document.createElement("span");
    counter.className = "tuto-bubble__count";
    var hint = document.createElement("span");
    hint.className = "tuto-bubble__hint";
    hint.textContent = "Espace = suite · Échap = quitter";
    var skip = document.createElement("button");
    skip.type = "button";
    skip.className = "tuto-bubble__skip";
    skip.textContent = "✕ Passer";
    skip.addEventListener("click", function () { end(); });
    bar.appendChild(counter);
    bar.appendChild(hint);
    bar.appendChild(skip);
    bubble.appendChild(tail);
    bubble.appendChild(title);
    bubble.appendChild(text);
    bubble.appendChild(bar);
    layer.appendChild(bubble);
    els = { layer: layer, bubble: bubble, tail: tail, title: title, text: text, counter: counter };
    return els;
  }

  // Ancre ecran (px CSS) d'une cible. Retourne [sx, sy] ou null si la
  // cible n'est pas localisable (repli : centre de l'ecran).
  function anchorFor(target) {
    var state = G.state;
    var W = (G.viewW && G.viewW()) || 800;
    var H = (G.viewH && G.viewH()) || 600;
    if (target === "hud") {
      var hud = (typeof document !== "undefined" && document.getElementById)
        ? document.getElementById("hud") : null;
      if (hud && hud.getBoundingClientRect) {
        try {
          var r = hud.getBoundingClientRect();
          return [r.left + 80, r.bottom];
        } catch (e) { /* rect indisponible : repli */ }
      }
      return [24, 24];
    }
    if (target === "minimap") return [W - 60, H - 64];
    if (target === "center") return [W / 2, H * 0.65];
    if (target === "player" && state && G.proj) {
      var pp = G.proj(state.player.x, state.player.y);
      return [pp[0], pp[1] - 24];
    }
    if ((target === "mairie" || target === "eglise" || target === "torche") && state && G.proj) {
      var flag = target === "mairie" ? "isMairie" : target === "eglise" ? "isChurch" : "isTorche";
      var best = null, bestD = Infinity;
      var bs = state.buildings || [];
      for (var i = 0; i < bs.length; i++) {
        if (!bs[i][flag]) continue;
        var cx = bs[i].x + bs[i].w / 2, cy = bs[i].y + bs[i].h / 2;
        var dx = cx - state.player.x, dy = cy - state.player.y;
        var d = dx * dx + dy * dy;
        if (d < bestD) { bestD = d; best = bs[i]; }
      }
      if (best) {
        var bp = G.proj(best.x + best.w / 2, best.y + best.h / 2);
        return [bp[0], bp[1]];
      }
    }
    return [W / 2, H / 2];
  }

  // Place la bulle pres de son ancre, entierement dans l'ecran, avec la
  // queue BD pointee vers l'ancre.
  function placeBubble() {
    if (!els) return;
    var step = STEPS[idx];
    var anchor = anchorFor(step.target);
    var W = (G.viewW && G.viewW()) || 800;
    var H = (G.viewH && G.viewH()) || 600;
    els.bubble.style.visibility = "hidden";
    els.bubble.style.left = "0px";
    els.bubble.style.top = "0px";
    var bw = els.bubble.offsetWidth || 320;
    var bh = els.bubble.offsetHeight || 160;
    var margin = 14;
    var above = anchor[1] > H / 2; // ancre en bas -> bulle au-dessus
    var x = anchor[0] - bw * 0.4;
    var y = above ? anchor[1] - bh - 18 : anchor[1] + 18;
    x = Math.max(margin, Math.min(x, W - bw - margin));
    y = Math.max(margin, Math.min(y, H - bh - margin));
    els.bubble.style.left = Math.round(x) + "px";
    els.bubble.style.top = Math.round(y) + "px";
    // Queue : bord le plus proche de l'ancre, pointe vers elle.
    var tx = Math.max(16, Math.min(anchor[0] - x, bw - 32));
    els.tail.style.left = Math.round(tx) + "px";
    if (above) {
      els.tail.style.top = Math.round(bh - 8) + "px";
      els.tail.style.bottom = "auto";
      els.tail.className = "tuto-bubble__tail tuto-bubble__tail--down";
    } else {
      els.tail.style.top = "-8px";
      els.tail.className = "tuto-bubble__tail tuto-bubble__tail--up";
    }
    els.bubble.style.visibility = "visible";
  }

  function showStep() {
    if (!els || idx < 0 || idx >= STEPS.length) return;
    var step = STEPS[idx];
    els.title.textContent = step.title;
    els.text.textContent = step.text;
    els.counter.textContent = (idx + 1) + "/" + STEPS.length;
    els.layer.hidden = false;
    placeBubble();
  }

  function end() {
    activeFlag = false;
    idx = -1;
    if (G.state) G.state.tutoActive = false;
    if (els) els.layer.hidden = true;
    markSeen();
  }

  // Clavier du tuto (appele depuis input.js). Renvoie true si la touche
  // a ete consommee.
  G.tutoKey = function (code) {
    if (!G.tutoActive()) return false;
    if (code === "Space") {
      idx += 1;
      if (idx >= STEPS.length) { end(); return true; }
      showStep();
      return true;
    }
    if (code === "Escape") { end(); return true; }
    return false;
  };

  // Proposition au demarrage d'une partie (local : apres buildWorld ;
  // serveur : apres "joined"/"restart"). Ne fait rien si le tuto a deja
  // ete propose une fois (localStorage) ou si le DOM n'est pas pret.
  G.tutoMaybeStart = function () {
    if (G.tutoSeen() || activeFlag) return false;
    if (typeof document === "undefined" || !document.getElementById) return false;
    if (!buildDom()) return false;
    idx = 0;
    activeFlag = true;
    if (G.state) G.state.tutoActive = true;
    showStep();
    return true;
  };

  // Replace la bulle quand la fenetre change de taille.
  if (typeof window !== "undefined" && window.addEventListener && !G._tutoResizeBound) {
    window.addEventListener("resize", function () {
      if (G.tutoActive()) placeBubble();
    });
    G._tutoResizeBound = true;
  }
})();
