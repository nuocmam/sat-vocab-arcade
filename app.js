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
    comboNote: document.getElementById("comboNote"),
    hitCount: document.getElementById("hitCount"),
    missCount: document.getElementById("missCount"),
    runCombo: document.getElementById("runCombo"),
    missedWrap: document.getElementById("missedWrap"),
    missedList: document.getElementById("missedList"),
    flash: document.getElementById("flash"),
    comboPop: document.getElementById("comboPop"),
    cabinet: document.getElementById("app"),
    fxLayer: document.getElementById("fxLayer"),
    floatLayer: document.getElementById("floatLayer"),
  };

  var audioCtx = null;
  var reduceMotion = false;
  var fx = {
    ctx: null,
    pool: [],
    live: [],
    raf: 0,
    running: false,
    last: 0,
    w: 0,
    h: 0,
  };
  var SPARK_COLORS = ["#00fff0", "#7cff4a", "#f5ff3d", "#ff2ec8"];
  var floatPool = [];
  var scoreTickRaf = 0;
  var finalTickRaf = 0;
  var eatTimer = 0;
  var brokeTimer = 0;

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
    var n = combo || 0;
    beep(520 + n * 36, 0.07, "square", 0.05);
    setTimeout(function () { beep(780 + n * 36, 0.09, "square", 0.05); }, 60);
    if (n >= 5) setTimeout(function () { beep(1040, 0.12, "triangle", 0.04); }, 120);
    if (n >= 10) {
      setTimeout(function () { beep(1320, 0.1, "square", 0.035); }, 180);
      setTimeout(function () { beep(1560, 0.08, "square", 0.03); }, 230);
    }
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
    if (n >= 2) return "COMBO x" + n;
    return "+" + n;
  }

  function popCombo(text, combo, broke) {
    els.comboPop.textContent = text;
    els.comboPop.classList.remove("show", "big", "huge", "broke");
    if (broke) els.comboPop.classList.add("broke");
    else if (combo >= 10) els.comboPop.classList.add("huge");
    else if (combo >= 5) els.comboPop.classList.add("big");
    void els.comboPop.offsetWidth;
    els.comboPop.classList.add("show");
  }

  function paintCombo(n) {
    els.comboEl.textContent = "x" + n;
    els.comboEl.classList.remove("mag", "combo-lo", "combo-mid", "combo-hi", "broke");
    if (n >= 10) els.comboEl.classList.add("combo-hi");
    else if (n >= 5) els.comboEl.classList.add("combo-mid");
    else if (n >= 3) els.comboEl.classList.add("combo-lo");
    else els.comboEl.classList.add("mag");
  }

  function stingComboBreak() {
    if (brokeTimer) {
      clearTimeout(brokeTimer);
      brokeTimer = 0;
    }
    els.comboEl.classList.remove("broke");
    void els.comboEl.offsetWidth;
    els.comboEl.classList.add("broke");
    popCombo("COMBO BROKE", 0, true);
    brokeTimer = setTimeout(function () {
      els.comboEl.classList.remove("broke");
      brokeTimer = 0;
    }, 400);
  }

  function hapticMiss() {
    if (!navigator.vibrate) return;
    try { navigator.vibrate(30); } catch (e) {}
  }

  function paintFinalScore(next) {
    if (finalTickRaf) {
      cancelAnimationFrame(finalTickRaf);
      finalTickRaf = 0;
    }
    els.finalScore.classList.remove("punch");
    if (reduceMotion || !next) {
      els.finalScore.textContent = String(next);
      return;
    }
    els.finalScore.textContent = "0";
    var start = performance.now();
    var dur = 700;
    function step(now) {
      var t = Math.min(1, (now - start) / dur);
      var eased = 1 - (1 - t) * (1 - t);
      els.finalScore.textContent = String(Math.round(next * eased));
      if (t < 1) {
        finalTickRaf = requestAnimationFrame(step);
      } else {
        finalTickRaf = 0;
        els.finalScore.classList.remove("punch");
        void els.finalScore.offsetWidth;
        els.finalScore.classList.add("punch");
      }
    }
    finalTickRaf = requestAnimationFrame(step);
  }

  function sizeFx() {
    if (!els.fxLayer || !fx.ctx) return;
    var dpr = Math.min(window.devicePixelRatio || 1, 2);
    fx.w = window.innerWidth;
    fx.h = window.innerHeight;
    els.fxLayer.width = Math.floor(fx.w * dpr);
    els.fxLayer.height = Math.floor(fx.h * dpr);
    els.fxLayer.style.width = fx.w + "px";
    els.fxLayer.style.height = fx.h + "px";
    fx.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  function initFx() {
    var mq = window.matchMedia ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;
    reduceMotion = !!(mq && mq.matches);
    if (mq) {
      var onMq = function (e) { reduceMotion = !!e.matches; };
      if (mq.addEventListener) mq.addEventListener("change", onMq);
      else if (mq.addListener) mq.addListener(onMq);
    }
    if (els.fxLayer) {
      fx.ctx = els.fxLayer.getContext("2d");
      sizeFx();
      window.addEventListener("resize", sizeFx);
    }
  }

  function burst(x, y, n) {
    if (reduceMotion || !fx.ctx) return;
    var i, p, ang, spd;
    for (i = 0; i < n; i++) {
      p = fx.pool.pop();
      if (!p) p = {};
      ang = (Math.PI * 2 * i) / n + (Math.random() - 0.5) * 0.5;
      spd = 90 + Math.random() * 260;
      p.x = x;
      p.y = y;
      p.vx = Math.cos(ang) * spd;
      p.vy = Math.sin(ang) * spd - 50;
      p.life = 0.28 + Math.random() * 0.2;
      p.age = 0;
      p.r = 2 + Math.random() * 2.4;
      p.color = SPARK_COLORS[i % SPARK_COLORS.length];
      fx.live.push(p);
    }
    if (!fx.running) {
      fx.running = true;
      fx.last = performance.now();
      fx.raf = requestAnimationFrame(tickFx);
    }
  }

  function tickFx(now) {
    var dt = Math.min(0.032, (now - fx.last) / 1000);
    fx.last = now;
    var ctx = fx.ctx;
    if (!ctx) {
      fx.running = false;
      return;
    }
    ctx.clearRect(0, 0, fx.w, fx.h);
    var next = [];
    var i, p, t;
    for (i = 0; i < fx.live.length; i++) {
      p = fx.live[i];
      p.age += dt;
      if (p.age >= p.life) {
        fx.pool.push(p);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 380 * dt;
      t = 1 - p.age / p.life;
      ctx.globalAlpha = t;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * (0.55 + t * 0.45), 0, Math.PI * 2);
      ctx.fill();
      next.push(p);
    }
    fx.live = next;
    ctx.globalAlpha = 1;
    if (fx.live.length) {
      fx.raf = requestAnimationFrame(tickFx);
    } else {
      fx.running = false;
      ctx.clearRect(0, 0, fx.w, fx.h);
    }
  }

  function recycleFloat(el) {
    el.classList.remove("go", "tier-lo", "tier-mid", "tier-hi");
    if (el.parentNode) el.parentNode.removeChild(el);
    if (floatPool.indexOf(el) < 0 && floatPool.length < 8) floatPool.push(el);
  }

  function spawnFloat(x, y, pts, combo) {
    if (reduceMotion || !els.floatLayer) return;
    var el = floatPool.pop();
    if (!el) {
      el = document.createElement("span");
      el.className = "float-pt";
      el.addEventListener("animationend", function () { recycleFloat(el); });
    }
    el.classList.remove("go", "tier-lo", "tier-mid", "tier-hi");
    el.classList.add(combo >= 5 ? "tier-hi" : combo >= 3 ? "tier-mid" : "tier-lo");
    el.textContent = "+" + pts;
    el.style.left = Math.round(x) + "px";
    el.style.top = Math.round(y) + "px";
    els.floatLayer.appendChild(el);
    void el.offsetWidth;
    el.classList.add("go");
  }

  function punch(combo) {
    if (reduceMotion || !els.cabinet) return;
    var cls = combo >= 10 ? "punch-lg" : combo >= 5 ? "punch-md" : "punch";
    els.cabinet.classList.remove("punch", "punch-md", "punch-lg");
    void els.cabinet.offsetWidth;
    els.cabinet.classList.add(cls);
    setTimeout(function () {
      els.cabinet.classList.remove("punch", "punch-md", "punch-lg");
    }, 230);
  }

  function hudTick(el) {
    if (!el) return;
    el.classList.remove("tick");
    void el.offsetWidth;
    el.classList.add("tick");
  }

  function paintScore(next) {
    var prev = Number(els.scoreEl.textContent) || 0;
    if (scoreTickRaf) {
      cancelAnimationFrame(scoreTickRaf);
      scoreTickRaf = 0;
    }
    if (reduceMotion || next === prev) {
      els.scoreEl.textContent = String(next);
      return;
    }
    var start = performance.now();
    var dur = 240;
    function step(now) {
      var t = Math.min(1, (now - start) / dur);
      var eased = 1 - (1 - t) * (1 - t);
      els.scoreEl.textContent = String(Math.round(prev + (next - prev) * eased));
      if (t < 1) scoreTickRaf = requestAnimationFrame(step);
      else scoreTickRaf = 0;
    }
    scoreTickRaf = requestAnimationFrame(step);
  }

  function eatBoard() {
    els.choices.classList.add("eat");
    if (eatTimer) clearTimeout(eatTimer);
    eatTimer = setTimeout(function () {
      els.choices.classList.remove("eat");
      eatTimer = 0;
    }, 80);
  }

  function wordPunch() {
    if (!els.wordEl) return;
    els.wordEl.classList.remove("hit");
    void els.wordEl.offsetWidth;
    els.wordEl.classList.add("hit");
  }

  function haptic(combo) {
    if (!navigator.vibrate) return;
    try {
      if (combo >= 10) navigator.vibrate([30, 40, 30, 40, 50]);
      else if (combo >= 5) navigator.vibrate([20, 40, 20]);
      else navigator.vibrate(18);
    } catch (e) {}
  }

  function juiceHit(originEl, points, combo) {
    var x, y, n, rect;
    if (originEl && originEl.getBoundingClientRect) {
      rect = originEl.getBoundingClientRect();
      x = rect.left + rect.width / 2;
      y = rect.top + rect.height / 2;
    } else {
      x = window.innerWidth / 2;
      y = window.innerHeight * 0.22;
    }
    n = combo >= 10 ? 24 : combo >= 5 ? 20 : 16;
    burst(x, y, n);
    spawnFloat(x, y - 8, points, combo);
    punch(combo);
    wordPunch();
    if (!reduceMotion) {
      hudTick(els.scoreEl);
      hudTick(els.comboEl);
    }
    haptic(combo);
  }

  function flash(kind, combo) {
    els.flash.className = "flash";
    void els.flash.offsetWidth;
    if (kind === "bad") {
      els.flash.classList.add("bad");
      return;
    }
    if (!combo || combo <= 2) return;
    els.flash.classList.add(combo <= 4 ? "ok-mid" : "ok-hi");
  }

  function renderQuestion() {
    var q = pickQuestion();
    state.current = q;
    state.locked = false;
    state.shownAt = performance.now();
    els.wordEl.textContent = q.word;
    els.wordEl.classList.remove("hit", "enter");
    els.scoreEl.classList.remove("tick");
    els.comboEl.classList.remove("tick", "broke");
    els.feedback.textContent = "";
    els.feedback.className = "feedback";
    els.choices.innerHTML = "";
    eatBoard();
    q.options.forEach(function (opt, idx) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "choice" + (reduceMotion ? "" : " enter");
      btn.dataset.idx = String(idx);
      btn.innerHTML = '<span class="key">' + KEYS[idx] + "</span><span>" + escapeHtml(opt.d) + "</span>";
      btn.addEventListener("click", function () { answer(idx); });
      els.choices.appendChild(btn);
    });
    if (!reduceMotion) {
      void els.wordEl.offsetWidth;
      els.wordEl.classList.add("enter");
    }
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
    if (opt.ok && buttons[idx]) {
      buttons[idx].classList.remove("land");
      void buttons[idx].offsetWidth;
      buttons[idx].classList.add("land");
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
      paintScore(state.score);
      paintCombo(state.combo);
      flash("ok", state.combo);
      sfxOk(state.combo);
      juiceHit(buttons[idx], points, state.combo);
      if (state.combo >= 2) popCombo(comboLabel(state.combo), state.combo);
    } else {
      var wasCombo = state.combo;
      state.misses += 1;
      state.combo = 0;
      paintCombo(0);
      els.feedback.textContent = "MISS  —  " + state.current.def;
      els.feedback.className = "feedback bad";
      flash("bad");
      sfxBad();
      if (wasCombo >= 3) stingComboBreak();
      hapticMiss();
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
    }, opt.ok ? 280 : 900);
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
    if (scoreTickRaf) {
      cancelAnimationFrame(scoreTickRaf);
      scoreTickRaf = 0;
    }
    if (finalTickRaf) {
      cancelAnimationFrame(finalTickRaf);
      finalTickRaf = 0;
    }
    if (brokeTimer) {
      clearTimeout(brokeTimer);
      brokeTimer = 0;
    }
    els.scoreEl.textContent = "0";
    paintCombo(0);
    els.finalScore.classList.remove("punch");
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
    var prevHigh = stats.highScore;
    var prevCombo = stats.longestCombo;
    var beaten = state.score > prevHigh;
    var comboRecord = state.bestCombo > prevCombo;
    if (beaten) stats.highScore = state.score;
    if (comboRecord) stats.longestCombo = state.bestCombo;
    stats.gamesPlayed += 1;
    saveStats(stats);

    paintFinalScore(state.score);
    els.highNote.classList.toggle("short", !beaten);
    if (beaten) {
      els.highNote.textContent = "NEW HIGH SCORE";
    } else {
      els.highNote.textContent = "BEST " + prevHigh + " · " + (prevHigh - state.score) + " SHORT";
    }
    els.highNote.hidden = false;
    if (comboRecord) {
      els.comboNote.textContent = "NEW MAX COMBO x" + state.bestCombo;
      els.comboNote.hidden = false;
    } else {
      els.comboNote.hidden = true;
    }
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
    els.muteBtn.textContent = state.muted ? "MUTED" : "SND";
    els.muteBtn.setAttribute("aria-label", state.muted ? "Unmute sound" : "Mute sound");
    if (!state.muted) ensureAudio();
  });
  document.addEventListener("keydown", onKey);

  if (!words.length) {
    els.playBtn.disabled = true;
    els.howto = document.querySelector(".howto");
    if (els.howto) els.howto.textContent = "Word bank failed to load.";
  }
  initFx();
  paintHome();
})();
