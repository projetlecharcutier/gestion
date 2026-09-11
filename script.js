(function () {
  "use strict";

  var SYMBOLS = ["🍎", "🚀", "🎵", "🌟", "🍕", "⚡", "🐱", "🌈"];
  var PAIRS = SYMBOLS.length;

  var board = document.getElementById("board");
  var movesEl = document.getElementById("moves");
  var pairsEl = document.getElementById("pairs");
  var totalEl = document.getElementById("total");
  var timerEl = document.getElementById("timer");
  var restartBtn = document.getElementById("restart");
  var playAgainBtn = document.getElementById("playAgain");
  var overlay = document.getElementById("overlay");
  var resultEl = document.getElementById("result");

  var state = {
    cards: [],
    first: null,
    lock: false,
    moves: 0,
    matched: 0,
    startedAt: null,
    timerId: null
  };

  function shuffle(arr) {
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = arr[i];
      arr[i] = arr[j];
      arr[j] = tmp;
    }
    return arr;
  }

  function buildDeck() {
    var deck = [];
    SYMBOLS.forEach(function (sym, idx) {
      deck.push({ id: idx, symbol: sym });
      deck.push({ id: idx, symbol: sym });
    });
    return shuffle(deck);
  }

  function createCardElement(card, index) {
    var btn = document.createElement("button");
    btn.className = "card";
    btn.type = "button";
    btn.dataset.index = String(index);
    btn.setAttribute("aria-label", "Carte cachée");

    var inner = document.createElement("span");
    inner.className = "card__inner";

    var front = document.createElement("span");
    front.className = "card__face card__face--front";
    front.textContent = "?";

    var back = document.createElement("span");
    back.className = "card__face card__face--back";
    back.textContent = card.symbol;

    inner.appendChild(front);
    inner.appendChild(back);
    btn.appendChild(inner);

    btn.addEventListener("click", function () {
      onCardClick(index);
    });

    return btn;
  }

  function render() {
    board.innerHTML = "";
    state.cards.forEach(function (card, index) {
      board.appendChild(createCardElement(card, index));
    });
  }

  function updateStats() {
    movesEl.textContent = String(state.moves);
    pairsEl.textContent = String(state.matched);
    totalEl.textContent = String(PAIRS);
  }

  function startTimer() {
    if (state.startedAt) return;
    state.startedAt = Date.now();
    state.timerId = setInterval(function () {
      var seconds = Math.floor((Date.now() - state.startedAt) / 1000);
      timerEl.textContent = seconds + "s";
    }, 250);
  }

  function stopTimer() {
    if (state.timerId) {
      clearInterval(state.timerId);
      state.timerId = null;
    }
  }

  function getCardEl(index) {
    return board.querySelector('.card[data-index="' + index + '"]');
  }

  function onCardClick(index) {
    if (state.lock) return;
    var card = state.cards[index];
    if (card.matched || card.flipped) return;

    startTimer();
    card.flipped = true;
    var el = getCardEl(index);
    el.classList.add("is-flipped");
    el.setAttribute("aria-label", "Carte " + card.symbol);

    if (!state.first) {
      state.first = { index: index, card: card };
      return;
    }

    state.moves += 1;
    updateStats();

    var second = { index: index, card: card };
    if (state.first.card.id === second.card.id) {
      state.first.card.matched = true;
      second.card.matched = true;
      getCardEl(state.first.index).classList.add("is-matched");
      getCardEl(second.index).classList.add("is-matched");
      state.matched += 1;
      updateStats();
      state.first = null;
      if (state.matched === PAIRS) {
        endGame();
      }
      return;
    }

    state.lock = true;
    var firstIndex = state.first.index;
    state.first = null;
    setTimeout(function () {
      card.flipped = false;
      state.cards[firstIndex].flipped = false;
      var e1 = getCardEl(firstIndex);
      var e2 = getCardEl(index);
      e1.classList.remove("is-flipped");
      e2.classList.remove("is-flipped");
      e1.setAttribute("aria-label", "Carte cachée");
      e2.setAttribute("aria-label", "Carte cachée");
      state.lock = false;
    }, 850);
  }

  function endGame() {
    stopTimer();
    var seconds = Math.floor((Date.now() - state.startedAt) / 1000);
    resultEl.textContent =
      "Vous avez trouvé les " + PAIRS + " paires en " + state.moves +
      " coups et " + seconds + " s.";
    overlay.hidden = false;
  }

  function resetGame() {
    stopTimer();
    state = {
      cards: buildDeck().map(function (c) {
        return { id: c.id, symbol: c.symbol, flipped: false, matched: false };
      }),
      first: null,
      lock: false,
      moves: 0,
      matched: 0,
      startedAt: null,
      timerId: null
    };
    timerEl.textContent = "0s";
    overlay.hidden = true;
    render();
    updateStats();
  }

  restartBtn.addEventListener("click", resetGame);
  playAgainBtn.addEventListener("click", resetGame);

  resetGame();
})();
