const canvas = document.getElementById("rope");
const ctx = canvas.getContext("2d");
const stage = document.getElementById("stage");

// ---- Tuning: change these to change how the charm feels ----
const DEFAULT_ROPE_LENGTH = 170; // resting length of the cord (px); a charm can override it
const GRAVITY = 1300;            // pull of gravity (px per second squared)
const STIFFNESS = 90;            // cord springiness (lower = more stretch and bounce)
const STRETCH_DAMP = 4;          // how quickly the bounce dies (higher = fewer bounces)
const AIR_DRAG = 0.8;            // how quickly the swing dies (higher = settles faster)
const SUBSTEPS = 8;              // more steps = more accurate
const MAX_RELEASE_SPEED = 1400;  // speed limit when you let go (px per second)
const ANGLE_SMOOTH = 0.25;       // how smoothly the charm turns (lower = smoother)
const ROPE_LAG = 0.15;           // how much the cord curve trails behind
const ANCHOR_RIGHT = 90;         // distance of the string from the right edge of the window (px)

// Set automatically from the current charm
let ropeLength = DEFAULT_ROPE_LENGTH;
let ropeStyle = "gold";
let charmWidth = 120;
let charmHeight = 200;
let charmMidY = 100;

// ---- Canvas and anchor ----
// The canvas is drawn at the screen's full pixel density so thin strings stay sharp on Retina displays.
const anchor = { x: 0, y: 0 };
let viewW = window.innerWidth;
let viewH = window.innerHeight;

function resize() {
  const dpr = window.devicePixelRatio || 1;
  viewW = window.innerWidth;
  viewH = window.innerHeight;
  canvas.width = Math.round(viewW * dpr);
  canvas.height = Math.round(viewH * dpr);
  canvas.style.width = viewW + "px";
  canvas.style.height = viewH + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  anchor.x = viewW - ANCHOR_RIGHT;
}
resize();
window.addEventListener("resize", resize);

// ---- The charm (the only moving body) ----
const bob = { x: 0, y: 0, vx: 0, vy: 0 };
const ropeCtrl = { x: 0, y: 0 };

function resetBob() {
  bob.x = anchor.x;
  bob.y = ropeLength;
  bob.vx = 0;
  bob.vy = 0;
  ropeCtrl.x = anchor.x;
  ropeCtrl.y = ropeLength / 2;
}
resetBob();

// ---- Charm element ----
const charmEl = document.createElement("div");
Object.assign(charmEl.style, {
  position: "absolute",
  left: "0px",
  top: "0px",
  transformOrigin: "50% 0px",
  userSelect: "none",
  pointerEvents: "none",
});
stage.appendChild(charmEl);

let currentCharm = -1;

// effect state: lives up here because setCharm resets it
const fx = {
  blinkStart: -1e9, nextDragBlink: 0,          // hamsa
  glow: 0, glowTarget: 0, glowHoldUntil: 0,    // oni
  lastRing: 0,                                 // bell
  lastTime: 0,
};

function resetEffects() {
  fx.blinkStart = -1e9;
  fx.glow = 0;
  fx.glowTarget = 0;
  fx.glowHoldUntil = 0;
  if (bodyEl) bodyEl.style.filter = "";
  if (wrapEl) wrapEl.style.filter = "";
}

const layerEls = {};   // the named layers of the current charm, so effects can reach them
let bodyEl = null;     // the main picture of the current charm
let wrapEl = null;     // wraps the picture and its layers (glow effects go here)

function loadImage(src, height) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.draggable = false;
    img.style.cssText = `display:block;height:${height}px;width:auto;`;
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error("Could not load charm image: " + src));
    img.src = src;
  });
}

