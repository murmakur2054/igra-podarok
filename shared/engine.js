// Общий движок подарочных игр: загрузка заказа, звук, музыка, мелочи.
(function () {
  const params = new URLSearchParams(location.search);
  const orderId = (params.get("order") || "demo").replace(/[^a-z0-9_-]/gi, "");
  const base = (window.GIFT_ROOT || "../") + "orders/" + orderId + "/";   // GIFT_ROOT = "./" для страниц в корне сайта

  // Загружаем config.js заказа через <script>, чтобы работало даже с file://
  function loadOrder() {
    return new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = base + "config.js";
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
      master.gain.value = 0.8;
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

  let musicTimer = null;
  let musicStop = false;

  // swell: 0..1 — насколько «раскрываются» струнные (растёт к кульминации)
  const music = {
    swell: 0,
    start() {
      const a = audio();
      musicStop = false;
      const beat = 60 / 64;
      let bar = 0;
      let next = a.currentTime + 0.2;
      const schedule = () => {
        if (musicStop) return;
        while (next < a.currentTime + 1.5) {
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
      clearTimeout(musicTimer);
      if (master) {
        const t = ctx.currentTime;
        master.gain.setValueAtTime(master.gain.value, t);
        master.gain.linearRampToValueAtTime(0.0001, t + fade);
        setTimeout(() => master && (master.gain.value = 0.8), fade * 1000 + 100);
      }
    },
  };

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

  window.Gift = { loadOrder, asset, loadImage, audio, sfx, music, confetti, showError, orderId };
})();
