// Son : bouton mute/unmute musique + bascule jour/nuit (SoundCloud),
// bouton effets sonores (SFX) avec fichiers dans assets/sounds/.
(function () {
  "use strict";
  var G = window.GAME = window.GAME || {};
  var btn = document.getElementById("soundBtn");
  var sfxBtn = document.getElementById("sfxBtn");
  var dayFrame = document.getElementById("scDay");
  var nightFrame = document.getElementById("scNight");
  var dayWidget = null, nightWidget = null;
  var enabled = false;
  var currentTrack = null; // "day" | "night"

  // Effets sonores : fichiers courts préchargés depuis assets/sounds/.
  // Dépose tes fichiers .mp3/.wav/.ogg dans assets/sounds/ (voir README).
  // Joue un effet si activé et si le fichier existe (tolérant aux 404).
  var sfxEnabled = true;
  var sfxCache = {};
  var SFX_DIR = "assets/sounds/";
  // Noms d'effets attendus : "shoot" (tir), "zombie_die" (zombie tué).
  // Delai minimal (s) entre deux declenchements du MEME effet : le
  // lance-flammes tire ~11x/s et relancait le meme Audio a chaque tir ->
  // son de tir en boucle continue des que le clic restait enfonce. On laisse
  // un son finir (ou presque) avant de le relancer.
  var sfxLastAt = {};
  var SFX_THROTTLE = { shoot: 0.18, eat: 0.2, tourCasse: 0.25 };
  G.playSfx = function (name) {
    if (!sfxEnabled) return;
    // Throttle : un effet relance sans arret se recouvre en une boucle
    // stridente ; les re-declenchements trop rapproches sont ignores.
    var now = (typeof performance !== "undefined" ? performance.now() : Date.now()) / 1000;
    var min = SFX_THROTTLE[name] || 0.05;
    if (sfxLastAt[name] !== undefined && (now - sfxLastAt[name]) < min) return;
    sfxLastAt[name] = now;
    if (!sfxCache[name]) {
      var a = new Audio(SFX_DIR + name + ".mp3");
      a.preload = "auto";
      a.volume = 0.5;
      sfxCache[name] = a;
    }
    try {
      // Clone : le tir suivant peut demarrer avant la fin du precedent
      // (chevauchement naturel) sans couper ni reboucler le son en cours.
      var clone = sfxCache[name].cloneNode();
      clone.volume = 0.5;
      var pr = clone.play();
      if (pr && pr.catch) pr.catch(function () {});
    } catch (e) {}
  };
  G.toggleSfx = function () {
    sfxEnabled = !sfxEnabled;
    if (sfxBtn) sfxBtn.textContent = "Effets : " + (sfxEnabled ? "ON" : "OFF");
  };

  if (window.SC && dayFrame) dayWidget = window.SC.Widget(dayFrame);
  if (window.SC && nightFrame) nightWidget = window.SC.Widget(nightFrame);

  // Boucle : quand une piste se termine, on la relance automatiquement.
  function loopTrack(w) {
    if (!w || !window.SC) return;
    try {
      w.bind(window.SC.Widget.Events.FINISH_PLAY, function () {
        try { w.seek(0); w.play(); } catch (e) {}
      });
    } catch (e) {}
  }
  loopTrack(dayWidget);
  loopTrack(nightWidget);

  function setVolume(w, vol) {
    if (w) try { w.setVolume(vol); } catch (e) {}
  }

  // Active/désactive le son.
  G.toggleSound = function () {
    enabled = !enabled;
    if (btn) btn.textContent = "Son : " + (enabled ? "ON" : "OFF");
    if (!enabled) {
      if (dayWidget) try { dayWidget.pause(); } catch (e) {}
      if (nightWidget) try { nightWidget.pause(); } catch (e) {}
      currentTrack = null;
    } else {
      G.updateMusic();
    }
  };

  // Bascule la musique selon le cycle jour/nuit. Appelé depuis update().
  // Ne joue aucune musique tant que la partie n'a pas démarré (menu d'accueil).
  G.updateMusic = function () {
    if (!enabled) return;
    if (!G.state.started) {
      if (dayWidget) try { dayWidget.pause(); } catch (e) {}
      if (nightWidget) try { nightWidget.pause(); } catch (e) {}
      currentTrack = null;
      return;
    }
    var night = G.isNight(G.state.clock);
    var want = night ? "night" : "day";
    if (want === currentTrack) return;
    currentTrack = want;
    if (want === "day") {
      if (nightWidget) try { nightWidget.pause(); } catch (e) {}
      if (dayWidget) { try { dayWidget.play(); } catch (e) {} setVolume(dayWidget, 80); }
    } else {
      if (dayWidget) try { dayWidget.pause(); } catch (e) {}
      if (nightWidget) { try { nightWidget.play(); } catch (e) {} setVolume(nightWidget, 80); }
    }
  };

  if (btn) btn.addEventListener("click", G.toggleSound);
  if (sfxBtn) sfxBtn.addEventListener("click", G.toggleSfx);
})();
