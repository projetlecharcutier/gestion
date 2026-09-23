// Non-regression des comportements voisins apres le fix orbit-slot.
global.window = global;
global.Image = function () {};
global.document = { getElementById: function () { return { style: {}, addEventListener: function () {}, appendChild: function () {}, innerHTML: "" }; } };
global.addEventListener = function () {};
var fs = require("fs"), path = require("path");
function load(f) { (0, eval)(fs.readFileSync(path.join(__dirname, "..", "..", "src", f), "utf8")); }
load("config.js"); load("projection.js"); load("world.js"); load("player.js");
load("walls.js"); load("towers.js"); load("chop.js"); load("weapons.js"); load("birds.js"); load("siege.js"); load("zombies.js");
var G = global.GAME;
G.hasSprite = function () { return false; };
G.houseNames = function () { return []; };
G.foretNames = function () { return []; };
G.updateHud = function () {};
G.foretAt = function () { return null; };
var fails = 0;
function assert(c, m) { if (!c) { console.log("FAIL: " + m); fails++; } }
function mkState(mode) {
  G.state = { time: 0, clock: 12, day: 0, waveActive: true, zombieMode: mode,
              player: { x: 9000, y: 9000, hp: 100 }, zombies: [], zombieGroups: [],
              walls: [], towers: [], buildings: [], projectiles: [], deadTraces: [],
              mouse: { inside: false }, zoom: 8, camera: { x: 5000, y: 5000 } };
  return G.state;
}

// 1) Retraite : pas de mur proche -> le groupe s'eloigne du centre-ville
var st = mkState("retreat");
st.buildings.push({ x: 4940, y: 4940, w: 120, h: 120, isMairie: true, hp: 1000, maxHp: 1000, name: "Mairie", door: { x: 5000, y: 5060 } });
var grp1 = { x: 4500, y: 5000, members: [], formation: 0, formPhase: 0, isHorde: false, retreat: false, hasRaider: false };
st.zombieGroups.push(grp1);
for (var i = 0; i < 4; i++) {
  grp1.members.push({ x: 4500, y: 5000, hp: 60, atkCd: 0, wallCd: 0, lunge: 0, speedFactor: 1,
    slotAng: 0, slotDist: 20, slotAngT: 0, slotDistT: 20, wanderFreq: 1, wanderPhase: i, wallBreaker: false });
  st.zombies.push(grp1.members[i]);
}
var d0 = Math.sqrt((4500 - 5000) ** 2);
for (var t = 0; t < 15; t += 0.05) { st.time = t; G.updateZombies(0.05); }
var d1 = Math.sqrt((grp1.x - 5000) ** 2 + (grp1.y - 5000) ** 2);
assert(d1 > d0 + 300, "retraite : le groupe s'eloigne (d " + d0.toFixed(0) + " -> " + d1.toFixed(0) + ")");

// 2) Attaque : cible joueur prioritaire a courte portee (pas de regression)
var st2 = mkState("attack");
st2.buildings.push({ x: 4940, y: 4940, w: 120, h: 120, isMairie: true, hp: 1000, maxHp: 1000, name: "Mairie", door: { x: 5000, y: 5060 } });
st2.player = { x: 4600, y: 5000, hp: 100 };
var grp2 = { x: 4550, y: 5000, members: [], formation: 0, formPhase: 0, isHorde: false, retreat: false, hasRaider: false };
st2.zombieGroups.push(grp2);
for (var j = 0; j < 3; j++) {
  grp2.members.push({ x: 4550, y: 5000, hp: 60, atkCd: 0, wallCd: 0, lunge: 0, speedFactor: 1,
    slotAng: 0, slotDist: 20, slotAngT: 0, slotDistT: 20, wanderFreq: 1, wanderPhase: j, wallBreaker: false });
  st2.zombies.push(grp2.members[j]);
}
var hp0 = st2.player.hp;
for (var t2 = 0; t2 < 10; t2 += 0.05) { st2.time = t2; G.updateZombies(0.05); }
assert(st2.player.hp < hp0, "joueur attaque a courte portee (hp " + hp0 + " -> " + st2.player.hp + ")");

// 3) Tour accessible : zombie pres d'une tour l'attaque (pas de mur a portee)
var st3 = mkState("attack");
st3.buildings.push({ x: 4940, y: 4940, w: 120, h: 120, isMairie: true, hp: 1000, maxHp: 1000, name: "Mairie", door: { x: 5000, y: 5060 } });
var tower = { x: 4400, y: 4960, w: 80, h: 80, level: "bois", hp: 500, maxHp: 500, chantierDone: true, cdL: 0, cdR: 0, animL: 0, animR: 0, isTower: true, builtAt: -100 };
st3.towers.push(tower);
var grp3 = { x: 4300, y: 5000, members: [], formation: 0, formPhase: 0, isHorde: false, retreat: false, hasRaider: false };
st3.zombieGroups.push(grp3);
for (var k = 0; k < 3; k++) {
  grp3.members.push({ x: 4300, y: 5000, hp: 60, atkCd: 0, wallCd: 0, lunge: 0, speedFactor: 1,
    slotAng: 0, slotDist: 20, slotAngT: 0, slotDistT: 20, wanderFreq: 1, wanderPhase: k, wallBreaker: true });
  st3.zombies.push(grp3.members[k]);
}
for (var t3 = 0; t3 < 15; t3 += 0.05) { st3.time = t3; G.updateZombies(0.05); }
assert(tower.hp < 500, "tour attaquee (hp " + tower.hp.toFixed(0) + ")");

// 4) Mairie sans mur : le groupe avance vers la mairie (champ de nav null -> ligne droite)
var st4 = mkState("attack");
st4.buildings.push({ x: 4940, y: 4940, w: 120, h: 120, isMairie: true, hp: 1000, maxHp: 1000, name: "Mairie", door: { x: 5000, y: 5060 } });
var grp4 = { x: 3000, y: 5000, members: [], formation: 0, formPhase: 0, isHorde: false, retreat: false, hasRaider: false };
st4.zombieGroups.push(grp4);
for (var l = 0; l < 4; l++) {
  grp4.members.push({ x: 3000, y: 5000, hp: 60, atkCd: 0, wallCd: 0, lunge: 0, speedFactor: 1,
    slotAng: 0, slotDist: 20, slotAngT: 0, slotDistT: 20, wanderFreq: 1, wanderPhase: l, wallBreaker: false });
  st4.zombies.push(grp4.members[l]);
}
for (var t4 = 0; t4 < 10; t4 += 0.05) { st4.time = t4; G.updateZombies(0.05); }
assert(grp4.x > 3000 + 200, "groupe avance vers la mairie (x 3000 -> " + grp4.x.toFixed(0) + ")");

console.log(fails === 0 ? "ALL_OK" : "FAILURES: " + fails);
process.exit(fails === 0 ? 0 : 1);
