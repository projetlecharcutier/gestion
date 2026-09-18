// Stub DOM minimal pour exécuter les modules de simulation (config, world,
// zombies, walls, chop, weapons, birds, projection) côté serveur sans navigateur.
// Expose un objet window global et un canvas factice + les stubs d'assets
// (hasSprite / SPRITES / spriteBounds / wallSpriteDims) pour que buildWorld()
// fonctionne sans PNG (les bâtiments prennent leurs tailles par défaut).
function setupStub() {
  // window === global : les modules écrivent window.GAME (=== global.GAME)
  // et lisent window.devicePixelRatio. En Node, on expose global via `window`.
  global.window = global;
  global.devicePixelRatio = 1;

  var G = {};
  global.GAME = G;

  // Canvas factice : projection.js lit G.canvas.width/height au rendu uniquement
  // (jamais côté serveur), mais on le définit pour éviter un ReferenceError.
  global.canvas = G.canvas = { width: 800, height: 600, getContext: function () { return null; } };

  // Stub d'assets : aucun PNG côté serveur. hasSprite -> false partout,
  // spriteBounds -> null, wallSpriteDims -> constantes par défaut.
  G.SPRITES = {};
  G.hasSprite = function () { return false; };
  G.spriteBounds = function () { return null; };
  // Aucune maison PNG côté serveur : houseNames() renvoie [] et le bloc de
  // maisons décoratives est sauté dans buildWorld().
  G.houseNames = function () { return []; };
  // Côté serveur, aucune forêt PNG. On fournit des frames factices avec les
  // dimensions réelles des PNG (assets/sprites/tree/ : 52x37 et 40x30) pour
  // que makeForet() construise des AABB de collision proches du client
  // (côté client shrinkToOpaque réduit encore à la zone opaque, mais l'ordre
  // de grandeur reste fidèle — des sprites de 128 créaient des massifs de
  // 256x256 qui bouchaient 3/4 de la carte côté serveur).
  G.foretNames = function () { return ["foret1", "foret2"]; };
  G.SPRITES.foret = { foret1: { w: 52, h: 37 }, foret2: { w: 40, h: 30 } };
  G.PLANK_LONG = 120;
  G.PLANK_THICK = 24;
  G.wallSpriteDims = function () { return { longW: G.PLANK_LONG, thick: G.PLANK_THICK }; };

  // Aucune dépendance au rendu/HUD/audio côté serveur.
  G.updateHud = function () {};
  G.addFloater = function () {};
  G.updateFloaters = function () {};
  G.playSfx = function () {};
  G.render = function () {};

  return G;
}

module.exports = { setupStub: setupStub };
