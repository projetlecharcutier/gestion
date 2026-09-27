// Test: ville-sync resiste a un depot en lecture seule (EACCES en prod).
// Reproduit /opt/flex : les writeFileSync de ville-grids.json, positions,
// signatures et villes.js echouent, mais le serveur doit quand meme
// demarrer AVEC les villes (grilles fraiches + manifeste en MEMOIRE,
// transportes au client via msg.map.villes).
var fs = require("fs");
var path = require("path");
var cp = require("child_process");
var REPO = path.join(__dirname, "..", "..");
var fails = 0;
function assert(c, m) { if (!c) { console.log("FAIL: " + m); fails++; } else console.log("OK: " + m); }

// 1. Copie du repo vers un dossier temporaire passe en lecture seule.
var TMP = path.join(require("os").tmpdir(), "flex-ville-ro-test");
try { cp.execSync("chmod -R u+w " + JSON.stringify(TMP) + " 2>/dev/null; rm -rf " + JSON.stringify(TMP)); } catch (e) {}
try { cp.execSync("rm -rf " + JSON.stringify(TMP)); } catch (e) {}
fs.mkdirSync(TMP);
["index.html", "src", "server", "assets"].forEach(function (f) {
  try { cp.execSync("cp -r " + JSON.stringify(path.join(REPO, f)) + " " + JSON.stringify(TMP)); } catch (e) {}
});
// node_modules en lien symbolique (pas besoin de le copier).
try { fs.unlinkSync(path.join(TMP, "server", "node_modules")); } catch (e) {}
try { fs.symlinkSync(path.join(REPO, "server", "node_modules"), path.join(TMP, "server", "node_modules")); } catch (e) {}
// Lecture seule : server/ et assets/ interdits d'ecriture.
try { cp.execSync("chmod -R a-w " + JSON.stringify(path.join(TMP, "server")) + " " + JSON.stringify(path.join(TMP, "assets"))); } catch (e) {}

// 2. Sync sur le depot lecture seule : doit reussir avec wroteAll=false.
var r = require(path.join(TMP, "server", "ville-sync")).sync();
assert(r.found >= 1, "villes detectees (" + r.found + ")");
assert(r.names.indexOf("est") >= 0, "ville est presente");
assert(r.wroteAll === false, "ecritures en echec attendues (wroteAll=false)");
assert(!!global.__VILLE_SYNC, "stash memoire pose (global.__VILLE_SYNC)");
assert(!!global.__VILLE_SYNC.manifest && global.__VILLE_SYNC.manifest.length >= 1,
       "manifeste en memoire (" + global.__VILLE_SYNC.manifest.length + " ville(s))");
assert(!!global.__VILLE_SYNC.grids && !!global.__VILLE_SYNC.grids.est, "grille est en memoire");

// 3. Le serveur de jeu doit demarrer AVEC la ville (dom-stub lit le stash).
var game = require(path.join(TMP, "server", "game"));
var G = game.G;
assert(G.state.villes.length >= 1, "ville posee dans l'etat du jeu");
assert(G.state.villes[0].sprite === "est", "ville est active");
assert(G.villeGrids && !!G.villeGrids.est, "grille de collision est enregistree");
assert(!!G.VILLE_MANIFEST && G.VILLE_MANIFEST.length >= 1, "manifeste expose au client (map.villes)");

// 4. Nettoyage.
try { cp.execSync("chmod -R u+w " + JSON.stringify(TMP) + " && rm -rf " + JSON.stringify(TMP)); } catch (e) {}

console.log(fails ? "FAIL ville/depot_lecture_seule (" + fails + ")" : "PASS ville/depot_lecture_seule");
process.exit(fails ? 1 : 0);
