// Test soldats romains (src/soldats.js) : 50 soldats en 5 patrouilles de 10
// autour du camp romain, ils chargent les intrus sans jamais trop s'eloigner,
// fragiles mais gros degats, neutres envers les zombies ; glaive d'or au
// centre du camp, vendable 500 or a l'eglise.
var fs = require("fs");
var path = require("path");
var REPO = path.join(__dirname, "..", "..");
var fails = 0;
function assert(c, m) { if (!c) { console.log("FAIL: " + m); fails++; } }

global.window = global;
global.document = {
  createElement: function () {
    return { getContext: function () { return {}; }, style: {} };
  }
};
require(path.join(REPO, "test", "seed.js"))(424242);
var game = require(path.join(REPO, "server", "game.js"));
var G = game.G;
game.startGame();
var st = G.state;

// 1) Effectif : exactement 50 soldats, 5 patrouilles de 10.
assert(st.soldats && st.soldats.length === 50, "50 soldats poses (" + (st.soldats || []).length + ")");
var parPat = {};
for (var i = 0; i < st.soldats.length; i++) {
  parPat[st.soldats[i].pat] = (parPat[st.soldats[i].pat] || 0) + 1;
}
assert(Object.keys(parPat).length === 5, "5 patrouilles");
for (var pk in parPat) {
  assert(parPat[pk] === 10, "patrouille " + pk + " de 10 soldats (" + parPat[pk] + ")");
}

// 2) Les soldats restent autour du camp (rayon patrouille + leash).
var c = { x: st.soldats[0] ? 0 : 0 };
// centre du camp = ville camp_romain ou position par defaut
var centre = { x: G.CAMP_ROMAIN_POS.x, y: G.CAMP_ROMAIN_POS.y };
for (var v = 0; v < (st.villes || []).length; v++) {
  if (st.villes[v].sprite === "camp_romain") {
    centre.x = st.villes[v].x + st.villes[v].w / 2;
    centre.y = st.villes[v].y + st.villes[v].h / 2;
  }
}
for (var s2 = 0; s2 < st.soldats.length; s2++) {
  var dx = st.soldats[s2].x - centre.x, dy = st.soldats[s2].y - centre.y;
  var d = Math.sqrt(dx * dx + dy * dy);
  assert(d < G.SOLDATS_RAYON_MAX, "soldat " + s2 + " pres du camp (d=" + d.toFixed(0) + ")");
}

// 3) Le glaive d'or est au milieu du camp.
var glaives = st.items.filter(function (it) { return it.name === "Glaive en or"; });
assert(glaives.length === 1, "un seul Glaive en or");
var gl = glaives[0];
assert(Math.abs(gl.x - centre.x) < 60 && Math.abs(gl.y - centre.y) < 60,
       "glaive au centre du camp (" + gl.x + "," + gl.y + " vs " + centre.x + "," + centre.y + ")");

// 4) Un intrus dans le perimetre est poursuivi ; le soldat frappe fort.
var soldat = st.soldats[0];
var hp0 = st.player.hp;
st.player.x = soldat.x + 100; st.player.y = soldat.y;
st.player.alive = true;
G.updateSoldats(0.05);
assert(soldat.cible !== null, "soldat detecte l'intrus");
// Le soldat court vers le joueur (distance diminue).
var d0 = Math.sqrt(Math.pow(soldat.x - st.player.x, 2) + Math.pow(soldat.y - st.player.y, 2));
G.updateSoldats(0.2);
var d1 = Math.sqrt(Math.pow(soldat.x - st.player.x, 2) + Math.pow(soldat.y - st.player.y, 2));
assert(d1 < d0, "soldat court vers l'intrus (" + d0.toFixed(1) + " -> " + d1.toFixed(1) + ")");
// GROS degats : plusieurs soldats, mais un seul coup suffit a verifier 45.
st.player.hp = hp0;
var soldat2 = st.soldats[1];
st.player.x = soldat2.x + 5; st.player.y = soldat2.y;
soldat2.atkCd = 0;
var hpAvant = st.player.hp;
G.updateSoldats(0.05);
assert(st.player.hp <= hpAvant - G.SOLDATS_DMG,
       "soldat frappe fort (" + (hpAvant - st.player.hp) + " degats)");

