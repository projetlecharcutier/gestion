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
