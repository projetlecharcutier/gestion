// Chat : bande superposee a DROITE de l'ecran, visible des l'ecran
// d'accueil (mode serveur). Messages limites a 50 caracteres, avec une
// palette d'emoticones. Un PSEUDO est obligatoire avant d'ecrire : sans
// pseudo, le champ refuse et le serveur refuse aussi (chatNeedPseudo).
// Entree ouvre le champ, Entree envoie (Echap annule). Les touches tapees
// ne declenchent AUCUNE action de jeu (stopPropagation + garde chatTyping
// dans input.js). L'historique (30 derniers messages) arrive via
// "chatHistory" au chargement de la page : le contenu persiste cote
// serveur, il survit aux mises a jour.
(function () {
  "use strict";
  var G = window.GAME = window.GAME || {};
  var CHAT_MAX = 30;      // lignes affichees
  var MSG_MAX = 50;       // limite par message (joueurs)
  var PSEUDO_KEY = "flexChatPseudo";
  var EMOJIS = ["\u{1F600}", "\u{1F642}", "\u{1F602}", "\u{1F62D}", "\u{1F621}", "\u{1F631}", "\u{1F480}", "\u{1F44D}", "\u{1F44E}", "\u{1F44B}", "\u{1F3AE}", "\u{1F6E1}\uFE0F", "\u{1F5E1}\uFE0F", "\u{1FA92}", "\u{1F6A8}", "\u{1F525}", "\u{1F4A9}", "\u{1F389}", "\u{1F44F}", "\u{1F340}", "\u{1F3C6}", "\u{1F401}", "\u{1F411}", "\u{26BD}"];
  var logEl = null;
  var inputEl = null;
  var pseudoEl = null;
  var emojiBarEl = null;
  var rootEl = null;
  var typing = false;

  function getSavedPseudo() {
    try { return window.localStorage.getItem(PSEUDO_KEY) || ""; } catch (e) { return ""; }
  }

  function currentPseudo() {
    var p = "";
    if (pseudoEl) p = pseudoEl.value;
    if (!p) p = G.state.playerName || "";
    if (!p) p = getSavedPseudo();
    return p.trim().slice(0, 20);
  }

  function setTyping(on) {
    typing = on;
    G.state.chatTyping = on;
    // Arrete net tout mouvement en cours : les touches relachees pendant
    // la saisie ne generent pas de keyup cote jeu (garde input.js).
    G.state.keys = {};
    G.state.keys.space = false;
    if (on && inputEl) {
      inputEl.value = "";
      inputEl.focus();
    } else if (!on && inputEl) {
      inputEl.blur();
      inputEl.value = "";
    }
  }

  // Horodatage affiche : jour + heure (JJ/MM HH:MM, heure locale).
  function chatTimeStamp(at) {
    var d = new Date(at);
    function p2(n) { return (n < 10 ? "0" : "") + n; }
    return p2(d.getDate()) + "/" + p2(d.getMonth() + 1) +
      " " + p2(d.getHours()) + ":" + p2(d.getMinutes());
  }

  function addChatMessage(from, text, at) {
    if (!logEl) return;
    var line = document.createElement("div");
    line.className = "chat__line";
    if (at) {
      var time = document.createElement("time");
      time.className = "chat__time";
      time.textContent = chatTimeStamp(at);
      line.appendChild(time);
    }
    var name = document.createElement("b");
    name.textContent = String(from || "?").slice(0, 20);
    var txt = document.createElement("span");
    txt.textContent = String(text || "").slice(0, 200);
    line.appendChild(name);
    line.appendChild(txt);
    logEl.appendChild(line);
    while (logEl.children.length > CHAT_MAX) logEl.removeChild(logEl.children[0]);
    logEl.scrollTop = logEl.scrollHeight;
  }

  function sendCurrent() {
    if (!inputEl) return;
    var text = (inputEl.value || "").trim().slice(0, MSG_MAX);
    if (text) {
      var pseudo = currentPseudo();
      if (!pseudo) {
        // Pas de pseudo : envoi refuse. Le champ de saisie RESTE ouvert et
        // focus (Echap l'annulera) ; le joueur remplit le pseudo a cote.
        addChatMessage("Chat", "Indiquez un pseudo pour \u00e9crire \u{1F645}");
        if (inputEl) inputEl.focus();
        return;
      }
      try { window.localStorage.setItem(PSEUDO_KEY, pseudo); } catch (e) {}
      if (G.playMode === "server" && G.netConnected && G.netConnected()) {
        G.netSend({ type: "chat", text: text, pseudo: pseudo });
      } else {
        addChatMessage(pseudo, text);
      }
    }
    setTyping(false);
  }

  function sendPseudo() {
    if (!pseudoEl) return;
    var pseudo = pseudoEl.value.trim().slice(0, 20);
    if (pseudo) {
      try { window.localStorage.setItem(PSEUDO_KEY, pseudo); } catch (e) {}
      pseudoEl.blur();
      addChatMessage("Chat", "Pseudo enregistr\u00e9 : " + pseudo + " \u{1F44B}");
    }
  }

  G.chatInit = function () {
    rootEl = document.getElementById("chat");
    logEl = document.getElementById("chatLog");
    inputEl = document.getElementById("chatInput");
    pseudoEl = document.getElementById("chatPseudo");
    emojiBarEl = document.getElementById("chatEmojis");
    if (!rootEl || !logEl || !inputEl) return;

    // Pseudo sauvegarde : prerempli (et sert aussi de nom de jeu par
    // defaut : input.js le lit au submit du formulaire d'accueil).
    var saved = getSavedPseudo();
    if (pseudoEl) {
      if (saved) pseudoEl.value = saved;
      pseudoEl.maxLength = 20;
      pseudoEl.addEventListener("keydown", function (e) {
        e.stopPropagation();
        if (e.code === "Enter" || e.key === "Enter") {
          e.preventDefault();
          sendPseudo();
        } else if (e.code === "Escape" || e.key === "Escape") {
          e.preventDefault();
          pseudoEl.blur();
        }
      });
      pseudoEl.addEventListener("blur", sendPseudo);
    }

    inputEl.addEventListener("keydown", function (e) {
      // Coupe la propagation vers les handlers window du jeu : la saisie ne
      // doit ni bouger le joueur ni ouvrir les menus.
      e.stopPropagation();
      if (e.code === "Enter" || e.key === "Enter") {
        e.preventDefault();
        sendCurrent();
      } else if (e.code === "Escape" || e.key === "Escape") {
        e.preventDefault();
        setTyping(false);
      }
    });
    inputEl.addEventListener("blur", function () {
      if (typing) setTyping(false);
    });

    // Palette d'emoticones : clic = inseree a la fin du champ.
    if (emojiBarEl) {
      for (var i = 0; i < EMOJIS.length; i++) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "chat__emoji";
        btn.textContent = EMOJIS[i];
        btn.title = "Ajouter " + EMOJIS[i];
        (function (emoji) {
          btn.addEventListener("click", function (e) {
            e.preventDefault();
            e.stopPropagation();
            if (inputEl) {
              inputEl.value = (inputEl.value + emoji).slice(0, MSG_MAX);
              inputEl.focus();
            }
          });
        })(EMOJIS[i]);
        emojiBarEl.appendChild(btn);
      }
    }

    window.addEventListener("keydown", function (e) {
      if (e.code !== "Enter" && e.key !== "Enter") return;
      var s = G.state;
      // Entree ouvre le chat pendant la partie active ET sur l'ecran
      // d'accueil (mode serveur), hors menus/overlays de jeu.
      if (typing) return;
      var inMenu = !s.started;
      if (!inMenu) {
        if (s.paused || s.gameOver || s.inBuilding ||
            s.buildMenuOpen || s.chestOpen || s.churchOpen ||
            (s.bag && s.bag.open) ||
            (G.universiteScreen && !G.universiteScreen.hidden) ||
            (G.marcheScreen && !G.marcheScreen.hidden) ||
            (G.potenceScreen && !G.potenceScreen.hidden) ||
            (G.adminOpen && G.adminOpen())) return;
      } else if (G.playMode !== "server") {
        return; // en solo, pas de chat
      }
      // Ne vole pas le submit du formulaire d'accueil : si un champ du
      // menu est focus (nom de partie, pseudo...), son propre handler
      // gere Enter. Repli sur document.activeElement indisponible : ok.
      if (document.activeElement && document.activeElement.tagName === "INPUT" &&
          document.activeElement !== inputEl) return;
      e.preventDefault();
      e.stopPropagation();
      setTyping(true);
    });
  };

  G.chatSetVisible = function (visible) {
    if (!rootEl) return;
    rootEl.hidden = !visible;
    // Si le chat est replie via le bouton (src/menu.js), on memorise qu'il
    // etait visible pour pouvoir le rouvrir au depliage.
    if (visible && rootEl._collapsedByUser) rootEl.hidden = true;
    // A la premiere apparition, une ligne d'aide rend le raccourci
    // decouvrible et prouve que le panneau est vivant (meme avant tout
    // message serveur).
    if (visible && !rootEl._chatHinted) {
      rootEl._chatHinted = true;
      addChatMessage("Chat", "Entr\u00e9e pour \u00e9crire (50 car. max) \u{1F642}");
    }
  };

  // Historique persistant : les 30 derniers messages, envoyes par le
  // serveur au chargement de la page. Remplace l'ancien contenu local.
  G.chatLoadHistory = function (messages) {
    if (!logEl || !messages || !messages.length) return;
    while (logEl.firstChild) logEl.removeChild(logEl.firstChild);
    for (var i = 0; i < messages.length; i++) {
      var m = messages[i];
      addChatMessage(m.from, m.text, m.at);
    }
  };

  G.addChatMessage = addChatMessage;
  G.currentChatPseudo = currentPseudo;
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", G.chatInit);
  } else {
    G.chatInit();
  }
})();