function setCharm(index) {
  if (index === currentCharm || !CHARMS[index]) return;
  currentCharm = index;
  const c = CHARMS[index];

  // The string style and length change right away; a longer string lets the charm drop down
  ropeLength = c.ropeLength || DEFAULT_ROPE_LENGTH;
  ropeStyle = c.rope || "gold";
  resetEffects();

  const layers = c.layers || [];
  const jobs = [loadImage(c.src, c.height), ...layers.map((l) => loadImage(l.src, c.height))];

  Promise.all(jobs)
    .then(([body, ...extras]) => {
      if (currentCharm !== index) return; // a newer choice arrived while this loaded

      const wrap = document.createElement("div");
      wrap.style.position = "relative";
      wrap.appendChild(body);

      for (const k of Object.keys(layerEls)) delete layerEls[k];

      extras.forEach((img, i) => {
        const l = layers[i];
        const origin = l.origin || [50, 50];
        Object.assign(img.style, {
          position: "absolute",
          left: "0px",
          top: "0px",
          transformOrigin: `${origin[0]}% ${origin[1]}%`,
        });
        if (l.opacity !== undefined) img.style.opacity = l.opacity;
        if (l.name) layerEls[l.name] = img;
        wrap.appendChild(img);
        if (l.keyframes) {
          img.animate(l.keyframes, {
            duration: l.duration || 1400,
            iterations: Infinity,
            direction: "alternate",   // back and forth
            easing: "ease-in-out",
          });
        }
      });

      bodyEl = body;
      wrapEl = wrap;
      charmEl.replaceChildren(wrap);
      charmWidth = (body.naturalWidth * c.height) / body.naturalHeight;
      charmHeight = c.height;
      charmMidY = c.height / 2;
    })
    .catch((err) => console.error(err));
}
setCharm(0);

// Switch from the menu bar menu
if (window.dangle && window.dangle.onSetCharm) {
  window.dangle.onSetCharm((index) => setCharm(index));
}

// Press 1 to 9 (and 0 for the tenth) to switch charms
window.addEventListener("keydown", (e) => {
  if (!/^[0-9]$/.test(e.key)) return;
  const n = e.key === "0" ? 10 : parseInt(e.key, 10);
  if (n >= 1 && n <= CHARMS.length) setCharm(n - 1);
});

// ---- Charm angle, middle, and hit test ----
let charmAngle = 0;

function charmCenter() {
  return {
    x: bob.x - Math.sin(charmAngle) * charmMidY,
    y: bob.y + Math.cos(charmAngle) * charmMidY,
  };
}

// True if the point is over the charm's picture (works even when it's tilted)
function overCharm(x, y) {
  const c = charmCenter();
  const dx = x - c.x;
  const dy = y - c.y;
  const cos = Math.cos(-charmAngle);
  const sin = Math.sin(-charmAngle);
  const lx = dx * cos - dy * sin;
  const ly = dx * sin + dy * cos;
  return Math.abs(lx) < charmWidth / 2 + 8 && Math.abs(ly) < charmHeight / 2 + 8;
}

// ---- Bell sound: built from the partials of a struck bell, so no audio file is needed ----
let audioCtx = null;

// strength: 1 = a full ring, smaller = a softer one
function ringBell(strength = 1) {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();

  const t0 = audioCtx.currentTime;
  const master = audioCtx.createGain();
  master.gain.value = 0.35 * strength;
  master.connect(audioCtx.destination);

  const base = 1180 + Math.random() * 60; // slightly different pitch each ring
  // ratio to the base pitch, loudness, and how many seconds each part rings for
  const partials = [
    { ratio: 1.0,  gain: 1.0,  decay: 2.8 },
    { ratio: 2.0,  gain: 0.55, decay: 2.1 },
    { ratio: 2.76, gain: 0.45, decay: 1.6 },
    { ratio: 5.4,  gain: 0.3,  decay: 1.0 },
    { ratio: 8.93, gain: 0.15, decay: 0.55 },
  ];

  for (const p of partials) {
    // two slightly detuned copies give the bell its shimmer
    for (const detune of [0, 2.5]) {
      const osc = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.value = base * p.ratio + detune;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(p.gain * 0.5, t0 + 0.003);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + p.decay);
      osc.connect(g);
      g.connect(master);
      osc.start(t0);
      osc.stop(t0 + p.decay + 0.05);
    }
  }

  // a tiny metallic click where the clapper strikes
  const len = Math.floor(audioCtx.sampleRate * 0.012);
  const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const click = audioCtx.createBufferSource();
  const hp = audioCtx.createBiquadFilter();
  hp.type = "highpass";
  hp.frequency.value = 3000;
  click.buffer = buf;
  click.connect(hp);
  hp.connect(master);
  click.start(t0);
}

