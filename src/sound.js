// Son : bouton mute/unmute + bascule jour/nuit via les widgets SoundCloud.
(function () {
  "use strict";
  var G = window.GAME = window.GAME || {};
  var btn = document.getElementById("soundBtn");
  var dayFrame = document.getElementById("scDay");
  var nightFrame = document.getElementById("scNight");
  var dayWidget = null, nightWidget = null;
  var enabled = false;
  var currentTrack = null; // "day" | "night"

  if (window.SC && dayFrame) dayWidget = window.SC.Widget(dayFrame);
  if (window.SC && nightFrame) nightWidget = window.SC.Widget(nightFrame);

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
  G.updateMusic = function () {
    if (!enabled) return;
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
})();
