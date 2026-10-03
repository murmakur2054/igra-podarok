// Пиксельный движок истории: сцена рисуется в маленьком разрешении (~150px по ширине)
// и растягивается браузером с image-rendering: pixelated.
(function () {
  const P = { LW: 0, LH: 0, fireworks: false, petals: false, romance: 0, blanket: false };
  let cv, g, LW, LH, GY, t = 0;
  let scene = null, sceneName = "", fx = [], timers = [], waiters = [];
  let shake = 0, flash = 0, flashColor = "#fff", romanceT = 0, slowT = 0;
  const chars = { a: null, b: null };
  P.chars = chars;

  // ---------- базовое ----------
  P.init = (canvas) => {
    cv = canvas;
    g = cv.getContext("2d");
    resize();
    addEventListener("resize", resize);
    requestAnimationFrame(loop);
  };

  function resize() {
    const W = innerWidth, H = innerHeight;
    const px = Math.max(3, Math.round(Math.min(W, 720) / 150));
    LW = P.LW = Math.ceil(W / px);
    LH = P.LH = Math.ceil(H / px);
    GY = Math.round(LH * 0.74);
    cv.width = LW;
    cv.height = LH;
    g.imageSmoothingEnabled = false;
  }

  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
      let x = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
      return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
    };
  }

  const R = (x, y, w, h, c) => { g.fillStyle = c; g.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  function disc(cx, cy, r, c) {
    g.fillStyle = c;
    for (let dy = -r; dy <= r; dy++) {
      const w = Math.floor(Math.sqrt(r * r - dy * dy));
      g.fillRect(Math.round(cx - w), Math.round(cy + dy), 2 * w + 1, 1);
    }
  }
  function bands(colors, top, bottom) {
    const n = colors.length, h = (bottom - top) / n;
    for (let i = 0; i < n; i++) {
      R(0, top + i * h, LW, h + 1, colors[i]);
      if (i < n - 1) {
        g.fillStyle = colors[i + 1];
        const y = Math.round(top + (i + 1) * h);
        for (let x = 0; x < LW; x += 2) { g.fillRect(x, y - 2, 1, 1); g.fillRect(x + 1, y - 1, 1, 1); g.fillRect(x, y - 1, 1, 1); }
      }
    }
  }
  function bmp(rows, x, y, c) {
    g.fillStyle = c;
    rows.forEach((r, j) => { for (let i = 0; i < r.length; i++) if (r[i] === "#") g.fillRect(Math.round(x) + i, Math.round(y) + j, 1, 1); });
  }
  const later = (sec, fn) => timers.push({ at: t + sec, fn });
  const when = (cond, fn) => waiters.push({ cond, fn });
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const sfx = (name) => { try { Gift.sfx[name](); } catch (e) { /* без звука */ } };

  // ---------- комиксные надписи поверх экрана ----------
  P.comic = (text, lx, ly, color = "#ffd166", size = 1) => {
    const d = document.createElement("div");
    d.className = "comic";
    d.textContent = text;
    d.style.left = Math.round((lx / LW) * innerWidth) + "px";
    d.style.top = Math.round((ly / LH) * innerHeight) + "px";
    d.style.color = color;
    d.style.fontSize = Math.round(18 * size) + "px";
    d.style.setProperty("--rot", (Math.random() - 0.5) * 22 + "deg");
    document.body.appendChild(d);
    setTimeout(() => d.remove(), 1500);
  };

  // ---------- лицо из фото -> пиксели ----------
  P.makeFace = (img, size = 20) => {
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const x = c.getContext("2d");
    if (!img) { x.fillStyle = "#f1c27d"; x.fillRect(0, 0, size, size); return c; }
    const mid = document.createElement("canvas");
    mid.width = mid.height = size * 4;
    const m = mid.getContext("2d");
    m.imageSmoothingQuality = "high";
    m.drawImage(img, 0, 0, size * 4, size * 4);
    x.imageSmoothingQuality = "high";
    x.drawImage(mid, 0, 0, size, size);
    try {
      const d = x.getImageData(0, 0, size, size);
      for (let i = 0; i < d.data.length; i += 4)
        for (let k = 0; k < 3; k++) d.data[i + k] = Math.min(255, Math.round((d.data[i + k] * 1.08) / 28) * 28 + 6);
      x.putImageData(d, 0, 0);
    } catch (e) { /* file:// — без постеризации */ }
    return c;
  };

  // ---------- пиксельные иконки ----------
  const EMO = {
    heart: { c: "#ff3b5c", b: [".##.##.", "#######", "#######", ".#####.", "..###..", "...#...", "......."] },
    excl: { c: "#ff8800", b: ["...#...", "...#...", "...#...", "...#...", ".......", "...#...", "......."] },
    question: { c: "#3a86ff", b: ["..###..", ".#...#.", "....#..", "...#...", "...#...", ".......", "...#..."] },
    anger: { c: "#e63946", b: ["#.#.#.#", ".#...#.", "#.....#", ".......", "#.....#", ".#...#.", "#.#.#.#"] },
    zz: { c: "#5a5aa0", b: ["####...", "..#....", ".#.....", "####...", "....###", ".....#.", "....###"] },
    note: { c: "#9b30d0", b: ["...####", "...#..#", "...#..#", "...#..#", ".###.##", "####.##", ".##...."] },
    sweat: { c: "#2ba8e0", b: ["...#...", "..###..", ".#####.", ".#####.", "..###..", ".......", "......."] },
    star: { c: "#ffb703", b: ["...#...", "..###..", "#######", ".#####.", "..###..", ".##.##.", "##...##"] },
  };
  const HEART5 = [".#.#.", "#####", "#####", ".###.", "..#.."];
  const HEART3 = ["##.##", "#####", ".###.", "..#.."];
  const STAR3 = [".#.", "###", ".#."];

  // ---------- персонаж ----------
  function Char(face, look) {
    Object.assign(this, { face, look, x: -30, tx: -30, speed: 40, jy: 0, vy: 0, walkT: 0, walking: false, dir: 1, emote: null, emoteT: 0, sit: false, lift: 0, dance: 0, item: null, stain: false, hugDir: 0, hand: false, toast: false, toastHead: false, dizzy: 0, heartEyes: 0, lean: 0, lying: 0, slideV: 0, shakeT: 0, fly: 0, dustT: 0, wasRun: false });
  }
  Char.prototype.running = function () { return this.walking && this.speed >= 70; };
  Char.prototype.headY = function () {
    const top = groundAt(this.x) + this.lift + this.jy - (this.sit ? 4 : 8);
    return top - 12 - this.face.width - 3;
  };
  Char.prototype.update = function (dt) {
    const d = this.tx - this.x;
    this.walking = Math.abs(d) > 0.6 && !this.sit && !this.lying;
    const run = this.speed >= 70;
    if (this.walking) {
      this.dir = Math.sign(d);
      this.x += this.dir * Math.min(Math.abs(d), this.speed * dt);
      this.walkT += dt;
      if (run) {
        this.dustT -= dt;
        if (this.dustT <= 0) { this.dustT = 0.05; dust(this.x - this.dir * 6, groundAt(this.x) + this.lift); }
        if (Math.random() < dt * 7) part(this.x + (Math.random() - 0.5) * 12, this.headY() + 2, -this.dir * 25 * Math.random(), -35, "#7fd3ff", 0.6, 170, 1, 2);
      }
      this.wasRun = run;
    } else if (this.wasRun) { // торможение с заносом
      this.wasRun = false;
      for (let i = 0; i < 9; i++) dust(this.x - this.dir * (2 + i * 1.5), groundAt(this.x) + this.lift);
    }
    if (this.lying && this.slideV) {
      this.x += this.slideV * dt;
      this.slideV *= Math.pow(0.25, dt);
      if (Math.abs(this.slideV) < 3) this.slideV = 0;
      if (Math.random() < 0.6) part(this.x, groundAt(this.x) - 1, (Math.random() - 0.5) * 20, -Math.random() * 25, "#fff", 0.5, 80);
      this.tx = this.x;
    }
    if (this.dance > 0) { this.dance -= dt; if (this.jy === 0 && this.vy === 0) this.vy = -55; }
    if (this.fly > 0) {
      this.fly -= dt; this.vy = 0;
      this.jy = Math.max(-28, this.jy - 45 * dt);
      this.x -= 10 * dt; this.tx = this.x;
      if (this.fly <= 0) this.vy = 1;
    } else if (this.vy !== 0 || this.jy < 0) {
      this.vy += 260 * dt; this.jy += this.vy * dt;
      if (this.jy >= 0) { if (this.vy > 120) { dust(this.x - 4, groundAt(this.x)); dust(this.x + 4, groundAt(this.x)); shake = Math.max(shake, 3); } this.jy = 0; this.vy = 0; }
    }
    if (this.emoteT > 0) { this.emoteT -= dt; if (this.emoteT <= 0) this.emote = null; }
    if (this.dizzy > 0) this.dizzy -= dt;
    if (this.heartEyes > 0) this.heartEyes -= dt;
    if (this.shakeT > 0) this.shakeT -= dt;
  };
  Char.prototype.jump = function (v = 70) { if (this.jy === 0) this.vy = -v; };
  Char.prototype.say = function (e, dur = 2.4) { this.emote = e; this.emoteT = dur; };
  Char.prototype.arrived = function () { return Math.abs(this.tx - this.x) < 0.8; };
  Char.prototype.draw = function () {
    const L = this.look, skin = L.skin || "#f1c27d", shirt = L.shirt || "#3a86ff", pants = L.pants || "#2d2d44", dark = "#1a1020";
    const F = this.face.width;
    const x = Math.round(this.x + (this.shakeT > 0 ? (Math.random() < 0.5 ? -1 : 1) : 0));
    const gy = groundAt(this.x) + this.lift, y = Math.round(gy + this.jy);
    const running = this.running();
    const f = this.walking ? Math.floor(this.walkT * (running ? 14 : 8)) % (running ? 4 : 2) : 0;
    R(x - 7, Math.round(gy), 15, 1, "rgba(0,0,0,0.25)");
    g.save();
    if (this.lying) { g.translate(x, y); g.rotate((this.lying * Math.PI) / 2); g.translate(-x, -y); }
    let top;
    if (this.sit) {
      R(x - 4, y - 4, 13, 4, pants); R(x + 8, y - 4, 2, 4, dark);
      top = y - 4;
    } else {
      let l1 = 0, l2 = 0, up1 = 0, up2 = 0;
      if (running) { const o = [[-3, 3], [0, 0], [3, -3], [0, 0]][f]; l1 = o[0] * this.dir; l2 = o[1] * this.dir; up1 = f === 0 ? 2 : 0; up2 = f === 2 ? 2 : 0; }
      else if (this.walking) { l1 = f ? 1 : -1; l2 = -l1; }
      R(x - 4 + l1, y - 8 - up1, 3, 8, pants); R(x + 1 + l2, y - 8 - up2, 3, 8, pants);
      R(x - 5 + l1, y - 1 - up1, 4, 1, dark); R(x + 1 + l2, y - 1 - up2, 4, 1, dark);
      top = y - 8;
    }
    const bob = this.walking ? (running ? f % 2 : f) : 0;
    const bx = x + (running ? this.dir * 2 : 0), by = top - 12 - bob;
    if (L.dress) { R(bx - 6, by, 12, 8, shirt); R(bx - 7, by + 8, 14, 2, shirt); R(bx - 8, by + 10, 16, 3, shirt); }
    else R(bx - 6, by, 12, 12, shirt);
    R(bx - 6, by, 12, 1, "rgba(255,255,255,0.3)");
    R(bx - 6, by + 11, 12, 1, "rgba(0,0,0,0.2)");
    if (this.stain) { R(bx - 3, by + 3, 3, 3, "#7a4a24"); R(bx + 1, by + 6, 3, 2, "#7a4a24"); R(bx - 1, by + 8, 1, 1, "#7a4a24"); }
    const sw = this.walking ? (f % 2 ? 1 : -1) : 0;
    const armsUp = (this.dance > 0 && Math.floor(t * 6) % 2) || this.fly > 0;
    if (running) { // руки мельтешат
      const u = f % 2 === 0;
      R(bx - 9, u ? by - 5 : by + 2, 3, 8, shirt); R(bx + 6, u ? by + 2 : by - 5, 3, 8, shirt);
      R(bx - 9, u ? by - 6 : by + 10, 3, 1, skin); R(bx + 6, u ? by + 10 : by - 6, 3, 1, skin);
    } else if (armsUp) {
      R(bx - 9, by - 7, 3, 8, shirt); R(bx + 6, by - 7, 3, 8, shirt);
      R(bx - 9, by - 8, 3, 1, skin); R(bx + 6, by - 8, 3, 1, skin);
    } else if (this.hugDir) {
      const ax = this.hugDir > 0 ? bx + 6 : bx - 14;
      R(ax, by + 3, 8, 3, shirt); R(this.hugDir > 0 ? ax + 8 : ax - 1, by + 3, 1, 3, skin);
      R(this.hugDir > 0 ? bx - 9 : bx + 6, by + 1, 3, 9, shirt);
    } else {
      R(bx - 9, by + 1 + sw, 3, 9, shirt); R(bx + 6, by + 1 - sw, 3, 9, shirt);
      R(bx - 9, by + 10 + sw, 3, 2, skin); R(bx + 6, by + 10 - sw, 3, 2, skin);
    }
    const ix = bx + 9;
    if (this.item === "icecream") { const iy = by + 2 - sw; R(ix, iy + 4, 3, 6, "#d9a05b"); disc(ix + 1, iy + 2, 3, "#ffb3c7"); R(ix, iy - 1, 1, 1, "#ff3b5c"); }
    if (this.item === "coffee") { const iy = by + 5 - sw; R(ix, iy, 4, 6, "#fff"); R(ix, iy + 2, 4, 1, "#7a4a24"); R(ix + 4, iy + 2, 1, 2, "#fff"); }
    if (this.item === "flowers") { const fx0 = bx - 15, fy = by; R(fx0 + 3, fy + 4, 1, 8, "#2d6a4f"); R(fx0 + 6, fy + 4, 1, 8, "#2d6a4f"); R(fx0 + 4, fy + 9, 3, 2, "#ff8fab"); disc(fx0 + 2, fy + 3, 2, "#ff4d6d"); disc(fx0 + 7, fy + 2, 2, "#ff4d6d"); disc(fx0 + 5, fy, 2, "#c9184a"); R(fx0 + 4, fy - 1, 1, 1, "#fff"); }
    R(bx - 2, by - 1, 4, 1, skin);
    const hx = bx + this.lean, hy = by - F - 3;
    R(hx - F / 2 - 1, hy, F + 2, F + 2, dark);
    g.drawImage(this.face, hx - F / 2, hy + 1, F, F);
    const blush = this.heartEyes > 0 || this.emote === "heart";
    if (blush) { R(hx - F / 2 + 2, hy + F - 5, 3, 1, "rgba(255,80,110,0.85)"); R(hx + F / 2 - 5, hy + F - 5, 3, 1, "rgba(255,80,110,0.85)"); }
    if (this.heartEyes > 0) { const ey = hy + 1 + Math.round(F * 0.32) - (Math.floor(t * 5) % 2); bmp(HEART3, hx - F / 2 + Math.round(F * 0.14), ey, "#ff1f5a"); bmp(HEART3, hx + Math.round(F * 0.1), ey, "#ff1f5a"); }
    if (this.toast) { const tx0 = hx + this.dir * 4 - 4, ty0 = hy + F - 6; R(tx0, ty0, 9, 7, "#b5651d"); R(tx0 + 1, ty0 + 1, 7, 5, "#f4d58d"); R(tx0 + 3, ty0 + 2, 2, 1, "#e9c46a"); }
    if (this.toastHead) { R(hx - 5, hy - 5, 10, 6, "#b5651d"); R(hx - 4, hy - 4, 8, 4, "#f4d58d"); }
    if (this.dizzy > 0) for (let k = 0; k < 3; k++) { const a = t * 7 + k * 2.09; bmp(STAR3, hx + Math.cos(a) * 10 - 1, hy - 4 + Math.sin(a) * 2, "#ffd166"); }
    if (this.emote) {
      const e = EMO[this.emote];
      const ex = hx - 5, ey = hy - 13 - (this.toastHead ? 5 : 0) - Math.round(Math.abs(Math.sin(t * 5)));
      R(ex - 1, ey - 1, 13, 11, dark); R(ex, ey, 11, 9, "#fff");
      R(ex + 4, ey + 9, 3, 1, "#fff"); R(ex + 5, ey + 10, 1, 1, "#fff");
      bmp(e.b, ex + 2, ey + 1, e.c);
    }
    g.restore();
  };

  P.setChars = (faceA, lookA, faceB, lookB) => {
    chars.a = new Char(faceA, lookA);
    chars.b = new Char(faceB, lookB);
  };

  // ---------- эффекты ----------
  function part(x, y, vx, vy, c, life, grav = 0, size = 1, hgt = 0) {
    fx.push({
      life, update(dt) { vy += grav * dt; x += vx * dt; y += vy * dt; this.life -= dt; return this.life > 0; },
      draw() { g.globalAlpha = Math.min(1, this.life * 2); R(x, y, size, hgt || size, c); g.globalAlpha = 1; },
    });
  }
  function dust(x, y) {
    let r = 1, age = 0; const vx = (Math.random() - 0.5) * 10;
    fx.push({ update(dt) { age += dt; r = 1 + age * 6; x += vx * dt; y -= 6 * dt; return age < 0.45; }, draw() { g.globalAlpha = 0.6 * (1 - age / 0.45); disc(x, y - 1, Math.round(r), "#e9e2d0"); g.globalAlpha = 1; } });
  }
  function burst(x, y, colors, n = 24, speed = 50, grav = 40, life = 1.2) {
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2, s = speed * (0.6 + Math.random() * 0.5);
      part(x, y, Math.cos(a) * s, Math.sin(a) * s, pick(colors), life * (0.7 + Math.random() * 0.5), grav);
    }
  }
  function burstHeart(x, y, c = "#ff4d6d", s = 2.4) {
    for (let k = 0; k < 40; k++) {
      const a = (k / 40) * Math.PI * 2;
      const hx = 16 * Math.pow(Math.sin(a), 3), hy = -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a));
      part(x, y, hx * s, hy * s, k % 4 ? c : "#fff", 1.5, 8);
    }
  }
  function sparkle(x, y) {
    let age = 0;
    fx.push({ update(dt) { age += dt; return age < 0.7; }, draw() { const big = age < 0.35; R(x - (big ? 2 : 1), y, big ? 5 : 3, 1, "#fff"); R(x, y - (big ? 2 : 1), 1, big ? 5 : 3, "#fff"); R(x, y, 1, 1, "#ffd1e8"); } });
  }
  function heartsRise(x, y, n = 6) {
    for (let i = 0; i < n; i++) {
      let hx = x + (Math.random() - 0.5) * 22, hy = y, life = 2.4 + Math.random(), vy = -12 - Math.random() * 10, ph = Math.random() * 6;
      let age = -i * 0.18;
      const c = pick(["#ff4d6d", "#ff8fab", "#c9184a"]);
      fx.push({ update(dt) { age += dt; if (age < 0) return true; hy += vy * dt; hx += Math.sin(age * 3 + ph) * 0.3; return age < life; }, draw() { if (age < 0) return; g.globalAlpha = Math.max(0, 1 - age / life); bmp(HEART5, hx, hy, c); g.globalAlpha = 1; } });
    }
  }
  function notes(x, y, n = 4) {
    for (let i = 0; i < n; i++) {
      let nx = x + (Math.random() - 0.5) * 24, ny = y, age = -i * 0.35; const c = pick(["#9b30d0", "#3a86ff", "#ff4d6d"]);
      fx.push({ update(dt) { age += dt; if (age > 0) { ny -= 14 * dt; nx += Math.sin(age * 4) * 0.4; } return age < 2; }, draw() { if (age < 0) return; g.globalAlpha = Math.max(0, 1 - age / 2); bmp(["..##", "..#.", "..#.", "###.", "##.."], nx, ny, c); g.globalAlpha = 1; } });
    }
  }
  function petal() {
    let x = Math.random() * (LW + 20) - 10, y = -3, vx = 3 + Math.random() * 6, vy = 7 + Math.random() * 7, ph = Math.random() * 6;
    const c = pick(["#ffb3c6", "#ff8fab", "#ffc8dd", "#fff0f5"]);
    fx.push({ update(dt) { ph += dt * 2.5; x += (vx + Math.sin(ph) * 8) * dt; y += vy * dt; return y < LH + 4; }, draw() { const flip = Math.sin(ph * 2) > 0; R(x, y, flip ? 2 : 1, flip ? 1 : 2, c); } });
  }
  function boom() {
    try { const a = Gift.audio(); const o = a.createOscillator(), gg = a.createGain(); o.type = "triangle"; o.frequency.setValueAtTime(90, a.currentTime); o.frequency.exponentialRampToValueAtTime(40, a.currentTime + 0.4); gg.gain.setValueAtTime(0.12, a.currentTime); gg.gain.exponentialRampToValueAtTime(0.0001, a.currentTime + 0.5); o.connect(gg).connect(a.destination); o.start(); o.stop(a.currentTime + 0.55); } catch (e) { /* без звука */ }
  }
  function rocket(x, heart = Math.random() < 0.5) {
    let y = GY, vy = -110 - Math.random() * 40;
    const top = LH * (0.1 + Math.random() * 0.25);
    const colors = pick([["#ff4d6d", "#ffd166"], ["#06d6a0", "#bdfcff"], ["#c77dff", "#ff9ef0"], ["#ffd166", "#fff"]]);
    fx.push({
      update(dt) { y += vy * dt; if (Math.random() < 0.6) part(x, y + 2, (Math.random() - 0.5) * 6, 10, "#ffcc66", 0.4); if (y <= top) { if (heart) burstHeart(x, y, pick(["#ff4d6d", "#ff8fab", "#ffd166"]), 1.6); else burst(x, y, colors, 30, 45, 25, 1.6); flash = Math.max(flash, 0.12); flashColor = "#fff"; boom(); return false; } return true; },
      draw() { R(x, y, 1, 2, "#fff"); },
    });
  }
  function heartbeat(times = 3) { for (let k = 0; k < times; k++) later(k * 0.75, () => { sfx("heartbeat"); P.romancePulse = 1; }); }

  // момент «время остановилось»: слоу-мо, розовая рамка, стук сердца, музыка громче
  function loveMoment(dur = 3) {
    romanceT = Math.max(romanceT, dur);
    slowT = dur * 0.6;
    heartbeat(Math.ceil(dur / 0.9));
    try { const prev = Gift.music.swell; Gift.music.swell = Math.max(prev, 0.75); later(dur, () => (Gift.music.swell = prev)); } catch (e) { /* без музыки */ }
    const M = (chars.a.x + chars.b.x) / 2;
    for (let i = 0; i < 14; i++) later(i * 0.18, () => sparkle(M + (Math.random() - 0.5) * 60, chars.a.headY() - 10 + (Math.random() - 0.5) * 40));
    heartsRise(M, chars.a.headY() - 6, 10);
  }

  function bird({ from, to, after, carry, onReach, speed = 2.2 }) {
    let x = from[0], y = from[1], k = 0, phase = 0, holding = carry || null;
    fx.push({
      update(dt) {
        k += dt;
        const tgt = phase === 0 ? (typeof to === "function" ? to() : to) : after;
        x += (tgt[0] - x) * Math.min(1, dt * speed); y += (tgt[1] - y) * Math.min(1, dt * speed);
        if (phase === 0 && Math.hypot(tgt[0] - x, tgt[1] - y) < 2.5) { phase = 1; if (onReach) holding = onReach() || holding; }
        return !(phase === 1 && Math.hypot(after[0] - x, after[1] - y) < 3);
      },
      draw() {
        const up = Math.floor(k * 10) % 2;
        bmp(up ? ["#...#", ".#.#.", "..#.."] : [".....", "#####", "..#.."], x - 2, y - 1, "#f8f9fa");
        R(x - 2, y + (up ? 0 : 1), 1, 1, "#343a40"); R(x + 2, y + (up ? 0 : 1), 1, 1, "#343a40"); R(x + 3, y + 1, 1, 1, "#ffb703");
        if (holding === "icecream") { R(x - 1, y + 3, 2, 3, "#d9a05b"); disc(x, y + 2, 1, "#ffb3c7"); }
      },
    });
  }
  function birdsChase(ch, n, dur) {
    for (let i = 0; i < n; i++) {
      let x = LW + 10 + i * 8, y = ch.headY() - 8 - i * 4, age = 0, k = Math.random();
      fx.push({ update(dt) { age += dt; k += dt; const tx = age < dur ? ch.x + 10 + i * 7 : -30, ty = age < dur ? ch.headY() - 6 - i * 5 + Math.sin(k * 6) * 3 : -20; x += (tx - x) * Math.min(1, dt * 3); y += (ty - y) * Math.min(1, dt * 3); return age < dur + 2.5; },
        draw() { const up = Math.floor(k * 12) % 2; bmp(up ? ["#...#", ".#.#.", "..#.."] : [".....", "#####", "..#.."], x - 2, y - 1, "#f8f9fa"); R(x - 3, y + 1, 1, 1, "#ffb703"); } });
    }
  }
  function cat(dir = 1) {
    let x = dir > 0 ? -12 : LW + 12, k = 0;
    fx.push({ update(dt) { k += dt; x += dir * 70 * dt; return dir > 0 ? x < LW + 14 : x > -14; }, draw() { drawCat(x, groundAt(x) - 1, dir, Math.floor(k * 12) % 2, false); } });
  }
  function drawCat(x, y, dir, f, sitting) {
    const c = "#f08c3a", d = "#a85a1c";
    if (sitting) {
      R(x - 3, y - 6, 7, 6, c); R(x - 2, y - 10, 6, 5, c); R(x - 2, y - 11, 1, 1, c); R(x + 3, y - 11, 1, 1, c);
      R(x - 1, y - 8, 1, 1, "#000"); R(x + 2, y - 8, 1, 1, "#000"); R(x - 5, y - 2 + Math.round(Math.sin(t * 3)), 3, 1, c);
      return;
    }
    R(x - 4, y - 5, 9, 4, c); R(x + 4 * dir, y - 8, 4, 4, c); R(x + 4 * dir, y - 9, 1, 1, c); R(x + 7 * dir, y - 9, 1, 1, c);
    R(x + 6 * dir, y - 7, 1, 1, "#000");
    R(x - 6 * dir, y - 8 + f, 1, 4, c); R(x - 2, y - 4, 1, 1, d); R(x + 1, y - 4, 1, 1, d);
    R(x - 3 + f, y - 1, 1, 1, d); R(x + 2 - f, y - 1, 1, 1, d);
  }
  function catSeat(targetX, seatY, onLand) { // кот запрыгивает на место раньше Димы
    let x = -12, y = groundAt(0) - 1, k = 0, state = "run", vy = 0;
    P.catOnSofa = null;
    fx.push({
      update(dt) {
        k += dt;
        if (P.catLap) { P.catOnSofa = null; return false; }
        if (state === "run") { x += 85 * dt; if (x >= targetX - 6) { state = "jump"; vy = -70; } }
        else if (state === "jump") { x += 25 * dt; vy += 260 * dt; y += vy * dt; if (vy > 0 && y >= seatY) { y = seatY; state = "sit"; onLand && onLand(); } }
        P.catOnSofa = state === "sit" ? { x, y } : null;
        return state !== "gone";
      },
      draw() { drawCat(x, y, 1, Math.floor(k * 12) % 2, state === "sit"); },
    });
  }
  function stormCloud(ch, dur) {
    let age = 0;
    fx.push({
      update(dt) { age += dt; if (Math.random() < 0.5) part(ch.x - 5 + Math.random() * 11, ch.headY() - 12, 0, 40, "#7fb2ff", 0.3, 0, 1, 2); return age < dur; },
      draw() { const x = ch.x, y = ch.headY() - 16; disc(x - 4, y, 4, "#495057"); disc(x + 4, y, 4, "#495057"); disc(x, y - 3, 4, "#5c636a"); if (Math.sin(t * 9) > 0.92) R(x, y + 3, 1, 4, "#fff3b0"); },
    });
  }
  function umbrella(ch, flyDelay = 1.6, flyDur = 1.8) {
    let age = 0, ox = 0, oy = 0;
    fx.push({
      update(dt) { age += dt; if (age > flyDelay + flyDur) { ox -= 50 * dt; oy -= 40 * dt; } return age < flyDelay + flyDur + 3; },
      draw() {
        const attached = age <= flyDelay + flyDur;
        const cx = (attached ? ch.x + 2 : ch.x + 2) + ox, cy = (attached ? ch.headY() - 10 : ch.headY() - 10) + oy;
        const flipped = age > flyDelay;
        if (!flipped) for (let r = 0; r < 6; r++) R(cx - 13 + r, cy + r - 5, 26 - r * 2, 1, r % 2 ? "#3a86ff" : "#ff4d6d");
        else for (let r = 0; r < 6; r++) R(cx - 7 - r * 1.2, cy - r - 4, 14 + r * 2.4, 1, r % 2 ? "#3a86ff" : "#ff4d6d");
        R(cx, cy - (flipped ? 4 : 0), 1, 13, "#343a40");
      },
    });
  }
  function toastFly(ch) {
    let x = ch.x, y = ch.headY() + 14, age = 0;
    const T = 1.1;
    fx.push({
      update(dt) { age += dt; if (age >= T) { ch.toastHead = true; return false; } return true; },
      draw() { const k = age / T, tx = ch.x, ty = ch.headY() - 3; const px = x + (tx - x) * k, py = y + (ty - y) * k - Math.sin(k * Math.PI) * 30; R(px - 4, py, 9, 6, "#b5651d"); R(px - 3, py + 1, 7, 4, "#f4d58d"); },
    });
  }
  function pelmeni(n = 5) {
    for (let i = 0; i < n; i++) {
      let x = LW - 26, y = GY - 36, vx = -(30 + Math.random() * 45), vy = -60 - Math.random() * 30, age = -i * 0.25;
      fx.push({
        update(dt) { age += dt; if (age < 0) return true; vy += 200 * dt; x += vx * dt; y += vy * dt; if (y > GY - 2) { y = GY - 2; vy = -Math.abs(vy) * 0.55; vx *= 0.9; } if (x < 2) { x = 2; vx = Math.abs(vx); } return age < 6; },
        draw() { if (age < 0) return; R(x - 2, y - 2, 5, 3, "#fff8e7"); R(x - 1, y - 3, 3, 1, "#fff8e7"); R(x, y - 1, 1, 1, "#e9c46a"); },
      });
    }
  }
  function snowball(from, to, onHit) {
    let age = 0; const T = 0.7;
    const x0 = from.x + 8 * Math.sign(to.x - from.x), y0 = from.headY() + 14;
    fx.push({
      update(dt) { age += dt; if (age >= T) { burst(to.x, to.headY() + 8, ["#fff", "#e8f0ff"], 14, 30, 60, 0.6); onHit && onHit(); return false; } return true; },
      draw() { const k = age / T, x1 = to.x, y1 = to.headY() + 8; disc(x0 + (x1 - x0) * k, y0 + (y1 - y0) * k - Math.sin(k * Math.PI) * 18, 2, "#fff"); },
    });
  }
  function heartSky() {
    const pts = [];
    for (let k = 0; k < 70; k++) {
      const a = (k / 70) * Math.PI * 2;
      pts.push([16 * Math.pow(Math.sin(a), 3), -(13 * Math.cos(a) - 5 * Math.cos(2 * a) - 2 * Math.cos(3 * a) - Math.cos(4 * a))]);
    }
    const s = Math.min(LW, LH) / 70, cx = LW / 2, cy = LH * 0.33;
    let age = 0;
    const dots = pts.map(([x, y], i) => ({ x0: cx + (Math.random() - 0.5) * 30, y0: GY - 20, x: cx + x * s * 1.3, y: cy + y * s * 1.3, d: i * 0.025 }));
    fx.push({
      update(dt) { age += dt; return true; },
      draw() {
        for (const p of dots) {
          const k = Math.max(0, Math.min(1, (age - p.d) / 1.6)), e = 1 - Math.pow(1 - k, 3);
          const x = p.x0 + (p.x - p.x0) * e, y = p.y0 + (p.y - p.y0) * e;
          R(x, y, 1, 1, Math.sin(t * 4 + p.d * 40) > -0.3 ? "#ff8fab" : "#ffd1dc");
          if (k >= 1 && Math.sin(t * 2 + p.d * 30) > 0.9) { R(x - 1, y, 3, 1, "#fff"); R(x, y - 1, 1, 3, "#fff"); }
        }
      },
    });
  }
  function lightning() {
    flash = 0.9; flashColor = "#fff";
    let x = LW * (0.2 + Math.random() * 0.6), y = 0;
    const pts = [];
    while (y < GY - 30) { pts.push([x, y]); x += (Math.random() - 0.5) * 10; y += 5 + Math.random() * 5; }
    let age = 0;
    fx.push({ update(dt) { age += dt; return age < 0.35; }, draw() { for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0)); for (let k = 0; k <= n; k++) R(x0 + ((x1 - x0) * k) / n, y0 + ((y1 - y0) * k) / n, 1, 1, "#fffbe0"); } } });
    try { const a = Gift.audio(); const len = a.sampleRate * 1.2, b = a.createBuffer(1, len, a.sampleRate), d = b.getChannelData(0); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3); const s = a.createBufferSource(), f = a.createBiquadFilter(), gg = a.createGain(); f.type = "lowpass"; f.frequency.value = 500; gg.gain.value = 0.35; s.buffer = b; s.connect(f).connect(gg).connect(a.destination); s.start(); } catch (e) { /* без звука */ }
  }
  P.sfxWind = () => { try { const a = Gift.audio(); const len = a.sampleRate * 0.8, b = a.createBuffer(1, len, a.sampleRate), d = b.getChannelData(0); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.sin((i / len) * Math.PI); const s = a.createBufferSource(), f = a.createBiquadFilter(), gg = a.createGain(); f.type = "bandpass"; f.frequency.value = 900; gg.gain.value = 0.25; s.buffer = b; s.connect(f).connect(gg).connect(a.destination); s.start(); } catch (e) { /* без звука */ } };

  // ---------- сцены ----------
  let groundAt = () => GY;
  const SCENES = {};

  SCENES.park = {
    draw(r) {
      bands(["#7ec8f0", "#a9d9ef", "#ffe1b0", "#ffc996"], 0, GY);
      disc(LW * 0.82, LH * 0.14, 9, "#fff6c2"); disc(LW * 0.82, LH * 0.14, 7, "#ffe066");
      for (let i = 0; i < 3; i++) { const cx = ((i * 60 + t * 3) % (LW + 40)) - 20; disc(cx, LH * 0.1 + i * 9, 4, "#fff"); disc(cx + 5, LH * 0.1 + i * 9 + 1, 3, "#fff"); disc(cx - 5, LH * 0.1 + i * 9 + 1, 3, "#fff"); }
      for (let x = 0; x < LW; x++) { const h = Math.sin(x * 0.05) * 5 + Math.sin(x * 0.13) * 3; R(x, GY - 24 + h, 1, 24 - h, "#d9a46e"); }
      for (let x = 0; x < LW; x++) { const h = Math.sin(x * 0.08 + 2) * 3; R(x, GY - 13 + h, 1, 13 - h, "#bb8152"); }
      const cx = 3, cw = Math.min(48, LW * 0.34), ch = 42;
      R(cx, GY - ch, cw, ch, "#efdcbc"); R(cx, GY - ch, cw, 2, "#8a5a3a");
      for (let i = 0; i < cw; i += 4) { R(cx + i, GY - ch + 2, 2, 6, "#e63946"); R(cx + i + 2, GY - ch + 2, 2, 6, "#fff"); }
      R(cx + 3, GY - ch + 12, 15, 13, "#3a2a1a"); R(cx + 4, GY - ch + 13, 13, 11, "#9fd3ff"); R(cx + 5, GY - ch + 14, 5, 4, "#d8f0ff");
      R(cx + cw - 14, GY - 22, 10, 22, "#6b4226"); R(cx + cw - 6, GY - 12, 1, 2, "#ffd166");
      R(cx + cw / 2 - 5, GY - ch - 9, 11, 8, "#3a2a1a"); R(cx + cw / 2 - 3, GY - ch - 7, 5, 4, "#fff"); R(cx + cw / 2 + 2, GY - ch - 6, 1, 2, "#fff");
      if (Math.sin(t * 3) > 0) R(cx + cw / 2 - 2, GY - ch - 11, 1, 2, "#ddd");
      [[0.5, "#f4a261"], [0.68, "#e76f51"], [0.86, "#e9c46a"], [1.0, "#f4a261"]].forEach(([k, c]) => {
        const x = LW * k;
        R(x - 1, GY - 26, 3, 26, "#6b4226");
        disc(x, GY - 31, 9, c); disc(x - 6, GY - 27, 6, c); disc(x + 6, GY - 28, 6, c);
        for (let j = 0; j < 7; j++) R(x - 8 + r() * 16, GY - 38 + r() * 14, 1, 1, "#ffe8a3");
      });
      const bx = LW * 0.74;
      R(bx, GY - 11, 18, 2, "#8a5a3a"); R(bx, GY - 7, 18, 2, "#8a5a3a"); R(bx + 1, GY - 5, 1, 5, "#4a3020"); R(bx + 16, GY - 5, 1, 5, "#4a3020");
      R(0, GY, LW, LH - GY, "#7aa33a"); R(0, GY, LW, 2, "#93c24a"); R(0, GY + 5, LW, 9, "#d8b27a");
      for (let i = 0; i < 40; i++) R(r() * LW, GY + 1 + r() * (LH - GY - 2), 2, 1, ["#e76f51", "#f4a261", "#e9c46a"][i % 3]);
    },
    ambient(dt) { if (Math.random() < dt * 5) leaf(); },
    init() {
      let px = LW * 0.9, dir = -1, peck = 0;
      fx.push({ update(dt) { peck += dt; if (Math.sin(peck * 2) > 0.6) px += dir * 6 * dt; if (px < LW * 0.72 || px > LW * 0.97) dir *= -1; return true; },
        draw() { const y = GY + 4, bob = Math.sin(peck * 8) > 0.5 ? 1 : 0; R(px - 2, y - 3, 5, 3, "#8d99ae"); R(px + 2 * dir, y - 5 + bob, 2, 2, "#6c7a91"); R(px + 3 * dir, y - 4 + bob, 1, 1, "#ffb703"); R(px - 1, y, 1, 1, "#ff8800"); R(px + 1, y, 1, 1, "#ff8800"); } });
    },
  };

  SCENES.night = {
    draw(r) {
      bands(["#0b1033", "#141a4a", "#22205e", "#3b2a6e"], 0, GY);
      for (let i = 0; i < 45; i++) { const x = r() * LW, y = r() * GY * 0.55; R(x, y, 1, 1, Math.sin(t * 2 + i) > 0.2 ? "#fff" : "#7c84b8"); }
      disc(LW * 0.18, LH * 0.12, 7, "#f5f0d0"); disc(LW * 0.18 + 3, LH * 0.12 - 2, 6, "#0b1033");
      let x = 0;
      while (x < LW) {
        const w = 12 + Math.floor(r() * 14), h = 30 + Math.floor(r() * 45);
        R(x, GY - h, w, h, "#1c1f3a");
        for (let wy = GY - h + 3; wy < GY - 4; wy += 5)
          for (let wx = x + 2; wx < x + w - 2; wx += 4) {
            const lit = r() < 0.45 && Math.sin(t * 0.4 + wx * 7 + wy) < 0.97;
            R(wx, wy, 2, 2, lit ? (r() < 0.15 ? "#ff9ec4" : "#ffd88a") : "#2a2e52");
          }
        x += w + 1;
      }
      const lx = LW * 0.5;
      g.globalAlpha = 0.16 + Math.sin(t * 3) * 0.02;
      g.fillStyle = "#ffe8a0"; g.beginPath(); g.moveTo(lx, GY - 39); g.lineTo(lx - 28, GY); g.lineTo(lx + 30, GY); g.fill();
      g.globalAlpha = 1;
      R(lx, GY - 40, 2, 40, "#0a0d1c"); R(lx - 2, GY - 42, 6, 3, "#0a0d1c"); R(lx - 1, GY - 39, 4, 1, "#ffe8a0");
      R(lx + Math.cos(t * 5) * 5, GY - 38 + Math.sin(t * 7) * 3, 1, 1, "#fff"); R(lx + Math.cos(t * 4 + 2) * 4, GY - 37 + Math.sin(t * 6) * 3, 1, 1, "#ddd");
      const tx = LW * 0.84;
      R(tx - 6, GY - 9, 14, 2, "#5a3a28"); R(tx, GY - 7, 2, 7, "#3a2418"); R(tx - 1, GY - 13, 3, 4, "#fff"); R(tx - 1, GY - 15 - (Math.sin(t * 9) > 0 ? 1 : 0), 3, 2, "#ffb703");
      g.globalAlpha = 0.18; disc(tx, GY - 15, 5, "#ffd166"); g.globalAlpha = 1;
      R(tx + 3, GY - 13, 1, 3, "#2d6a4f"); disc(tx + 3, GY - 14, 1, "#ff4d6d");
      R(0, GY, LW, LH - GY, "#2a2d45"); R(0, GY, LW, 2, "#3a3e5c");
      for (let k = 0; k < LW; k += 10) R(k, GY + 2, 1, LH - GY, "#24273d");
    },
    ambient() {},
  };

  SCENES.sakura = {
    draw(r) {
      bands(["#2b1d4f", "#4f2668", "#86407f", "#c86a92", "#f2a7b4"], 0, GY);
      for (let i = 0; i < 25; i++) R(r() * LW, r() * GY * 0.3, 1, 1, Math.sin(t * 2 + i) > 0 ? "#fff" : "#b9a3e0");
      let x = 0;
      while (x < LW) { const w = 8 + Math.floor(r() * 10), h = 10 + Math.floor(r() * 18); R(x, GY - 14 - h, w, h + 14, "#5a2f6a"); for (let k = 0; k < 4; k++) if (r() < 0.7) R(x + 2 + r() * (w - 4), GY - 12 - r() * h, 1, 1, "#ffd6e8"); x += w + 1; }
      for (let xx = 0; xx < LW; xx++) { const yy = LH * 0.16 + Math.sin((xx / LW) * Math.PI) * 9; R(xx, yy, 1, 1, "#2b1d3a"); if (xx % 7 === 3) { const on = Math.sin(t * 2 + xx) > -0.5; R(xx - 1, yy + 1, 3, 3, on ? pick2(xx) : "#5a3a4a"); if (on) { g.globalAlpha = 0.2; disc(xx, yy + 2, 3, "#ffd6a0"); g.globalAlpha = 1; } } }
      const tx = LW * 0.26;
      R(tx - 2, GY - 40, 5, 40, "#5a3424"); R(tx + 2, GY - 30, 10, 2, "#5a3424"); R(tx - 10, GY - 34, 9, 2, "#5a3424"); R(tx + 10, GY - 36, 2, 7, "#5a3424");
      [[0, -50, 12], [-12, -44, 9], [12, -45, 10], [-20, -36, 7], [20, -36, 8], [0, -38, 9], [-6, -58, 8], [8, -57, 8]].forEach(([dx, dy, rr], i) => disc(tx + dx, GY + dy, rr, i % 2 ? "#ffb7c5" : "#ff8fab"));
      for (let k = 0; k < 40; k++) R(tx - 26 + r() * 52, GY - 64 + r() * 34, 1, 1, r() < 0.5 ? "#fff0f5" : "#ffd1dc");
      const t2 = LW * 0.9;
      R(t2 - 1, GY - 24, 3, 24, "#5a3424"); disc(t2, GY - 30, 9, "#ffb7c5"); disc(t2 - 7, GY - 25, 6, "#ff8fab"); disc(t2 + 7, GY - 26, 6, "#ffc8dd");
      const bx = LW * 0.6;
      R(bx, GY - 11, 20, 2, "#7a4a32"); R(bx, GY - 7, 20, 2, "#7a4a32"); R(bx + 1, GY - 5, 2, 5, "#4a2a1a"); R(bx + 17, GY - 5, 2, 5, "#4a2a1a");
      R(0, GY, LW, LH - GY, "#3f6b3a"); R(0, GY, LW, 2, "#5a8f4a");
      for (let i = 0; i < 70; i++) R(r() * LW, GY + 2 + r() * (LH - GY), 2, 1, r() < 0.5 ? "#ffb7c5" : "#ff8fab");
    },
    ambient(dt) { if (Math.random() < dt * 10) petal(); },
  };
  function pick2(i) { return ["#ffd166", "#ff8fab", "#fff3b0"][i % 3]; }

  SCENES.kitchen = {
    draw(r) {
      R(0, 0, LW, GY, "#f3e3c3");
      for (let y = GY - 32; y < GY; y += 5) R(0, y, LW, 1, "#e2cfa6");
      for (let y = GY - 32; y < GY; y += 5) for (let x = ((y / 5) % 2) * 3; x < LW; x += 6) R(x, y, 1, 5, "#e2cfa6");
      const wx = LW * 0.4, wy = LH * 0.1;
      R(wx, wy, 32, 24, "#7ec8f0"); R(wx, wy, 32, 1, "#fff"); R(wx + 15, wy, 2, 24, "#fff"); R(wx, wy + 11, 32, 2, "#fff");
      R(wx - 4, wy - 2, 5, 28, "#e76f51"); R(wx + 31, wy - 2, 5, 28, "#e76f51");
      R(4, GY - 56, 22, 56, "#e8eef2"); R(4, GY - 36, 22, 1, "#b0bcc4"); R(22, GY - 50, 2, 10, "#90a0aa"); R(22, GY - 30, 2, 10, "#90a0aa");
      bmp(HEART5, 8, GY - 50, "#e63946"); R(14, GY - 46, 3, 3, "#ffd166"); R(9, GY - 30, 4, 3, "#3a86ff");
      const sx = LW - 36;
      R(sx, GY - 22, 32, 22, "#d0d6da"); R(sx, GY - 24, 32, 2, "#6c757d"); R(sx + 5, GY - 16, 22, 10, "#343a40");
      R(sx + 6, GY - 15, 20, 1, Math.sin(t * 8) > 0 ? "#ff8800" : "#ffb703");
      R(sx + 8, GY - 34, 16, 10, "#adb5bd"); R(sx + 8, GY - 34, 16, 1, "#ced4da");
      const jig = Math.sin(t * (P.steamBoost > 0 ? 40 : 22)) > 0.5 ? -1 - (P.steamBoost > 0 ? 2 : 0) : 0;
      R(sx + 6, GY - 36 + jig, 20, 2, "#868e96"); R(sx + 14, GY - 38 + jig, 4, 2, "#495057");
      const tx = LW * 0.5;
      R(tx - 12, GY - 12, 24, 2, "#8a5a3a"); R(tx - 10, GY - 10, 2, 10, "#6b4226"); R(tx + 8, GY - 10, 2, 10, "#6b4226");
      R(tx - 7, GY - 14, 14, 2, "#fff");
      for (let k = 0; k < 5; k++) R(tx - 6 + k * 3, GY - 16, 2, 2, "#fff4dc");
      R(tx + 5, GY - 19, 2, 5, "#fff"); R(tx + 5, GY - 21 - (Math.sin(t * 9) > 0 ? 1 : 0), 2, 2, "#ffb703");
      for (let y = GY; y < LH; y += 6) for (let x = 0; x < LW; x += 6) R(x, y, 6, 6, ((x + y) / 6) % 2 ? "#c9a87c" : "#b08d5e");
    },
    ambient(dt) { if (Math.random() < dt * (P.steamBoost > 0 ? 25 : 6)) part(LW - 26 + Math.random() * 12, GY - 38, (Math.random() - 0.5) * 4, -14 - Math.random() * 8, "rgba(255,255,255,0.8)", 1.4, 0, 2); if (P.steamBoost > 0) P.steamBoost -= dt; },
  };

  SCENES.rain = {
    draw(r) {
      bands(["#252d3a", "#2f3949", "#3a4556", "#465264"], 0, GY);
      let x = 0;
      while (x < LW) { const w = 14 + Math.floor(r() * 12), h = 25 + Math.floor(r() * 40); R(x, GY - h, w, h, "#1a2029"); for (let wy = GY - h + 4; wy < GY - 4; wy += 6) for (let wx = x + 2; wx < x + w - 2; wx += 5) if (r() < 0.2) R(wx, wy, 2, 2, "#6c6a4a"); x += w + 1; }
      for (let i = 0; i < 6; i++) { const cx = ((i * 34 + t * 5) % (LW + 40)) - 20, cy = 6 + (i % 3) * 5; disc(cx, cy, 9, "#1c232e"); disc(cx + 9, cy + 2, 7, "#1c232e"); }
      R(0, GY, LW, LH - GY, "#232b36");
      for (let i = 0; i < 12; i++) { const px = r() * LW, py = GY + 4 + r() * (LH - GY - 8); R(px, py, 10 + r() * 10, 2, "#2f3b4b"); }
      for (let i = 0; i < 20; i++) R(r() * LW, GY + r() * (LH - GY), 3, 1, "#3d4d63");
    },
    ambient(dt) {
      for (let i = 0; i < 3; i++) part(Math.random() * (LW + 30), -4, -25, 220 + Math.random() * 60, "#9fb4d0", 1.2, 0, 1, 4);
      if (Math.random() < dt * 8) { const rx = Math.random() * LW, ry = GY + 3 + Math.random() * (LH - GY - 6); let age = 0; fx.push({ update(dt) { age += dt; return age < 0.6; }, draw() { const rr = Math.round(age * 8); g.globalAlpha = 1 - age / 0.6; R(rx - rr, ry, 1, 1, "#9fb4d0"); R(rx + rr, ry, 1, 1, "#9fb4d0"); R(rx, ry - 1, 1, 1, "#9fb4d0"); g.globalAlpha = 1; } }); }
      if (Math.random() < dt * 0.08) lightning();
    },
  };

  SCENES.beach = {
    ground: () => GY + 5,
    draw(r) {
      const sea = GY - 16;
      bands(["#2d1b4e", "#5a2a63", "#a63e6b", "#e8704d", "#ffb45e"], 0, sea);
      disc(LW * 0.5, sea, 13, "#fff1a8"); disc(LW * 0.5, sea, 11, "#ffd166");
      R(0, sea, LW, 16, "#2a4d7a");
      for (let k = 0; k < 7; k++) { const w = 18 - k * 2 + Math.sin(t * 3 + k) * 2; R(LW * 0.5 - w / 2, sea + 1 + k * 2, w, 1, "#ffcf70"); }
      for (let i = 0; i < 14; i++) { const x = ((i * 17 + t * (6 + (i % 3) * 3)) % (LW + 10)) - 5; R(x, sea + 2 + (i % 6) * 2, 4, 1, "#5a87b8"); }
      R(0, GY, LW, LH - GY, "#e9c98f");
      for (let x = 0; x < LW; x++) if (Math.sin(x * 0.3 + t * 2) > 0.2) R(x, GY, 1, 1, "#fff");
      R(0, GY - 1, LW, 1, "#d8f3ff");
      for (let i = 0; i < 40; i++) R(r() * LW, GY + 2 + r() * (LH - GY), 1, 1, "#d4b07a");
      const px = LW * 0.88;
      for (let k = 0; k < 34; k++) R(px - Math.sin((k / 34) * 1.2) * 8, GY - k, 3, 1, k % 4 ? "#8a5a3a" : "#6b4226");
      const tx = px - Math.sin(1.2) * 8 + 1, ty = GY - 34;
      for (let k = 0; k < 14; k++) { const sway = Math.sin(t * 2); R(tx + k, ty + k * 0.4 + sway, 2, 1, "#2d6a4f"); R(tx - k, ty + k * 0.45 + sway, 2, 1, "#2d6a4f"); R(tx + k * 0.6, ty - 3 + k * 0.6, 2, 1, "#40916c"); R(tx - k * 0.6, ty - 3 + k * 0.7, 2, 1, "#40916c"); }
      disc(tx, ty + 2, 1, "#6b4226"); disc(tx + 2, ty + 3, 1, "#6b4226");
      const ux = LW * 0.13;
      R(ux, GY - 26, 1, 26, "#555");
      for (let k = 0; k < 8; k++) for (let s = -12 + k; s <= 12 - k; s++) R(ux + s, GY - 34 + k, 1, 1, Math.floor((s + 12) / 4) % 2 ? "#fff" : "#e63946");
      R(ux - 10, GY + 3, 16, 3, "#3a86ff");
    },
    init() {
      for (let i = 0; i < 2; i++) { let bx = -10 - i * 40, k = 0; const by = LH * (0.12 + i * 0.07); fx.push({ update(dt) { k += dt; bx += 14 * dt; if (bx > LW + 10) bx = -10; return true; }, draw() { bmp(Math.floor(k * 4) % 2 ? ["#...#", ".#.#."] : ["#####"], bx, by + Math.sin(k) * 2, "#2d1b4e"); } }); }
    },
    ambient() {},
  };

  SCENES.winter = {
    draw(r) {
      bands(["#0f1a3a", "#18284f", "#22386a", "#2f4a80"], 0, GY);
      for (let i = 0; i < 35; i++) R(r() * LW, r() * GY * 0.5, 1, 1, Math.sin(t * 3 + i) > 0 ? "#fff" : "#9fb4ff");
      disc(LW * 0.85, LH * 0.1, 6, "#f5f0d0");
      for (let k = 0; k < 3; k++) {
        const hx = 4 + k * (LW * 0.3), hw = 22, hh = 22;
        R(hx, GY - hh, hw, hh, "#4a2f3d");
        for (let s = 0; s < 8; s++) R(hx - 2 + s, GY - hh - s, hw + 4 - s * 2, 1, "#f1f5ff");
        R(hx + 4, GY - 14, 5, 5, Math.sin(t + k) > -0.8 ? "#ffd88a" : "#a8885a"); R(hx + 13, GY - 14, 5, 5, "#ffd88a");
      }
      const tx = LW * 0.78;
      R(tx - 1, GY - 6, 3, 6, "#5a3a28");
      for (let L = 0; L < 4; L++) { const w = 16 - L * 3, y = GY - 8 - L * 9; for (let s = 0; s < 9; s++) R(tx - (w * s) / 9, y - s + 2, ((w * s) / 9) * 2 + 1, 1, "#1e6b45"); R(tx - w, y + 2, w * 2 + 1, 1, "#f1f5ff"); }
      const cols = ["#ff4d6d", "#ffd166", "#06d6a0", "#4cc9f0", "#c77dff"];
      for (let k = 0; k < 16; k++) { const lx = tx - 12 + r() * 24, ly = GY - 10 - r() * 32; if (Math.abs(lx - tx) < (GY - ly) * 0.38) R(lx, ly, 1, 1, Math.sin(t * 4 + k) > 0 ? cols[k % 5] : "#0d3b26"); }
      bmp(["..#..", ".###.", "#####", ".#.#."], tx - 2, GY - 48, Math.sin(t * 3) > 0 ? "#ffd166" : "#fff3b0");
      const sx = LW * 0.12;
      disc(sx, GY - 6, 6, "#fff"); disc(sx, GY - 16, 4, "#fff"); R(sx - 1, GY - 17, 1, 1, "#000"); R(sx + 1, GY - 17, 1, 1, "#000"); R(sx + 1, GY - 15, 3, 1, "#ff8800");
      R(sx - 3, GY - 21, 7, 1, "#222"); R(sx - 2, GY - 25, 5, 4, "#222"); R(sx - 8, GY - 11, 4, 1, "#6b4226"); R(sx + 5, GY - 12, 4, 1, "#6b4226");
      R(sx - 2, GY - 14, 4, 1, "#c00");
      for (let x = 0; x < LW; x++) { const y = 3 + Math.sin((x / LW) * Math.PI) * 6; R(x, y, 1, 1, "#333"); if (x % 6 === 0) R(x, y + 1, 1, 2, Math.sin(t * 3 + x) > 0 ? cols[(x / 6) % 5] : "#555"); }
      R(0, GY, LW, LH - GY, "#e8f0ff"); R(0, GY, LW, 1, "#fff");
      R(LW * 0.35, GY + 3, LW * 0.35, 3, "#cfe6ff"); R(LW * 0.35 + 3, GY + 3, 6, 1, "#fff");
      for (let i = 0; i < 25; i++) R(r() * LW, GY + 2 + r() * (LH - GY), 3, 1, "#c8d6f0");
    },
    ambient(dt) { if (Math.random() < dt * 14) part(Math.random() * LW, -2, (Math.random() - 0.5) * 8, 12 + Math.random() * 10, "#fff", 12, 0, Math.random() < 0.3 ? 2 : 1); },
  };

  SCENES.home = {
    draw(r) {
      R(0, 0, LW, GY, "#7a4b3a");
      for (let x = 0; x < LW; x += 8) R(x, 0, 3, GY, "#84523f");
      const wx = LW * 0.06, wy = LH * 0.1;
      R(wx - 2, wy - 2, 32, 28, "#3a2418"); R(wx, wy, 28, 24, "#101836");
      for (let i = 0; i < 8; i++) R(wx + r() * 26, wy + r() * 14, 1, 1, Math.sin(t * 2 + i) > 0 ? "#fff" : "#6a74b0");
      disc(wx + 20, wy + 6, 3, "#f5f0d0"); R(wx + 13, wy, 2, 24, "#3a2418");
      for (let xx = 0; xx < LW; xx++) { const yy = LH * 0.05 + Math.sin((xx / LW) * Math.PI) * 6; R(xx, yy, 1, 1, "#3a2418"); if (xx % 8 === 4) R(xx - 1, yy + 1, 2, 2, Math.sin(t * 2 + xx) > -0.3 ? "#ffd88a" : "#8a6a3a"); }
      const fx_ = LW * 0.62, fy = LH * 0.14;
      R(fx_, fy, 18, 14, "#c9a227"); R(fx_ + 2, fy + 2, 14, 10, "#f6e7d0"); bmp(HEART5, fx_ + 7, fy + 4, "#e63946");
      const lx = LW * 0.9;
      g.globalAlpha = 0.14; disc(lx, GY - 40, 26, "#ffd88a"); g.globalAlpha = 1;
      R(lx, GY - 40, 1, 40, "#2b1a12"); R(lx - 5, GY - 46, 11, 6, "#ffcf70"); R(lx - 4, GY - 41, 9, 1, "#fff3b0"); R(lx - 3, GY, 7, 1, "#2b1a12");
      const sx = LW * 0.22, sw = LW * 0.56;
      R(sx, GY - 20, sw, 7, "#9a2f3c"); R(sx, GY - 13, sw, 9, "#b23a48"); R(sx - 4, GY - 16, 5, 12, "#8a2834"); R(sx + sw - 1, GY - 16, 5, 12, "#8a2834");
      R(sx + 4, GY - 18, 10, 6, "#ffd166"); R(sx + sw - 14, GY - 18, 10, 6, "#06d6a0");
      R(sx + 2, GY - 4, 2, 4, "#2b1a12"); R(sx + sw - 4, GY - 4, 2, 4, "#2b1a12");
      const px = LW * 0.04;
      R(px, GY - 8, 8, 8, "#c2703d"); for (let k = 0; k < 6; k++) R(px + 3 + Math.sin(k) * 4, GY - 10 - k * 2, 3, 1, "#40916c");
      R(0, GY, LW, LH - GY, "#5a3a28"); for (let y = GY + 4; y < LH; y += 5) R(0, y, LW, 1, "#4a2f20");
      R(LW * 0.2, GY + 4, LW * 0.6, 6, "#d9a05b"); for (let x = LW * 0.2 + 2; x < LW * 0.8 - 2; x += 4) R(x, GY + 6, 2, 2, "#b5651d");
    },
    ambient() {},
  };

  SCENES.finale = {
    draw(r) {
      bands(["#020208", "#050a1c", "#0a1130", "#140f3c", "#1d1450"], 0, LH);
      for (let i = 0; i < 120; i++) { const x = r() * LW, y = r() * LH * 0.75; const b = Math.sin(t * (1 + (i % 5) * 0.4) + i); R(x, y, 1, 1, b > 0.6 ? "#fff" : b > -0.2 ? "#8b93c9" : "#2b3266"); }
      for (let i = 0; i < 60; i++) { const k = r(); R(k * LW, LH * 0.05 + k * LH * 0.4 + (r() - 0.5) * 14, 1, 1, "rgba(200,180,255,0.35)"); }
      const mx = LW * 0.82, my = LH * 0.08;
      g.globalAlpha = 0.08; disc(mx, my, 15, "#fdf6d8"); g.globalAlpha = 1;
      disc(mx, my, 9, "#fdf6d8"); disc(mx - 3, my - 2, 2, "#ece2b8"); disc(mx + 3, my + 3, 1, "#ece2b8");
      for (let x = 0; x < LW; x++) { const h = groundAt(x); R(x, h, 1, LH - h, "#0a0f22"); R(x, h, 1, 1, "#1a2245"); }
      for (let i = 0; i < 30; i++) { const fx0 = r() * LW, fy = groundAt(fx0) + 2 + r() * 6; R(fx0, fy, 1, 1, Math.sin(t + i) > 0 ? "#ff8fab" : "#c9184a"); }
      const tx = LW * 0.16, ty = groundAt(tx);
      R(tx - 1, ty - 20, 3, 20, "#0a0f22"); disc(tx, ty - 24, 9, "#0a0f22"); disc(tx - 6, ty - 20, 6, "#0a0f22"); disc(tx + 7, ty - 21, 6, "#0a0f22");
      R(tx + 4, ty - 18, 1, 12, "#1a2245"); R(tx + 9, ty - 18, 1, 12, "#1a2245"); R(tx + 3, ty - 6, 8, 1, "#3a2a1a");
    },
    ground: (x) => Math.round(GY - Math.cos(((x - LW / 2) / LW) * Math.PI) * 20 + 6),
    ambient(dt) {
      if (Math.random() < dt * 3) { let x = Math.random() * LW, y = LH * 0.4 + Math.random() * LH * 0.5, age = 0; const vx = (Math.random() - 0.5) * 8, ph = Math.random() * 6; fx.push({ update(dt) { age += dt; x += vx * dt; y -= 4 * dt; return age < 6; }, draw() { const a = Math.max(0, Math.sin(age * 1.6 + ph)) * Math.min(1, 6 - age); g.globalAlpha = a; R(x, y, 1, 1, "#fff2a8"); g.globalAlpha = a * 0.3; R(x - 1, y - 1, 3, 3, "#ffe066"); g.globalAlpha = 1; } }); }
      if (Math.random() < dt * 0.3) { let x = Math.random() * LW * 0.6, y = Math.random() * LH * 0.25, age = 0; fx.push({ update(dt) { age += dt; x += 90 * dt; y += 40 * dt; return age < 0.7; }, draw() { for (let k = 0; k < 8; k++) { g.globalAlpha = (1 - k / 8) * (1 - age / 0.7); R(x - k * 2, y - k, 1, 1, "#fff"); } g.globalAlpha = 1; } }); }
      if (P.fireworks && Math.random() < dt * 1.5) rocket(LW * (0.15 + Math.random() * 0.7));
      if (P.petals && Math.random() < dt * 9) petal();
    },
  };

  function leaf() {
    let x = Math.random() * LW, y = -2, ph = Math.random() * 6;
    const vx = 6 + Math.random() * 8, vy = 10 + Math.random() * 10, c = pick(["#e76f51", "#f4a261", "#e9c46a", "#d62828"]);
    fx.push({ update(dt) { ph += dt * 3; x += (vx + Math.sin(ph) * 10) * dt; y += vy * dt; return y < GY + 6; }, draw() { R(x, y, 2, 1, c); R(x + (Math.sin(ph) > 0 ? 1 : 0), y + 1, 1, 1, c); } });
  }

  P.setScene = (name) => {
    sceneName = name;
    scene = SCENES[name];
    groundAt = scene.ground || (() => GY);
    fx = [];
    timers = []; waiters = [];
    P.fireworks = false; P.steamBoost = 0; P.petals = name === "sakura"; P.blanket = false; P.catOnSofa = null; P.catLap = false;
    romanceT = 0; slowT = 0;
    for (const c of [chars.a, chars.b]) if (c) Object.assign(c, { item: null, stain: false, sit: false, lift: 0, hugDir: 0, hand: false, dance: 0, emote: null, speed: 40, x: -30, tx: -30, toast: false, toastHead: false, dizzy: 0, heartEyes: 0, lean: 0, lying: 0, slideV: 0, fly: 0, jy: 0, vy: 0, shakeT: 0 });
    if (chars.b) { chars.b.x = LW + 30; chars.b.tx = LW + 30; }
    scene.init && scene.init();
  };

  // ---------- действия на строках истории ----------
  P.act = (name) => {
    const A = chars.a, B = chars.b, M = LW / 2;
    const close = (gap = 12) => { A.tx = M - gap; B.tx = M + gap; };
    const both = () => A.arrived() && B.arrived();
    const head = (c) => c.headY() - 10;
    const kiss = () => {
      if (A.sit || B.sit) { A.x = A.tx = M - 11; B.x = B.tx = M + 11; }
      A.lean = 1; B.lean = -1;
      P.comic("ЧМОК!", M, head(A) - 8, "#ff4d8d", 1.5);
      burstHeart(M, head(A) - 6, "#ff4d6d", 2);
      heartsRise(M, head(A), 10);
      A.heartEyes = B.heartEyes = 3.5;
      loveMoment(3.2);
      later(3, () => { A.lean = B.lean = 0; });
    };
    switch (name) {
      case "enter": A.x = -16; B.x = LW + 16; A.tx = LW * 0.3; B.tx = LW * 0.7; break;

      // --- смешное ---
      case "lateRun":
        A.x = -16; A.toast = true; A.speed = 100; A.tx = LW * 0.8; A.say("sweat", 4); sfx("whoosh");
        later(0.3, () => P.comic("ААА!", LW * 0.25, head(A), "#ffd166"));
        when(() => A.arrived(), () => { A.say("question", 1.2); later(0.5, () => { A.tx = LW * 0.3; sfx("whoosh"); }); });
        break;
      case "rushB":
        B.x = LW + 16; B.item = "coffee"; B.speed = 85; B.tx = LW * 0.7; B.say("sweat", 3);
        later(0.4, () => P.comic("ОЙ-ОЙ!", LW * 0.75, head(B), "#7fd3ff", 0.9));
        break;
      case "rush": A.speed = B.speed = 85; A.tx = LW * 0.38; B.tx = LW * 0.62; A.say("sweat"); B.say("sweat"); break;
      case "bump":
        A.speed = B.speed = 110; close(11); sfx("whoosh");
        when(both, () => {
          shake = 9; sfx("bad"); flash = 0.25; flashColor = "#fff";
          P.comic("БАЦ!", M, head(A) - 4, "#fff", 1.8);
          burst(M, head(A) + 20, ["#7a4a24", "#a0663a", "#fff"], 34, 65, 160, 1);
          A.stain = true; B.item = null;
          if (A.toast) { A.toast = false; toastFly(A); }
          A.speed = B.speed = 70; A.tx = M - 26; B.tx = M + 26;
          later(0.35, () => { A.sit = B.sit = true; A.dizzy = B.dizzy = 2.8; sfx("boing"); });
        });
        break;
      case "eyes":
        A.sit = B.sit = false; A.dizzy = B.dizzy = 0; A.speed = B.speed = 30; close(14);
        when(both, () => {
          A.heartEyes = B.heartEyes = 4.5; A.say("heart", 3.5); later(0.4, () => B.say("heart", 3.5));
          P.comic("ТУК-ТУК", M, head(A) - 6, "#ff8fab", 1.1);
          loveMoment(4);
        });
        break;
      case "laugh": A.say("note"); B.say("note"); A.jump(50); later(0.3, () => B.jump(50)); later(0.7, () => A.jump(40)); later(1, () => B.jump(40)); notes(M, head(A)); P.comic("ХА-ХА!", M, head(A) - 4, "#ffd166", 1); break;
      case "sweat": B.say("sweat"); B.shakeT = 1.5; later(0.6, () => A.say("sweat")); break;
      case "talk": close(14); for (let k = 0; k < 6; k++) later(k * 0.7, () => { const c = k % 2 ? B : A; c.say(k % 3 ? "note" : "excl", 0.8); c.jump(30); }); later(4.3, () => { A.say("heart"); B.say("heart"); heartsRise(M, head(A), 5); }); break;
      case "heart": close(12); when(both, () => { A.hand = true; A.say("heart", 3); B.say("heart", 3); B.heartEyes = 3; loveMoment(2.6); }); break;
      case "nervous": A.x = -16; A.tx = LW * 0.3; B.x = LW * 0.62; B.tx = LW * 0.62; A.shakeT = 3.5; later(1.2, () => { A.say("sweat", 2.5); P.comic("ГЛЫК", A.x, head(A), "#7fd3ff", 0.9); }); break;
      case "flowers":
        A.item = "flowers"; A.speed = 50; close(15);
        when(both, () => { B.say("heart", 3); B.jump(65); B.heartEyes = 3.5; heartsRise(B.x, head(B), 7); P.comic("АХ!", B.x, head(B) - 4, "#ff8fab", 1.1); sfx("good"); });
        break;
      case "confess": close(12); P.petals = true; when(both, () => { A.say("heart", 4.5); B.say("heart", 4.5); A.heartEyes = B.heartEyes = 4.5; burstHeart(M, LH * 0.28, "#ff4d6d", 2.6); loveMoment(4.5); }); break;
      case "kiss": close(11); if (A.sit || B.sit) kiss(); else when(both, kiss); break;
      case "steam": P.steamBoost = 3; A.say("excl"); later(1, () => B.say("question")); break;
      case "chase":
        P.steamBoost = 1.5; pelmeni(6); P.comic("ПЛЮХ!", LW - 26, GY - 46, "#fff", 1);
        later(0.5, () => { A.speed = 100; A.tx = LW * 0.1; A.say("excl", 3); P.comic("СТОЯТЬ!", LW * 0.3, head(A), "#ffd166"); });
        later(1.0, () => { B.say("note", 3); B.jump(40); });
        later(1.8, () => (A.tx = LW * 0.6));
        later(2.8, () => (A.tx = LW * 0.15));
        later(3.8, () => { A.speed = 40; A.tx = LW * 0.3; A.say("sweat"); later(0.4, () => B.jump(40)); });
        break;
      case "apart": A.tx = LW * 0.2; B.tx = LW * 0.8; break;
      case "angry": A.say("anger", 3.5); B.say("anger", 3.5); stormCloud(A, 4); stormCloud(B, 4); A.jump(30); break;
      case "lightning": lightning(); shake = 6; A.say("excl"); B.say("excl"); A.jump(); B.jump(); P.comic("БАБАХ!", M, LH * 0.25, "#fffbe0", 1.4); break;
      case "umbrellaFly":
        A.speed = 45; close(12);
        when(both, () => {
          umbrella(A, 1.6, 1.8);
          later(1.6, () => { P.sfxWind(); P.comic("ВЖУХ!", A.x, head(A) - 14, "#7fd3ff", 1.3); A.fly = 1.8; A.say("excl", 2); B.say("question", 2); });
          later(3.6, () => { A.dizzy = 1.8; B.speed = 70; B.tx = A.x + 18; });
          later(5.2, () => { A.tx = A.x; A.hugDir = 1; B.hugDir = -1; heartsRise((A.x + B.x) / 2, head(A), 8); loveMoment(2.5); sfx("good"); });
        });
        break;
      case "seagull":
        A.item = "icecream";
        bird({ from: [LW + 10, 10], to: () => [A.x + 10, A.headY() + 12], after: [-20, 4], onReach: () => { A.item = null; A.say("anger", 3); P.comic("ЭЙ!", A.x, head(A), "#ff4d6d"); later(0.6, () => B.say("note")); later(0.8, () => B.jump(40)); return "icecream"; } });
        break;
      case "chaseBird":
        A.speed = 100; A.tx = -24; P.comic("ВЕРНИ!", LW * 0.2, head(A), "#ffd166"); sfx("whoosh");
        later(0.8, () => { B.say("note", 3); B.jump(40); });
        later(2.2, () => { A.x = -24; A.tx = LW * 0.85; birdsChase(A, 3, 2.2); P.comic("ААА!", LW * 0.4, head(A), "#ff4d6d", 1.2); A.say("excl", 2.5); sfx("whoosh"); });
        later(4.6, () => { A.speed = 50; A.tx = LW * 0.3; A.say("sweat"); });
        break;
      case "dance": close(15); A.dance = B.dance = 4.5; for (let k = 0; k < 5; k++) later(k * 0.8, () => notes(M, head(A), 2)); break;
      case "slip":
        A.speed = 85; A.tx = LW * 0.6;
        when(() => A.x > LW * 0.4, () => {
          A.tx = A.x; A.lying = -1; A.slideV = 75; sfx("whoosh"); P.comic("ВЖУХ!", A.x + 20, head(B), "#bdfcff", 1.3); B.say("excl", 1.5); B.jump(50);
          later(1.9, () => { A.lying = 0; A.slideV = 0; A.dizzy = 1.8; B.say("note", 2); P.comic("ХА-ХА!", B.x, head(B), "#ffd166", 0.9); });
          later(3.4, () => { A.speed = 50; A.tx = LW * 0.3; });
        });
        break;
      case "snowball":
        snowball(B, A, () => { A.say("excl", 1); A.jump(40); });
        later(1, () => snowball(A, B, () => { B.say("note", 1); B.jump(40); }));
        later(2, () => snowball(B, A, () => { A.say("sweat", 1.5); A.shakeT = 0.6; P.comic("ПЛЮХ!", A.x, head(A), "#fff", 1.2); B.jump(50); }));
        break;
      case "wish":
        close(11);
        when(both, () => { A.hand = true; A.say("star", 2.5); B.say("star", 2.5); for (let k = 0; k < 4; k++) later(k * 0.5, () => rocket(LW * (0.2 + k * 0.2), true)); later(2.2, kiss); });
        break;
      case "cat": cat(1); later(0.6, () => { A.say("question"); B.say("excl"); A.jump(45); }); break;
      case "catSeat": {
        const spot = LW * 0.42;
        A.speed = 45; A.tx = spot; B.tx = LW * 0.7;
        catSeat(spot, GY - 13, () => { P.comic("МЯУ", spot, GY - 30, "#ffd166", 0.9); });
        when(() => A.arrived() && P.catOnSofa, () => { A.say("question", 1.8); later(1.6, () => { A.sit = true; A.lift = 0; P.comic("…", A.x, head(A), "#fff"); B.say("note", 2); B.jump(40); }); });
        break;
      }
      case "cuddle":
        A.sit = false; A.lift = 0; A.speed = 35; close(12);
        when(both, () => { A.sit = B.sit = true; A.lift = B.lift = -10; P.blanket = true; P.catLap = true; A.say("heart", 3); later(0.8, () => B.say("zz", 3)); heartsRise(M, head(A), 8); loveMoment(3); });
        break;
      case "sit":
        close(12);
        when(both, () => { A.sit = B.sit = true; A.lift = B.lift = sceneName === "home" ? -10 : 0; A.say("heart", 3); later(0.8, () => B.say("zz", 3)); heartsRise(M, head(A), 4); });
        break;
      case "hug": close(11); when(both, () => { A.hugDir = 1; B.hugDir = -1; heartsRise(M, head(A), 6); }); break;
      case "finaleEnter":
        A.x = -16; B.x = LW + 16; A.speed = B.speed = 22; close(12); P.petals = true;
        when(both, () => { A.sit = B.sit = true; A.hand = true; });
        break;
      case "finaleKiss": kiss(); later(0.5, () => { for (let k = 0; k < 5; k++) later(k * 0.35, () => rocket(LW * (0.15 + k * 0.17), true)); }); break;
      case "heartSky": heartSky(); A.say("heart", 99); B.say("heart", 99); A.heartEyes = B.heartEyes = 99; break;
      default: break;
    }
  };

  // ---------- цикл ----------
  let last = 0;
  function loop(now) {
    const realDt = Math.min(0.033, (now - (last || now)) / 1000);
    last = now;
    if (slowT > 0) slowT -= realDt;
    if (romanceT > 0) romanceT -= realDt;
    const dt = realDt * (slowT > 0 ? 0.35 : 1);
    t += dt;
    if (scene) {
      timers = timers.filter((x) => (x.at <= t ? (x.fn(), false) : true));
      waiters = waiters.filter((w) => (w.cond() ? (w.fn(), false) : true));
      scene.ambient && scene.ambient(dt);
      chars.a && chars.a.update(dt);
      chars.b && chars.b.update(dt);
      fx = fx.filter((e) => e.update(dt));
      shake *= 0.85; flash *= 0.88;
      P.romance += ((romanceT > 0 ? 1 : 0) - P.romance) * Math.min(1, realDt * 3);
      P.romancePulse = (P.romancePulse || 0) * 0.9;
      if (P.romance > 0.5 && Math.random() < realDt * 12 && chars.a) sparkle(Math.random() * LW, Math.random() * GY);

      g.save();
      if (shake > 0.5) g.translate(Math.round((Math.random() - 0.5) * shake), Math.round((Math.random() - 0.5) * shake));
      scene.draw(rng(sceneName.length * 999 + 7));
      const A = chars.a, B = chars.b;
      if (A && B && A.hand && Math.abs(B.x - A.x) < 40) {
        const y = Math.round(groundAt(A.x) + A.lift - (A.sit ? 8 : 10));
        R(Math.min(A.x, B.x) + 9, y, Math.abs(B.x - A.x) - 17, 2, A.look.skin || "#f1c27d");
      }
      if (A && A.x > -24 && A.x < LW + 24) A.draw();
      if (B && B.x > -24 && B.x < LW + 24) B.draw();
      if (P.blanket && A && B) { const bx0 = Math.min(A.x, B.x) - 9, bw = Math.abs(B.x - A.x) + 18, by0 = groundAt(A.x) + A.lift - 6; for (let x = 0; x < bw; x += 3) for (let y = 0; y < 7; y += 3) R(bx0 + x, by0 + y, 3, 3, ((x + y) / 3) % 2 ? "#e76f51" : "#f4a261"); R(bx0, by0, bw, 1, "#ffd166"); }
      if (P.catLap && A && A.sit && A.lift < 0) drawCat(A.x + 2, groundAt(A.x) + A.lift - 4, 1, 0, true);
      fx.forEach((e) => e.draw());
      // розовая рамка романтики + пульс сердца
      const rom = Math.min(1, P.romance + P.romancePulse * 0.4);
      if (rom > 0.02) for (let i = 0; i < 14; i++) { g.globalAlpha = rom * 0.5 * (1 - i / 14); g.fillStyle = "#ff4d8d"; g.fillRect(0, i, LW, 1); g.fillRect(0, LH - 1 - i, LW, 1); g.fillRect(i, 0, 1, LH); g.fillRect(LW - 1 - i, 0, 1, LH); }
      g.globalAlpha = 1;
      if (flash > 0.02) { g.globalAlpha = Math.min(0.85, flash); R(0, 0, LW, LH, flashColor); g.globalAlpha = 1; }
      g.restore();
    }
    requestAnimationFrame(loop);
  }

  window.Pix = P;
})();