// ---- Reactions: what a charm does when you click it, drag it, or let go ----
// A charm picks one in charms.js with  react: "bell" | "blink" | "glow"
const BLINK_CLOSE = 90;        // ms to close the eye
const BLINK_HOLD = 70;         // ms it stays shut
const BLINK_OPEN = 140;        // ms to open again
const GLOW_AFTER_TAP = 1100;   // ms the glow lasts after a quick click
const GLOW_AFTER_DRAG = 900;   // ms the glow lasts after you let go of a drag

function reactPress(now) {
  const c = CHARMS[currentCharm];
  if (!c || !c.react) return;
  if (c.react === "bell") {
    ringBell(1);
    fx.lastRing = now;
  } else if (c.react === "blink") {
    fx.blinkStart = now;
    fx.nextDragBlink = now + 900;
  } else if (c.react === "glow") {
    fx.glowTarget = 1;
    fx.glowHoldUntil = Infinity; // stays lit while you hold it
  }
}

// called every frame while the charm is held; speed is how fast you're moving it (px per second)
function reactDrag(now, speed) {
  const c = CHARMS[currentCharm];
  if (!c || !c.react) return;
  if (c.react === "bell") {
    // shaking the bell makes it ring, harder for faster shakes
    if (speed > 320 && now - fx.lastRing > 170) {
      ringBell(0.15 + 0.85 * Math.min(1, speed / 1500));
      fx.lastRing = now;
    }
  } else if (c.react === "blink") {
    // keeps blinking while you drag it around
    if (speed > 120 && now > fx.nextDragBlink) {
      fx.blinkStart = now;
      fx.nextDragBlink = now + 900;
    }
  }
}

function reactRelease(now, wasTap) {
  const c = CHARMS[currentCharm];
  if (!c || !c.react) return;
  if (c.react === "bell" && wasTap) {
    // a click knocks the bell sideways so it swings as it rings
    bob.vx += (Math.random() < 0.5 ? -1 : 1) * 380;
    bob.vy -= 60;
  } else if (c.react === "glow") {
    fx.glowHoldUntil = now + (wasTap ? GLOW_AFTER_TAP : GLOW_AFTER_DRAG);
  }
}

// runs every frame: moves the blink and glow along
function updateEffects(now) {
  const c = CHARMS[currentCharm];
  const dt = Math.min(0.05, Math.max(0, (now - fx.lastTime) / 1000));
  fx.lastTime = now;
  if (!c) return;

  if (c.react === "blink" && layerEls.blink) {
    const t = now - fx.blinkStart;
    let level = 0;
    if (t >= 0 && t < BLINK_CLOSE) level = t / BLINK_CLOSE;
    else if (t >= BLINK_CLOSE && t < BLINK_CLOSE + BLINK_HOLD) level = 1;
    else if (t >= BLINK_CLOSE + BLINK_HOLD && t < BLINK_CLOSE + BLINK_HOLD + BLINK_OPEN) {
      level = 1 - (t - BLINK_CLOSE - BLINK_HOLD) / BLINK_OPEN;
    }
    layerEls.blink.style.opacity = level.toFixed(3);
  }

  if (c.react === "glow" && layerEls.glow && bodyEl && wrapEl) {
    if (fx.glowTarget === 1 && now > fx.glowHoldUntil) fx.glowTarget = 0;
    const rate = fx.glowTarget ? 10 : 2.2;                 // lights up fast, fades slowly
    fx.glow += (fx.glowTarget - fx.glow) * (1 - Math.exp(-rate * dt));
    const g = fx.glow < 0.002 ? 0 : fx.glow;
    const flicker = 1 + 0.07 * Math.sin(now / 90) * g;     // a slight pulse while lit
    layerEls.glow.style.opacity = Math.min(1, g * flicker).toFixed(3);
    bodyEl.style.filter = g > 0 ? `brightness(${(1 - 0.22 * g).toFixed(3)})` : "";
    wrapEl.style.filter = g > 0
      ? `drop-shadow(0 0 ${(6 + 10 * g).toFixed(1)}px rgba(255,120,30,${(0.9 * g).toFixed(2)})) ` +
        `drop-shadow(0 0 ${(14 + 22 * g).toFixed(1)}px rgba(255,80,20,${(0.55 * g).toFixed(2)}))`
      : "";
  }
}

