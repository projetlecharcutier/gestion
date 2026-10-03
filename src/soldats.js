// Soldats romains : 50 legionnaires en armure autour du camp romain
// (ville PNG "camp_romain"), en 5 patrouilles de 10. Ils chargent quiconque
// penetre le perimetre du camp, frappent fort mais sont fragiles, ne
// s'eloignent jamais trop du camp, et sont totalement neutres envers les
// zombies (aucune attaque dans un sens ni dans l'autre).
//
// APPARENCE : rendu procedural par defaut ; REMPLACABLE par un PNG pose dans
// assets/sprites/Soldat_romain/soldat.png (charge automatiquement s'il
// existe, sinon rendu procedural). Le PNG peut etre change a tout moment.
(function () {
  "use strict";
  var G = window.GAME = window.GAME || {};

  // --- Reglages ------------------------------------------------------------
  G.SOLDATS_COUNT = 50;       // total autour du camp
  G.SOLDATS_PAR_PATROUILLE = 10;   // 5 patrouilles de 10
  G.SOLDATS_HP = 30;         // fragile
  G.SOLDATS_DMG = 45;        // gros degats
  G.SOLDATS_ATTACK_CD = 0.8;
  G.SOLDATS_SPEED = 150;     // course (ils courent)
  G.SOLDATS_PATROL_SPEED = 60;
  // Le camp romain : centre monde (position par defaut, la vraie position
  // vient de la ville "camp_romain" si elle est posee, cf. spawnSoldats).
  G.CAMP_ROMAIN_POS = { x: 4500, y: 15500 };
  // Rayon du perimetre garde : patrouilles + distance max au camp.
  G.SOLDATS_RAYON = 900;         // rayon de patrouille autour du centre
  G.SOLDATS_RAYON_MAX = 1300;    // distance maximale au camp (leash)
  G.SOLDATS_AGRO = 420;          // distance de detection d'un intrus
  G.SOLDATS_HIT_R = 16;          // portee de coup
  // Le glaive d'or au milieu du camp : vendable 500 or a l'eglise.
  G.GLAIVE_PRICE = 500;

  // Trouve la ville camp_romain dans state.villes (ou la position par defaut).
  function campCentre(state) {
    var vs = state.villes || [];
    for (var i = 0; i < vs.length; i++) {
      if (vs[i].sprite === "camp_romain" || vs[i].name === "Camp romain") {
        return { x: vs[i].cx || vs[i].x + vs[i].w / 2, y: vs[i].cy || vs[i].y + vs[i].h / 2 };
      }
    }
    return { x: G.CAMP_ROMAIN_POS.x, y: G.CAMP_ROMAIN_POS.y };
  }

  // Position d'un soldat d'une patrouille : la patrouille tourne autour du
  // camp en cercle (angle commun qui avance), chaque soldat garde son slot.
  function spawnSoldat(state, patIdx, slotIdx, angBase) {
    var c = campCentre(state);
    var rayon = G.SOLDATS_RAYON * (0.75 + 0.25 * ((patIdx % 3) / 2));
    var ang = angBase + (slotIdx / G.SOLDATS_PAR_PATROUILLE) * Math.PI * 2;
    return {
      x: c.x + Math.cos(ang) * rayon,
      y: c.y + Math.sin(ang) * rayon,
      hp: G.SOLDATS_HP,
      pat: patIdx,            // index de patrouille (0..4)
      slot: slotIdx,          // position dans la patrouille (0..9)
      ang: angBase,           // angle de patrouille commun a la patrouille
      rayon: rayon,
      cible: null,            // { x, y, ent } intrus poursuit
      atkCd: 0,
      vx: 0, vy: 0,           // direction pour le rendu (course gauche/droite)
      hitFlash: 0
    };
  }

  // Pose les 50 soldats : 5 patrouilles de 10, angles decales regulierement.
  G.spawnSoldats = function (state) {
    var st = state || G.state;
    st.soldats = [];
    var nbPat = G.SOLDATS_COUNT / G.SOLDATS_PAR_PATROUILLE;
    for (var p = 0; p < nbPat; p++) {
      var angBase = (p / nbPat) * Math.PI * 2;
      for (var s = 0; s < G.SOLDATS_PAR_PATROUILLE; s++) {
        st.soldats.push(spawnSoldat(st, p, s, angBase));
      }
    }
  };

  // Le glaive d'or : pose au MILIEU du camp, vendable 500 or a l'eglise.
  G.placeGlaiveOr = function (state) {
    var st = state || G.state;
    for (var i = 0; i < st.items.length; i++) {
      if (st.items[i].name === "Glaive en or") return;
    }
    var c = campCentre(st);
    st.items.push({
      x: c.x, y: c.y, taken: false,
      name: "Glaive en or", color: "#f5c542", kind: "objet",
      glaive: true
    });
  };

  // Intrus le plus proche dans le perimetre (joueur solo ou joueurs reseau).
  // Les zombies ne comptent PAS : les soldats les ignorent totalement.
  function intrusLePlusProche(st, s) {
    var best = null, bestD = Infinity;
    function consider(x, y, ent) {
      var dx = x - s.x, dy = y - s.y;
      var d = Math.sqrt(dx * dx + dy * dy);
      if (d < bestD && d < G.SOLDATS_AGRO) { bestD = d; best = { x: x, y: y, ent: ent }; }
    }
    var p = st.player;
    if (p && p.alive !== false) consider(p.x, p.y, p);
    var ps = st.players || [];
    for (var i = 0; i < ps.length; i++) {
      if (ps[i].alive) consider(ps[i].x, ps[i].y, ps[i]);
    }
    return best;
  }

  // Un soldat poursuit TANT QU'il reste dans le leash ; sinon il abandonne
  // et rejoint sa patrouille (les soldats ne s'eloignent jamais du camp).
  function distCamp(st, x, y) {
    var c = campCentre(st);
    var dx = x - c.x, dy = y - c.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Deplacement avec collision batiments (axe par axe, glisse).
  function moveAvecCollision(st, s, nx, ny) {
    if (G.tryMoveSoldat) {
      return G.tryMoveSoldat(s, nx, ny);
    }
    s.x = nx; s.y = ny;
    return true;
  }

  // Mise a jour d'une patrouille : l'angle commun avance (les soldats tournent
  // autour du camp en file indienne), chaque soldat garde son slot. Si un
  // soldat voit un intrus, il charge ; hors du leash, il revient.
  function updateSoldat(st, s, dt) {
    var c = campCentre(st);
    if (s.atkCd > 0) s.atkCd -= dt;
    if (s.hitFlash > 0) s.hitFlash -= dt;

    // Poursuite d'un intrus deja acquis ?
    var encore = s.cible && s.cible.ent && s.cible.ent.alive !== false &&
                 distCamp(st, s.cible.x, s.cible.y) < G.SOLDATS_RAYON_MAX;
    if (s.cible && !encore) s.cible = null;

    // Detection d'un nouvel intrus (uniquement si le soldat patrouille).
    if (!s.cible) {
      var intrus = intrusLePlusProche(st, s);
      if (intrus) s.cible = intrus;
    }

    var spd;
    if (s.cible) {
      // Charge l'intrus : course, frappe a portee.
      var dx = s.cible.x - s.x, dy = s.cible.y - s.y;
      var d = Math.sqrt(dx * dx + dy * dy) || 1;
      spd = G.SOLDATS_SPEED;
      if (d > G.SOLDATS_HIT_R) {
        var step = spd * dt;
        moveAvecCollision(st, s, s.x + (dx / d) * step, s.y + (dy / d) * step);
        s.vx = dx / d; s.vy = dy / d;
      } else if (s.atkCd <= 0) {
        // GROS DEGATS : 45 par coup, cooldown court.
        s.atkCd = G.SOLDATS_ATTACK_CD;
        var tgt = s.cible.ent;
        tgt.hp -= G.SOLDATS_DMG;
        s.vx = dx / d; s.vy = dy / d;
        // Mise a mort du joueur (solo : gameOver ; reseau : alive=false par
        // le serveur via le meme code partage).
        if (tgt.hp <= 0) {
          tgt.hp = 0;
          if (st.gameOver !== undefined && st.players === undefined) {
            st.gameOver = true;
            if (st.gameOverCause !== undefined) st.gameOverCause = "player";
          } else if (st.players) {
            tgt.alive = false;
            var anyAlive = false;
            for (var pi = 0; pi < st.players.length; pi++) {
              if (st.players[pi].alive) { anyAlive = true; break; }
            }
            if (!anyAlive) { st.gameOver = true; st.gameOverCause = "player"; }
          }
        }
        // Le soldat n'acharne pas : apres le coup, retourne vers sa patrouille
        // si la cible s'est eloignee du leash (re-evalue au prochain tick).
      }
      // Leash : jamais trop loin du camp.
      if (distCamp(st, s.x, s.y) > G.SOLDATS_RAYON_MAX) {
        s.cible = null;
      }
    } else {
      // Patrouille : l'angle de patrouille avance lentement, le soldat
      // rejoint son slot sur le cercle de sa patrouille.
      s.ang += (G.SOLDATS_PATROL_SPEED / s.rayon) * dt;
      var slotAng = s.ang + (s.slot / G.SOLDATS_PAR_PATROUILLE) * Math.PI * 2;
      var tx = c.x + Math.cos(slotAng) * s.rayon;
      var ty = c.y + Math.sin(slotAng) * s.rayon;
      var pdx = tx - s.x, pdy = ty - s.y;
      var pd = Math.sqrt(pdx * pdx + pdy * pdy);
      if (pd > 4) {
        var pstep = G.SOLDATS_PATROL_SPEED * dt;
        if (pstep > pd) pstep = pd;
        moveAvecCollision(st, s, s.x + (pdx / pd) * pstep, s.y + (pdy / pd) * pstep);
        s.vx = pdx / pd; s.vy = pdy / pd;
      } else {
        s.vx = 0; s.vy = 0;
      }
    }
  }

  G.updateSoldats = function (dt) {
    var st = G.state;
    var so = st.soldats;
    if (!so) return;
    for (var i = 0; i < so.length; i++) updateSoldat(st, so[i], dt);
  };

  // Retire les soldats morts (hp <= 0) : fragiles, une balle les tue.
  // Un soldat tue respawn le lendemain (repopSoldats, cf. nouveau jour).
  G.cleanupSoldats = function () {
    var so = G.state.soldats;
    if (!so) return;
    for (var i = so.length - 1; i >= 0; i--) {
      if (so[i].hp <= 0) so.splice(i, 1);
    }
  };

  // Repop du matin : complete les patrouilles a 50 soldats.
  G.repopSoldats = function () {
    var st = G.state;
    if (!st.soldats) st.soldats = [];
    var nbPat = G.SOLDATS_COUNT / G.SOLDATS_PAR_PATROUILLE;
    while (st.soldats.length < G.SOLDATS_COUNT) {
      var s = st.soldats.length % G.SOLDATS_PAR_PATROUILLE;
      var p = st.soldats.length % nbPat;
      st.soldats.push(spawnSoldat(st, p, s, (p / nbPat) * Math.PI * 2));
    }
  };

  // Deplacement d'un soldat avec collisions (batiments + villes PNG), axe
  // par axe avec glisse. Reutilise les grilles existantes ; taille de
  // collision equivalente au joueur.
  G.tryMoveSoldat = function (s, nx, ny) {
    var HALF = (G.PLAYER_W || 20) / 2;
    function libre(x, y) {
      if (x < HALF || y < HALF || x > G.WORLD - HALF || y > G.WORLD - HALF) return false;
      if (G.aabbHitsBuildings && G.aabbHitsBuildings(x, y)) return false;
      if (G.aabbHitsVilles && G.aabbHitsVilles(x - HALF, y - HALF, HALF * 2, HALF * 2)) return false;
      if (G.aabbHitsWalls && G.aabbHitsWalls(x - HALF, y - HALF, HALF * 2, HALF * 2, false)) return false;
      return true;
    }
    var moved = false;
    if (libre(nx, s.y)) { s.x = nx; moved = true; }
    if (libre(s.x, ny)) { s.y = ny; moved = true; }
    return moved;
  };

  // ---------------------------------------------------------------------
  // RENDU : procedural par defaut, PNG de remplacement optionnel.
  // Le PNG se charge depuis assets/sprites/Soldat_romain/soldat.png (le
  // premier PNG trouve du dossier). Changez le fichier, le rendu suit au
  // prochain chargement -- aucune modification de code requise.
  // ---------------------------------------------------------------------
  var _soldatSprite = null;   // { img, w, h } si PNG disponible
  var _soldatSpriteChecked = false;

  G.soldatSpritePath = "assets/sprites/Soldat_romain/soldat.png";

  function checkSoldatSprite() {
    if (_soldatSpriteChecked) return _soldatSprite;
    _soldatSpriteChecked = true;
    if (typeof document === "undefined") return null;
    try {
      var img = new Image();
      img.onload = function () {
        if (img.naturalWidth) _soldatSprite = { img: img, w: img.naturalWidth, h: img.naturalHeight };
      };
      img.src = G.soldatSpritePath;
    } catch (e) { /* pas de DOM : rendu procedural */ }
    return null;
  }

  // Dessine un soldat : PNG de remplacement si charge, sinon legionnaire
  // procedural (armure rouge/gris, casque a crete, bouclier, jambes animees).
  G.drawSoldat = function (s) {
    var ctx = G.ctx;
    var z = G.state.zoom;
    var base = G.proj(s.x, s.y);
    var cell = Math.max(1.4, z * 0.6);
    checkSoldatSprite();
    ctx.save();
    // Ombre au sol.
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath();
    ctx.ellipse(base[0], base[1], 5 * cell, 2.2 * cell, 0, 0, Math.PI * 2);
    ctx.fill();
    // Face au sens du deplacement.
    var flip = s.vx < 0;
    if (flip) {
      ctx.translate(base[0], 0);
      ctx.scale(-1, 1);
      ctx.translate(-base[0], 0);
    }
    if (_soldatSprite) {
      // PNG personnalise : dessine centré, pieds au sol, ~2.2x la taille
      // d'une cellule de large (le PNG peut faire n'importe quelle taille).
      var dw = _soldatSprite.w * cell * 0.12;
      var dh = _soldatSprite.h * cell * 0.12;
      ctx.drawImage(_soldatSprite.img, base[0] - dw / 2, base[1] - dh, dw, dh);
    } else {
      drawSoldatProcedural(ctx, base, cell, s);
    }
    // Flash blanc quand le soldat est touche.
    if (s.hitFlash > 0) {
      ctx.globalAlpha = Math.min(0.6, s.hitFlash);
      ctx.fillStyle = "#fff";
      ctx.fillRect(base[0] - 3.4 * cell, base[1] - 7.4 * cell, 6.8 * cell, 7.4 * cell);
      ctx.globalAlpha = 1;
    }
    ctx.restore();
  };

  // Legionnaire procedural ~10x8 cellules : casque a crete rouge, armure
  // grise, tunique rouge, bouclier rond, jambes en course (2 frames par
  // oscillation de temps).
  function drawSoldatProcedural(ctx, base, cell, s) {
    var x = base[0], y = base[1];
    var t = (G.state.time || 0) * 8;
    var course = (s.vx !== 0 || s.vy !== 0);
    var jambe = course ? Math.sin(t) : 0;
    // Palette soldat.
    var rouge = "#a32638";       // crete + tunique
    var rougeFonce = "#7c1a28";
    var gris = "#8f96a3";        // armure
    var grisFonce = "#5c6270";
    var peau = "#d9a066";
    var or = "#f5c542";
    // Jambes (jambieres grises, animation de course).
    ctx.fillStyle = grisFonce;
    ctx.fillRect(x - 2.2 * cell, y - 1.8 * cell + jambe * cell, 1.2 * cell, 1.8 * cell);
    ctx.fillRect(x + 1.0 * cell, y - 1.8 * cell - jambe * cell, 1.2 * cell, 1.8 * cell);
    // Tunique rouge.
    ctx.fillStyle = rouge;
    ctx.fillRect(x - 2.2 * cell, y - 4.4 * cell, 4.4 * cell, 2.8 * cell);
    // Cuirasse grise (armure).
    ctx.fillStyle = gris;
    ctx.fillRect(x - 2.2 * cell, y - 4.6 * cell, 4.4 * cell, 1.6 * cell);
    ctx.fillStyle = or;
    ctx.fillRect(x - 0.4 * cell, y - 4.4 * cell, 0.8 * cell, 1.2 * cell);
    // Bras : porte le bouclier (avant) et le glaive (arriere leve).
    ctx.fillStyle = peau;
    ctx.fillRect(x + 1.6 * cell, y - 4.4 * cell, 1.0 * cell, 1.8 * cell);
    // Bouclier rond (rectangulaire arrondi ecran iso) cote gauche.
    ctx.fillStyle = or;
    ctx.fillRect(x - 3.4 * cell, y - 4.6 * cell, 1.6 * cell, 2.6 * cell);
    ctx.fillStyle = rougeFonce;
    ctx.fillRect(x - 3.0 * cell, y - 4.2 * cell, 0.8 * cell, 1.8 * cell);
    // Glaive (epee courte) bras arriere.
    ctx.fillStyle = "#d9d9d9";
    ctx.fillRect(x + 1.9 * cell, y - 6.6 * cell, 0.5 * cell, 2.4 * cell);
    ctx.fillStyle = or;
    ctx.fillRect(x + 1.7 * cell, y - 4.4 * cell, 0.9 * cell, 0.5 * cell);
    // Tete + casque a crete rouge (sur le dessus, signe du legionnaire).
    ctx.fillStyle = peau;
    ctx.fillRect(x - 1.0 * cell, y - 6.2 * cell, 2.0 * cell, 1.8 * cell);
    ctx.fillStyle = gris;
    ctx.fillRect(x - 1.2 * cell, y - 6.6 * cell, 2.4 * cell, 1.0 * cell);
    ctx.fillStyle = rouge;
    ctx.fillRect(x - 0.35 * cell, y - 7.6 * cell, 0.7 * cell, 1.2 * cell);
    ctx.fillStyle = rougeFonce;
    ctx.fillRect(x - 0.5 * cell, y - 7.2 * cell, 1.0 * cell, 0.4 * cell);
  }

  // Rendu du glaive d'or plante au milieu du camp : epee doree avec lueur,
  // ombre au sol. Ramassable comme tout item, vendable 500 or a l'eglise.
  G.drawGlaiveOr = function (it) {
    var ctx = G.ctx;
    var s = G.proj(it.x, it.y);
    var z = G.state.zoom;
    var cell = Math.max(1.4, z * 0.6);
    var t = (G.state.time || 0) % 2;
    var pulse = t < 1 ? t : 2 - t;
    ctx.save();
    ctx.fillStyle = "rgba(0,0,0,0.28)";
    ctx.beginPath();
    ctx.ellipse(s[0], s[1], 4 * cell, 1.8 * cell, 0, 0, Math.PI * 2);
    ctx.fill();
    // Lame doree pointee vers le haut (plantee au sol).
    ctx.fillStyle = "#f5c542";
    ctx.fillRect(s[0] - 0.8 * cell, s[1] - 7 * cell, 1.6 * cell, 5 * cell);
    ctx.fillStyle = "#fff3c4";
    ctx.fillRect(s[0] - 0.8 * cell, s[1] - 7 * cell, 0.5 * cell, 5 * cell);
    // Garde et poignee.
    ctx.fillStyle = "#b8860b";
    ctx.fillRect(s[0] - 2 * cell, s[1] - 2.2 * cell, 4 * cell, 0.7 * cell);
    ctx.fillRect(s[0] - 0.5 * cell, s[1] - 1.8 * cell, 1 * cell, 1.6 * cell);
    // Lueur douce autour de la lame.
    ctx.globalAlpha = 0.25 + pulse * 0.2;
    ctx.fillStyle = "#f5c542";
    ctx.beginPath();
    ctx.arc(s[0], s[1] - 4.5 * cell, 3.2 * cell, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  // Vente du glaive en or a l'eglise : +500 or (cf. drawChurch/sellAnneau).
  G.sellGlaive = function (index) {
    var state = G.state;
    if (index < 0 || index >= state.bag.contents.length) return;
    var it = state.bag.contents[index];
    if (it.name !== "Glaive en or") return;
    if (G.netConnected && G.netConnected()) {
      G.netInput({ glaiveSell: true });
      state.bag.contents.splice(index, 1);
      state.inventory = state.bag.contents.length;
      G.drawChurch();
      G.updateHud();
      return;
    }
    state.bag.contents.splice(index, 1);
    state.inventory = state.bag.contents.length;
    state.mairieGold = (state.mairieGold || 0) + G.GLAIVE_PRICE;
    if (G.statsAddGold) G.statsAddGold(G.GLAIVE_PRICE);
    if (G.addFloater) G.addFloater(G.GLAIVE_PRICE + " pièces d'or");
    G.drawChurch();
    G.updateHud();
  };
})();
