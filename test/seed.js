// PRNG xorshift32 seedable pour des tests REPRODUCTIBLES : remplace
// Math.random avant tout appel a buildWorld()/spawnWave() -> la generation
// du monde (forets, maisons, reliques) est identique a chaque run.
// Usage : require("./seed")(42);
// Le meme PRNG est utilise cote serveur via TEST_SEED (server/game.js).
module.exports = function seedRandom(seed) {
  "use strict";
  var s = (parseInt(seed, 10) >>> 0) || 1;
  Math.random = function () {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
};