// ---- Mouse input: only the charm can be grabbed ----
const HOVER_PUSH = 0.03;   // how strongly brushing the cursor across the charm pushes it
const HOVER_MAX = 90;      // limit of one push (px per second)
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

const mouse = { x: 0, y: 0 };
let holding = false;
const grabOffset = { x: 0, y: 0 };
const heldVel = { x: 0, y: 0 };
let downAt = 0;
const downPos = { x: 0, y: 0 };
let lastMove = { x: 0, y: 0, t: 0 };

window.addEventListener("pointermove", (e) => {
  const now = performance.now();
  const dt = Math.max(1, now - lastMove.t) / 1000;
  const vx = (e.clientX - lastMove.x) / dt;
  const vy = (e.clientY - lastMove.y) / dt;
  lastMove = { x: e.clientX, y: e.clientY, t: now };

  mouse.x = e.clientX;
  mouse.y = e.clientY;

  // brushing the cursor across the charm gives it a push in the direction you're moving
  if (!holding && dt < 0.1 && overCharm(mouse.x, mouse.y)) {
    bob.vx = clamp(bob.vx + clamp(vx * HOVER_PUSH, -HOVER_MAX, HOVER_MAX), -900, 900);
    bob.vy = clamp(bob.vy + clamp(vy * HOVER_PUSH * 0.5, -HOVER_MAX / 2, HOVER_MAX / 2), -900, 900);
  }
});

window.addEventListener("pointerdown", (e) => {
  mouse.x = e.clientX;
  mouse.y = e.clientY;

  if (overCharm(mouse.x, mouse.y)) {
    holding = true;
    downAt = performance.now();
    downPos.x = mouse.x;
    downPos.y = mouse.y;
    grabOffset.x = bob.x - mouse.x;
    grabOffset.y = bob.y - mouse.y;
    heldVel.x = 0;
    heldVel.y = 0;
    bob.vx = 0;
    bob.vy = 0;
    reactPress(downAt);   // the sound or animation starts the moment you click
  }
});

function release() {
  if (!holding) return;
  holding = false;

  // A quick press with almost no movement is a click, not a drag
  const now = performance.now();
  const quick = now - downAt < 300;
  const still = Math.hypot(mouse.x - downPos.x, mouse.y - downPos.y) < 8;
  const wasTap = quick && still;

  if (wasTap) {
    bob.vx = 0;
    bob.vy = 0;
    reactRelease(now, true);
    return;
  }

  reactRelease(now, false);

  let vx = heldVel.x;
  let vy = heldVel.y;
  const speed = Math.hypot(vx, vy);
  if (speed > MAX_RELEASE_SPEED) {
    vx *= MAX_RELEASE_SPEED / speed;
    vy *= MAX_RELEASE_SPEED / speed;
  }
  bob.vx = vx;
  bob.vy = vy;
}
window.addEventListener("pointerup", release);
window.addEventListener("pointercancel", release);

// ---- Physics: one weight on an elastic cord ----
function simulate(dt) {
  const dx = bob.x - anchor.x;
  const dy = bob.y - anchor.y;
  const dist = Math.hypot(dx, dy) || 1e-6;
  const ux = dx / dist;
  const uy = dy / dist;

  let ax = 0;
  let ay = GRAVITY;

  // The cord only pulls when stretched. When slack, it goes limp.
  const stretch = dist - ropeLength;
  if (stretch > 0) {
    const along = bob.vx * ux + bob.vy * uy;
    const force = STIFFNESS * stretch + STRETCH_DAMP * along;
    ax -= force * ux;
    ay -= force * uy;
  }

  ax -= AIR_DRAG * bob.vx;
  ay -= AIR_DRAG * bob.vy;

  bob.vx += ax * dt;
  bob.vy += ay * dt;
  bob.x += bob.vx * dt;
  bob.y += bob.vy * dt;

  // Keep the charm inside the window; bounce softly off the edges
  const halfW = charmWidth / 2;
  if (bob.x < halfW) { bob.x = halfW; bob.vx = Math.abs(bob.vx) * 0.4; }
  if (bob.x > viewW - halfW) { bob.x = viewW - halfW; bob.vx = -Math.abs(bob.vx) * 0.4; }
  const floor = viewH - charmHeight - 10;
  if (bob.y > floor) { bob.y = floor; bob.vy = -Math.abs(bob.vy) * 0.4; }
}

