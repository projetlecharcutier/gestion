var srv = require("../../server/game.js");
var G = srv.G;
srv.startGame();
var st = srv.getState();
st.mairieGold = 100;
srv.addPlayer("a1", "alice"); srv.addPlayer("b2", "bob"); srv.addPlayer("c3", "carol");
var pa = st.players[0], pb = st.players[1], pc = st.players[2];
pa.planks = 500;
// Le vote exige < 250 px de la mairie (audit anti-triche) : le spawn aleatoire
// laisse parfois un joueur hors de portee. Le client legitime clique le bouton
// du coffre, ouvert pres de la mairie.
var mairie = st.buildings.filter(function (b) { return b.isMairie; })[0];
pa.x = mairie.x + mairie.w / 2 + 40; pa.y = mairie.y + mairie.h / 2 + 40;
pb.x = mairie.x + mairie.w / 2 - 40; pb.y = mairie.y + mairie.h / 2 - 40;
pc.x = mairie.x + mairie.w / 2 + 60; pc.y = mairie.y + mairie.h / 2 - 60;

// 1) alice lance le vote
srv.applyInput("a1", { techVote: "scierie" });
console.log("vote lance:", !!st.vote, st.vote && st.vote.proposal);
if (!st.vote) { console.log("FAIL: vote non lance"); process.exit(1); }

// 2) bob clique (comme le fait le client : re-envoie techVote pendant un vote en cours)
srv.applyInput("b2", { techVote: "scierie" });
console.log("votes:", JSON.stringify(st.vote.votes));

// 3) carol clique aussi
srv.applyInput("c3", { techVote: "scierie" });
console.log("votes:", JSON.stringify(st.vote.votes));

// 4) resolution apres VOTE_DURATION
var initGold = st.mairieGold;
for (var i = 0; i < 400; i++) srv.tick(0.05);
console.log("scierieUnlocked:", st.scierieUnlocked);
console.log("mairieGold:", st.mairieGold, "(init " + initGold + ")");
console.log("alice planks:", pa.planks);
if (!st.scierieUnlocked) { console.log("FAIL: vote non resolu/applique"); process.exit(1); }
console.log("OK");
