// Joueur : déplacement, collisions bâtiments, entrée/sortie bâtiments, soin hôpital.
(function () {
  "use strict";
  var G = window.GAME = window.GAME || {};

  G.aabbHitsBuildings = function (x, y) {
    var bx = x - G.PLAYER_HALF, by = y - G.PLAYER_HALF;
    var bw = G.PLAYER_W, bh = G.PLAYER_W;
    for (var i = 0; i < G.state.buildings.length; i++) {
      var b = G.state.buildings[i];
      if (b.isForet && G.foretDepleted(b)) continue;
      if (bx < b.x + b.w && bx + bw > b.x && by < b.y + b.h && by + bh > b.y) {
        return true;
      }
    }
    return false;
  };

  G.tryMove = function (nx, ny) {
    var p = G.state.player;
    var moved = false;
    // Sous-pas : on avance vers (nx,ny) par incrément ≤ STEP px pour ne pas
    // traverser une planche fine en un seul grand pas.
    var STEP = 8;
    var targetX = nx, targetY = ny;
    while (p.x !== targetX || p.y !== targetY) {
      var px = p.x, py = p.y;
      var dxs = targetX - p.x, dys = targetY - p.y;
      var len = Math.sqrt(dxs * dxs + dys * dys);
      if (len <= STEP) {
 if (G._stepMove(targetX, targetY)) moved = true; break;
      }
      var sx = p.x + (dxs / len) * STEP;
      var sy = p.y + (dys / len) * STEP;
      if (!G._stepMove(sx, sy)) break;
      if (p.x === px && p.y === py) break; // aucun progres : stoppe pour eviter boucle infinie.
      moved = true;
    }
    return moved;
  };

  // Avance d'un seul sous-pas (axe par axe, glisse le long des murs/planches).
  G._stepMove = function (nx, ny) {
    var p = G.state.player;
    var advanced = false;
    var testX = p.x;
    var testY = ny;
    if (!G.aabbHitsBuildings(testX, testY) && !G.aabbHitsWalls(testX - G.PLAYER_HALF, testY - G.PLAYER_HALF, G.PLAYER_W, G.PLAYER_W, true) &&
        testX >= G.PLAYER_HALF && testX <= G.WORLD - G.PLAYER_HALF &&
        testY >= G.PLAYER_HALF && testY <= G.WORLD - G.PLAYER_HALF) {
      p.y = testY;
      advanced = true;
    }
    testY = p.y;
    testX = nx;
    if (!G.aabbHitsBuildings(testX, testY) && !G.aabbHitsWalls(testX - G.PLAYER_HALF, testY - G.PLAYER_HALF, G.PLAYER_W, G.PLAYER_W, true) &&
        testX >= G.PLAYER_HALF && testX <= G.WORLD - G.PLAYER_HALF &&
        testY >= G.PLAYER_HALF && testY <= G.WORLD - G.PLAYER_HALF) {
      p.x = testX;
      advanced = true;
    }
    return advanced;
  };

  G.clampPlayer = function () {
    var p = G.state.player;
    p.x = G.clamp(p.x, G.PLAYER_HALF, G.WORLD - G.PLAYER_HALF);
    p.y = G.clamp(p.y, G.PLAYER_HALF, G.WORLD - G.PLAYER_HALF);
  };

  G.enterBuilding = function (b) {
    G.state.inBuilding = b;
    G.buildingName.textContent = b.name;
    G.buildingMsg.textContent = b.msg;
    G.buildingScreen.hidden = false;
  };

  // Cherche une position libre (hors bâtiments/arbres/murs) près de (x, y).
  // Si inTown est vrai, la position doit rester dans la ville. Recherche en
  // spirale par pas croissants autour du point pour trouver la plus proche.
  G.findFreeSpotNear = function (x, y, inTown) {
    var p = G.state.player;
    var step = 20, maxR = 400;
    for (var r = 0; r <= maxR; r += step) {
      for (var ang = 0; ang < Math.PI * 2; ang += Math.PI / 4) {
        var cx = x + Math.cos(ang) * r;
        var cy = y + Math.sin(ang) * r;
        if (cx < G.PLAYER_HALF || cx > G.WORLD - G.PLAYER_HALF) continue;
        if (cy < G.PLAYER_HALF || cy > G.WORLD - G.PLAYER_HALF) continue;
        if (inTown && !G.inTown(cx, cy)) continue;
        if (G.aabbHitsBuildings(cx, cy)) continue;
        if (G.aabbHitsWalls(cx - G.PLAYER_HALF, cy - G.PLAYER_HALF, G.PLAYER_W, G.PLAYER_W, true)) continue;
        return { x: cx, y: cy };
      }
    }
    return null;
  };
  G.leaveBuilding = function () {
    var b = G.state.inBuilding;
    if (b) {
      // Sort en bas de la porte, puis cherche une position libre à proximité
      // (reste dans la ville pour ne pas se retrouver hors des murs).
      var spot = G.findFreeSpotNear(b.door.x, b.door.y + 60, true);
      if (spot) {
        G.state.player.x = spot.x;
        G.state.player.y = spot.y;
      } else {
        G.state.player.x = b.door.x;
        G.state.player.y = b.door.y + 60;
        G.clampPlayer();
      }
    }
    G.state.inBuilding = null;
    G.buildingScreen.hidden = true;
  };

  // Coffre de la mairie : déposer des objets du sac.
  G.openMairieChest = function () {
    var state = G.state;
    state.chestOpen = true;
    state.paused = false;
    G.pauseScreen.hidden = true;
    G.drawChest();
    G.chestScreen.hidden = false;
  };

  // Eglise : ouvre le panneau (comme le coffre de la mairie) pour déposer
  // une relique et gagner 100 pièces d'or. Le son church.mp3 se joue à l'ouverture.
  G.openChurch = function () {
    var state = G.state;
    if (G.playSfx) G.playSfx("church");
    state.churchOpen = true;
    state.paused = false;
    G.pauseScreen.hidden = true;
    G.drawChurch();
    G.churchScreen.hidden = false;
  };

  G.closeChurch = function () {
    G.state.churchOpen = false;
    if (G.churchScreen) G.churchScreen.hidden = true;
  };

  // Centre de decollage de montgolfiere : affiche le volume et la direction
  // de la prochaine vague (pre-tiree le matin, cf. rollWave dans zombies.js).
  G.openMontgolfiere = function () {
    var state = G.state;
    state.paused = false;
    G.pauseScreen.hidden = true;
    G.drawMontgolfiere();
    if (G.montgolfiereScreen) G.montgolfiereScreen.hidden = false;
  };

  G.closeMontgolfiere = function () {
    if (G.montgolfiereScreen) G.montgolfiereScreen.hidden = true;
  };

  var SIDE_NAMES = ["nord", "sud", "ouest", "est"];

  G.drawMontgolfiere = function () {
    var info = G.montgolfiereInfo;
    if (!info) return;
    var pw = G.state.pendingWave;
    if (!pw) {
      info.textContent = "Aucune observation pour le moment.";
      return;
    }
    var dirTxt = pw.sides.map(function (s) { return SIDE_NAMES[s] || "?"; }).join(", ");
    info.innerHTML = "";
    var p1 = document.createElement("p");
    p1.textContent = "Prochaine horde : " + pw.count + " zombies";
    var p2 = document.createElement("p");
    p2.textContent = "Arrivée : " + (pw.sides.length === 4 ? "de toutes parts" : (pw.sides.length === 1 ? "du " + dirTxt : "du " + dirTxt + " (tenaille)"));
    info.appendChild(p1);
    info.appendChild(p2);
  };

  // Universite : placeholder pret a recevoir de futures ameliorations.
  G.openUniversite = function () {
    var state = G.state;
    state.paused = false;
    G.pauseScreen.hidden = true;
    G.drawUniversite();
    if (G.universiteScreen) G.universiteScreen.hidden = false;
  };

  G.closeUniversite = function () {
    if (G.universiteScreen) G.universiteScreen.hidden = true;
  };

  G.drawUniversite = function () {
    var info = G.universiteInfo;
    if (!info) return;
    info.textContent = "Aucune amélioration disponible pour le moment. De futures recherches y seront enseignées.";
  };

  // Vend une relique (index dans le sac) : +100 or. En réseau, le serveur
  // est autorité (le client demande churchDeposit ; l'or revient via l'état).
  G.sellRelic = function (index) {
    var state = G.state;
    if (index < 0 || index >= state.bag.contents.length) return;
    var it = state.bag.contents[index];
    if (it.name !== "Relique") return;
    if (G.netConnected && G.netConnected()) {
      G.netInput({ churchDeposit: true });
      // Le serveur retire la relique et ajoute l'or ; on la retire aussi
      // localement pour l'affichage immédiat (l'état serveur confirmera).
      state.bag.contents.splice(index, 1);
      state.inventory = state.bag.contents.length;
      G.drawChurch();
      G.updateHud();
      return;
    }
    state.bag.contents.splice(index, 1);
    state.inventory = state.bag.contents.length;
    state.mairieGold = (state.mairieGold || 0) + 100;
    if (G.addFloater) G.addFloater("100 pièces d'or");
    G.drawChurch();
    G.updateHud();
  };

  // Affiche les reliques du sac (cliquables pour vendre) + l'or courant.
  G.drawChurch = function () {
    var state = G.state;
    if (G.churchGold) G.churchGold.textContent = String(state.mairieGold || 0);
    var bag = G.churchBag;
    if (!bag) return;
    bag.innerHTML = "";
    var list = document.createElement("div");
    list.className = "chest__list";
    // Filtre les reliques du sac (groupées).
    var relics = [];
    for (var i = 0; i < state.bag.contents.length; i++) {
      if (state.bag.contents[i].name === "Relique") relics.push(i);
    }
    if (G.churchVault) {
      G.churchVault.textContent = relics.length > 0
        ? ("Reliques : " + relics.length)
        : "Aucune relique dans votre sac";
    }
    if (relics.length === 0) {
      var empty = document.createElement("p");
      empty.textContent = "(ramassez une relique puis revenez la vendre)";
      list.appendChild(empty);
    } else {
      for (var r = 0; r < relics.length; r++) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn chest__item";
        btn.textContent = "Relique  —  Vendre (+100 or)";
        (function (idx) {
          btn.addEventListener("click", function () { G.sellRelic(idx); });
        })(relics[r]);
        list.appendChild(btn);
      }
    }
    bag.appendChild(list);
  };

  G.closeChest = function () {
    G.state.chestOpen = false;
    G.chestScreen.hidden = true;
  };

  // Dépose un objet du sac (index) dans le coffre de la mairie.
  G.depositItem = function (index) {
    var state = G.state;
    if (index < 0 || index >= state.bag.contents.length) return;
    var it = state.bag.contents[index];
    // Déséquipe si on dépose l'arme équipée ou la hache.
    if (it.kind === "arme" && state.equipped === it.name) state.equipped = null;
    if (it.kind === "outil" && it.name === "Hache") state.axeEquipped = false;
    state.chest.push(it);
    state.bag.contents.splice(index, 1);
    state.inventory = state.bag.contents.length;
    G.drawChest();
    G.updateHud();
  };

  // Récupère un objet du coffre (index) vers le sac.
  G.withdrawItem = function (index) {
    var state = G.state;
    if (index < 0 || index >= state.chest.length) return;
    var it = state.chest[index];
    state.bag.contents.push(it);
    state.inventory = state.bag.contents.length;
    state.chest.splice(index, 1);
    G.drawChest();
    G.updateHud();
  };

  // Affiche le contenu du coffre et du sac dans l'écran de coffre.
  // Demande le deblocage de la scierie : achat direct en solo (si le coffre
  // suffit), proposition de vote en multijoueur (serveur autoritaire).
  G.buyScierie = function () {
    var state = G.state;
    if (state.scierieUnlocked) return;
    if (G.netConnected && G.netConnected()) {
      G.netInput({ techVote: "scierie" });
      if (G.addFloater) G.addFloater("Vote lancé (15 s)");
      G.drawChest();
      return;
    }
    if (G.unlockScierie()) {
      if (G.addFloater) G.addFloater("Scierie débloquée ! Z + posez-la en ville");
      G.drawChest();
      G.updateHud();
    } else {
      if (G.addFloater) G.addFloater("Il faut 100 planches + 10 or au coffre");
    }
  };

  // Section Technologies du coffre de la mairie : un bouton par batiment de
  // ville du registre TOWN_BUILDINGS (scierie, universite, montgolfiere, ...
  // futurs ajouts automatiques). Achat direct en solo, vote en multi.
  G.drawChestTech = function () {
    var state = G.state;
    var tech = G.chestTech;
    if (!tech) return;
    if (G.chestGold) G.chestGold.textContent = String(state.mairieGold || 0);
    tech.innerHTML = "";
    var list = document.createElement("div");
    list.className = "chest__list";
    var h = document.createElement("p");
    h.textContent = "Technologies";
    list.appendChild(h);
    for (var tb in G.TOWN_BUILDINGS) {
      if (!G.TOWN_BUILDINGS.hasOwnProperty(tb)) continue;
      var tdef = G.TOWN_BUILDINGS[tb];
      var b = state[tdef.stateField];
      if (state[tdef.unlockedField]) {
        var ok = document.createElement("p");
        ok.textContent = tdef.label + " : débloquée" + (b ? (b.chantierDone ? " (bâtiment posé)" : " (en construction)") : " — posez-la en ville (Z)");
        list.appendChild(ok);
      } else {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn chest__item";
        var label = tdef.label + " — " + tdef.cost.planks + " planches + " + tdef.cost.gold + " or";
        var net = G.netConnected && G.netConnected();
        var voteActive = net && state.vote && state.vote.proposal === tb;
        if (voteActive) {
          label += " — VOTE en cours : " + Math.max(0, Math.ceil((state.vote.endsAt || 0) - (state.time || 0))) + " s (clic = voter pour)";
        }
        btn.textContent = label;
        (function (id) {
          btn.addEventListener("click", function () { G.buyTownTech(id); });
        })(tb);
        list.appendChild(btn);
      }
    }
    tech.appendChild(list);
  };

  // Demande le deblocage d'une tech de batiment de ville : achat direct en
  // solo (si le coffre suffit), proposition de vote en multijoueur.
  G.buyTownTech = function (id) {
    var state = G.state;
    var tdef = G.TOWN_BUILDINGS[id];
    if (!tdef || state[tdef.unlockedField]) return;
    if (G.netConnected && G.netConnected()) {
      G.netInput({ techVote: id });
      if (G.addFloater) G.addFloater("Vote lancé (15 s)");
      G.drawChest();
      return;
    }
    if (G.unlockTownTech(id)) {
      if (G.addFloater) G.addFloater(tdef.label + " débloquée ! Z + posez-la en ville");
      G.drawChest();
      G.updateHud();
    } else {
      if (G.addFloater) G.addFloater("Il faut " + tdef.cost.planks + " planches + " + tdef.cost.gold + " or au coffre");
    }
  };

  G.drawChest = function () {
    var state = G.state;
    G.drawChestTech();
    var vault = G.chestVault;
    var bag = G.chestBag;
    // Coffre : objets groupés (même nom + type) avec leur nombre.
    vault.innerHTML = "";
    var vaultList = document.createElement("div");
    vaultList.className = "chest__list";
    if (state.chest.length === 0) {
      var emptyVault = document.createElement("p");
      emptyVault.textContent = "Coffre vide";
      vaultList.appendChild(emptyVault);
    } else {
      var vGroups = G.groupItems(state.chest);
      for (var gi = 0; gi < vGroups.length; gi++) {
        var g = vGroups[gi];
        var vbtn = document.createElement("button");
        vbtn.type = "button";
        vbtn.className = "btn chest__item";
        var vlabel = g.name;
        if (g.count > 1) vlabel += " ×" + g.count;
        vlabel += g.kind === "arme" ? " (arme)" : g.kind === "outil" ? " (outil)" : "";
        vbtn.textContent = vlabel;
        (function (idx) {
          vbtn.addEventListener("click", function () { G.withdrawItem(idx); });
        })(g.first);
        vaultList.appendChild(vbtn);
      }
    }
    vault.appendChild(vaultList);
    // Sac : objets groupés avec leur nombre.
    bag.innerHTML = "";
    var list = document.createElement("div");
    list.className = "chest__list";
    if (state.bag.contents.length === 0) {
      var empty = document.createElement("p");
      empty.textContent = "Sac vide";
      list.appendChild(empty);
    } else {
      var bGroups = G.groupItems(state.bag.contents);
      for (var bi = 0; bi < bGroups.length; bi++) {
        var bg = bGroups[bi];
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn chest__item";
        var blabel = bg.name;
        if (bg.count > 1) blabel += " ×" + bg.count;
        blabel += bg.kind === "arme" ? " (arme)" : bg.kind === "outil" ? " (outil)" : "";
        btn.textContent = blabel;
        (function (idx) {
          btn.addEventListener("click", function () { G.depositItem(idx); });
        })(bg.first);
        list.appendChild(btn);
      }
    }
    bag.appendChild(list);
  };

  G.togglePause = function () {
    if (G.state.inBuilding) return;
    G.state.paused = !G.state.paused;
    G.pauseScreen.hidden = !G.state.paused;
  };
})();