// ---- Drawing the string ----
// Every style starts from the same sampled curve, so they all follow the cord's motion.
function sampleRope(N) {
  const P = [];
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    const u = 1 - t;
    P.push({
      x: u * u * anchor.x + 2 * u * t * ropeCtrl.x + t * t * bob.x,
      y: u * u * anchor.y + 2 * u * t * ropeCtrl.y + t * t * bob.y,
    });
  }
  // distance along the cord, and the direction at each point
  const S = [0];
  for (let i = 1; i <= N; i++) S.push(S[i - 1] + Math.hypot(P[i].x - P[i - 1].x, P[i].y - P[i - 1].y));
  const T = P.map((_, i) => {
    const a = P[Math.max(0, i - 1)];
    const b = P[Math.min(N, i + 1)];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const l = Math.hypot(dx, dy) || 1;
    return { x: dx / l, y: dy / l };
  });
  return { N, P, S, T, total: S[N] };
}

// A point on the cord at distance s along it, shifted sideways (v) and along (u)
function ropePoint(r, s, u = 0, v = 0) {
  let i = 0;
  while (i < r.N && r.S[i + 1] < s) i++;
  const f = (s - r.S[i]) / ((r.S[i + 1] - r.S[i]) || 1);
  const x = r.P[i].x + (r.P[Math.min(r.N, i + 1)].x - r.P[i].x) * f;
  const y = r.P[i].y + (r.P[Math.min(r.N, i + 1)].y - r.P[i].y) * f;
  const t = r.T[i];
  return { x: x + t.x * u - t.y * v, y: y + t.y * u + t.x * v, tx: t.x, ty: t.y };
}

// Stroke the whole cord. "off" shifts it sideways: a number, or a function of the distance along the cord.
function strokeRope(r, width, color, off = 0) {
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  for (let i = 0; i <= r.N; i++) {
    const o = typeof off === "function" ? off(r.S[i]) : off;
    const x = r.P[i].x - r.T[i].y * o;
    const y = r.P[i].y + r.T[i].x * o;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.stroke();
}

// Classic gold string
function drawGoldRope() {
  ctx.beginPath();
  ctx.moveTo(anchor.x, anchor.y);
  ctx.quadraticCurveTo(ropeCtrl.x, ropeCtrl.y, bob.x, bob.y);
  ctx.strokeStyle = "#c9a227";
  ctx.lineWidth = 1.6;
  ctx.lineCap = "round";
  ctx.stroke();
}

// Realistic Spider-Man: a thin silver cable made of fine fibres, slightly uneven like real silk
function drawSilkRope(r) {
  const waver = (s, k) => 0.42 * Math.sin(s / 3.1 + k) + 0.3 * Math.sin(s / 5.3 + 1.3 * k) + 0.22 * Math.sin(s / 9.7 + 0.4 * k);
  strokeRope(r, 3.8, "rgba(0, 0, 0, 0.13)");                         // soft shadow so it never vanishes
  strokeRope(r, 2.3, "#a2a2a8", (s) => waver(s, 0) * 0.6);           // body of the cable
  strokeRope(r, 0.8, "#6c6c72", (s) => 0.5 + waver(s, 2));           // a darker fibre
  strokeRope(r, 0.8, "#f3f3f5", (s) => -0.45 + waver(s, 4));         // a bright fibre catching the light
}

// Comic Spider-Man: a mauve-pink line, heavy black ink on the left, thin ink on the right
function drawComicRope(r) {
  strokeRope(r, 4.7, "#120d0c");                                     // ink outline
  strokeRope(r, 3.0, "#d3b8b6", -0.35);                              // pale edges
  strokeRope(r, 1.6, "#c1a2a1", -0.35);                              // darker mauve centre
}

// Cartoon Spider-Man: a pale blue-white cord with one white strand wrapped around it in a spiral
function drawToonRope(r) {
  const INK = "#23222a";
  strokeRope(r, 5.0, INK);                                           // cord outline
  strokeRope(r, 3.5, "#c9cedd");                                     // cord body (shaded side)
  strokeRope(r, 2.0, "#eef1f8", 0.45);                               // lit side

  // the wrapped strand: only the half facing us is visible; the other half goes behind the cord
  const period = 11;
  const R = 2.35;
  const wrap = (front) => {
    const segs = [];
    for (let i = 0; i < r.N; i++) {
      const th0 = (2 * Math.PI * r.S[i]) / period;
      const th1 = (2 * Math.PI * r.S[i + 1]) / period;
      if (Math.cos((th0 + th1) / 2) >= 0 !== front) continue;
      const fade0 = Math.min(1, r.S[i] / 10, (r.total - r.S[i]) / 10);
      const fade1 = Math.min(1, r.S[i + 1] / 10, (r.total - r.S[i + 1]) / 10);
      const k0 = R * Math.sin(th0) * fade0;
      const k1 = R * Math.sin(th1) * fade1;
      segs.push([
        { x: r.P[i].x - r.T[i].y * k0, y: r.P[i].y + r.T[i].x * k0 },
        { x: r.P[i + 1].x - r.T[i + 1].y * k1, y: r.P[i + 1].y + r.T[i + 1].x * k1 },
      ]);
    }
    return segs;
  };
  const trace = (segs, width, color) => {
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.beginPath();
    for (const [a, b] of segs) { ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); }
    ctx.stroke();
  };
  const front = wrap(true);
  trace(front, 3.0, INK);                                            // dark edge of the strand
  trace(front, 1.7, "#f7f8fc");                                      // white strand
}

