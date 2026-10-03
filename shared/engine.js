// Общий движок подарочных игр: загрузка заказа, звук, музыка, мелочи.
(function () {
  const params = new URLSearchParams(location.search);
  const orderId = (params.get("order") || "demo").replace(/[^a-z0-9_-]/gi, "");
  const base = (window.GIFT_ROOT || "../") + "orders/" + orderId + "/";   // GIFT_ROOT = "./" для страниц в корне сайта

  // Загружаем config.js заказа через <script>, чтобы работало даже с file://
  function loadOrder() {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = base + "config.js?t=" + Date.now();   // всегда свежий заказ
      s.onload = () => (window.GIFT ? resolve(window.GIFT) : reject(new Error("config пустой")));
      s.onerror = () => reject(new Error("Заказ «" + orderId + "» не найден"));
      document.head.appendChild(s);
    });
  }

  function asset(file) {
    return base + file;
  }

  function loadImage(file) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = asset(file);
    });
  }

  // ---------------- ЗВУК ----------------
  let ctx = null;
  let master = null;
  let reverb = null;

  function audio() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      master = ctx.createGain();
      master.gain.value = vol();
      master.connect(ctx.destination);
      reverb = makeReverb(3.2);
      const wet = ctx.createGain();
      wet.gain.value = 0.45;
      reverb.connect(wet).connect(master);
    }
    if (ctx.state === "suspended") ctx.resume();
    return ctx;
  }

  // Искусственная реверберация из затухающего шума — «зал»
  function makeReverb(seconds) {
    const len = Math.floor(ctx.sampleRate * seconds);
    const buf = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6);
    }
    const c = ctx.createConvolver();
    c.buffer = buf;
    return c;
  }

  function tone({ freq, type = "square", dur = 0.12, vol = 0.15, slide = 0, when = 0, wet = false }) {
    const a = audio();
    const t = a.currentTime + when;
    const o = a.createOscillator();
    const g = a.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(30, freq + slide), t + dur);
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(master);
    if (wet) g.connect(reverb);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  const sfx = {
    tap: () => tone({ freq: 660, dur: 0.06, vol: 0.08 }),
    heartbeat: () => { tone({ freq: 75, type: "sine", dur: 0.16, vol: 0.4, slide: -35 }); tone({ freq: 70, type: "sine", dur: 0.2, vol: 0.32, slide: -35, when: 0.22 }); },
    whoosh: () => tone({ freq: 900, type: "sawtooth", dur: 0.3, vol: 0.04, slide: -700 }),
    blip: () => tone({ freq: 480 + Math.random() * 120, dur: 0.035, vol: 0.025 }),
    good: () => { tone({ freq: 523, dur: 0.08 }); tone({ freq: 784, dur: 0.12, when: 0.07 }); },
    bad: () => tone({ freq: 220, type: "sawtooth", dur: 0.35, slide: -150, vol: 0.12 }),
    win: () => [523, 659, 784, 1047].forEach((f, i) => tone({ freq: f, dur: 0.25, when: i * 0.12, wet: true })),
    wrong: () => { tone({ freq: 300, type: "sawtooth", dur: 0.15, vol: 0.1 }); tone({ freq: 200, type: "sawtooth", dur: 0.3, when: 0.15, vol: 0.1 }); },
    boing: () => tone({ freq: 180, type: "sine", dur: 0.4, slide: 500, vol: 0.2 }),
  };

  // ---------------- ТРОГАТЕЛЬНАЯ МУЗЫКА ----------------
  // Фортепиано + струнный фон. Гармония vi–IV–I–V (Am–F–C–G), 64 BPM.
  const NOTE = { C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5, "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11 };
  function hz(name) {
    const m = name.match(/^([A-G]#?)(\d)$/);
    return 440 * Math.pow(2, (NOTE[m[1]] + (Number(m[2]) + 1) * 12 - 69) / 12);
  }

  function piano(freq, t, vol, len) {
    const a = audio();
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + 0.012);
    g.gain.exponentialRampToValueAtTime(vol * 0.35, t + 0.4);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len);
    const lp = a.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(Math.min(5000, freq * 6), t);
    lp.frequency.exponentialRampToValueAtTime(Math.max(400, freq * 1.5), t + len);
    [[1, "triangle", 1], [2, "sine", 0.35], [3, "sine", 0.12]].forEach(([mult, type, amp]) => {
      const o = a.createOscillator();
      const og = a.createGain();
      o.type = type;
      o.frequency.value = freq * mult;
      o.detune.value = (Math.random() - 0.5) * 6;
      og.gain.value = amp;
      o.connect(og).connect(lp);
      o.start(t);
      o.stop(t + len + 0.1);
    });
    lp.connect(g);
    g.connect(master);
    g.connect(reverb);
  }

  function strings(freqs, t, len, vol) {
    const a = audio();
    const g = a.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(vol, t + len * 0.45);
    g.gain.linearRampToValueAtTime(0.0001, t + len + 0.6);
    const lp = a.createBiquadFilter();
    lp.type = "lowpass";
    lp.frequency.value = 1400;
    freqs.forEach((f) => {
      [-7, 7].forEach((det) => {
        const o = a.createOscillator();
        o.type = "sawtooth";
        o.frequency.value = f;
        o.detune.value = det;
        o.connect(lp);
        o.start(t);
        o.stop(t + len + 0.8);
      });
    });
    lp.connect(g);
    g.connect(reverb);
    g.connect(master);
  }

  const PROGRESSION = [
    { bass: "A2", chord: ["A3", "C4", "E4"], melody: ["E5", "C5", "B4", "C5"] },
    { bass: "F2", chord: ["F3", "A3", "C4"], melody: ["A4", "C5", "A4", "G4"] },
    { bass: "C3", chord: ["C4", "E4", "G4"], melody: ["G4", "E5", "D5", "C5"] },
    { bass: "G2", chord: ["G3", "B3", "D4"], melody: ["D5", "B4", "G4", "B4"] },
  ];

  // ---------------- 8-БИТНАЯ МУЗЫКА (квиз, аркада) ----------------
  // Мелодия — 8 восьмых на такт, "-" — пауза.
  const CHIP = {
    // квиз: весёлая прыгучая, до мажор
    fun: { bpm: 128, lead: "square", bars: [
      { root: "C3", mel: ["E5", "-", "G5", "E5", "C5", "-", "D5", "E5"] },
      { root: "A2", mel: ["C5", "-", "E5", "C5", "A4", "-", "B4", "C5"] },
      { root: "F2", mel: ["A4", "-", "C5", "A4", "F4", "-", "G4", "A4"] },
      { root: "G2", mel: ["B4", "D5", "G5", "-", "F5", "D5", "B4", "G4"] },
    ] },
    // аркада: быстрая и бодрая, ля минор
    arcade: { bpm: 152, lead: "square", bars: [
      { root: "A2", mel: ["A4", "C5", "E5", "A5", "G5", "E5", "C5", "E5"] },
      { root: "F2", mel: ["F4", "A4", "C5", "F5", "E5", "C5", "A4", "C5"] },
      { root: "C3", mel: ["G4", "C5", "E5", "G5", "F5", "E5", "D5", "E5"] },
      { root: "G2", mel: ["B4", "D5", "G5", "B5", "A5", "G5", "F5", "D5"] },
    ] },
  };

  let noiseBuf = null;
  function drum(kind, t) {
    const a = audio();
    if (kind === "kick") {
      const o = a.createOscillator();
      const g = a.createGain();
      o.type = "sine";
      o.frequency.setValueAtTime(150, t);
      o.frequency.exponentialRampToValueAtTime(45, t + 0.12);
      g.gain.setValueAtTime(0.3, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
      o.connect(g).connect(master);
      o.start(t);
      o.stop(t + 0.2);
      return;
    }
    if (!noiseBuf) {
      noiseBuf = a.createBuffer(1, a.sampleRate * 0.3, a.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const s = a.createBufferSource();
    const f = a.createBiquadFilter();
    const g = a.createGain();
    const dur = kind === "snare" ? 0.14 : 0.04;
    s.buffer = noiseBuf;
    f.type = "highpass";
    f.frequency.value = kind === "snare" ? 1500 : 7000;
    g.gain.setValueAtTime(kind === "snare" ? 0.09 : 0.035, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f).connect(g).connect(master);
    s.start(t);
    s.stop(t + dur + 0.02);
  }

  function chipBar(st, b, t, loop) {
    const e = 60 / st.bpm / 2;   // восьмая
    for (let i = 0; i < 8; i++) {
      const at = t + i * e;
      // бас «умпа»: корень / октава
      tone({ freq: hz(b.root) * (i % 2 ? 2 : 1), type: "triangle", dur: e * 0.9, vol: 0.13, when: at - audio().currentTime });
      const n = b.mel[i];
      // на первом круге мелодия тише — разгон
      if (n !== "-") tone({ freq: hz(n), type: st.lead, dur: e * 0.85, vol: loop ? 0.035 : 0.022, when: at - audio().currentTime });
      if (i % 4 === 0) drum("kick", at);
      if (i % 4 === 2) drum("snare", at);
      drum("hat", at + e / 2);
    }
    return e * 8;
  }

  let musicTimer = null;
  let musicStop = true;
  let muted = false;
  const vol = () => (muted ? 0.0001 : 0.8);

  // swell: 0..1 — насколько «раскрываются» струнные (растёт к кульминации)
  // style: "love" — фортепиано (история, главная), "fun" — квиз, "arcade" — аркада
  const music = {
    swell: 0,
    playing: false,
    start(style = "love") {
      if (music.playing) return;
      const a = audio();
      musicStop = false;
      music.playing = true;
      master.gain.cancelScheduledValues(a.currentTime);
      master.gain.setValueAtTime(vol(), a.currentTime);
      const st = CHIP[style];
      const beat = 60 / 64;
      let bar = 0;
      let next = a.currentTime + 0.2;
      const schedule = () => {
        if (musicStop) return;
        while (next < a.currentTime + 1.5) {
          if (st) {
            next += chipBar(st, st.bars[bar % 4], next, bar >= 4);
            bar++;
            continue;
          }
          const p = PROGRESSION[bar % 4];
          const loop = Math.floor(bar / 4);
          piano(hz(p.bass), next, 0.22, beat * 4);
          // арпеджио восьмыми
          const arp = [p.chord[0], p.chord[1], p.chord[2], p.chord[1], p.chord[0], p.chord[1], p.chord[2], p.chord[1]];
          arp.forEach((n, i) => piano(hz(n), next + i * beat * 0.5, 0.07, beat * 2));
          // мелодия появляется со второго круга
          if (loop >= 1) p.melody.forEach((n, i) => piano(hz(n), next + i * beat, 0.13 + music.swell * 0.05, beat * 2.5));
          if (music.swell > 0.05) strings(p.chord.map(hz), next, beat * 4, 0.035 * music.swell);
          next += beat * 4;
          bar++;
        }
        musicTimer = setTimeout(schedule, 250);
      };
      schedule();
    },
    stop(fade = 2) {
      musicStop = true;
      music.playing = false;
      clearTimeout(musicTimer);
      if (master) {
        const t = ctx.currentTime;
        master.gain.setValueAtTime(master.gain.value, t);
        master.gain.linearRampToValueAtTime(0.0001, t + fade);
        setTimeout(() => master && (master.gain.value = vol()), fade * 1000 + 100);
      }
    },
  };

  // Пиксельная кнопка звука в углу. Первое нажатие включает музыку, дальше — вкл/выкл.
  function soundButton(style) {
    const b = document.createElement("button");
    b.className = "snd";
    const paint = () => (b.textContent = music.playing && !muted ? "🔊" : "🔇");
    b.onclick = (e) => {
      e.stopPropagation();
      if (!music.playing) { muted = false; music.start(style); }
      else {
        muted = !muted;
        master.gain.cancelScheduledValues(ctx.currentTime);
        master.gain.setValueAtTime(vol(), ctx.currentTime);
      }
      paint();
    };
    document.body.appendChild(b);
    paint();
    return { refresh: paint };
  }

  // ---------------- МЕЛОЧИ ----------------
  function confetti(count = 80) {
    const colors = ["#ff4d6d", "#ffd166", "#06d6a0", "#118ab2", "#ef476f", "#f78c6b"];
    for (let i = 0; i < count; i++) {
      const p = document.createElement("div");
      p.className = "confetti";
      p.style.left = Math.random() * 100 + "vw";
      p.style.background = colors[i % colors.length];
      p.style.animationDuration = 2 + Math.random() * 2.5 + "s";
      p.style.animationDelay = Math.random() * 0.6 + "s";
      p.style.transform = "rotate(" + Math.random() * 360 + "deg)";
      document.body.appendChild(p);
      setTimeout(() => p.remove(), 5500);
    }
  }

  function showError(msg) {
    document.body.innerHTML = '<div class="screen center"><h2>Ой 😅</h2><p>' + msg + "</p></div>";
  }

  window.Gift = { loadOrder, asset, loadImage, audio, sfx, music, soundButton, confetti, showError, orderId };
})();
