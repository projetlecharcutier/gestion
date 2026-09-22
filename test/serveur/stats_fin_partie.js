// Stats de fin de partie : compteurs par joueur (or, batiments, planches,
// kills, tirs) + globals (vagues, kills tours/joueurs). Valide le comptage
// SERVEUR (autoritaire en ligne) : tir, kill par projectile attribue au bon
// joueur, kill par tour, vague enregistree, pickup or.
var srv = require("../../server/game.js");
var G = srv.G;
srv.startGame();
var st = srv.getState();
srv.addPlayer("s1", "statTest");
var p = st.players[0];
var fails = 0;
function assert(c, m) { if (!c) { console.log("FAIL: " + m); fails++; } }

// --- 1) Tir : 3 declenchements de pistolet = 3 tirs (pas par pellet).
p.equipped = "Pistolet";
p.axeEquipped = false;
p.alive = true;
p.x = 4000; p.y = 4000;
p._aimX = 4100; p._aimY = 4000;
for (var i = 0; i < 30; i++) srv.applyInput("s1", { fire: true, aimX: 4100, aimY: 4000 });
for (var t = 0; t < 40; t++) srv.tick(0.05);
assert(p.stats && p.stats.shots >= 3, "tir compte (shots=" + (p.stats ? p.stats.shots : "null") + ")");

// --- 2) Kill attribue au joueur : un zombie faible devant le tir.
st.zombies = [{ x: 4100, y: 4000, hp: 1, speedFactor: 0, group: 0, vx: 0, vy: 0 }];
var kills0 = p.stats.kills;
p._fireLatch = true;
for (var t2 = 0; t2 < 5; t2++) srv.tick(0.05);
assert(p.stats.kills > kills0, "kill attribue au joueur (kills=" + p.stats.kills + ")");
assert(st.globalStats && st.globalStats.playerKills > 0, "playerKills global > 0");

// --- 3) Kill par tour : fleche owner "tour".
st.zombies = [{ x: 4200, y: 4000, hp: 1, speedFactor: 0, group: 0, vx: 0, vy: 0 }];
st.projectiles.push({ x: 4200, y: 4000, vx: 0, vy: 0, dmg: 10, life: 1, owner: "tour", piercing: false, pierceCount: 0, trail: [], hitEntities: [], blast: false });
var tk0 = st.globalStats ? st.globalStats.towerKills : 0;
srv.tick(0.05);
assert(st.globalStats.towerKills === tk0 + 1, "kill tour compte (towerKills=" + st.globalStats.towerKills + ")");

// --- 4) Vague enregistree : la nuit tombe, spawnWave doit remplir waves.
var w0 = st.globalStats ? st.globalStats.waves.length : 0;
G.spawnWave();
assert(st.globalStats.waves.length === w0 + 1, "vague enregistree");
var lastWave = st.globalStats.waves[st.globalStats.waves.length - 1];
assert(lastWave && lastWave.count > 0 && lastWave.night !== undefined, "vague avec count et nuit (" + JSON.stringify(lastWave) + ")");

// --- 5) Pickup or : +1 pour le joueur.
p.bag.contents = [];
st.items = [];
st.items.push({ x: p.x + 100, y: p.y, name: "Pièce", kind: "or", color: "#fbbf24" });
var g0 = p.stats.gold;
srv.applyInput("s1", { pickup: { x: p.x + 100, y: p.y } });
assert(p.stats.gold === g0 + 1, "or recolte credite (gold=" + p.stats.gold + ")");

// --- 6) Planches : la coupe credite le joueur (delta pendant swap chop).
p.axeEquipped = true;
p.equipped = null;
p.alive = true;
var c = G.WORLD / 2;
// Une foret surement a portee : on cherche le batiment isForet le plus proche.
var foret = null, bd = 1e9;
for (var bi = 0; bi < st.buildings.length; bi++) {
  var b = st.buildings[bi];
  if (!b.isForet || b.foretStage > 0) continue;
  var d = (b.x - p.x) * (b.x - p.x) + (b.y - p.y) * (b.y - p.y);
  if (d < bd) { bd = d; foret = b; }
}
if (foret) {
  p.x = foret.x + foret.w / 2 + 40;
  p.y = foret.y + foret.h / 2;
  p._aimX = foret.x + foret.w / 2; p._aimY = foret.y + foret.h / 2;
  var pl0 = p.stats.planks;
  for (var t3 = 0; t3 < 80; t3++) {
    srv.applyInput("s1", { fire: true, aimX: p._aimX, aimY: p._aimY });
    srv.tick(0.05);
  }
  assert(p.stats.planks > pl0, "planches recoltees creditees (planks " + pl0 + " -> " + p.stats.planks + ")");
} else {
  console.log("WARN: aucune foret a portee pour le test planches");
}

if (fails > 0) { console.log(fails + " FAIL"); process.exit(1); }
console.log("OK stats de fin de partie (tirs, kills joueur/tour, vague, or, planches)");
