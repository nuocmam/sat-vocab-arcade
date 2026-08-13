(function () {
  "use strict";

  var ROUND_MS = 60000;
  var STORAGE_KEY = "satWordBlitz.v1";
  var KEYS = ["1", "2", "3", "4"];
  var LETTERS = ["a", "b", "c", "d"];

  var words = window.SAT_WORDS || [];
  var state = {
    screen: "home",
    playing: false,
    locked: false,
    score: 0,
    combo: 0,
    bestCombo: 0,
    hits: 0,
    misses: 0,
    missed: [],
    used: {},
    current: null,
    shownAt: 0,
    endsAt: 0,
    raf: 0,
    muted: false,
  };

  var els = {
    home: document.getElementById("home"),
    play: document.getElementById("play"),
    results: document.getElementById("results"),
    homeBest: document.getElementById("homeBest"),
    homeCombo: document.getElementById("homeCombo"),
    homeGames: document.getElementById("homeGames"),
    playBtn: document.getElementById("playBtn"),
    againBtn: document.getElementById("againBtn"),
    homeBtn: document.getElementById("homeBtn"),
    muteBtn: document.getElementById("muteBtn"),
    scoreEl: document.getElementById("scoreEl"),
    timeEl: document.getElementById("timeEl"),
    comboEl: document.getElementById("comboEl"),
    timerBar: document.getElementById("timerBar"),
    hudTimer: document.querySelector(".hud-timer"),
    countdown: document.getElementById("countdown"),
    countdownNum: document.getElementById("countdownNum"),
    questionWrap: document.getElementById("questionWrap"),
    wordEl: document.getElementById("wordEl"),
    choices: document.getElementById("choices"),
    feedback: document.getElementById("feedback"),
    playStatus: document.getElementById("playStatus"),
    finalScore: document.getElementById("finalScore"),
    highNote: document.getElementById("highNote"),
    hitCount: document.getElementById("hitCount"),
    missCount: document.getElementById("missCount"),
    runCombo: document.getElementById("runCombo"),
    missedWrap: document.getElementById("missedWrap"),
    missedList: document.getElementById("missedList"),
    flash: document.getElementById("flash"),
    comboPop: document.getElementById("comboPop"),
  };

  var audioCtx = null;

  function loadStats() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { highScore: 0, longestCombo: 0, gamesPlayed: 0 };
      var data = JSON.parse(raw);
      return {
        highScore: Number(data.highScore) || 0,
        longestCombo: Number(data.longestCombo) || 0,
        gamesPlayed: Number(data.gamesPlayed) || 0,
      };
    } catch (e) {
      return { highScore: 0, longestCombo: 0, gamesPlayed: 0 };
    }
  }

  function saveStats(stats) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  }

  function paintHome() {
    var s = loadStats();
    els.homeBest.textContent = String(s.highScore);
    els.homeCombo.textContent = String(s.longestCombo);
    els.homeGames.textContent = String(s.gamesPlayed);
  }

  function showScreen(name) {
    state.screen = name;
    ["home", "play", "results"].forEach(function (id) {
      var node = els[id];
      var on = id === name;
      node.classList.toggle("is-active", on);
      if (on) node.removeAttribute("hidden");
      else node.setAttribute("hidden", "");
    });
  }

  function shuffle(arr) {
    var a = arr.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i];
      a[i] = a[j];
      a[j] = t;
    }
    return a;
  }

  function pickQuestion() {
    var pool = [];
    var i;
    for (i = 0; i < words.length; i++) {
      if (!state.used[words[i].w]) pool.push(words[i]);
    }
    if (pool.length < 8) {
      state.used = {};
      pool = words.slice();
    }
    var item = pool[Math.floor(Math.random() * pool.length)];
    state.used[item.w] = true;

    var distractors = [];
    var guard = 0;
    while (distractors.length < 3 && guard < 80) {
      guard++;
      var other = words[Math.floor(Math.random() * words.length)];
      if (other.w === item.w) continue;
      if (distractors.some(function (d) { return d.d === other.d; })) continue;
      distractors.push(other);
    }
    var options = shuffle([{ d: item.d, ok: true }].concat(
      distractors.map(function (d) { return { d: d.d, ok: false }; })
    ));
    return { word: item.w, def: item.d, options: options };
  }

  function ensureAudio() {
    if (state.muted) return null;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    if (!audioCtx) audioCtx = new AC();
    if (audioCtx.state === "suspended") audioCtx.resume();
    return audioCtx;
  }

  function beep(freq, dur, type, gain) {
    var ctx = ensureAudio();
    if (!ctx) return;
    var osc = ctx.createOscillator();
    var g = ctx.createGain();
    osc.type = type || "square";
    osc.frequency.value = freq;
    g.gain.value = gain == null ? 0.05 : gain;
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start();
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
    osc.stop(ctx.currentTime + dur + 0.02);
  }

  function sfxOk(combo) {
    beep(520, 0.07, "square", 0.05);
    setTimeout(function () { beep(780, 0.09, "square", 0.05); }, 60);
    if (combo >= 5) setTimeout(function () { beep(1040, 0.12, "triangle", 0.04); }, 120);
  }
  function sfxBad() {
    beep(180, 0.18, "sawtooth", 0.04);
    setTimeout(function () { beep(120, 0.22, "sawtooth", 0.035); }, 80);
  }
  function sfxTick() { beep(880, 0.04, "square", 0.03); }
  function sfxStart() {
    beep(330, 0.08); setTimeout(function () { beep(440, 0.08); }, 90);
    setTimeout(function () { beep(660, 0.12); }, 180);
  }

  function comboLabel(n) {
    if (n >= 15) return "VOCAB GOD x" + n;
    if (n >= 10) return "UNSTOPPABLE x" + n;
    if (n >= 5) return "ON FIRE x" + n;
    if (n >= 3) return "COMBO x" + n;
    return "+" + n;
  }

  function popCombo(text) {
    els.comboPop.textContent = text;
    els.comboPop.classList.remove("show");
    void els.comboPop.offsetWidth;
    els.comboPop.classList.add("show");
  }

  function flash(kind) {
    els.flash.className = "flash " + kind;
  }

  function renderQuestion() {
    var q = pickQuestion();
    state.current = q;
    state.locked = false;
    state.shownAt = performance.now();
    els.wordEl.textContent = q.word;
    els.feedback.textContent = "";
    els.feedback.className = "feedback";
    els.choices.innerHTML = "";
    q.options.forEach(function (opt, idx) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "choice";
      btn.dataset.idx = String(idx);
      btn.innerHTML = '<span class="key">' + KEYS[idx] + "</span><span>" + escapeHtml(opt.d) + "</span>";
      btn.addEventListener("click", function () { answer(idx); });
      els.choices.appendChild(btn);
    });
    els.playStatus.textContent = "Define " + q.word;
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function answer(idx) {
    if (!state.playing || state.locked || !state.current) return;
    var remaining = state.endsAt - performance.now();
    if (remaining <= 0) return;
    state.locked = true;
    var opt = state.current.options[idx];
    var buttons = els.choices.querySelectorAll(".choice");
    var i;
    for (i = 0; i < buttons.length; i++) {
      buttons[i].disabled = true;
      var o = state.current.options[i];
      if (o.ok) buttons[i].classList.add("correct");
      else if (i === idx) buttons[i].classList.add("wrong");
      else buttons[i].classList.add("dim");
    }

    if (opt.ok) {
      var elapsed = performance.now() - state.shownAt;
      var speed = Math.max(0, Math.round(80 * (1 - Math.min(elapsed, 5000) / 5000)));
      state.combo += 1;
      if (state.combo > state.bestCombo) state.bestCombo = state.combo;
      var mult = 1 + (state.combo - 1) * 0.2;
      var points = Math.round((100 + speed) * mult);
      state.score += points;
      state.hits += 1;
      els.feedback.textContent = "HIT  +" + points + (state.combo > 1 ? "  COMBO x" + state.combo : "");
      els.feedback.className = "feedback ok";
      els.scoreEl.textContent = String(state.score);
      els.comboEl.textContent = "x" + state.combo;
      flash("ok");
      sfxOk(state.combo);
      if (state.combo >= 3) popCombo(comboLabel(state.combo));
    } else {
      state.misses += 1;
      state.combo = 0;
      els.comboEl.textContent = "x0";
      els.feedback.textContent = "MISS  —  " + state.current.def;
      els.feedback.className = "feedback bad";
      flash("bad");
      sfxBad();
      state.missed.push({
        word: state.current.word,
        def: state.current.def,
        picked: opt.d,
      });
    }

    setTimeout(function () {
      if (!state.playing) return;
      if (performance.now() >= state.endsAt) {
        endRound();
        return;
      }
      renderQuestion();
    }, opt.ok ? 420 : 900);
  }

  function tick() {
    if (!state.playing) return;
    var left = Math.max(0, state.endsAt - performance.now());
    var secs = Math.ceil(left / 1000);
    els.timeEl.textContent = String(secs);
    els.timerBar.style.transform = "scaleX(" + (left / ROUND_MS) + ")";
    var low = left <= 10000;
    els.hudTimer.classList.toggle("low", low);
    if (low && left > 0 && Math.floor(left / 1000) !== Math.floor((left + 16) / 1000)) {
      sfxTick();
    }
    if (left <= 0) {
      endRound();
      return;
    }
    state.raf = requestAnimationFrame(tick);
  }

  function startRound() {
    cancelAnimationFrame(state.raf);
    state.playing = false;
    state.score = 0;
    state.combo = 0;
    state.bestCombo = 0;
    state.hits = 0;
    state.misses = 0;
    state.missed = [];
    state.used = {};
    state.current = null;
    els.scoreEl.textContent = "0";
    els.comboEl.textContent = "x0";
    els.timeEl.textContent = "60";
    els.timerBar.style.transform = "scaleX(1)";
    els.hudTimer.classList.remove("low");
    els.feedback.textContent = "";
    showScreen("play");
    els.questionWrap.hidden = true;
    els.countdown.hidden = false;
    sfxStart();
    var seq = ["3", "2", "1", "BLITZ"];
    var si = 0;
    function showCount() {
      if (si >= seq.length) {
        els.countdown.hidden = true;
        els.questionWrap.hidden = false;
        state.playing = true;
        state.endsAt = performance.now() + ROUND_MS;
        renderQuestion();
        state.raf = requestAnimationFrame(tick);
        return;
      }
      els.countdownNum.textContent = seq[si];
      els.countdownNum.style.animation = "none";
      void els.countdownNum.offsetWidth;
      els.countdownNum.style.animation = "";
      si += 1;
      setTimeout(showCount, si === seq.length ? 450 : 550);
    }
    showCount();
  }

  function endRound() {
    if (!state.playing && state.screen !== "play") return;
    state.playing = false;
    cancelAnimationFrame(state.raf);
    var stats = loadStats();
    var beaten = state.score > stats.highScore;
    if (beaten) stats.highScore = state.score;
    if (state.bestCombo > stats.longestCombo) stats.longestCombo = state.bestCombo;
    stats.gamesPlayed += 1;
    saveStats(stats);

    els.finalScore.textContent = String(state.score);
    els.highNote.hidden = !beaten;
    els.hitCount.textContent = String(state.hits);
    els.missCount.textContent = String(state.misses);
    els.runCombo.textContent = String(state.bestCombo);

    if (state.missed.length) {
      els.missedWrap.hidden = false;
      els.missedList.innerHTML = state.missed.map(function (m) {
        return "<li><strong>" + escapeHtml(m.word) + "</strong>" +
          '<span class="def">' + escapeHtml(m.def) + "</span>" +
          '<div class="picked">you picked: ' + escapeHtml(m.picked) + "</div></li>";
      }).join("");
    } else {
      els.missedWrap.hidden = true;
      els.missedList.innerHTML = "";
    }
    showScreen("results");
    paintHome();
  }

  function onKey(e) {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    var k = e.key.toLowerCase();
    if (state.screen === "home" && (k === "enter" || k === " ")) {
      e.preventDefault();
      startRound();
      return;
    }
    if (state.screen === "results" && (k === "enter" || k === " ")) {
      e.preventDefault();
      startRound();
      return;
    }
    if (state.screen !== "play" || !state.playing) return;
    var idx = KEYS.indexOf(k);
    if (idx < 0) idx = LETTERS.indexOf(k);
    if (idx >= 0) {
      e.preventDefault();
      answer(idx);
    }
  }

  els.playBtn.addEventListener("click", startRound);
  els.againBtn.addEventListener("click", startRound);
  els.homeBtn.addEventListener("click", function () {
    showScreen("home");
    paintHome();
  });
  els.muteBtn.addEventListener("click", function () {
    state.muted = !state.muted;
    els.muteBtn.setAttribute("aria-pressed", state.muted ? "true" : "false");
    els.muteBtn.textContent = state.muted ? "MUTE" : "SND";
    if (!state.muted) ensureAudio();
  });
  document.addEventListener("keydown", onKey);

  if (!words.length) {
    els.playBtn.disabled = true;
    els.howto = document.querySelector(".howto");
    if (els.howto) els.howto.textContent = "Word bank failed to load.";
  }
  paintHome();
})();
