// Joueur : déplacement, collisions bâtiments, entrée/sortie bâtiments, soin hôpital.
(function () {
  "use strict";
  var G = window.GAME = window.GAME || {};

  G.aabbHitsBuildings = function (x, y) {
    var bx = x - G.PLAYER_HALF, by = y - G.PLAYER_HALF;
    var bw = G.PLAYER_W, bh = G.PLAYER_W;
    for (var i = 0; i < G.state.buildings.length; i++) {
      var b = G.state.buildings[i];
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
    if (!G.aabbHitsBuildings(testX, testY) && !G.aabbHitsWalls(testX - G.PLAYER_HALF, testY - G.PLAYER_HALF, G.PLAYER_W, G.PLAYER_W) &&
        testX >= G.PLAYER_HALF && testX <= G.WORLD - G.PLAYER_HALF &&
        testY >= G.PLAYER_HALF && testY <= G.WORLD - G.PLAYER_HALF) {
      p.y = testY;
      advanced = true;
    }
    testY = p.y;
    testX = nx;
    if (!G.aabbHitsBuildings(testX, testY) && !G.aabbHitsWalls(testX - G.PLAYER_HALF, testY - G.PLAYER_HALF, G.PLAYER_W, G.PLAYER_W) &&
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

  G.leaveBuilding = function () {
    var b = G.state.inBuilding;
    if (b) {
      G.state.player.x = b.door.x;
      G.state.player.y = b.door.y + 140;
      G.clampPlayer();
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
  G.drawChest = function () {
    var state = G.state;
    var vault = G.chestVault;
    var bag = G.chestBag;
    // Coffre : boutons cliquables pour récupérer un objet vers le sac.
    vault.innerHTML = "";
    var vaultList = document.createElement("div");
    vaultList.className = "chest__list";
    if (state.chest.length === 0) {
      var emptyVault = document.createElement("p");
      emptyVault.textContent = "Coffre vide";
      vaultList.appendChild(emptyVault);
    } else {
      for (var i = 0; i < state.chest.length; i++) {
        var vi = state.chest[i];
        var vbtn = document.createElement("button");
        vbtn.type = "button";
        vbtn.className = "btn chest__item";
        vbtn.textContent = vi.name + (vi.kind === "arme" ? " (arme)" : vi.kind === "outil" ? " (outil)" : "");
        (function (idx) {
          vbtn.addEventListener("click", function () { G.withdrawItem(idx); });
        })(i);
        vaultList.appendChild(vbtn);
      }
    }
    vault.appendChild(vaultList);
    // Sac : boutons cliquables pour déposer un objet vers le coffre.
    bag.innerHTML = "";
    var list = document.createElement("div");
    list.className = "chest__list";
    if (state.bag.contents.length === 0) {
      var empty = document.createElement("p");
      empty.textContent = "Sac vide";
      list.appendChild(empty);
    } else {
      for (var i = 0; i < state.bag.contents.length; i++) {
        var it = state.bag.contents[i];
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn chest__item";
        btn.textContent = it.name + (it.kind === "arme" ? " (arme)" : it.kind === "outil" ? " (outil)" : "");
        (function (idx) {
          btn.addEventListener("click", function () { G.depositItem(idx); });
        })(i);
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

  G.hasGoldPiece = function () {
    for (var i = 0; i < G.state.bag.contents.length; i++) {
      if (G.state.bag.contents[i].name === "Pièce") return i;
    }
    return -1;
  };

  G.tryHealAtHospital = function () {
    var state = G.state;
    if (state.player.hp >= G.PLAYER_MAX_HP) {
      state.bag.open = true;
      return;
    }
    var idx = G.hasGoldPiece();
    if (idx < 0) {
      state.bag.open = true;
      return;
    }
    state.bag.contents.splice(idx, 1);
    state.inventory = Math.max(0, state.inventory - 1);
    state.player.hp = G.PLAYER_MAX_HP;
    G.updateHud();
  };
})();