// Chibi Spider-Man: a pale knotted silk thread with dark ink edges, big sweeping curls and tiny curly wisps
const WEB_INK = "#1c2340";
const WEB_CURLS = [
  { freq: 0.0105, amp: 19, phase: 0.6, width: 1.0, wob: 0.006, off: 0.4 },
  { freq: 0.0072, amp: 24, phase: 2.4, width: 0.95, wob: 0.0045, off: 2.2 },
  { freq: 0.052,  amp: 3.6, phase: 1.1, width: 0.8, wob: 0.014, off: 0.9 },
];

function drawWebRope(r) {
  // the thread: ink edge, pale silk, bright highlight
  strokeRope(r, 5.2, WEB_INK);
  strokeRope(r, 3.7, "#eef3fb");
  strokeRope(r, 1.0, "#ffffff", 0.7);

  // big sweeping curls that loop around the thread, in clusters that come and go
  ctx.strokeStyle = WEB_INK;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  for (const st of WEB_CURLS) {
    ctx.lineWidth = st.width;
    ctx.beginPath();
    for (let i = 0; i <= r.N; i++) {
      const s = r.S[i];
      const cluster = 0.45 + 0.55 * Math.sin(s * st.wob + st.off);
      const ends = Math.min(1, s / 30, (r.total - s) / 30);
      const amp = st.amp * Math.max(0.15, cluster) * ends;
      const th = 2 * Math.PI * st.freq * s + st.phase;
      const nx = -r.T[i].y;
      const ny = r.T[i].x;
      const x = r.P[i].x + nx * amp * Math.sin(th) + r.T[i].x * amp * Math.cos(th);
      const y = r.P[i].y + ny * amp * Math.sin(th) + r.T[i].y * amp * Math.cos(th);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }

  // knots: little clusters of pale silk beads along the thread
  for (let k = 0, s = 26; s < r.total - 18; k++, s += 38 + 9 * Math.sin(k * 2.1)) {
    for (let j = 0; j < 3; j++) {
      const p = ropePoint(r, s + j * 3.4, 0, (j - 1) * 0.9);
      ctx.beginPath();
      ctx.ellipse(p.x, p.y, 3.3 - j * 0.4, 2.1, Math.atan2(p.ty, p.tx) + 0.5 * (j - 1), 0, Math.PI * 2);
      ctx.fillStyle = "#f2f6fd";
      ctx.fill();
      ctx.lineWidth = 0.8;
      ctx.stroke();
    }
  }

  // curly tendrils: a wisp that leaves the thread, swings out, and ends in a tiny spiral
  const tendrils = [{ at: 0.2, side: 1 }, { at: 0.47, side: -1 }, { at: 0.74, side: 1 }];
  ctx.lineWidth = 0.9;
  for (const td of tendrils) {
    const s = r.total * td.at;
    const a = ropePoint(r, s, 0, 0);
    const c = ropePoint(r, s, 14, td.side * 5);
    const e = ropePoint(r, s, 20, td.side * 17);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.quadraticCurveTo(c.x, c.y, e.x, e.y);
    const cc = ropePoint(r, s, 20 + 0, td.side * 20.5); // centre of the little curl
    const a0 = Math.atan2(e.y - cc.y, e.x - cc.x);
    ctx.arc(cc.x, cc.y, 3.4, a0, a0 + td.side * Math.PI * 1.6, td.side < 0);
    ctx.stroke();
  }
}

function drawRope() {
  if (ropeStyle === "gold") return drawGoldRope();
  const r = sampleRope(160);
  if (ropeStyle === "silk") drawSilkRope(r);
  else if (ropeStyle === "comic") drawComicRope(r);
  else if (ropeStyle === "toon") drawToonRope(r);
  else if (ropeStyle === "web") drawWebRope(r);
  else drawGoldRope();
}

// ---- Drawing ----
function draw() {
  ctx.clearRect(0, 0, viewW, viewH);

  // The cord is a smooth curve whose middle trails slightly behind the charm
  const midX = (anchor.x + bob.x) / 2;
  const midY = (anchor.y + bob.y) / 2;
  ropeCtrl.x += (midX - ropeCtrl.x) * ROPE_LAG;
  ropeCtrl.y += (midY - ropeCtrl.y) * ROPE_LAG;

  drawRope();

  // Hang the charm from the end of the cord, tilted along the cord's direction
  const targetAngle = -Math.atan2(bob.x - anchor.x, bob.y - anchor.y);
  charmAngle += (targetAngle - charmAngle) * ANGLE_SMOOTH;

  charmEl.style.left = bob.x - charmWidth / 2 + "px";
  charmEl.style.top = bob.y + "px";
  charmEl.style.transform = `rotate(${charmAngle}rad)`;
}

// ---- Click-through: only the charm catches the mouse ----
let clickable = false;

function updateClickThrough() {
  const shouldCatch = holding || overCharm(mouse.x, mouse.y);
  if (shouldCatch !== clickable) {
    clickable = shouldCatch;
    if (window.dangle) window.dangle.setClickable(clickable);
  }
}

// ---- Main loop ----
let last = performance.now();

function frame(now) {
  const frameTime = Math.min((now - last) / 1000, 1 / 30);
  last = now;

  // If the numbers ever break, reset instead of losing the charm
  if (!Number.isFinite(bob.x) || !Number.isFinite(bob.y)) resetBob();

  if (holding && frameTime > 0) {
    const targetX = mouse.x + grabOffset.x;
    const targetY = mouse.y + grabOffset.y;

    // Don't let the cord be pulled further than 1.6x its length
    const dx = targetX - anchor.x;
    const dy = targetY - anchor.y;
    const d = Math.hypot(dx, dy);
    const maxD = ropeLength * 1.6;
    let nx = targetX;
    let ny = targetY;
    if (d > maxD) {
      nx = anchor.x + (dx / d) * maxD;
      ny = anchor.y + (dy / d) * maxD;
    }

    const vx = (nx - bob.x) / frameTime;
    const vy = (ny - bob.y) / frameTime;
    heldVel.x = heldVel.x * 0.6 + vx * 0.4;
    heldVel.y = heldVel.y * 0.6 + vy * 0.4;
    reactDrag(now, Math.hypot(heldVel.x, heldVel.y));   // sounds and animations while dragging
    bob.x = nx;
    bob.y = ny;
  } else if (frameTime > 0) {
    const dt = frameTime / SUBSTEPS;
    for (let s = 0; s < SUBSTEPS; s++) simulate(dt);
  }

  updateEffects(now);
  draw();
  updateClickThrough();
  requestAnimationFrame(frame);
}

requestAnimationFrame(frame);