// 5) Leash : le soldat n'acharne pas un intrus parti loin du camp.
st.player.x = centre.x + 3000; st.player.y = centre.y;
st.player.hp = 100;
for (var s3 = 0; s3 < st.soldats.length; s3++) st.soldats[s3].cible = null;
G.updateSoldats(0.1);
var poursuit = false;
for (var s4 = 0; s4 < st.soldats.length; s4++) {
  if (st.soldats[s4].cible) poursuit = true;
}
assert(!poursuit, "intrus hors perimetre ignore (leash respecte)");

// 6) Neutralite zombies : apres une longue simulation, aucun soldat ni
// zombie n'a ete touche par l'autre. (Les soldats ignorent totalement les
// zombies : jamais de cible zombie, jamais de degats croises.)
var zomb0 = st.zombies.length;
var soldatsAvant = st.soldats.length;
var zHp0 = [];
for (var zz = 0; zz < st.zombies.length; zz++) zHp0.push(st.zombies[zz].hp);
// Place des zombies au milieu du camp : les soldats ne reagissent pas.
for (var zz2 = 0; zz2 < st.zombies.length; zz2++) {
  st.zombies[zz2].x = centre.x;
  st.zombies[zz2].y = centre.y;
}
for (var tick = 0; tick < 50; tick++) G.updateSoldats(0.05);
var soldatsApres = st.soldats.length;
assert(soldatsApres === soldatsAvant, "aucun soldat tue par un zombie");
var ztouch = false;
for (var zz3 = 0; zz3 < st.zombies.length; zz3++) {
  if (st.zombies[zz3].hp < zHp0[zz3]) ztouch = true;
}
assert(!ztouch, "aucun zombie attaque par les soldats");
// Aucun soldat ne cible un zombie.
for (var s5 = 0; s5 < st.soldats.length; s5++) {
  assert(!st.soldats[s5].cible || !st.zombies.some(function (z) {
    return st.soldats[s5].cible && st.soldats[s5].cible.ent === z;
  }), "soldat " + s5 + " ne cible jamais un zombie");
}

// 7) Fragiles : 30 HP, une balle de pistolet (dmg 25) blesse, deux tuent.
assert(G.SOLDATS_HP === 30, "soldat fragile (30 HP)");
assert(G.SOLDATS_DMG === 45, "soldat gros degats (45)");

// 8) Vente du glaive : 500 or a l'eglise.
assert(G.GLAIVE_PRICE === 500, "prix glaive = 500 or");
st.bag.contents.push({ name: "Glaive en or", kind: "objet", color: "#f5c542" });
var gold0 = st.mairieGold || 0;
var glIdx = -1;
for (var bi = 0; bi < st.bag.contents.length; bi++) {
  if (st.bag.contents[bi].name === "Glaive en or") { glIdx = bi; break; }
}
var floater = 0;
G.addFloater = function () { floater++; };
G.drawChurch = function () {};
G.updateHud = function () {};
G.sellGlaive(glIdx);
assert(st.mairieGold === gold0 + 500, "vente glaive +500 or (" + st.mairieGold + ")");
assert(floater === 1, "message de vente affiche");
assert(!st.bag.contents.some(function (it) { return it.name === "Glaive en or"; }),
       "glaive retire du sac");

// 9) Repop : les soldats tues reviennent au matin.
st.soldats[0].hp = 0;
G.cleanupSoldats();
assert(st.soldats.length === 49, "soldat tue retire");
G.repopSoldats();
assert(st.soldats.length === 50, "repop a 50 le matin");

console.log(fails === 0 ? "SUCCES TOTAL" : fails + " FAIL");
process.exit(fails === 0 ? 0 : 1);
