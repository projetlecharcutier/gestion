// Zombie vs tour : pose scierie -> chantier -> pose tour -> un zombie accessible
// attaque la tour (priorite tour meme si des murs existent ailleurs dans le monde).
var game = require("../../server/game.js");
var G = game.G;
game.startGame();
G.state.mairieGold = 500; G.state.scierieUnlocked = true; G.state.planks = 500;
G.state.buildSel = "scierie";
var placed = false;
outer: for (var x = 4550; x <= 5450; x += 20) for (var y = 4550; y <= 5450; y += 20) {
  if (G.placeFromBuildMenu(x, y)) { placed = true; break outer; }
}
if (!placed) { console.log("FAIL: pas de spot scierie"); process.exit(1); }
G.state.time += 11; G.updateBuildSites(0.1);
G.state.buildSel = "tour:bois";
var c = G.WORLD / 2;
var tourOk = false;
outer2: for (var r = 200; r <= 2000; r += 50) {
  var cands = [[c + r, c + r], [c + r, c - r], [c - r, c + r], [c - r, c - r], [c + r, c], [c, c + r]];
  for (var ci = 0; ci < cands.length; ci++) {
    if (G.placeFromBuildMenu(cands[ci][0], cands[ci][1])) { tourOk = true; break outer2; }
  }
}
if (!tourOk) { console.log("FAIL: pose tour"); process.exit(1); }
var t = G.state.towers[0];
G.state.time += 11; G.updateBuildSites(0.1);
if (!t.chantierDone) { console.log("FAIL: chantier tour non fini"); process.exit(1); }
if (G.state.walls.length === 0) { console.log("FAIL: pas de murs dans le monde (contexte du test)"); process.exit(1); }
var grp = { x: t.x + 200, y: t.y, members: [], formation: 0, formPhase: 0 };
var z = { x: t.x + t.w + 20, y: t.y + t.h / 2, hp: 1, atkCd: 0, wallCd: 0, group: grp, slotAng: 0, slotDist: 0, speedFactor: 1, wanderPhase: 0, wanderFreq: 1, hesitate: 0, harasser: false, raider: false, wallBreaker: true, seekDir: 0, lunge: 0, lungeDx: 0, lungeDy: 0, isLeader: true };
grp.members.push(z); G.state.zombies.push(z); G.state.zombieGroups.push(grp);
var hpBefore = t.hp;
for (var i = 0; i < 60; i++) G.updateZombies(0.05);
console.log("murs dans le monde:", G.state.walls.length, "| tour hp:", t.hp, "(avant " + hpBefore + ")");
if (t.hp >= hpBefore) { console.log("FAIL: le zombie n'a pas attaque la tour"); process.exit(1); }
console.log("OK zombie attaque la tour");
