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
    var testX = p.x;
    var testY = ny;
    if (!G.aabbHitsBuildings(testX, testY) &&
        testX >= G.PLAYER_HALF && testX <= G.WORLD - G.PLAYER_HALF &&
        testY >= G.PLAYER_HALF && testY <= G.WORLD - G.PLAYER_HALF) {
      p.y = testY;
      moved = true;
    }
    testY = p.y;
    testX = nx;
    if (!G.aabbHitsBuildings(testX, testY) &&
        testX >= G.PLAYER_HALF && testX <= G.WORLD - G.PLAYER_HALF &&
        testY >= G.PLAYER_HALF && testY <= G.WORLD - G.PLAYER_HALF) {
      p.x = testX;
      moved = true;
    }
    return moved;
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

  // Affiche le contenu du coffre et du sac dans l'écran de coffre.
  G.drawChest = function () {
    var state = G.state;
    var vault = G.chestVault;
    var bag = G.chestBag;
    if (state.chest.length === 0) {
      vault.textContent = "Coffre vide";
    } else {
      vault.textContent = state.chest.map(function (it) {
        return (it.kind === "arme" || it.kind === "outil") ? it.name : it.name;
      }).join(", ");
    }
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
