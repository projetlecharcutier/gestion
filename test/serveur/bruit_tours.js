var srv = require("../../server/game.js");
var G = srv.G;
srv.startGame();
var st = srv.getState();
st.waveActive = true;

function proj(owner) {
  return { x: 100, y: 100, vx: 50, vy: 0, dmg: 10, life: 2, speed: 50,
           color: "#111", size: 1, type: "fleche", owner: owner,
           piercing: false, pierceCount: 0, trail: [], hitEntities: [] };
}

// Fleche de tour : ne doit PAS creer d'attraction de bruit.
st.projectiles.push(proj("tour"));
srv.tick(0.05);
if (st.lastShot) { console.log("FAIL: fleche de tour detectee comme bruit"); process.exit(1); }

// Tir de joueur : doit creer l'attraction de bruit.
st.projectiles.push(proj(undefined));
srv.tick(0.05);
if (!st.lastShot) { console.log("FAIL: tir joueur non detecte comme bruit"); process.exit(1); }

console.log("OK: fleches de tour ignorees, tir joueur detecte");
