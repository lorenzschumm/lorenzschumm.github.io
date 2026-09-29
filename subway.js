"use strict";
// A subway-surfer-style endless runner that plays itself, drawn on a small
// canvas as a joke "gameplay" subscreen. Everything is generated at random in
// the browser: no assets, no server, no loops that repeat.
//
// World coordinates: x = sideways (lanes at -1, 0, 1), y = up, and "wz" =
// distance along the track. The player runs at wz = dist; the camera sits
// PLAYER_Z behind and CAM_H above, and projects with a simple pinhole model.

(() => {
const aside    = document.getElementById("subway");
const canvas   = document.getElementById("subway-canvas");
const closeBtn = document.getElementById("subway-close");
const openBtn  = document.getElementById("subway-open");
const ctx = canvas.getContext("2d");

// ---- Tunable constants ---------------------------------------------------
const IH         = 320;    // internal render height (px); width follows the box
const LANES      = [-1, 0, 1];
const PLAYER_Z   = 2.4;    // camera-to-player distance
const CAM_H      = 3.0;    // camera height (looks down on train roofs)
const NEAR       = 0.35;   // near clip distance
const FAR        = 55;     // draw / spawn distance
const FOG_START  = 18;
const FPS        = 30;     // plenty for a joke, easy on batteries
const JUMP_T     = 0.6;    // seconds
const JUMP_H     = 1.2;
const ROLL_T     = 0.6;
const DAY_CYCLE  = 120;    // seconds for a full day → sunset → night → dawn
const STORAGE_KEY = "subway-hidden";

// ---- Palette ---------------------------------------------------------------
const GROUND   = [128, 124, 116];
const BED      = [112, 94, 80];
const SLEEPER  = [88, 62, 44];
const RAIL     = [196, 196, 206];
const POLE     = [70, 74, 82];
const GLASS    = [38, 48, 70];
const TRAIN_COLORS = [[208, 60, 50], [58, 112, 196], [232, 182, 44], [70, 152, 94], [196, 198, 206]];
const BUILDING_COLORS = [[176, 76, 60], [214, 186, 140], [86, 140, 150], [140, 140, 152],
                         [122, 92, 152], [210, 132, 72], [92, 122, 84]];
const GRAFFITI = [[255, 70, 160], [60, 220, 255], [255, 230, 40], [120, 255, 100], [255, 120, 40]];
const HOODIE = [40, 120, 220], HOODIE_DARK = [28, 86, 170], JEANS = [44, 60, 112];
const SHOES = [240, 64, 64], CAP = [245, 200, 40], HAIR = [70, 46, 30], SKIN = [236, 190, 156];
const BACKPACK = [250, 140, 40];
const SKY = [                                              // keyframes of the day cycle
  { top: [70, 160, 255],  bot: [200, 235, 255], light: 1.0 },   // day
  { top: [70, 160, 255],  bot: [200, 235, 255], light: 1.0 },
  { top: [250, 110, 90],  bot: [255, 200, 140], light: 0.85 },  // sunset
  { top: [14, 20, 60],    bot: [60, 60, 120],   light: 0.55 },  // night
  { top: [14, 20, 60],    bot: [60, 60, 120],   light: 0.55 },
  { top: [130, 120, 210], bot: [255, 180, 190], light: 0.8 },   // dawn
];
const STARS = Array.from({ length: 40 }, () => [Math.random(), Math.random() * 0.9]);

// ---- Helpers ---------------------------------------------------------------
const rand  = (a, b) => a + Math.random() * (b - a);
const pick  = arr => arr[Math.floor(Math.random() * arr.length)];
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const rgb   = c => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;

// ---- Canvas sizing & projection -------------------------------------------
let IW = 180, F = 128, CX = 90, HOR = 115;
let camX = 0, camY = CAM_H;
let env = skyAt(0);

function resize() {
  const r = canvas.getBoundingClientRect();
  if (!r.width || !r.height) return;
  IW = clamp(Math.round(IH * r.width / r.height), 100, 900);
  if (canvas.width !== IW || canvas.height !== IH) { canvas.width = IW; canvas.height = IH; }
  F = IH * 0.4;
  CX = IW / 2;
  HOR = IH * 0.86 - CAM_H * F / PLAYER_Z;   // puts the player's feet near the bottom
}

function P(x, y, z) {
  const k = F / z;
  return [CX + (x - camX) * k, HOR + (camY - y) * k];
}

// Camera-space depth of a point along the track.
const cz = wz => wz - dist + PLAYER_Z;

function skyAt(time) {
  const p = (time / DAY_CYCLE * SKY.length) % SKY.length;
  const i = Math.floor(p), f = p - i, s = f * f * (3 - 2 * f);
  const a = SKY[i], b = SKY[(i + 1) % SKY.length];
  const mix = (u, v) => u.map((c, j) => c + (v[j] - c) * s);
  return { top: mix(a.top, b.top), bot: mix(a.bot, b.bot), light: a.light + (b.light - a.light) * s };
}

// A colour lit by the time of day and fogged towards the horizon by depth z.
function col(c, z, mul = 1) {
  const l = mul * env.light, b = env.bot;
  const f = clamp((z - FOG_START) / (FAR - FOG_START), 0, 1);
  return `rgb(${(Math.min(255, c[0] * l) * (1 - f) + b[0] * f) | 0},` +
             `${(Math.min(255, c[1] * l) * (1 - f) + b[1] * f) | 0},` +
             `${(Math.min(255, c[2] * l) * (1 - f) + b[2] * f) | 0})`;
}

// Fog on the ground plane depends only on screen height, so a gradient does it.
function groundFill(c) {
  const g = ctx.createLinearGradient(0, HOR, 0, HOR + camY * F / FOG_START);
  g.addColorStop(0, rgb(env.bot));
  g.addColorStop(1, col(c, 0));
  return g;
}

function poly(pts, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  ctx.fill();
}
// Axis-aligned quads: a wall at constant x, a floor/roof at constant y, and a
// face at constant z (which is just a screen rectangle).
function wallX(x, y0, y1, z0, z1, fill) { poly([P(x, y0, z0), P(x, y0, z1), P(x, y1, z1), P(x, y1, z0)], fill); }
function wallY(y, x0, x1, z0, z1, fill) { poly([P(x0, y, z0), P(x1, y, z0), P(x1, y, z1), P(x0, y, z1)], fill); }
function wallZ(z, x0, x1, y0, y1, fill) {
  const a = P(x0, y1, z), b = P(x1, y0, z);
  ctx.fillStyle = fill;
  ctx.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
}

// ---- World state -----------------------------------------------------------
let t = rand(0, DAY_CYCLE * 0.25);   // global clock (day cycle keeps going across runs)
let dist, speed, runTime, score, coins;
let obstacles, coinList, rows, scenery, poles;
let safeLane, laneBusy, nextRowZ, lastRowZ, sideNext, poleNext;
let player, crash, blunder, nextBlunder;

function reset() {
  dist = 0; speed = 9; runTime = 0; score = 0; coins = 0;
  obstacles = []; coinList = []; rows = []; scenery = []; poles = [];
  safeLane = pick(LANES);
  laneBusy = [-99, -99, -99];        // per lane: track position until which it's occupied
  lastRowZ = 6; nextRowZ = 16;
  sideNext = [-PLAYER_Z - 2, -PLAYER_Z - 2];
  poleNext = 2;
  player = { x: safeLane, lane: safeLane, y: 0, jumpT: -1, rollT: -1, phase: 0 };
  camX = player.x * 0.55;
  crash = null;
  blunder = false;
  nextBlunder = rand(35, 110);       // the bot "messes up" now and then, like real footage
  populate();
}

function addObstacle(type, lane, wz, len = 0.15) {
  obstacles.push({ type, x: lane, wz, len, rgb: pick(TRAIN_COLORS), stripe: pick(GRAFFITI) });
  laneBusy[lane + 1] = Math.max(laneBusy[lane + 1], wz + len + (type === "train" ? 0 : 0.3));
}

function addCoin(lane, wz, y = 0.4) { coinList.push({ x: lane, wz, y, taken: false }); }

// One "row" of obstacles. There is always a guaranteed-safe lane; it only
// shifts sideways into a lane that has been clear since the previous row, so
// the bot (following it) can always make the switch.
function spawnRow(wz) {
  const gapStart = lastRowZ;
  let moved = false;
  if (Math.random() < 0.4) {
    const opts = [safeLane - 1, safeLane + 1]
      .filter(l => l >= -1 && l <= 1 && laneBusy[l + 1] < gapStart + 0.4);
    if (opts.length) { safeLane = pick(opts); moved = true; }
  }
  for (const l of LANES) {
    if (l === safeLane || laneBusy[l + 1] > wz - 2) continue;
    const r = Math.random();
    if (r < 0.5)       addObstacle("train", l, wz, rand(5, 16));
    else if (r < 0.65) addObstacle("low", l, wz);
    else if (r < 0.78) addObstacle("high", l, wz);
  }
  let trailEnd = wz - 1.5;
  const r = Math.random();
  if (r < 0.35 && laneBusy[safeLane + 1] < wz - 1) {
    const type = Math.random() < 0.55 ? "low" : "high";
    addObstacle(type, safeLane, wz);
    if (type === "low") {                       // coin arc over the jump
      for (let i = -2; i <= 2; i++) addCoin(safeLane, wz + i * 1.1, 0.4 + 0.9 * (1 - (i / 2.6) ** 2));
      trailEnd = wz - 3;
    } else {
      trailEnd = wz - 2;
    }
  }
  if (Math.random() < 0.65) {                   // coin trail leading the way
    for (let z = gapStart + (moved ? 3 : 1.5); z < trailEnd; z += 1.3) addCoin(safeLane, z);
  }
  rows.push({ wz, safe: safeLane, react: rand(0.45, 0.9) });
  lastRowZ = wz;
}

function spawnScenery() {
  for (let s = 0; s < 2; s++) {
    const side = s ? 1 : -1;
    while (sideNext[s] < dist + FAR) {
      const z0 = sideNext[s];
      if (Math.random() < 0.12) { sideNext[s] += rand(2, 5); continue; }   // alley gap
      const len = rand(4, 11);
      const low = Math.random() < 0.15;                                    // low wall
      scenery.push({
        side, z0, z1: z0 + len - (Math.random() < 0.3 ? rand(0.3, 1) : 0),
        x: side * rand(2.1, 2.6),
        h: low ? rand(0.8, 1.3) : rand(3, 7.5),
        rgb: pick(BUILDING_COLORS),
        windows: !low,
        graffiti: Math.random() < 0.55
          ? { c: pick(GRAFFITI), c2: pick(GRAFFITI), at: rand(0.1, 0.5), w: rand(1.2, 3), h: rand(0.5, 1.2) }
          : null,
      });
      sideNext[s] += len;
    }
  }
  while (poleNext < dist + FAR) { poles.push(poleNext); poleNext += 9; }
}

function populate() {
  while (nextRowZ < dist + FAR) {
    spawnRow(nextRowZ);
    nextRowZ += rand(7, 12) * speed / 9;       // keep roughly constant time between rows
  }
  spawnScenery();
  const behind = dist - PLAYER_Z;
  obstacles = obstacles.filter(o => o.wz + o.len > behind);
  coinList  = coinList.filter(c => !c.taken && c.wz > behind);
  rows      = rows.filter(r => r.wz > dist - 2);
  scenery   = scenery.filter(b => b.z1 > behind);
  poles     = poles.filter(p => p > behind);
}

// ---- The bot ---------------------------------------------------------------
function jump() {
  if (player.jumpT < 0) { player.jumpT = 0; player.rollT = -1; }
  else if (player.jumpT > JUMP_T / 2) {
    // Already coming down: bounce into a new jump, starting at the current height.
    player.jumpT = JUMP_T * (1 - Math.sqrt(Math.max(0, 1 - player.y / JUMP_H))) / 2;
  }
}
function roll() { if (player.rollT < 0) { player.rollT = 0; player.jumpT = -1; player.y = 0; } }

function steer(dt) {
  if (blunder) {
    // Deliberately wander into the next train, as real players eventually do.
    for (const o of obstacles) {
      const d = o.wz - dist;
      if (o.type === "train" && d > 3 && d < 18 && Math.abs(o.x - player.lane) <= 1) { player.lane = o.x; break; }
    }
    return;
  }
  // Follow the safe lane of the next row once it's within this row's reaction distance.
  for (const row of rows) {
    if (row.wz < dist - 0.6) continue;
    if (row.wz - dist < speed * row.react) player.lane = row.safe;
    break;
  }
  let barrierAhead = false;
  for (const o of obstacles) {
    if (o.type === "train" || (Math.abs(o.x - player.x) > 0.5 && o.x !== player.lane)) continue;
    const d = o.wz - dist;
    if (d > -0.5 && d < speed * 1.2) barrierAhead = true;
    if (d > 0 && d < speed * 0.24) (o.type === "low" ? jump : roll)();
  }
  // Style points — but never when a pointless jump could still be airborne at a barrier.
  if (!barrierAhead && player.jumpT < 0 && player.rollT < 0 && Math.random() < dt * 0.15) jump();
}

function hits(o) {
  if (Math.abs(o.x - player.x) > 0.6) return false;
  if (dist + 0.2 < o.wz || dist - 0.2 > o.wz + o.len) return false;
  if (o.type === "train") return true;
  if (o.type === "low") return player.y < 0.5;
  return player.rollT < 0;
}

// ---- Simulation ------------------------------------------------------------
function update(dt) {
  t += dt;
  env = skyAt(t);
  if (crash) {
    crash.t += dt;
    if (crash.t > 2.4) reset();
    return;
  }
  runTime += dt;
  speed = 9 + Math.min(7, runTime * 0.07);
  dist += speed * dt;
  score += speed * dt * multiplier();
  populate();

  steer(dt);
  player.x += (player.lane - player.x) * Math.min(1, dt * 14);
  if (player.jumpT >= 0) {
    player.jumpT += dt;
    const u = player.jumpT / JUMP_T;
    if (u >= 1) { player.jumpT = -1; player.y = 0; }
    else player.y = 4 * JUMP_H * u * (1 - u);
  }
  if (player.rollT >= 0 && (player.rollT += dt) > ROLL_T) player.rollT = -1;
  player.phase += dt * speed * 1.3;

  for (const c of coinList) {
    if (!c.taken && Math.abs(c.x - player.x) < 0.5 && Math.abs(c.wz - dist) < 0.5 &&
        Math.abs(c.y - (player.y + 0.4)) < 0.8) {
      c.taken = true;
      coins++;
      score += 10 * multiplier();
    }
  }
  for (const o of obstacles) if (hits(o)) { crash = { t: 0 }; break; }
  if (runTime > nextBlunder) blunder = true;

  camX += (player.x * 0.55 - camX) * Math.min(1, dt * 6);
  camY = CAM_H + player.y * 0.35;
}

const multiplier = () => 1 + Math.min(4, Math.floor(runTime / 25));

// ---- Rendering -------------------------------------------------------------
function drawSky() {
  const g = ctx.createLinearGradient(0, 0, 0, HOR);
  g.addColorStop(0, rgb(env.top));
  g.addColorStop(1, rgb(env.bot));
  ctx.fillStyle = g;
  ctx.fillRect(-8, -8, IW + 16, HOR + 9);
  const starAlpha = clamp((0.75 - env.light) * 3, 0, 1);
  if (starAlpha > 0) {
    ctx.fillStyle = `rgba(255,255,230,${starAlpha})`;
    for (const [sx, sy] of STARS) ctx.fillRect(sx * IW, sy * HOR * 0.8, 1, 1);
  }
}

function drawTrack() {
  ctx.fillStyle = groundFill(GROUND);
  ctx.fillRect(-8, HOR, IW + 16, IH - HOR + 8);
  wallY(0, -1.6, 1.6, NEAR, FAR, groundFill(BED));
  const first = Math.ceil((dist - PLAYER_Z + NEAR) / 0.75) * 0.75;
  for (const l of LANES) {
    for (let wz = first; cz(wz) < 40; wz += 0.75) {
      const z = cz(wz);
      wallY(0.01, l - 0.42, l + 0.42, z, z + 0.22, col(SLEEPER, z));
    }
  }
  for (const l of LANES) {
    for (const s of [-0.26, 0.26]) wallY(0.03, l + s - 0.035, l + s + 0.035, NEAR, FAR, col(RAIL, 12));
  }
}

function drawBuilding(b) {
  let z0 = cz(b.z0), z1 = Math.min(cz(b.z1), FAR);
  if (z1 < NEAR || z0 > FAR) return;
  const clipped = z0 < NEAR;
  z0 = Math.max(z0, NEAR);
  const zm = (z0 + z1) / 2, s = b.side;
  wallX(b.x, 0, b.h, z0, z1, col(b.rgb, zm, 0.75));
  if (b.windows && z0 < 35) {
    const night = env.light < 0.7;
    for (let wz = b.z0 + 0.8; wz < b.z1 - 0.9; wz += 1.6) {
      const z = cz(wz);
      if (z < NEAR || z > FAR) continue;
      for (let y = 1.4, n = 0; y < b.h - 0.6; y += 1.3, n++) {
        const lit = night && (Math.floor(wz * 7) + n * 3) % 4 === 0;
        wallX(b.x - s * 0.01, y, y + 0.7, z, z + 0.8, lit ? "#ffd86b" : col(GLASS, z));
      }
    }
  }
  if (b.graffiti) {
    const g = b.graffiti, gz = cz(b.z0 + g.at * (b.z1 - b.z0));
    if (gz > NEAR) {
      wallX(b.x - s * 0.02, 0.3, 0.3 + g.h, gz, gz + g.w, col(g.c, gz));
      wallX(b.x - s * 0.03, 0.45, 0.3 + g.h * 0.6, gz + g.w * 0.2, gz + g.w * 0.7, col(g.c2, gz));
    }
  }
  if (b.h < camY) wallY(b.h, b.x, b.x + s * 12, z0, z1, col(b.rgb, zm, 1.1));
  if (!clipped) wallZ(z0, Math.min(b.x, b.x + s * 12), Math.max(b.x, b.x + s * 12), 0, b.h, col(b.rgb, z0));
}

function drawPolesAndWires() {
  for (const p of poles) {
    const z = cz(p);
    if (z < NEAR || z > FAR) continue;
    for (const s of [-1, 1]) {
      wallZ(z, s * 1.85 - 0.05, s * 1.85 + 0.05, 0, 3.4, col(POLE, z));
      wallZ(z, Math.min(s * 1.85, s * 1.3), Math.max(s * 1.85, s * 1.3), 3.3, 3.4, col(POLE, z));
    }
  }
  ctx.strokeStyle = "rgba(20,20,24,0.55)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const s of [-1, 1]) {
    const a = P(s * 1.4, 3.3, NEAR + 0.4), b = P(s * 1.4, 3.3, FAR);
    ctx.moveTo(a[0], a[1]);
    ctx.lineTo(b[0], b[1]);
  }
  ctx.stroke();
}

function drawTrain(o) {
  let z0 = cz(o.wz), z1 = Math.min(cz(o.wz + o.len), FAR);
  if (z1 < NEAR || z0 > FAR) return;
  const clipped = z0 < NEAR;
  z0 = Math.max(z0, NEAR);
  const x0 = o.x - 0.42, x1 = o.x + 0.42, h = 1.45, zm = (z0 + z1) / 2;
  wallY(h, x0, x1, z0, z1, col(o.rgb, zm, 1.15));
  const sx = camX < x0 ? x0 : camX > x1 ? x1 : null;     // which side face we can see
  if (sx !== null) {
    wallX(sx, 0, h, z0, z1, col(o.rgb, zm, 0.7));
    wallX(sx, 0.8, 1.15, z0, z1, col(GLASS, zm));
    wallX(sx, 0.35, 0.45, z0, z1, col(o.stripe, zm));
    for (let wz = o.wz + 4; wz < o.wz + o.len - 0.5; wz += 4) {   // gaps between cars
      const z = cz(wz);
      if (z > NEAR && z < FAR) wallX(sx, 0, h, z - 0.06, z + 0.06, col([30, 30, 34], z));
    }
  }
  if (!clipped) {
    wallZ(z0, x0, x1, 0, h, col(o.rgb, z0));
    wallZ(z0, x0 + 0.1, x1 - 0.1, 0.85, 1.25, col(GLASS, z0));
    wallZ(z0, x0, x1, 0, 0.12, col([30, 30, 34], z0));
    wallZ(z0, x0 + 0.1, x0 + 0.24, 0.3, 0.42, "#fff6c0");
    wallZ(z0, x1 - 0.24, x1 - 0.1, 0.3, 0.42, "#fff6c0");
  }
}

function drawBarrier(o) {
  const z = cz(o.wz);
  if (z < NEAR || z > FAR) return;
  const x0 = o.x - 0.45, x1 = o.x + 0.45;
  const [y0, y1] = o.type === "low" ? [0.18, 0.5] : [0.8, 1.25];
  const post = col([90, 90, 96], z);
  wallZ(z, x0 + 0.04, x0 + 0.12, 0, y1, post);
  wallZ(z, x1 - 0.12, x1 - 0.04, 0, y1, post);
  wallY(y1, x0, x1, z, z + 0.12, col([240, 240, 240], z, 0.9));
  wallZ(z, x0, x1, y0, y1, col(o.type === "low" ? [220, 50, 40] : [240, 200, 30], z));
  const stripe = col(o.type === "low" ? [245, 245, 245] : [30, 30, 30], z);
  for (let i = 0; i < 4; i++) wallZ(z, x0 + 0.08 + i * 0.22, x0 + 0.17 + i * 0.22, y0, y1, stripe);
}

function drawCoin(c) {
  const z = cz(c.wz);
  if (z < NEAR || z > 40) return;
  const [sx, sy] = P(c.x, c.y, z);
  const r = 0.17 * F / z;
  const w = Math.max(r * Math.abs(Math.cos(t * 5 + c.wz)), 0.8);
  ctx.fillStyle = col([255, 205, 40], z);
  ctx.beginPath();
  ctx.ellipse(sx, sy, w, r, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = col([255, 245, 170], z);
  ctx.beginPath();
  ctx.ellipse(sx, sy, w * 0.5, r * 0.55, 0, 0, Math.PI * 2);
  ctx.fill();
}

function drawPlayer() {
  const k = F / PLAYER_Z;
  const [gx, gy] = P(player.x, 0, PLAYER_Z);
  ctx.fillStyle = "rgba(0,0,0,0.28)";
  ctx.beginPath();
  ctx.ellipse(gx, gy, 0.32 * k, 0.07 * k, 0, 0, Math.PI * 2);
  ctx.fill();

  const [fx, fy] = P(player.x, player.y, PLAYER_Z);
  ctx.save();
  ctx.translate(fx, fy);
  ctx.scale(k, k);                                  // 1 = one world unit
  ctx.rotate((player.lane - player.x) * 0.3);       // lean into lane changes
  // Drawn from behind; y is measured upwards from the feet.
  const rect = (c, x, y, w, h) => { ctx.fillStyle = col(c, 0); ctx.fillRect(x, -y - h, w, h); };
  const circle = (c, x, y, r) => {
    ctx.fillStyle = col(c, 0);
    ctx.beginPath(); ctx.arc(x, -y, r, 0, Math.PI * 2); ctx.fill();
  };
  if (player.rollT >= 0) {
    const a = player.rollT * 16;
    circle(HOODIE, 0, 0.28, 0.28);
    circle(BACKPACK, Math.cos(a) * 0.14, 0.28 + Math.sin(a) * 0.14, 0.1);
    circle(CAP, Math.cos(a + 2.5) * 0.15, 0.28 + Math.sin(a + 2.5) * 0.15, 0.08);
    ctx.restore();
    return;
  }
  const air = player.jumpT >= 0;
  const sw = air ? 0 : Math.sin(player.phase);
  const base = air ? 0.12 : 0, legH = air ? 0.33 : 0.45;
  const lA = Math.max(0, sw) * 0.14, lB = Math.max(0, -sw) * 0.14;
  rect(JEANS, -0.15, base + lA, 0.12, legH - lA);
  rect(JEANS, 0.03, base + lB, 0.12, legH - lB);
  rect(SHOES, -0.16, base + lA, 0.14, 0.07);
  rect(SHOES, 0.02, base + lB, 0.14, 0.07);
  const armY = air ? 0.72 : 0.5;
  rect(HOODIE_DARK, -0.27, armY + sw * 0.07, 0.09, 0.3);
  rect(HOODIE_DARK, 0.18, armY - sw * 0.07, 0.09, 0.3);
  rect(HOODIE, -0.19, 0.42, 0.38, 0.46);
  rect(BACKPACK, -0.13, 0.5, 0.26, 0.28);
  rect(HOODIE_DARK, -0.12, 0.84, 0.24, 0.07);
  rect(SKIN, -0.16, 0.95, 0.04, 0.07);
  rect(SKIN, 0.12, 0.95, 0.04, 0.07);
  circle(HAIR, 0, 1.0, 0.14);
  ctx.fillStyle = col(CAP, 0);
  ctx.beginPath(); ctx.arc(0, -1.03, 0.15, Math.PI, 0); ctx.fill();
  rect(CAP, -0.08, 0.93, 0.16, 0.06);               // backwards cap brim
  ctx.restore();
}

function drawHud() {
  const fs = Math.round(IH * 0.05);
  const top = Math.round(IH * 0.09);                // leave room for the close button
  ctx.font = `bold ${fs}px system-ui, sans-serif`;
  ctx.lineJoin = "round";
  ctx.lineWidth = 3;
  ctx.strokeStyle = "rgba(0,0,0,0.75)";
  const text = (s, x, y, fill, align) => {
    ctx.textAlign = align;
    ctx.strokeText(s, x, y);
    ctx.fillStyle = fill;
    ctx.fillText(s, x, y);
  };
  text(String(Math.floor(score)).padStart(6, "0"), IW - 8, top + fs, "#fff", "right");
  text(String(coins), IW - 8, top + 4 + fs * 2, "#ffd84a", "right");
  const cw = ctx.measureText(String(coins)).width;
  ctx.fillStyle = "#ffd84a";
  ctx.beginPath();
  ctx.arc(IW - 16 - cw, top + 4 + fs * 1.65, fs * 0.33, 0, Math.PI * 2);
  ctx.fill();
  text(`x${multiplier()}`, 8, 8 + fs, "#9cf36b", "left");
}

function drawCrash() {
  if (crash.t < 0.15) {
    ctx.fillStyle = `rgba(255,255,255,${1 - crash.t / 0.15})`;
    ctx.fillRect(0, 0, IW, IH);
  }
  if (crash.t > 0.35) {
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    ctx.fillRect(0, 0, IW, IH);
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.font = `bold ${Math.round(IH * 0.08)}px system-ui, sans-serif`;
    ctx.fillText("💥 BONK!", IW / 2, IH * 0.45);
    ctx.font = `bold ${Math.round(IH * 0.045)}px system-ui, sans-serif`;
    ctx.fillText(`score ${Math.floor(score)}  ·  coins ${coins}`, IW / 2, IH * 0.53);
  }
}

function draw() {
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (crash && crash.t < 0.35) ctx.translate(rand(-3, 3), rand(-3, 3));
  drawSky();
  drawTrack();
  scenery.sort((a, b) => b.z0 - a.z0);
  for (const b of scenery) drawBuilding(b);
  drawPolesAndWires();

  // Everything on the tracks, far to near (painter's algorithm).
  const items = [];
  for (const o of obstacles) items.push([Math.max(cz(o.wz), NEAR), o]);
  for (const c of coinList) items.push([cz(c.wz), c]);
  items.push([PLAYER_Z, player]);
  items.sort((a, b) => b[0] - a[0]);
  for (const [, it] of items) {
    if (it === player) drawPlayer();
    else if (it.type === "train") drawTrain(it);
    else if (it.type) drawBarrier(it);
    else drawCoin(it);
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawHud();
  if (crash) drawCrash();
  if (paused) {
    ctx.fillStyle = "rgba(0,0,0,0.4)";
    ctx.fillRect(0, 0, IW, IH);
    const r = IH * 0.06;
    ctx.fillStyle = "#fff";
    ctx.beginPath();
    ctx.moveTo(IW / 2 - r * 0.7, IH / 2 - r);
    ctx.lineTo(IW / 2 + r, IH / 2);
    ctx.lineTo(IW / 2 - r * 0.7, IH / 2 + r);
    ctx.fill();
  }
}

// ---- Main loop, pausing & show/hide ---------------------------------------
let paused = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
let onScreen = true, rafId = 0, lastTime = 0;

function tick(now) {
  rafId = requestAnimationFrame(tick);
  if (now - lastTime < 1000 / FPS - 2) return;
  const dt = Math.min((now - lastTime) / 1000, 0.1);
  lastTime = now;
  // Substeps keep fast movement from skipping over thin barriers.
  const steps = Math.ceil(dt * 60);
  for (let i = 0; i < steps; i++) update(dt / steps);
  draw();
}

function setRunning() {
  const run = !paused && onScreen && !aside.hidden && !document.hidden;
  if (run && !rafId) {
    lastTime = performance.now();
    rafId = requestAnimationFrame(tick);
  } else if (!run && rafId) {
    cancelAnimationFrame(rafId);
    rafId = 0;
  }
  if (!run && !aside.hidden) draw();
}

function setHidden(hidden) {
  aside.hidden = hidden;
  openBtn.hidden = !hidden;
  try { localStorage.setItem(STORAGE_KEY, hidden ? "1" : "0"); } catch (e) { /* storage unavailable */ }
  if (!hidden) resize();
  setRunning();
}

canvas.addEventListener("click", () => { paused = !paused; setRunning(); });
closeBtn.addEventListener("click", () => setHidden(true));
openBtn.addEventListener("click", () => setHidden(false));
document.addEventListener("visibilitychange", setRunning);
new ResizeObserver(() => { resize(); if (!rafId && !aside.hidden) draw(); }).observe(canvas);
new IntersectionObserver(entries => {
  onScreen = entries[entries.length - 1].isIntersecting;
  setRunning();
}).observe(canvas);

let startHidden = false;
try { startHidden = localStorage.getItem(STORAGE_KEY) === "1"; } catch (e) { /* storage unavailable */ }
resize();
reset();
setHidden(startHidden);
})();
