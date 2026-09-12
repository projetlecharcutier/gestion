// Projection isométrique monde -> écran et inverse, helpers de vue.
(function () {
  "use strict";
  var G = window.GAME = window.GAME || {};

  G.viewW = function () { return G.canvas.width / (window.devicePixelRatio || 1); };
  G.viewH = function () { return G.canvas.height / (window.devicePixelRatio || 1); };

  G.proj = function (wx, wy) {
    var z = G.state.zoom;
    var sx = (wx - wy) * 0.5 * z;
    var sy = (wx + wy) * 0.25 * z;
    var camSX = (G.state.camera.x - G.state.camera.y) * 0.5 * z;
    var camSY = (G.state.camera.x + G.state.camera.y) * 0.25 * z;
    return [sx - camSX + G.viewW() / 2, sy - camSY + G.viewH() / 2];
  };

  G.unproj = function (sx, sy) {
    var z = G.state.zoom;
    var camSX = (G.state.camera.x - G.state.camera.y) * 0.5 * z;
    var camSY = (G.state.camera.x + G.state.camera.y) * 0.25 * z;
    var a = sx - G.viewW() / 2 + camSX;
    var b = sy - G.viewH() / 2 + camSY;
    var d = a / (0.5 * z);
    var s = b / (0.25 * z);
    return [(d + s) / 2, (s - d) / 2];
  };

  G.inTown = function (x, y) {
    return x >= G.TOWN_MIN && x <= G.TOWN_MAX && y >= G.TOWN_MIN && y <= G.TOWN_MAX;
  };

  G.visibleWorldBounds = function () {
    var pts = [
      G.unproj(0, 0),
      G.unproj(G.canvas.width / (window.devicePixelRatio || 1), 0),
      G.unproj(0, G.canvas.height / (window.devicePixelRatio || 1)),
      G.unproj(G.canvas.width / (window.devicePixelRatio || 1), G.canvas.height / (window.devicePixelRatio || 1))
    ];
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for (var i = 0; i < pts.length; i++) {
      if (pts[i][0] < minX) minX = pts[i][0];
      if (pts[i][1] < minY) minY = pts[i][1];
      if (pts[i][0] > maxX) maxX = pts[i][0];
      if (pts[i][1] > maxY) maxY = pts[i][1];
    }
    return { minX: minX - G.TS, minY: minY - G.TS, maxX: maxX + G.TS, maxY: maxY + G.TS };
  };
})();
