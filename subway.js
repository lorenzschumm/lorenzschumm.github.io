"use strict";
// A subway-surfer-style endless runner that plays itself, drawn on a small
// canvas as a joke "gameplay" subscreen. Everything is generated at random in
// the browser: no assets, no server, no loops that repeat.
//
// World coordinates: x = sideways (lanes at -1, 0, 1), y = up, and "wz" =
// distance along the track. The player runs at wz = dist; the camera sits
// PLAYER_Z behind and CAM_H above, and projects with a simple pinhole model.
// Scenery comes in stretches ("biomes": city, tunnel, bridge, park, station);
// sky effects (sun, moon, clouds, birds, planes, fireworks) and all the
// "juice" (popups, particles, flying coins) are drawn in screen space.

(() => {
const aside    = document.getElementById("subway");
const canvas   = document.getElementById("subway-canvas");
const closeBtn = document.getElementById("subway-close");
const openBtn  = document.getElementById("subway-open");
const ctx = canvas.getContext("2d");

// ---- Tunable constants ---------------------------------------------------
const IH         = 360;    // internal render height (px); width follows the box
const LANES      = [-1, 0, 1];
const PLAYER_Z   = 2.4;    // camera-to-player distance
const CAM_H      = 3.0;    // camera height (looks down on train roofs)
const NEAR       = 0.35;   // near clip distance
const FAR        = 55;     // draw / spawn distance
const FOG_START  = 18;
const DETAIL_Z   = 26;     // small details are only drawn closer than this
const FPS        = 30;     // plenty for a joke, easy on batteries
const GRAVITY    = 26.7;   // with JUMP_V: a 1.2-unit jump lasting 0.6 s
const JUMP_V     = 8;
const ROLL_T     = 0.6;    // seconds
const TRAIN_H    = 1.45;
const RAMP_LEN   = 3;
const TUNNEL_H   = 3.8;
const TUNNEL_LIGHT = 0.6;  // tunnels are lit the same day or night
const PLATFORM_H = 0.9;
const DAY_CYCLE  = 120;    // seconds for a full day → sunset → night → dawn
const MAGNET_T   = 10;     // seconds a coin magnet lasts
const BOOST_T    = 15;     // seconds a 2x score boost lasts
const STORAGE_KEY = "subway-hidden";
const BEST_KEY    = "subway-best";

// ---- Palette ---------------------------------------------------------------
const GROUND   = [128, 124, 116];
const SIDEWALK = [150, 146, 138];
const BED      = [112, 94, 80];
const SLEEPER  = [88, 62, 44];
const RAIL     = [196, 196, 206];
const CONCRETE = [172, 170, 162];
const POLE     = [70, 74, 82];
const GLASS    = [38, 48, 70];
const DARK     = [30, 30, 34];
const METAL    = [150, 154, 162];
const STONE    = [118, 110, 102];
const WATER    = [52, 112, 170];
const GRASS    = [96, 150, 70];
const TRUNK    = [100, 70, 45];
const WOOD     = [176, 124, 70];
const TILE     = [226, 220, 204];
const PLATFORM = [186, 182, 172];
const WHITE    = [245, 245, 245];
const YELLOW   = [240, 200, 40];
const TUNNEL_FOG = [26, 26, 34];
const TRAIN_COLORS = [[208, 60, 50], [58, 112, 196], [232, 182, 44], [70, 152, 94], [196, 198, 206]];
const CARGO_COLORS = [[150, 70, 50], [96, 96, 106], [60, 92, 132], [172, 122, 60], [120, 60, 80]];
const BUILDING_COLORS = [[176, 76, 60], [214, 186, 140], [86, 140, 150], [140, 140, 152],
                         [122, 92, 152], [210, 132, 72], [92, 122, 84], [200, 200, 190]];
const GLASSES  = [[38, 48, 70], [52, 80, 110], [70, 60, 50], [40, 70, 80]];
const FRAMES   = [[235, 230, 220], [60, 60, 66], [150, 110, 80], [200, 200, 205]];
const AWNINGS  = [[220, 60, 60], [40, 140, 200], [60, 170, 90], [240, 180, 40], [200, 90, 160]];
const GRAFFITI = [[255, 70, 160], [60, 220, 255], [255, 230, 40], [120, 255, 100], [255, 120, 40]];
const NEON     = [[255, 60, 170], [60, 240, 255], [255, 230, 60], [140, 255, 90], [255, 110, 60]];
const LEAVES   = [[60, 130, 60], [82, 150, 62], [48, 110, 72], [120, 160, 60], [190, 120, 50]];
const FLOWERS  = [[255, 90, 110], [255, 220, 80], [240, 240, 255], [200, 120, 255], [255, 150, 60]];
const BIN_COLORS = [[70, 110, 80], [80, 84, 92], [40, 90, 150]];
const BAG_COLORS = [[40, 40, 44], [30, 60, 40], [70, 70, 76]];
const PIGEON_COLORS = [[150, 150, 162], [120, 120, 132], [175, 170, 170]];
const FW_COLORS = [[255, 80, 80], [255, 210, 60], [90, 200, 255], [160, 255, 120], [255, 120, 230], [255, 255, 255]];
const OUTFITS = {
  hoodie: [[40, 120, 220], [220, 60, 70], [60, 170, 90], [240, 150, 40], [150, 80, 200], [50, 50, 60]],
  pants:  [[44, 60, 112], [40, 40, 46], [110, 100, 80], [70, 90, 120]],
  cap:    [[245, 200, 40], [240, 240, 240], [230, 60, 60], [40, 40, 60], [60, 200, 220]],
  shoes:  [[240, 64, 64], [250, 250, 250], [60, 220, 120], [255, 200, 40]],
  pack:   [[250, 140, 40], [60, 60, 70], [230, 70, 150], [90, 200, 230]],
  hair:   [[70, 46, 30], [30, 26, 24], [200, 150, 70], [150, 60, 40]],
  hat:    ["cap", "cap", "beanie", "none"],
  phones: [false, false, true],
};
const SKIN = [236, 190, 156];
const STATION_NAMES = ["SCROLL AVE", "SNACK ST", "DEADLINE SQ", "COFFEE JCT", "BRAINROT BLVD",
                       "LOOP ST", "COMMIT CIRCLE", "MERGE CONFLICT", "404 STATION", "HELLO THERE"];
const SKY = [                                              // keyframes of the day cycle
  { top: [70, 160, 255],  bot: [200, 235, 255], light: 1.0 },   // day
  { top: [70, 160, 255],  bot: [200, 235, 255], light: 1.0 },
  { top: [250, 110, 90],  bot: [255, 200, 140], light: 0.85 },  // sunset
  { top: [14, 20, 60],    bot: [60, 60, 120],   light: 0.55 },  // night
  { top: [14, 20, 60],    bot: [60, 60, 120],   light: 0.55 },
  { top: [130, 120, 210], bot: [255, 180, 190], light: 0.8 },   // dawn
];

// ---- Helpers ---------------------------------------------------------------
const rand    = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));
const pick    = arr => arr[Math.floor(Math.random() * arr.length)];
const clamp   = (v, a, b) => (v < a ? a : v > b ? b : v);
const rgb     = c => `rgb(${c[0] | 0},${c[1] | 0},${c[2] | 0})`;
const rgba    = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
const mixRgb  = (a, b, s) => a.map((c, i) => c + (b[i] - c) * s);
const hash    = (a, b = 0) => { const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453; return s - Math.floor(s); };
const easeOutBack = u => 1 + 2.7 * (u - 1) ** 3 + 1.7 * (u - 1) ** 2;
const TAU = Math.PI * 2;

// ---- Sky decorations (persist across runs) ---------------------------------
const STARS = Array.from({ length: 50 }, () => [Math.random(), Math.random() * 0.9]);
const SKYLINE = [];                     // [x, width, height] as fractions of the view
for (let x = 0; x < 1; ) { const w = rand(0.025, 0.07); SKYLINE.push([x, w, rand(0.02, 0.09), Math.random() < 0.2]); x += w; }
const clouds = Array.from({ length: 5 }, () => ({ x: rand(-0.2, 1.2), y: rand(0.08, 0.5), s: rand(0.6, 1.3), v: rand(0.004, 0.012) }));
let birds = null, birdNext = rand(8, 25);
let plane = null, planeNext = rand(15, 45);
let shooting = null;
let rockets = [], sparks = [], fwNext = rand(10, 30);

// ---- Canvas sizing & projection -------------------------------------------
let IW = 200, F = 144, CX = 100, HOR = 130;
let camX = 0, camY = CAM_H, fovKick = 0, shake = 0;
let t = rand(0, DAY_CYCLE * 0.25);   // global clock (day cycle keeps going across runs)
let env = skyAt(t);

function resize() {
  const r = canvas.getBoundingClientRect();
  if (!r.width || !r.height) return;
  IW = clamp(Math.round(IH * r.width / r.height), 110, 1000);
  if (canvas.width !== IW || canvas.height !== IH) { canvas.width = IW; canvas.height = IH; }
  setProjection();
}

// fovKick briefly widens the view (speed-ups, power-ups) for a sense of rush.
function setProjection() {
  F = IH * 0.4 * (1 - fovKick * 0.1);
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
  return { top: mixRgb(a.top, b.top, s), bot: mixRgb(a.bot, b.bot, s), light: a.light + (b.light - a.light) * s };
}

function inTunnel(wz) {
  return zones.some(zn => zn.kind === "tunnel" && wz > zn.z0 + 0.5 && wz < zn.z1);
}
function zoneOverlaps(kinds, a, b) {
  return zones.some(zn => kinds.includes(zn.kind) && zn.z0 < b && zn.z1 > a);
}

// A colour lit by the time of day (or tunnel lamps) and fogged by depth z.
function col(c, z, mul = 1) {
  const tunnel = inTunnel(z + dist - PLAYER_Z);
  const l = mul * (tunnel ? TUNNEL_LIGHT : env.light), fc = tunnel ? TUNNEL_FOG : env.bot;
  const f = clamp((z - FOG_START) / (FAR - FOG_START), 0, 1);
  return `rgb(${(Math.min(255, c[0] * l) * (1 - f) + fc[0] * f) | 0},` +
             `${(Math.min(255, c[1] * l) * (1 - f) + fc[1] * f) | 0},` +
             `${(Math.min(255, c[2] * l) * (1 - f) + fc[2] * f) | 0})`;
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
  const a = P(Math.min(x0, x1), y1, z), b = P(Math.max(x0, x1), y0, z);
  ctx.fillStyle = fill;
  ctx.fillRect(a[0], a[1], b[0] - a[0], b[1] - a[1]);
}
function disc(x, y, r, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.arc(x, y, Math.max(r, 0.5), 0, TAU);
  ctx.fill();
}
function ellipse(x, y, rx, ry, fill) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(x, y, Math.max(rx, 0.5), Math.max(ry, 0.5), 0, 0, TAU);
  ctx.fill();
}
// A flat ellipse lying on the ground (puddles, stains, manholes).
function flatEllipse(x, y, wz, rx, rz, fill) {
  const pts = [];
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * TAU, z = cz(wz + Math.sin(a) * rz);
    if (z < NEAR) return;
    pts.push(P(x + Math.cos(a) * rx, y, z));
  }
  poly(pts, fill);
}
function line3(a, b) {                 // adds a projected segment to the current path
  ctx.moveTo(a[0], a[1]);
  ctx.lineTo(b[0], b[1]);
}

// ---- World state -----------------------------------------------------------
let dist, speed, runTime, score, coins, magnetT, boostT;
let obstacles, coinList, pickups, rows, scenery, decor, poles, zones = [], particles;
let safeLane, laneBusy, nextRowZ, lastRowZ, segEnd, biome, poleNext;
let player, outfit, crash, blunder, nextBlunder;
let popups = [], floaters = [], flyCoins = [];
let streak, lastCoinT, lastMult, nextSpeedTier, nextDistMark, beatBest, cooldown;
let scorePunch = 0, coinPunch = 0;
let best = 0;
try { best = Number(localStorage.getItem(BEST_KEY)) || 0; } catch (e) { /* storage unavailable */ }

function reset() {
  dist = 0; speed = 9; runTime = 0; score = 0; coins = 0; magnetT = 0; boostT = 0;
  obstacles = []; coinList = []; pickups = []; rows = []; scenery = []; decor = []; poles = []; zones = []; particles = [];
  popups = []; floaters = []; flyCoins = [];
  streak = 0; lastCoinT = -9; lastMult = 1; nextSpeedTier = 11; nextDistMark = 500; beatBest = false;
  cooldown = { nice: 0, close: 0, roof: 0, trick: 0 };
  safeLane = pick(LANES);
  laneBusy = [-99, -99, -99];        // per lane: track position until which it's occupied
  lastRowZ = 6; nextRowZ = 16;
  segEnd = -PLAYER_Z - 6;
  biome = Math.random() < 0.5 ? "city" : "start";
  poleNext = 2;
  outfit = Object.fromEntries(Object.entries(OUTFITS).map(([k, v]) => [k, pick(v)]));
  player = { x: safeLane, lane: safeLane, y: 0, vy: 0, rollT: -1, phase: 0, squash: 0, trick: -1, onRoof: false };
  camX = player.x * 0.55;
  camY = CAM_H;
  crash = null;
  blunder = false;
  nextBlunder = rand(35, 110);       // the bot "messes up" now and then, like real footage
  populate();
  announce("GO!", "#9cf36b", { life: 0.9 });
}

// ---- Events: banners, floating text, flying coins --------------------------
function announce(text, color, opts = {}) {
  if (popups.some(p => p.text === text) || popups.length >= 3) return;
  popups.push({ text, color, sub: opts.sub || "", t: 0, life: opts.life || 1.5 });
}
function floater(text, color, x, y) {
  floaters.push({ text, color, x, y, t: 0, life: 0.9 });
}
function addScore(n) {
  score += n * multiplier();
  scorePunch = 1;
}

// ---- Obstacle generation ---------------------------------------------------
function busy(lane, until) { laneBusy[lane + 1] = Math.max(laneBusy[lane + 1], until); }

function addObstacle(type, lane, wz, len = 0.15) {
  const variant = type === "low" ? pick(["board", "crates", "hurdle"]) : type === "high" ? pick(["bar", "sign"]) : type;
  obstacles.push({ type, variant, x: lane, wz, len });
  busy(lane, wz + len + 0.3);
}

function addTrain(lane, wz, len, v = 0) {
  const style = Math.random() < 0.35 ? "cargo" : "passenger";
  const o = {
    type: "train", x: lane, wz, len, v, style, seed: Math.random() * 100,
    rgb: pick(style === "cargo" ? CARGO_COLORS : TRAIN_COLORS),
    stripe: pick(GRAFFITI),
    graffiti: Math.random() < 0.6 ? { c: pick(GRAFFITI), c2: pick(GRAFFITI), at: rand(0.05, 0.5), w: rand(1.5, 3), h: rand(0.5, 0.9) } : null,
  };
  if (v) {
    // Oncoming train: start it further out so that it *meets* the player at wz,
    // and keep its lane clear behind it so it never drives through anything.
    o.wz = dist + (wz - dist) * (speed + v) / speed;
    busy(lane, o.wz + len + 2);
  }
  obstacles.push(o);
  busy(lane, wz + len);
  if (!v && Math.random() < 0.35) {                      // coins on the roof
    for (let z = wz + 1; z < wz + len - 1; z += 1.3) addCoin(lane, z, TRAIN_H + 0.4);
  }
}

function addRampTrain(lane, wz, len) {
  obstacles.push({ type: "ramp", x: lane, wz, len: RAMP_LEN });
  addTrain(lane, wz + RAMP_LEN, len);
}

// `base` is the surface the coin hovers over (for its shadow).
function addCoin(lane, wz, y = 0.4, base = y - 0.4) {
  coinList.push({ x: lane, wz, y, base, taken: false, pull: false });
}

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
    if (r < 0.14)      addTrain(l, wz, rand(6, 14), rand(4, 7));      // oncoming
    else if (r < 0.34) addTrain(l, wz, rand(5, 16));
    else if (r < 0.42) addRampTrain(l, wz, rand(6, 14));
    else if (r < 0.52) addObstacle("block", l, wz, 0.5);
    else if (r < 0.66) addObstacle("low", l, wz);
    else if (r < 0.78) addObstacle("high", l, wz);
  }
  // The safe lane: a barrier to jump/roll, a ramp up onto a train, or a pickup.
  let trailEnd = wz - 1.5;
  const free = laneBusy[safeLane + 1] < wz - 4;
  const r = Math.random();
  if (free && r < 0.3) {
    const type = Math.random() < 0.55 ? "low" : "high";
    addObstacle(type, safeLane, wz);
    if (type === "low") {                       // coin arc over the jump
      for (let i = -2; i <= 2; i++) addCoin(safeLane, wz + i * 1.1, 0.4 + 0.9 * (1 - (i / 2.6) ** 2), 0);
      trailEnd = wz - 3;
    } else {
      trailEnd = wz - 2;
    }
  } else if (free && r < 0.46) {
    const len = rand(8, 18);
    addRampTrain(safeLane, wz, len);
    for (let z = wz + 0.4; z < wz + RAMP_LEN + len - 0.8; z += 1.3) {
      addCoin(safeLane, z, (z < wz + RAMP_LEN ? TRAIN_H * (z - wz) / RAMP_LEN : TRAIN_H) + 0.4);
    }
  } else if (free && r < 0.53 && !pickups.length) {
    const kind = magnetT <= 0 && Math.random() < 0.6 ? "magnet" : "box";
    pickups.push({ kind, x: safeLane, wz, y: 0.6 });
    trailEnd = wz - 2;
  }
  if (Math.random() < 0.65) {                   // coin trail leading the way (onto roofs, too)
    for (let z = gapStart + (moved ? 3 : 1.5); z < trailEnd; z += 1.3) {
      const g = groundAt(safeLane, z);
      addCoin(safeLane, z, g + 0.4, g);
    }
  }
  rows.push({ wz, safe: safeLane, react: rand(0.45, 0.9) });
  lastRowZ = wz;
}

// ---- Scenery generation ----------------------------------------------------
function spawnScenery() {
  while (segEnd < dist + FAR) {
    const z0 = segEnd;
    biome = biome === "city"
      ? pick(["tunnel", "bridge", "bridge", "park", "park", "station", "station", "city"])
      : "city";
    const z1 = z0 + { city: rand(60, 140), tunnel: rand(25, 45), bridge: rand(30, 55), park: rand(40, 80), station: rand(30, 45) }[biome];
    zones.push({ kind: biome, z0, z1 });
    if (biome === "city") { fillCity(-1, z0, z1); fillCity(1, z0, z1); }
    else if (biome === "park") fillPark(z0, z1);
    else if (biome === "tunnel") scenery.push({ kind: "tunnel", z0, z1 });
    else if (biome === "station") fillStation(z0, z1);
    else {
      scenery.push({
        kind: "bridge", z0, z1, rgb: pick([[70, 90, 110], [150, 60, 50], [60, 110, 90]]),
        glints: Array.from({ length: 14 }, () => [pick([-1, 1]) * rand(2.5, 12), rand(z0, z1), rand(0, TAU)]),
        boats: Array.from({ length: randInt(0, 2) }, () => ({
          x: pick([-1, 1]) * rand(5, 12), wz: rand(z0 + 5, z1 + 10), v: rand(-1.5, 2.5),
          sail: Math.random() < 0.5, c: pick([[240, 240, 240], [200, 60, 50], [60, 90, 160]]),
        })),
      });
    }
    fillDecor(biome, z0, z1);
    segEnd = z1;
  }
  while (poleNext < dist + FAR) {
    if (!zoneOverlaps(["tunnel", "station"], poleNext - 1, poleNext + 1)) {
      poles.push({ wz: poleNext, signal: Math.random() < 0.2 ? pick(["#ff3b30", "#38e06a"]) : null });
    }
    poleNext += 9;
  }
}

function fillCity(side, z0, z1) {
  for (let z = z0; z < z1 - 1.5; ) {
    if (Math.random() < 0.1) { z += rand(2, 4); continue; }        // alley gap
    const len = Math.min(rand(4, 11), z1 - z);
    const low = Math.random() < 0.12;                              // low wall
    const h = low ? rand(0.8, 1.3) : rand(3, 7.5);
    const b = {
      kind: "building", side, z0: z, z1: z + len - (Math.random() < 0.3 ? rand(0.3, 1) : 0),
      x: side * rand(2.35, 2.8), h, low, seed: Math.random() * 1000,
      rgb: pick(BUILDING_COLORS),
      tex: pick(["brick", "brick", "panel", "plain"]),
      win: low ? null : { w: rand(0.45, 0.85), h: rand(0.55, 0.9), dz: rand(1.3, 2.0), dy: rand(1.1, 1.5),
                          glass: pick(GLASSES), frame: pick(FRAMES), ledge: Math.random() < 0.4 },
      shop: !low && Math.random() < 0.4 ? pick(AWNINGS) : null,
      billboard: !low && h > 4.2 && Math.random() < 0.3
        ? { c: pick(AWNINGS), c2: pick(GRAFFITI), at: rand(0.1, 0.4), w: Math.min(rand(2, 3.5), len * 0.6) } : null,
      graffiti: Math.random() < 0.5
        ? { c: pick(GRAFFITI), c2: pick(GRAFFITI), at: rand(0.1, 0.5), w: rand(1.2, 3), h: rand(0.5, 1.1) } : null,
      pipe: !low && Math.random() < 0.5 ? z + (Math.random() < 0.5 ? 0.15 : len - 0.6) : null,
      roof: !low && Math.random() < 0.5 ? { kind: pick(["tank", "antenna", "chimney"]), at: rand(0.2, 0.8) } : null,
      deco: [],
    };
    if (!low) decorateBuilding(b);
    scenery.push(b);
    z += len;
  }
}

// Wall decorations snapped to the window grid (AC units, flower boxes,
// fire escapes) plus doors, posters and neon signs at street level.
function decorateBuilding(b) {
  const w = b.win, yStart = b.shop ? 1.9 : 1.2;
  const cols = Math.max(1, Math.floor((b.z1 - b.z0 - 1) / w.dz));
  const rowsN = Math.max(1, Math.floor((b.h - 0.4 - yStart) / w.dy));
  const at = () => [b.z0 + 0.6 + randInt(0, cols - 1) * w.dz, yStart + randInt(0, rowsN - 1) * w.dy];
  for (let i = randInt(0, 3); i > 0; i--) { const [wz, y] = at(); b.deco.push({ type: "ac", wz: wz + w.w * 0.1, y: y - 0.42 }); }
  if (Math.random() < 0.5) {
    const c = pick(FLOWERS);
    for (let i = randInt(1, 4); i > 0; i--) { const [wz, y] = at(); b.deco.push({ type: "flowers", wz, y, w: w.w, c }); }
  }
  if (Math.random() < 0.3 && cols >= 2 && rowsN >= 2) {
    const c0 = randInt(0, cols - 2);
    b.deco.push({ type: "fire", wz: b.z0 + 0.3 + c0 * w.dz, w: w.dz + w.w + 0.6, ys: Array.from({ length: rowsN - 1 }, (_, i) => yStart + (i + 1) * w.dy - 0.12) });
  }
  if (!b.shop) {
    for (let i = randInt(0, 2); i > 0; i--) b.deco.push({ type: "door", wz: rand(b.z0 + 0.4, b.z1 - 1.2), c: pick([...AWNINGS, [80, 60, 50], [50, 50, 56]]) });
  }
  for (let i = randInt(0, 2); i > 0; i--) b.deco.push({ type: "poster", wz: rand(b.z0 + 0.3, b.z1 - 1), c1: pick([WHITE, YELLOW, [250, 220, 200]]), c2: pick(AWNINGS) });
  if (Math.random() < 0.35) b.deco.push({ type: "neon", wz: rand(b.z0 + 0.3, b.z1 - 1.8), y: b.shop ? 1.58 : rand(1.6, 2.4), w: rand(0.8, 1.6), c: pick(NEON) });
  b.deco.sort((a, c) => c.wz - a.wz);                  // far to near, for overlapping protrusions
}

function fillPark(z0, z1) {
  scenery.push({ kind: "grass", z0, z1 });
  for (const side of [-1, 1]) {
    for (let z = z0 + rand(0, 3); z < z1; z += rand(2, 5)) {
      const r = rand(0.7, 1.25);
      // Keep canopies clear of the track: trunk far enough out that leaves stop at ~x=1.8.
      scenery.push({ kind: "tree", side, z0: z, z1: z, x: side * rand(2.6 + r * 0.4, 6.5), h: rand(1.8, 3.4), r, leaf: pick(LEAVES) });
      if (Math.random() < 0.35) scenery.push({ kind: "bush", side, z0: z + 1, z1: z + 1, x: side * rand(3.2, 4.5), leaf: pick(LEAVES) });
    }
    for (let z = z0 + 4; z < z1; z += 10) scenery.push({ kind: "lamp", side, z0: z, z1: z, x: side * 1.95 });
  }
}

function fillStation(z0, z1) {
  const things = [];
  const color = pick([[200, 60, 50], [40, 110, 190], [60, 150, 90], [230, 170, 40]]);
  for (const side of [-1, 1]) {
    for (let z = z0 + 2; z < z1 - 1; z += 5) things.push({ kind: "pillar", side, wz: z });
    for (let z = z0 + 4; z < z1 - 3; z += rand(6, 9)) things.push({ kind: "bench", side, wz: z });
    for (let z = z0 + 6; z < z1 - 2; z += rand(10, 14)) things.push({ kind: "sign", side, wz: z });
    for (let z = z0 + 1; z < z1 - 3; z += rand(5, 8)) things.push({ kind: "ad", side, wz: z, c: pick(AWNINGS), c2: pick(GRAFFITI) });
    for (let n = randInt(2, 6); n > 0; n--) {
      things.push({ kind: "person", side, wz: rand(z0 + 1, z1 - 1), x: side * rand(2.2, 4.8), h: rand(0.8, 1.0),
                    c: pick(OUTFITS.hoodie), hair: pick(OUTFITS.hair), ph: rand(0, TAU) });
    }
  }
  things.sort((a, b) => b.wz - a.wz);
  scenery.push({ kind: "station", z0, z1, color, name: pick(STATION_NAMES), things, announced: false });
}

// Small stuff on the ground: litter, puddles, sidewalk props and pigeons.
function fillDecor(kind, z0, z1) {
  if (kind === "bridge") return;
  const nearPole = z => { const m = (((z - 2) % 9) + 9) % 9; return m < 0.8 || m > 8.2; };
  for (let z = z0 + rand(0, 4); z < z1; z += rand(2, 5)) {
    const r = Math.random(), side = pick([-1, 1]);
    const gap = pick([-1.5, -0.5, 0.5, 1.5]);                   // between the lanes
    if (r < 0.22) decor.push({ kind: "puddle", x: gap, wz: z, rx: rand(0.1, 0.18), rz: rand(0.4, 0.9) });
    else if (r < 0.34) decor.push({ kind: "paper", x: gap + rand(-0.05, 0.05), wz: z, a: rand(0, TAU) });
    else if (r < 0.44) decor.push({ kind: "stain", x: pick(LANES) + rand(-0.08, 0.08), wz: z, rx: rand(0.08, 0.15), rz: rand(0.2, 0.5) });
    else if (r < 0.56 && kind !== "tunnel" && kind !== "station") {
      for (let n = randInt(2, 4); n > 0; n--) {
        decor.push({ kind: "pigeon", x: side * rand(1.65, 2.2), wz: z + rand(-0.6, 0.6), y: 0, fly: false,
                     flee: rand(3.5, 6), ph: rand(0, TAU), c: pick(PIGEON_COLORS), dir: pick([-1, 1]) });
      }
    } else if (kind === "city") {
      if (Math.random() < 0.25) decor.push({ kind: "manhole", x: side * 2.05, wz: z });
      else if (!nearPole(z)) {
        const prop = pick(["hydrant", "bin", "cone", "cone", "bags", "bench", "crate", "mailbox"]);
        decor.push({ kind: prop, side, x: side * (prop === "bench" ? 2.12 : rand(2.0, 2.1)), wz: z,
                     c: prop === "bags" ? pick(BAG_COLORS) : pick(BIN_COLORS) });
      }
    } else if (kind === "park") {
      if (Math.random() < 0.5) decor.push({ kind: "flowers", x: side * rand(2.3, 3.5), wz: z, c: [pick(FLOWERS), pick(FLOWERS)] });
      else if (!nearPole(z)) decor.push({ kind: pick(["bench", "bin"]), side, x: side * 2.25, wz: z, c: pick(BIN_COLORS) });
    }
  }
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
  pickups   = pickups.filter(p => !p.taken && p.wz > behind);
  rows      = rows.filter(r => r.wz > dist - 2);
  scenery   = scenery.filter(b => b.z1 + 12 > behind);             // +12: boats drift past bridge ends
  decor     = decor.filter(d => d.wz > behind - 1 && !(d.y > 8));
  zones     = zones.filter(zn => zn.z1 > behind - 1);
  poles     = poles.filter(p => p.wz > behind);
}

// ---- Player physics & the bot ----------------------------------------------
// Height of whatever the player would stand on (ground, ramp or train roof).
function groundAt(x, wz) {
  let g = 0;
  for (const o of obstacles) {
    if ((o.type !== "train" && o.type !== "ramp") || Math.abs(o.x - x) > 0.45) continue;
    if (wz < o.wz || wz > o.wz + o.len) continue;
    g = Math.max(g, o.type === "train" ? TRAIN_H : TRAIN_H * (wz - o.wz) / o.len);
  }
  return g;
}

function jump(style = false) {
  const above = player.y - groundAt(player.x, dist);
  // From the ground, or bounce again while coming down (back-to-back barriers).
  if ((above < 0.01 && player.vy <= 0) || player.vy < 0) {
    player.vy = JUMP_V;
    player.rollT = -1;
    player.trick = style && Math.random() < 0.4 ? 0 : -1;
  }
}
function roll() {
  if (player.rollT >= 0) return;
  player.rollT = 0;
  player.trick = -1;
  if (player.y > groundAt(player.x, dist) + 0.01) player.vy = Math.min(player.vy, -18);   // slam down
}

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
    if (o.type !== "low" && o.type !== "high") continue;
    const d = o.wz - dist;
    if (d > -0.5 && d < speed * 1.5) barrierAhead = true;          // any lane: we may switch mid-air
    if (Math.abs(o.x - player.x) > 0.5 && o.x !== player.lane) continue;
    if (d > 0 && d < speed * 0.24) (o.type === "low" ? jump : roll)();
  }
  // Style points — but never when a pointless jump could still be airborne at a barrier.
  if (!barrierAhead && player.rollT < 0 && Math.random() < dt * 0.15) jump(true);
}

function hits(o) {
  if (o.type === "ramp" || Math.abs(o.x - player.x) > 0.6) return false;
  const solid = o.type === "train" || o.type === "block";       // dropping down behind these is fine
  if (dist + 0.2 < o.wz || dist - (solid ? 0 : 0.2) > o.wz + o.len) return false;
  if (o.type === "train") return player.y < TRAIN_H - 0.3;
  if (o.type === "block") return player.y < 0.95;
  if (o.type === "low") return player.y < 0.5;
  return player.rollT < 0;
}

// ---- Particles (screen space) ----------------------------------------------
function burst(x, y, n, colors, spd, life, grav = 80, size = 1.5, up = 0.3) {
  for (let i = 0; i < n; i++) {
    const a = rand(0, TAU), v = spd * rand(0.3, 1);
    particles.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - spd * up, life: rand(life * 0.6, life), max: life, c: pick(colors), g: grav, s: size });
  }
}
const DUST = [[200, 196, 188], [170, 162, 150]];
function dust(x, y, n, dir = 0) {
  for (let i = 0; i < n; i++) {
    particles.push({ x: x + rand(-3, 3), y, vx: dir * rand(20, 50) + rand(-15, 15), vy: rand(-25, -5), life: rand(0.2, 0.4), max: 0.4, c: pick(DUST), g: 30, s: rand(1.5, 3) });
  }
}

function launchFireworks(n) {
  for (let i = 0; i < n; i++) {
    rockets.push({ x: rand(0.15, 0.85) * IW, y: HOR, vy: -HOR * rand(1.0, 1.4), top: HOR * rand(0.15, 0.45),
                   c: pick(FW_COLORS), delay: i * rand(0.2, 0.5) });
  }
}

function explodeFirework(r) {
  const n = randInt(18, 30), spd = IH * rand(0.12, 0.2);
  const c2 = Math.random() < 0.4 ? pick(FW_COLORS) : r.c;
  for (let i = 0; i < n; i++) {
    const a = i / n * TAU + rand(-0.1, 0.1), v = spd * rand(0.8, 1.1);
    sparks.push({ x: r.x, y: r.y, px: r.x, py: r.y, vx: Math.cos(a) * v, vy: Math.sin(a) * v,
                  life: rand(0.9, 1.4), max: 1.4, c: i % 2 ? r.c : c2 });
  }
  sparks.push({ flash: true, x: r.x, y: r.y, life: 0.15, max: 0.15, c: [255, 250, 230] });
}

function updateSky(dt) {
  for (const c of clouds) {
    c.x -= c.v * dt;
    if (c.x < -0.3) { c.x = 1.3; c.y = rand(0.08, 0.5); c.s = rand(0.6, 1.3); }
  }
  if ((birdNext -= dt) <= 0) {
    birdNext = rand(20, 45);
    if (env.light > 0.8) birds = { x: -0.1, y: rand(0.15, 0.45), v: rand(0.05, 0.09), n: randInt(3, 6) };
  }
  if (birds && (birds.x += birds.v * dt) > 1.4) birds = null;
  if ((planeNext -= dt) <= 0) {
    planeNext = rand(40, 90);
    const dir = pick([-1, 1]);
    plane = { x: dir > 0 ? -0.1 : 1.1, y: rand(0.1, 0.3), v: dir * rand(0.03, 0.05) };
  }
  if (plane && ((plane.x += plane.v * dt) > 1.2 || plane.x < -0.2)) plane = null;
  if (!shooting && env.light < 0.65 && Math.random() < dt * 0.05) {
    shooting = { x: rand(0.1, 0.9), y: rand(0.05, 0.4), vx: pick([-1, 1]) * rand(0.5, 0.8), vy: rand(0.15, 0.3), life: 0.5 };
  }
  if (shooting) {
    shooting.x += shooting.vx * dt; shooting.y += shooting.vy * dt;
    if ((shooting.life -= dt) <= 0) shooting = null;
  }

  // Small, infrequent fireworks — a bit more often at night.
  if ((fwNext -= dt) <= 0) {
    fwNext = env.light < 0.75 ? rand(12, 30) : rand(35, 80);
    launchFireworks(randInt(1, 3));
  }
  for (const r of rockets) {
    if (r.delay > 0) { r.delay -= dt; continue; }
    r.y += r.vy * dt;
    if (r.y <= r.top) { r.done = true; explodeFirework(r); }
  }
  rockets = rockets.filter(r => !r.done);
  for (const s of sparks) {
    s.life -= dt;
    if (s.flash) continue;
    s.px = s.x; s.py = s.y;
    s.vx *= 1 - 1.8 * dt;
    s.vy = s.vy * (1 - 1.8 * dt) + 25 * dt;
    s.x += s.vx * dt;
    s.y += s.vy * dt;
  }
  sparks = sparks.filter(s => s.life > 0);
}

// Everything that animates in screen space, even while crashed.
function updateJuice(dt) {
  for (const p of particles) {
    p.vy += p.g * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.life -= dt;
  }
  particles = particles.filter(p => p.life > 0);
  if (popups.length && (popups[0].t += dt) > popups[0].life) popups.shift();
  for (const f of floaters) f.t += dt;
  floaters = floaters.filter(f => f.t < f.life);
  for (const c of flyCoins) {
    c.t += dt;
    if (c.t >= 0.45 && !c.done) { c.done = true; coinPunch = 1; }
  }
  flyCoins = flyCoins.filter(c => !c.done);
  scorePunch = Math.max(0, scorePunch - dt * 4);
  coinPunch = Math.max(0, coinPunch - dt * 5);
  shake = Math.max(0, shake - dt * 8);
  fovKick = Math.max(0, fovKick - dt * 1.5);
  for (const k in cooldown) cooldown[k] -= dt;
}

// ---- Simulation ------------------------------------------------------------
function update(dt) {
  t += dt;
  env = skyAt(t);
  updateSky(dt);
  updateJuice(dt);
  if (crash) {
    crash.t += dt;
    if (crash.t > 2.8) reset();
    return;
  }
  runTime += dt;
  speed = 9 + Math.min(7, runTime * 0.07);
  dist += speed * dt;
  score += speed * dt * multiplier();
  boostT = Math.max(0, boostT - dt);
  for (const o of obstacles) if (o.v) o.wz -= o.v * dt;
  for (const b of scenery) if (b.boats) for (const bt of b.boats) bt.wz += bt.v * dt;
  for (const d of decor) {
    if (d.kind !== "pigeon") continue;
    if (!d.fly && d.wz - dist < d.flee) {
      d.fly = true;
      d.vx = Math.sign(d.x) * rand(1.5, 3); d.vy = rand(2.5, 4); d.vz = rand(3, 6);
    }
    if (d.fly) { d.x += d.vx * dt; d.y += d.vy * dt; d.wz += d.vz * dt; d.vy += 1.5 * dt; }
  }
  populate();

  const prevLane = player.lane;
  steer(dt);
  player.x += (player.lane - player.x) * Math.min(1, dt * 14);
  const g = groundAt(player.x, dist);
  const [fx, fy] = P(player.x, g, PLAYER_Z);
  if (player.lane !== prevLane && player.y - g < 0.05) dust(fx, fy, 4, Math.sign(prevLane - player.lane));
  if (player.y > g + 0.001 || player.vy > 0) {
    player.vy -= GRAVITY * dt;
    player.y += player.vy * dt;
    if (player.trick >= 0 && (player.trick += dt / 0.62) >= 1) {
      player.trick = -1;
      if (cooldown.trick <= 0) {
        cooldown.trick = 4;
        addScore(100);
        floater(pick(["TRICK! +100", "SICK! +100", "360! +100"]), "#ff9ff3", fx, fy - IH * 0.18);
      }
    }
    if (player.y <= g) {                            // landing
      if (player.vy < -4) player.squash = 0.14;
      if (player.vy < -7) dust(fx, fy, 6);
      if (player.vy < -12) shake = Math.max(shake, 1.2);
      player.y = g;
      player.vy = 0;
      player.trick = -1;
    }
  } else {
    const before = Math.sin(player.phase);
    player.y = g;                                   // walk up ramps
    if (Math.sign(Math.sin(player.phase + dt * speed * 1.3)) !== Math.sign(before) && Math.random() < 0.5) dust(fx, fy, 1);
  }
  // Never poke through a tunnel ceiling (or its portal) from a train roof.
  if (zoneOverlaps(["tunnel"], dist - 0.5, dist + 0.5) && player.y > TUNNEL_H - 1.15) {
    player.y = TUNNEL_H - 1.15;
    player.vy = Math.min(player.vy, 0);
  }
  if (player.rollT >= 0 && (player.rollT += dt) > ROLL_T) player.rollT = -1;
  player.squash = Math.max(0, player.squash - dt);
  player.phase += dt * speed * 1.3;

  const onRoof = g >= TRAIN_H - 0.01 && player.y <= g + 0.01;
  if (onRoof && !player.onRoof && cooldown.roof <= 0) {
    cooldown.roof = 18;
    floater("ROOFTOP!", "#ffd84a", fx, fy - IH * 0.2);
  }
  player.onRoof = onRoof;

  // Coins, the magnet, and pickups.
  if (magnetT > 0) {
    magnetT -= dt;
    for (const c of coinList) { const d = c.wz - dist; if (d < 8 && d > -1) c.pull = true; }
  }
  const [px, py] = P(player.x, player.y + 0.6, PLAYER_Z);
  for (const c of coinList) {
    if (c.taken) continue;
    if (c.pull) {
      const k = Math.min(1, dt * 9);
      c.x += (player.x - c.x) * k;
      c.y += (player.y + 0.5 - c.y) * k;
      c.wz += (dist - c.wz) * k;
    }
    if (Math.abs(c.x - player.x) < 0.5 && Math.abs(c.wz - dist) < 0.5 && Math.abs(c.y - (player.y + 0.4)) < 0.8) {
      c.taken = true;
      coins++;
      addScore(10);
      if (flyCoins.length < 14) flyCoins.push({ x: px, y: py, t: 0 });
      burst(px, py, 3, [[255, 230, 90], [255, 255, 220]], IH * 0.15, 0.3, 0, 1.5);
      streak = runTime - lastCoinT < 1.4 ? streak + 1 : 1;
      lastCoinT = runTime;
      if ([10, 25, 50, 100, 200].includes(streak)) announce(`${streak}x STREAK!`, "#7df9ff");
    }
  }
  for (const p of pickups) {
    if (p.taken || Math.abs(p.x - player.x) > 0.5 || Math.abs(p.wz - dist) > 0.6) continue;
    p.taken = true;
    fovKick = 1;
    if (p.kind === "magnet") {
      magnetT = MAGNET_T;
      announce("MAGNET!", "#ff6a5a");
      burst(px, py, 12, [[255, 80, 80], [255, 255, 255]], IH * 0.25, 0.5, 0, 2);
    } else if (Math.random() < 0.55) {
      const n = pick([15, 25, 50]);
      coins += n;
      addScore(10 * n);
      for (let i = 0; i < Math.min(n, 14); i++) flyCoins.push({ x: px + rand(-15, 15), y: py + rand(-15, 5), t: -i * 0.04 });
      announce("MYSTERY BOX", "#c89bff", { sub: `+${n} COINS` });
      burst(px, py, 16, [[200, 150, 255], [255, 230, 90], [255, 255, 255]], IH * 0.3, 0.6, 60, 2);
    } else {
      boostT = BOOST_T;
      announce("MYSTERY BOX", "#c89bff", { sub: "2X SCORE!" });
      burst(px, py, 16, [[200, 150, 255], [120, 255, 160], [255, 255, 255]], IH * 0.3, 0.6, 60, 2);
    }
  }

  // Little rewards and announcements.
  for (const o of obstacles) {
    if ((o.type === "low" || o.type === "high") && !o.cleared && o.wz + o.len < dist - 0.3 && Math.abs(o.x - player.x) < 0.5) {
      o.cleared = true;
      addScore(25);
      if (cooldown.nice <= 0 && Math.random() < 0.5) {
        cooldown.nice = 3;
        floater(pick(["NICE!", "SMOOTH!", "WHOOSH!", "CLEAN!"]), "#ffffff", fx, fy - IH * 0.2);
      }
    }
    if (o.v && !o.passed && o.wz < dist) {
      o.passed = true;
      if (Math.abs(o.x - player.x) < 1.3 && cooldown.close <= 0) {
        cooldown.close = 10;
        shake = Math.max(shake, 1.5);
        addScore(50);
        announce("CLOSE CALL!", "#ff6b6b", { sub: "+50" });
      }
    }
  }
  const m = multiplier();
  if (m > lastMult) { lastMult = m; announce(`x${m} MULTIPLIER`, "#9cf36b"); }
  if (speed >= nextSpeedTier) { nextSpeedTier += 2; fovKick = 1; announce("SPEED UP!", "#ff9f43"); }
  if (dist >= nextDistMark) { announce(`${nextDistMark} m`, "#ffffff", { life: 1.1 }); nextDistMark += 500; }
  if (!beatBest && best > 300 && score > best) {
    beatBest = true;
    announce("NEW HIGHSCORE!", "#ffd84a", { life: 2 });
    launchFireworks(4);
    burst(IW / 2, IH * 0.3, 30, FW_COLORS, IH * 0.5, 1.2, 120, 2.5, 0.6);   // confetti
  }
  for (const s of scenery) {
    if (s.kind === "station" && !s.announced && s.z0 - dist < 12) {
      s.announced = true;
      announce(s.name, "#9fd7ff", { sub: "NOW ARRIVING" });
    }
  }

  for (const o of obstacles) {
    if (hits(o)) {
      crash = { t: 0, dir: Math.sign(player.x - o.x) || pick([-1, 1]), newBest: score > best };
      if (crash.newBest) {
        best = Math.floor(score);
        try { localStorage.setItem(BEST_KEY, String(best)); } catch (e) { /* storage unavailable */ }
      }
      shake = 3;
      burst(px, py, 16, [[255, 230, 60], [255, 255, 255], [255, 120, 60]], IH * 0.4, 0.8, 60, 2.5);
      break;
    }
  }
  if (runTime > nextBlunder) blunder = true;

  camX += (player.x * 0.55 - camX) * Math.min(1, dt * 6);
  let camTarget = CAM_H + player.y * 0.35;
  if (zoneOverlaps(["tunnel"], dist - PLAYER_Z - 1, dist + 3)) camTarget = Math.min(camTarget, TUNNEL_H - 0.35);
  camY += (camTarget - camY) * Math.min(1, dt * 10);
}

const multiplier = () => (1 + Math.min(4, Math.floor(runTime / 25))) * (boostT > 0 ? 2 : 1);

// ---- Rendering: sky --------------------------------------------------------
function drawSky() {
  const g = ctx.createLinearGradient(0, 0, 0, HOR);
  g.addColorStop(0, rgb(env.top));
  g.addColorStop(1, rgb(env.bot));
  ctx.fillStyle = g;
  ctx.fillRect(-8, -8, IW + 16, HOR + 9);
  const u = IH / 360;

  const starA = clamp((0.75 - env.light) * 3, 0, 1);
  if (starA > 0) {
    for (const [sx, sy] of STARS) {
      ctx.fillStyle = `rgba(255,255,230,${starA * (0.6 + 0.4 * Math.sin(t * 3 + sx * 50))})`;
      ctx.fillRect(sx * IW, sy * HOR * 0.8, u, u);
    }
  }
  if (shooting) {
    ctx.strokeStyle = `rgba(255,255,240,${shooting.life * 2})`;
    ctx.lineWidth = u;
    ctx.beginPath();
    ctx.moveTo(shooting.x * IW, shooting.y * HOR);
    ctx.lineTo((shooting.x - shooting.vx * 0.15) * IW, (shooting.y - shooting.vy * 0.15) * HOR);
    ctx.stroke();
  }
  const sunA = clamp((env.light - 0.75) / 0.2, 0, 1);
  if (sunA > 0) {
    const sx = IW * 0.78 - camX * 2, sy = HOR * (0.2 + (1 - env.light) * 1.6);
    const glow = ctx.createRadialGradient(sx, sy, 0, sx, sy, IH * 0.12);
    glow.addColorStop(0, `rgba(255,240,200,${0.5 * sunA})`);
    glow.addColorStop(1, "rgba(255,240,200,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(sx - IH * 0.12, sy - IH * 0.12, IH * 0.24, IH * 0.24);
    disc(sx, sy, IH * 0.035, `rgba(255,${(245 - (1 - env.light) * 400) | 0},170,${sunA})`);
  }
  const moonA = clamp((0.72 - env.light) * 6, 0, 1);
  if (moonA > 0) {
    const mx = IW * 0.25 - camX * 2, my = HOR * 0.28, r = IH * 0.028;
    disc(mx, my, r * 1.8, `rgba(240,240,220,${moonA * 0.12})`);
    disc(mx, my, r, `rgba(240,240,220,${moonA})`);
    disc(mx - r * 0.3, my - r * 0.2, r * 0.25, `rgba(200,200,185,${moonA})`);
    disc(mx + r * 0.35, my + r * 0.3, r * 0.18, `rgba(200,200,185,${moonA})`);
  }
  const cloudC = mixRgb([255 * env.light, 255 * env.light, 255 * env.light], env.bot, 0.3);
  const cloudShade = cloudC.map(c => c * 0.88);
  for (const c of clouds) {
    const x = c.x * IW - camX * 3, y = c.y * HOR, r = IH * 0.03 * c.s;
    for (const [dx, dy, dr, shade] of [[0, 0.15, 1, true], [1.1, 0.35, 0.8, true], [-1.1, 0.4, 0.75, true],
                                       [0, 0, 1, false], [1.1, 0.2, 0.8, false], [-1.1, 0.25, 0.75, false], [0.3, -0.5, 0.8, false]]) {
      disc(x + dx * r, y + dy * r, dr * r, rgba(shade ? cloudShade : cloudC, 0.85));
    }
  }
  if (plane) {
    const x = plane.x * IW, y = plane.y * HOR, d = Math.sign(plane.v);
    if (env.light > 0.75) {
      ctx.strokeStyle = "rgba(255,255,255,0.45)";
      ctx.lineWidth = 1.5 * u;
      ctx.beginPath();
      ctx.moveTo(x - d * 4 * u, y);
      ctx.lineTo(x - d * 60 * u, y + 2 * u);
      ctx.stroke();
    }
    ctx.fillStyle = env.light > 0.75 ? "rgba(90,96,110,0.9)" : "rgba(30,30,40,0.9)";
    ctx.fillRect(x - 5 * u, y - u, 10 * u, 2 * u);
    ctx.fillRect(x - u, y - 3 * u, 2 * u, 6 * u);
    ctx.fillRect(x - d * 5 * u, y - 3 * u, u, 3 * u);
    if (env.light < 0.8 && Math.sin(t * 8) > 0.3) {
      ctx.fillStyle = "#ff4040"; ctx.fillRect(x - u, y - 3 * u, u, u);
      ctx.fillStyle = "#ffffff"; ctx.fillRect(x + d * 5 * u, y - u, u, u);
    }
  }
  if (birds) {
    ctx.strokeStyle = "rgba(30,30,40,0.7)";
    ctx.lineWidth = u;
    ctx.beginPath();
    for (let i = 0; i < birds.n; i++) {
      const bx = (birds.x - i * 0.035) * IW, by = (birds.y + (i % 2) * 0.03 + i * 0.012) * HOR;
      const flap = Math.sin(t * 10 + i * 1.7) * 2 * u;
      ctx.moveTo(bx - 3 * u, by - flap);
      ctx.lineTo(bx, by);
      ctx.lineTo(bx + 3 * u, by - flap);
    }
    ctx.stroke();
  }
  drawFireworks();
  // Distant skyline, peeking out behind everything else.
  const skyC = mixRgb(env.bot, env.top, 0.25).map(c => c * 0.82);
  const off = ((-camX * 5) % IW + IW) % IW;
  for (let k = -1; k <= 1; k++) {
    for (const [x, w, h, spire] of SKYLINE) {
      const sx = x * IW + k * IW + off;
      ctx.fillStyle = rgb(skyC);
      ctx.fillRect(sx, HOR - h * IH, w * IW + 0.5, h * IH + 1);
      if (spire) ctx.fillRect(sx + w * IW * 0.45, HOR - h * IH - IH * 0.03, 1, IH * 0.03);
      if (env.light < 0.7) {
        ctx.fillStyle = "rgba(255,220,130,0.6)";
        for (let i = 0; i < 3; i++) if (hash(x * 100, i) < 0.5) ctx.fillRect(sx + hash(i, x) * w * IW, HOR - hash(x, i + 7) * h * IH, 1, 1);
      }
    }
  }
}

function drawFireworks() {
  ctx.globalCompositeOperation = env.light < 0.85 ? "lighter" : "source-over";
  for (const r of rockets) {
    if (r.delay > 0) continue;
    ctx.fillStyle = "rgba(255,230,180,0.9)";
    ctx.fillRect(r.x - 1, r.y - 1, 2, 2);
    ctx.fillStyle = "rgba(255,200,120,0.4)";
    ctx.fillRect(r.x - 0.5, r.y + 1, 1, 6);
  }
  ctx.lineWidth = env.light < 0.85 ? 1.5 : 2;
  for (const s of sparks) {
    const a = clamp(s.life / s.max, 0, 1);
    if (s.flash) { disc(s.x, s.y, IH * 0.03, rgba(s.c, a * 0.8)); continue; }
    ctx.strokeStyle = rgba(s.c, a);
    ctx.beginPath();
    ctx.moveTo(s.px, s.py);
    ctx.lineTo(s.x + (s.x - s.px), s.y + (s.y - s.py));
    ctx.stroke();
  }
  ctx.globalCompositeOperation = "source-over";
}

// ---- Rendering: track & scenery -------------------------------------------
function drawTrack() {
  ctx.fillStyle = groundFill(GROUND);
  ctx.fillRect(-8, HOR, IW + 16, IH - HOR + 8);
  for (const s of [-1, 1]) wallY(0.001, s * 1.74, s * 3.2, NEAR, FAR, groundFill(SIDEWALK));
  wallY(0, -1.6, 1.6, NEAR, FAR, groundFill(BED));
  for (const s of [-1, 1]) wallY(0.002, s * 1.6, s * 1.74, NEAR, FAR, groundFill(CONCRETE));

  // Sidewalk slabs and gravel speckles, anchored to the world so they scroll.
  const first = Math.ceil((dist - PLAYER_Z + NEAR) / 0.75);
  ctx.strokeStyle = col(SIDEWALK, 8, 0.85);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let n = Math.ceil(first / 2) * 2; cz(n * 0.75) < DETAIL_Z; n += 2) {
    const z = cz(n * 0.75);
    for (const s of [-1, 1]) line3(P(s * 1.74, 0.002, z), P(s * 2.4, 0.002, z));
  }
  ctx.stroke();
  const specs = [col(BED, 8, 0.72), col(BED, 8, 1.3), col([150, 146, 140], 8)];
  for (let n = first; cz(n * 0.75) < 22; n++) {
    for (let i = 0; i < 6; i++) {
      const z = cz(n * 0.75 + hash(n, i + 10) * 0.75);
      if (z < NEAR) continue;
      const [sx, sy] = P(hash(n, i) * 3.1 - 1.55, 0.005, z);
      ctx.fillStyle = specs[i % 3];
      const sz = z < 6 ? 2 : 1;
      ctx.fillRect(sx, sy, sz, sz);
    }
  }
  for (const l of LANES) {
    for (let n = first; cz(n * 0.75) < 40; n++) {
      const z = cz(n * 0.75);
      wallY(0.01, l - 0.42, l + 0.42, z, z + 0.22, col(SLEEPER, z, 0.85 + 0.3 * hash(n, l)));
    }
  }
  for (const l of LANES) {
    for (const s of [-0.26, 0.26]) {
      wallY(0.03, l + s - 0.035, l + s + 0.035, NEAR, FAR, col(RAIL, 12, 0.8));
      wallY(0.031, l + s - 0.012, l + s + 0.012, NEAR, 30, col(RAIL, 6, 1.2));    // polished top
    }
  }
}

// Clip a [z0, z1] track span to the view; returns null when it's not visible.
function span(wz0, wz1) {
  const z0 = cz(wz0), z1 = Math.min(cz(wz1), FAR);
  if (z1 < NEAR || z0 > FAR) return null;
  const c0 = Math.max(z0, NEAR);
  return { z0: c0, z1, zm: (c0 + z1) / 2, clipped: z0 < NEAR };
}

// Ground-level decoration that everything else stands on.
function drawFloors() {
  for (const o of scenery) {
    if (o.kind !== "grass" && o.kind !== "bridge" && o.kind !== "tunnel") continue;
    const s = span(o.z0, o.z1);
    if (!s) continue;
    if (o.kind === "grass") {
      for (const side of [-1, 1]) wallY(0.003, side * 1.74, side * 40, s.z0, s.z1, groundFill(GRASS));
    } else if (o.kind === "bridge") {
      for (const side of [-1, 1]) wallY(-0.9, side * 1.9, side * 60, s.z0, s.z1, groundFill(WATER));
      ctx.fillStyle = `rgba(255,255,255,${0.5 * env.light})`;
      for (const [gx, gwz, ph] of o.glints) {
        const z = cz(gwz);
        if (z < 1 || z > FAR || Math.sin(t * 3 + ph) < 0.5) continue;
        const [sx, sy] = P(gx, -0.9, z);
        ctx.fillRect(sx, sy, Math.max(1, 0.5 * F / z), 1);
      }
    } else {
      wallY(0.004, -2.3, 2.3, s.z0, s.z1, "rgba(0,0,0,0.35)");
    }
  }
  for (const d of decor) {
    const z = cz(d.wz);
    if (z < NEAR + 0.4 || z > DETAIL_Z) continue;
    switch (d.kind) {
      case "puddle": {
        const tunnel = inTunnel(d.wz);
        const sky = tunnel ? [60, 60, 70] : mixRgb(env.top, env.bot, 0.4);
        flatEllipse(d.x, 0.012, d.wz, d.rx, d.rz, rgba(sky, 0.45));
        flatEllipse(d.x - d.rx * 0.3, 0.013, d.wz - d.rz * 0.2, d.rx * 0.35, d.rz * 0.25, "rgba(255,255,255,0.22)");
        break;
      }
      case "stain":
        flatEllipse(d.x, 0.012, d.wz, d.rx, d.rz, "rgba(20,15,10,0.35)");
        break;
      case "manhole":
        flatEllipse(d.x, 0.004, d.wz, 0.2, 0.2, col(DARK, z, 2));
        flatEllipse(d.x, 0.005, d.wz, 0.14, 0.14, col(DARK, z, 2.6));
        break;
      case "paper": {
        const c = Math.cos(d.a) * 0.1, s = Math.sin(d.a) * 0.1;
        poly([P(d.x - c, 0.01, cz(d.wz - s)), P(d.x + s, 0.01, cz(d.wz - c)),
              P(d.x + c, 0.01, cz(d.wz + s)), P(d.x - s, 0.01, cz(d.wz + c))], col([232, 228, 214], z));
        break;
      }
      case "flowers":
        for (let i = 0; i < 7; i++) {
          const fz = cz(d.wz + hash(d.wz, i) * 1.2);
          if (fz < NEAR) continue;
          const [sx, sy] = P(d.x + hash(i, d.wz) * 0.8 - 0.4, 0.05, fz);
          ctx.fillStyle = col(d.c[i % 2], fz);
          const sz = fz < 8 ? 2 : 1;
          ctx.fillRect(sx - sz / 2, sy - sz, sz, sz);
        }
        break;
    }
  }
}

function drawBuilding(b) {
  const s = span(b.z0, b.z1);
  if (!s) return;
  const { z0, z1, zm } = s, side = b.side, x = b.x, night = env.light < 0.7;
  const inset = d => x - side * d;
  const near = z0 < DETAIL_Z;
  wallX(x, 0, b.h, z0, z1, col(b.rgb, zm, 0.75));
  if (near && b.tex !== "plain") {                                   // brick courses or panel seams
    ctx.strokeStyle = col(b.rgb, zm, 0.63);
    ctx.lineWidth = 1;
    ctx.beginPath();
    const zb = Math.min(z1, DETAIL_Z + 8);
    if (b.tex === "brick") {
      for (let y = 0.3; y < b.h - 0.3; y += 0.3) line3(P(inset(0.003), y, z0), P(inset(0.003), y, zb));
    } else {
      for (let wz = b.z0 + 1; wz < b.z1; wz += 2) {
        const z = cz(wz);
        if (z > NEAR && z < zb) line3(P(inset(0.003), 0, z), P(inset(0.003), b.h, z));
      }
    }
    ctx.stroke();
  }
  if (!b.low) wallX(inset(0.01), b.h - 0.25, b.h, z0, z1, col(b.rgb, zm, 0.95));      // cornice
  if (b.pipe != null && near) {
    const z = cz(b.pipe);
    if (z > NEAR) wallX(inset(0.03), 0, b.h - 0.1, z, z + 0.1, col(METAL, z, 0.6));
  }
  if (b.win && z0 < 35) {
    const w = b.win, yStart = b.shop ? 1.9 : 1.2;
    for (let wz = b.z0 + 0.6, i = 0; wz + w.w < b.z1 - 0.4; wz += w.dz, i++) {
      const z = cz(wz), za = cz(wz + w.w);
      if (za < NEAR || z > FAR) continue;
      const zc = Math.max(z, NEAR);
      for (let y = yStart, n = 0; y + w.h < b.h - 0.4; y += w.dy, n++) {
        const h = hash(b.seed + i, n);
        if (w.ledge) wallX(inset(0.02), y - 0.08, y, zc, za + 0.08, col(b.rgb, z, 1.05));
        if (z < DETAIL_Z) wallX(inset(0.005), y - 0.05, y + w.h + 0.05, zc, za + 0.05, col(w.frame, z));
        let glass = col(w.glass, z);
        if (night && h < 0.3) {
          if (h < 0.05) { const f = 0.6 + 0.4 * Math.sin(t * 13 + h * 400); glass = rgb([110 * f, 150 * f, 255 * f]); }  // TV
          else glass = h < 0.18 ? "#ffd86b" : "#ffbf7a";
        }
        wallX(inset(0.01), y, y + w.h, zc, za, glass);
        if (z < DETAIL_Z) {
          if (h > 0.72) {                                                   // curtains
            const cc = col(AWNINGS[Math.floor(h * 97) % AWNINGS.length], z);
            wallX(inset(0.012), y, y + w.h, zc, cz(wz + w.w * 0.28), cc);
            wallX(inset(0.012), y, y + w.h, cz(wz + w.w * 0.72), za, cc);
          } else if (h > 0.55) {                                            // half-drawn blind
            wallX(inset(0.012), y + w.h * 0.55, y + w.h, zc, za, col([224, 218, 200], z, 0.9));
          }
        }
      }
    }
  }
  if (near) {
    for (const d of b.deco) {
      const z = cz(d.wz);
      if (z > DETAIL_Z) continue;
      switch (d.type) {
        case "ac": {
          const zb = cz(d.wz + 0.45);
          if (zb < NEAR) break;
          wallX(inset(0.28), d.y, d.y + 0.3, Math.max(z, NEAR), zb, col([205, 205, 198], z));
          wallX(inset(0.281), d.y + 0.08, d.y + 0.11, Math.max(z, NEAR), zb, col([130, 130, 130], z));
          wallX(inset(0.281), d.y + 0.17, d.y + 0.2, Math.max(z, NEAR), zb, col([130, 130, 130], z));
          if (z > NEAR) wallZ(z, x, inset(0.28), d.y, d.y + 0.3, col([175, 175, 168], z));
          break;
        }
        case "flowers": {
          const zb = cz(d.wz + d.w);
          if (zb < NEAR) break;
          wallX(inset(0.1), d.y - 0.16, d.y - 0.02, Math.max(z, NEAR), zb, col([150, 80, 50], z));
          for (let i = 0; i < 5; i++) {
            const fz = cz(d.wz + (i + 0.5) * d.w / 5);
            if (fz < NEAR) continue;
            const [sx, sy] = P(inset(0.1), d.y + 0.02, fz);
            ctx.fillStyle = col(i % 2 ? d.c : [80, 160, 70], fz);
            ctx.fillRect(sx - 1, sy - 1, 2, 2);
          }
          break;
        }
        case "fire": {
          const za = cz(d.wz), zb = cz(d.wz + d.w);
          if (zb < NEAR) break;
          const c = col(DARK, za, 1.3), zs = Math.max(za, NEAR);
          for (const y of d.ys) wallY(y, x, inset(0.45), zs, zb, c);        // platforms
          ctx.strokeStyle = c;
          ctx.lineWidth = 1;
          ctx.beginPath();
          d.ys.forEach((y, i) => {
            line3(P(inset(0.45), y + 0.4, zs), P(inset(0.45), y + 0.4, zb)); // railing
            line3(P(inset(0.45), y, zs), P(inset(0.45), y + 0.4, zs));
            line3(P(inset(0.45), y, zb), P(inset(0.45), y + 0.4, zb));
            if (i > 0) {                                                    // ladder between floors
              const ya = d.ys[i - 1], zl = cz(d.wz + (i % 2 ? d.w * 0.2 : d.w * 0.8));
              if (zl > NEAR) line3(P(inset(0.3), ya, zl), P(inset(0.3), y, cz(d.wz + (i % 2 ? d.w * 0.8 : d.w * 0.2))));
            }
          });
          ctx.stroke();
          break;
        }
        case "door": {
          const zb = cz(d.wz + 0.7);
          if (zb < NEAR) break;
          const zs = Math.max(z, NEAR);
          wallX(inset(0.005), 0, 1.15, zs, zb + 0.05, col([220, 216, 206], z, 0.8));
          wallX(inset(0.01), 0.05, 1.1, zs, zb, col(d.c, z));
          wallX(inset(0.012), 0.75, 1.0, cz(d.wz + 0.15), cz(d.wz + 0.55), col(GLASS, z));
          wallY(0.06, x, inset(0.2), zs, zb, col(CONCRETE, z, 1.05));
          break;
        }
        case "poster": {
          const zb = cz(d.wz + 0.6);
          if (zb < NEAR || z < NEAR) break;
          wallX(inset(0.012), 0.5, 1.35, z, zb, col(d.c1, z));
          wallX(inset(0.013), 0.62, 0.95, cz(d.wz + 0.08), cz(d.wz + 0.52), col(d.c2, z));
          wallX(inset(0.013), 1.05, 1.12, cz(d.wz + 0.08), cz(d.wz + 0.45), col(DARK, z));
          wallX(inset(0.013), 1.18, 1.23, cz(d.wz + 0.08), cz(d.wz + 0.3), col(DARK, z));
          break;
        }
        case "neon": {
          const zb = cz(d.wz + d.w);
          if (zb < NEAR || z < NEAR) break;
          const on = Math.sin(t * 7 + d.wz * 3) > -0.85;                      // occasional flicker
          const c = on ? (night ? rgb(d.c) : col(d.c, z, 1.05)) : col(DARK, z, 1.5);
          wallX(inset(0.04), d.y, d.y + 0.32, z, zb, col(DARK, z));
          wallX(inset(0.05), d.y + 0.07, d.y + 0.25, cz(d.wz + 0.08), cz(d.wz + d.w - 0.08), c);
          if (night && on) {
            const [gx, gy] = P(inset(0.05), d.y + 0.16, (z + zb) / 2);
            disc(gx, gy, 0.5 * F / z, rgba(d.c, 0.2));
          }
          break;
        }
      }
    }
  }
  if (b.shop && z0 < 35) {
    wallX(inset(0.01), 0.1, 1.15, z0, z1, night ? col([255, 214, 140], zm, 1.4) : col([80, 110, 130], zm));
    if (near) {
      for (let wz = b.z0 + 1.2; wz < b.z1 - 0.2; wz += 1.6) {                 // shop window mullions
        const z = cz(wz);
        if (z > NEAR && z < DETAIL_Z) wallX(inset(0.011), 0.1, 1.15, z, z + 0.07, col(DARK, z, 1.5));
      }
    }
    wallX(inset(0.12), 1.2, 1.5, z0, z1, col([240, 240, 235], zm));
    for (let wz = b.z0; wz < b.z1; wz += 0.6) {                                // awning stripes
      const za = cz(wz), zb = cz(Math.min(wz + 0.3, b.z1));
      if (zb > NEAR && za < FAR) wallX(inset(0.12), 1.2, 1.5, Math.max(za, NEAR), zb, col(b.shop, za));
    }
  }
  if (b.billboard && z0 < 35) {
    const bb = b.billboard, bz = cz(b.z0 + bb.at * (b.z1 - b.z0));
    if (bz > NEAR) {
      const m = night ? 1.3 / env.light : 1;                                          // lit at night
      wallX(inset(0.05), b.h - 1.9, b.h - 0.5, bz, bz + bb.w, col(bb.c, bz, m));
      wallX(inset(0.06), b.h - 1.2, b.h - 1.0, bz + 0.2, bz + bb.w * 0.8, col(WHITE, bz, m));
      wallX(inset(0.06), b.h - 1.6, b.h - 1.4, bz + 0.2, bz + bb.w * 0.5, col(bb.c2, bz, m));
    }
  }
  if (b.graffiti) {
    const g = b.graffiti, gz = cz(b.z0 + g.at * (b.z1 - b.z0));
    if (gz > NEAR) {
      wallX(inset(0.02), 0.3, 0.3 + g.h, gz, gz + g.w, col(g.c, gz));
      wallX(inset(0.03), 0.45, 0.3 + g.h * 0.6, gz + g.w * 0.2, gz + g.w * 0.7, col(g.c2, gz));
    }
  }
  if (b.roof && b.h > camY) {                                                     // rooftop silhouettes
    const rz = cz(b.z0 + b.roof.at * (b.z1 - b.z0)), cx = x + side * 0.8, h = b.h;
    if (rz > NEAR) {
      const c = col(b.roof.kind === "tank" ? [120, 84, 56] : b.roof.kind === "chimney" ? [150, 70, 55] : POLE, rz);
      if (b.roof.kind === "tank") {
        wallZ(rz, cx - 0.35, cx - 0.3, h, h + 0.4, c);
        wallZ(rz, cx + 0.3, cx + 0.35, h, h + 0.4, c);
        wallZ(rz, cx - 0.4, cx + 0.4, h + 0.4, h + 1.3, c);
        poly([P(cx - 0.45, h + 1.3, rz), P(cx + 0.45, h + 1.3, rz), P(cx, h + 1.65, rz)], col([90, 70, 50], rz));
      } else if (b.roof.kind === "chimney") {
        wallZ(rz, cx - 0.2, cx + 0.2, h, h + 0.7, c);
        wallZ(rz, cx - 0.25, cx + 0.25, h + 0.6, h + 0.75, col(DARK, rz, 1.5));
      } else {
        ctx.strokeStyle = c;
        ctx.lineWidth = 1;
        ctx.beginPath();
        line3(P(cx, h, rz), P(cx, h + 1.6, rz));
        line3(P(cx - 0.3, h + 1.2, rz), P(cx + 0.3, h + 1.2, rz));
        line3(P(cx - 0.2, h + 1.45, rz), P(cx + 0.2, h + 1.45, rz));
        ctx.stroke();
        if (night && Math.sin(t * 3) > 0) disc(...P(cx, h + 1.6, rz), 1.5, "#ff4040");
      }
    }
  }
  if (b.h < camY) wallY(b.h, x, x + side * 12, z0, z1, col(b.rgb, zm, 1.1));
  if (!s.clipped) {
    wallZ(z0, x, x + side * 12, 0, b.h, col(b.rgb, z0));
    if (b.win && z0 < DETAIL_Z) {                                                  // windows on the end wall
      const w = b.win;
      for (let i = 0; i < 3; i++) {
        const xa = x + side * (0.5 + i * 1.3);
        for (let y = b.shop ? 1.9 : 1.2; y + w.h < b.h - 0.4; y += w.dy) {
          wallZ(z0, xa, xa + side * w.w, y, y + w.h, night && hash(b.seed, i + y) < 0.3 ? "#ffd86b" : col(w.glass, z0));
        }
      }
    }
  }
}

function drawTree(o) {
  const z = cz(o.z0);
  if (z < NEAR || z > FAR) return;
  wallZ(z, o.x - 0.09, o.x + 0.09, 0, o.h * 0.6, col(TRUNK, z));
  const k = F / z;
  const sway = Math.sin(t * 1.5 + o.z0) * 0.04;
  for (const [dx, dy, dr, m] of [[-0.35, -0.1, 0.7, 0.8], [0.35, -0.05, 0.7, 0.88], [0, 0.3, 0.75, 1], [-0.15, 0.45, 0.35, 1.15]]) {
    const [sx, sy] = P(o.x + dx * o.r + sway * (dy + 0.5), o.h * 0.7 + dy * o.r, z);
    disc(sx, sy, dr * o.r * k, col(o.leaf, z, m));
  }
}

function drawBush(o) {
  const z = cz(o.z0);
  if (z < NEAR || z > FAR) return;
  const k = F / z;
  for (const [dx, dr, m] of [[-0.2, 0.3, 0.85], [0.2, 0.28, 1], [0, 0.22, 1.12]]) {
    const [sx, sy] = P(o.x + dx, 0.25, z);
    disc(sx, sy, dr * k, col(o.leaf, z, m));
  }
}

function drawLamp(o) {
  const z = cz(o.z0);
  if (z < NEAR || z > FAR) return;
  const hx = o.x - o.side * 0.4;
  wallZ(z, o.x - 0.04, o.x + 0.04, 0, 2.6, col(POLE, z));
  wallZ(z, o.x, hx, 2.55, 2.62, col(POLE, z));
  const night = env.light < 0.7;
  wallZ(z, hx - 0.1, hx + 0.1, 2.45, 2.55, night ? "#fff2b0" : col([220, 220, 210], z));
  if (night) {
    const [sx, sy] = P(hx, 2.45, z);
    disc(sx, sy, 0.6 * F / z, "rgba(255,230,150,0.18)");
  }
}

function drawBridge(o) {
  const s = span(o.z0, o.z1);
  for (const bt of [...o.boats].sort((a, b) => b.wz - a.wz)) {                // boats under the bridge
    const z = cz(bt.wz);
    if (z < NEAR || z > FAR) continue;
    const bob = Math.sin(t * 2 + bt.wz) * 0.04, y = -0.9 + bob;
    poly([P(bt.x - 0.6, y, z), P(bt.x + 0.6, y, z), P(bt.x + 0.8, y + 0.35, z), P(bt.x - 0.8, y + 0.35, z)], col(bt.c, z));
    wallZ(z, bt.x - 0.8, bt.x + 0.8, y + 0.3, y + 0.35, col(DARK, z, 2));
    if (bt.sail) {
      wallZ(z, bt.x - 0.02, bt.x + 0.02, y + 0.35, y + 1.6, col(WOOD, z));
      poly([P(bt.x + 0.03, y + 0.45, z), P(bt.x + 0.03, y + 1.55, z), P(bt.x + 0.6, y + 0.45, z)], col(WHITE, z));
    } else {
      wallZ(z, bt.x - 0.3, bt.x + 0.25, y + 0.35, y + 0.65, col(WHITE, z, 0.9));
      wallZ(z, bt.x - 0.22, bt.x + 0.17, y + 0.48, y + 0.58, col(GLASS, z));
    }
    const [wx, wy] = P(bt.x, -0.9, z);                                         // wake
    ctx.fillStyle = `rgba(255,255,255,${0.4 * env.light})`;
    ctx.fillRect(wx - 0.9 * F / z, wy, 1.8 * F / z, 1);
  }
  if (!s) return;
  for (const side of [-1, 1]) {
    wallX(side * 1.9, 0.5, 0.58, s.z0, s.z1, col(METAL, s.zm));
    wallX(side * 1.9, 0.25, 0.3, s.z0, s.z1, col(METAL, s.zm, 0.85));
  }
  for (let wz = o.z0; wz <= o.z1; wz += 1.5) {                       // railing posts
    const z = cz(wz);
    if (z < NEAR || z > 35) continue;
    for (const side of [-1, 1]) wallZ(z, side * 1.9 - 0.03, side * 1.9 + 0.03, 0, 0.58, col(METAL, z, 0.8));
  }
  for (let wz = o.z0; wz <= o.z1; wz += 6) {                         // steel truss
    const z = cz(wz);
    if (z < NEAR || z > FAR) continue;
    const c = col(o.rgb, z);
    for (const side of [-1, 1]) wallZ(z, side * 2.05 - 0.1, side * 2.05 + 0.1, 0, 4.5, c);
    wallZ(z, -2.15, 2.15, 4.3, 4.55, c);
    if (z < DETAIL_Z) for (let i = -2; i <= 2; i++) disc(...P(i * 0.9, 4.42, z), 0.03 * F / z, col(o.rgb, z, 0.7));   // rivets
    const zn = cz(wz + 6);
    if (wz + 6 <= o.z1 && zn < FAR) {
      ctx.strokeStyle = c;
      ctx.lineWidth = Math.max(1, 0.12 * F / ((z + zn) / 2));
      ctx.beginPath();
      for (const side of [-1, 1]) line3(P(side * 2.05, 0.2, z), P(side * 2.05, 4.3, zn));
      ctx.stroke();
    }
  }
}

function drawTunnel(o) {
  const s = span(o.z0, o.z1);
  if (!s) return;
  for (const side of [-1, 1]) {
    wallX(side * 2.3, 0, TUNNEL_H, s.z0, s.z1, col(STONE, s.zm, 0.9));
    wallX(side * 2.29, 0, 0.5, s.z0, s.z1, col(STONE, s.zm, 0.6));            // grimy skirting
  }
  wallY(TUNNEL_H, -2.3, 2.3, s.z0, s.z1, col(STONE, s.zm, 0.65));
  for (let wz = o.z0 + 2.5; wz < o.z1; wz += 5) {                    // arch ribs
    const z = cz(wz);
    if (z < NEAR || z > FAR) continue;
    for (const side of [-1, 1]) wallX(side * 2.28, 0, TUNNEL_H, z, z + 0.35, col(STONE, z, 0.75));
    wallY(TUNNEL_H - 0.01, -2.3, 2.3, z, z + 0.35, col(STONE, z, 0.5));
  }
  ctx.strokeStyle = col(DARK, 10, 1.4);                              // cable runs
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const side of [-1, 1]) {
    for (const y of [2.95, 3.05]) line3(P(side * 2.27, y, s.z0), P(side * 2.27, y, s.z1));
  }
  ctx.stroke();
  for (let wz = o.z0 + 2; wz < o.z1 - 1; wz += 5) {                  // lamps
    const z = cz(wz);
    if (z < NEAR || z > FAR) continue;
    for (const side of [-1, 1]) wallX(side * 2.28, 2.4, 2.6, z, z + 0.7, "#ffe9a8");
    wallY(TUNNEL_H - 0.02, -0.16, 0.16, z, z + 0.6, "#f3e3b0");
  }
  for (let wz = o.z0 + 8; wz < o.z1 - 2; wz += 15) {                 // emergency exit signs
    const z = cz(wz);
    if (z > NEAR && z < DETAIL_Z) wallX(-2.27, 1.9, 2.15, z, z + 0.5, "#35d07f");
  }
  if (!s.clipped) {                                                   // portal
    const z = s.z0, c = col(STONE, z), trim = col(STONE, z, 0.7);
    wallZ(z, -14, -2.3, 0, 7, c);
    wallZ(z, 2.3, 14, 0, 7, c);
    wallZ(z, -2.3, 2.3, TUNNEL_H, 7, c);
    wallZ(z, -2.6, 2.6, TUNNEL_H, TUNNEL_H + 0.35, trim);
    wallZ(z, -2.6, -2.3, 0, TUNNEL_H, trim);
    wallZ(z, 2.3, 2.6, 0, TUNNEL_H, trim);
    for (let i = 0; i < 10; i++) {                                    // hazard stripes on the lintel
      wallZ(z, -2.3 + i * 0.46, -2.07 + i * 0.46, TUNNEL_H + 0.35, TUNNEL_H + 0.55, col(i % 2 ? DARK : YELLOW, z));
    }
    wallZ(z, -0.6, 0.6, 4.7, 5.2, col(YELLOW, z));
    wallZ(z, -0.45, 0.45, 4.85, 5.05, col(DARK, z));
  }
}

function drawStation(o) {
  const s = span(o.z0, o.z1);
  if (!s) return;
  const { z0, z1, zm } = s;
  for (const side of [-1, 1]) {
    wallX(side * 5.5, PLATFORM_H, 4, z0, z1, col(TILE, zm, 0.85));                  // back wall
    wallX(side * 5.49, PLATFORM_H, PLATFORM_H + 0.25, z0, z1, col(o.color, zm, 0.8));
    wallY(3.6, side * 1.9, side * 5.5, z0, z1, col([96, 100, 112], zm));            // canopy
    wallY(PLATFORM_H, side * 1.75, side * 5.5, z0, z1, col(PLATFORM, zm));
    wallY(PLATFORM_H + 0.002, side * 1.75, side * 1.95, z0, z1, col(YELLOW, zm));    // safety line
    wallX(side * 1.75, 0, PLATFORM_H, z0, z1, col(PLATFORM, zm, 0.7));
    wallX(side * 1.9, 3.35, 3.7, z0, z1, col(o.color, zm));                         // fascia
  }
  if (!s.clipped) {
    for (const side of [-1, 1]) {
      wallZ(z0, side * 1.75, side * 5.5, 0, PLATFORM_H, col(PLATFORM, z0, 0.85));
      wallZ(z0, side * 1.9, side * 5.5, 3.35, 3.7, col(o.color, z0, 0.9));
    }
  }
  const night = env.light < 0.7;
  for (const th of o.things) {
    const z = cz(th.wz);
    if (z < NEAR || z > FAR) continue;
    const sd = th.side, k = F / z;
    switch (th.kind) {
      case "pillar":
        wallZ(z, sd * 2.4 - 0.09, sd * 2.4 + 0.09, PLATFORM_H, 3.6, col(o.color, z, 0.9));
        wallZ(z, sd * 2.4 - 0.12, sd * 2.4 + 0.12, 3.35, 3.6, col(DARK, z, 1.5));
        break;
      case "ad":
        if (z > DETAIL_Z) break;
        wallX(sd * 5.48, 1.5, 2.8, Math.max(z, NEAR), cz(th.wz + 2.4), col(th.c, z, night ? 1.2 / env.light : 1));
        wallX(sd * 5.47, 1.9, 2.4, cz(th.wz + 0.3), cz(th.wz + 1.6), col(th.c2, z, night ? 1.2 / env.light : 1));
        break;
      case "bench": {
        const x = sd * 3.3, zb = cz(th.wz + 1.4);
        wallY(PLATFORM_H + 0.38, x - sd * 0.18, x + sd * 0.18, z, zb, col(WOOD, z, 1.1));
        wallX(x + sd * 0.18, PLATFORM_H + 0.38, PLATFORM_H + 0.75, z, zb, col(WOOD, z, 0.85));
        wallZ(z, x - 0.18, x + 0.18, PLATFORM_H + 0.3, PLATFORM_H + 0.38, col(WOOD, z, 0.7));
        wallZ(z, x - 0.16, x - 0.12, PLATFORM_H, PLATFORM_H + 0.3, col(POLE, z));
        wallZ(z, x + 0.12, x + 0.16, PLATFORM_H, PLATFORM_H + 0.3, col(POLE, z));
        break;
      }
      case "sign": {
        const xa = sd * 2.1, xb = sd * 4.1;
        wallZ(z, xa + sd * 0.3, xa + sd * 0.33, 2.9, 3.35, col(POLE, z));
        wallZ(z, xb - sd * 0.33, xb - sd * 0.3, 2.9, 3.35, col(POLE, z));
        wallZ(z, xa, xb, 2.45, 2.95, col([30, 60, 140], z));
        wallZ(z, xa, xb, 2.45, 2.5, col(WHITE, z));
        if (z < 30) {
          const [lx, ty] = P(Math.min(xa, xb), 2.95, z), [rx, by] = P(Math.max(xa, xb), 2.5, z);
          const hgt = by - ty;
          ctx.fillStyle = col(WHITE, z, 1.1);
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.font = `bold ${Math.max(3, hgt * 0.62)}px system-ui, sans-serif`;
          ctx.fillText(o.name, (lx + rx) / 2, ty + hgt * 0.5, (rx - lx) * 0.9);
          ctx.textBaseline = "alphabetic";
        }
        break;
      }
      case "person": {
        // Commuters: they wave as the runner goes past.
        const [fx, fy] = P(th.x, PLATFORM_H, z);
        const h = th.h * k, wv = th.wz - dist < 6 && th.wz - dist > -2;
        ctx.fillStyle = col([50, 50, 60], z);
        ctx.fillRect(fx - 0.07 * k, fy - h * 0.45, 0.06 * k, h * 0.45);
        ctx.fillRect(fx + 0.01 * k, fy - h * 0.45, 0.06 * k, h * 0.45);
        ctx.fillStyle = col(th.c, z);
        ctx.fillRect(fx - 0.11 * k, fy - h * 0.88, 0.22 * k, h * 0.45);
        const shoulder = fy - h * 0.85, armLen = h * 0.38, ax = fx - sd * 0.14 * k - 0.03 * k;
        if (wv) ctx.fillRect(ax + Math.sin(t * 10 + th.ph) * 0.05 * k, shoulder - armLen, 0.06 * k, armLen);
        else ctx.fillRect(ax, shoulder, 0.06 * k, armLen);
        disc(fx, fy - h * 0.97, 0.1 * k, col(SKIN, z));
        ctx.fillStyle = col(th.hair, z);
        ctx.beginPath();
        ctx.arc(fx, fy - h * 0.99, 0.1 * k, Math.PI, 0);
        ctx.fill();
        break;
      }
    }
  }
}

function drawPolesAndWires() {
  for (const p of poles) {
    const z = cz(p.wz);
    if (z < NEAR || z > FAR) continue;
    for (const s of [-1, 1]) {
      wallZ(z, s * 1.85 - 0.05, s * 1.85 + 0.05, 0, 3.4, col(POLE, z));
      wallZ(z, s * 1.85, s * 1.3, 3.3, 3.4, col(POLE, z));
      if (z < DETAIL_Z) wallZ(z, s * 1.45 - 0.03, s * 1.45 + 0.03, 3.12, 3.3, col([200, 190, 170], z));  // insulator
    }
    if (p.signal) {
      wallZ(z, -1.85 - 0.12, -1.85 + 0.12, 2.3, 2.9, col(DARK, z));
      const on = Math.sin(t * 4) > -0.3;
      wallZ(z, -1.85 - 0.06, -1.85 + 0.06, 2.62, 2.78, on ? p.signal : col(DARK, z, 2));
      if (on && env.light < 0.8) disc(...P(-1.85, 2.7, z), 0.25 * F / z, rgba(p.signal === "#ff3b30" ? [255, 60, 50] : [60, 230, 110], 0.25));
    }
  }
  ctx.strokeStyle = "rgba(20,20,24,0.55)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (const s of [-1, 1]) line3(P(s * 1.4, 3.3, NEAR + 0.4), P(s * 1.4, 3.3, FAR));
  ctx.stroke();
}

// Sidewalk props and pigeons (drawn after scenery: they stand in front of walls).
function drawProp(d) {
  const z = cz(d.wz);
  if (z < NEAR || z > DETAIL_Z + 6) return;
  const x = d.x, k = F / z;
  switch (d.kind) {
    case "hydrant":
      wallZ(z, x - 0.07, x + 0.07, 0.03, 0.32, col([220, 50, 40], z));
      wallZ(z, x - 0.11, x + 0.11, 0.18, 0.24, col([220, 50, 40], z, 0.8));
      wallZ(z, x - 0.09, x + 0.09, 0, 0.04, col([220, 50, 40], z, 0.7));
      disc(...P(x, 0.32, z), 0.07 * k, col([220, 50, 40], z, 1.15));
      break;
    case "bin":
      wallY(0.45, x - 0.14, x + 0.14, z, z + 0.26, col(d.c, z, 0.7));
      wallZ(z, x - 0.13, x + 0.13, 0, 0.45, col(d.c, z));
      wallZ(z, x - 0.13, x + 0.13, 0.3, 0.34, col(d.c, z, 0.8));
      break;
    case "cone":
      poly([P(x - 0.11, 0.03, z), P(x + 0.11, 0.03, z), P(x + 0.025, 0.42, z), P(x - 0.025, 0.42, z)], col([255, 130, 30], z));
      poly([P(x - 0.075, 0.17, z), P(x + 0.075, 0.17, z), P(x + 0.055, 0.26, z), P(x - 0.055, 0.26, z)], col(WHITE, z));
      wallZ(z, x - 0.14, x + 0.14, 0, 0.03, col([255, 130, 30], z, 0.7));
      break;
    case "bags":
      for (const [dx, r, m] of [[-0.08, 0.13, 0.8], [0.08, 0.11, 1], [0, 0.09, 1.3]]) disc(...P(x + dx, r * 0.9, z), r * k, col(d.c, z, m));
      break;
    case "crate":
      wallY(0.34, x - 0.16, x + 0.16, z, z + 0.32, col(WOOD, z, 1.15));
      wallZ(z, x - 0.16, x + 0.16, 0, 0.34, col(WOOD, z));
      wallZ(z, x - 0.16, x + 0.16, 0.15, 0.19, col(WOOD, z, 0.7));
      break;
    case "mailbox":
      wallZ(z, x - 0.1, x - 0.06, 0, 0.1, col(DARK, z));
      wallZ(z, x + 0.06, x + 0.1, 0, 0.1, col(DARK, z));
      wallY(0.55, x - 0.12, x + 0.12, z, z + 0.24, col([40, 80, 170], z, 1.2));
      wallZ(z, x - 0.12, x + 0.12, 0.1, 0.55, col([40, 80, 170], z));
      wallZ(z, x - 0.07, x + 0.07, 0.44, 0.47, col(DARK, z));
      break;
    case "bench": {
      const s = d.side, zb = cz(d.wz + 1.2);
      wallY(0.32, x - 0.15, x + 0.15, z, zb, col(WOOD, z, 1.1));
      wallX(x + s * 0.15, 0.32, 0.62, z, zb, col(WOOD, z, 0.85));
      wallZ(z, x - 0.15, x + 0.15, 0.27, 0.32, col(WOOD, z, 0.7));
      wallZ(z, x - 0.13, x - 0.09, 0, 0.27, col(POLE, z));
      wallZ(z, x + 0.09, x + 0.13, 0, 0.27, col(POLE, z));
      break;
    }
    case "pigeon": {
      const [sx, sy] = P(x, d.y + 0.07, z);
      const c = col(d.c, z);
      if (!d.fly) {
        const peck = Math.max(0, Math.sin(t * 3 + d.ph)) * 0.05;
        ellipse(sx, sy, 0.09 * k, 0.055 * k, c);
        disc(sx + d.dir * 0.07 * k, sy - 0.05 * k + peck * k, 0.035 * k, col(d.c, z, 0.8));
      } else {
        const flap = Math.sin(t * 28 + d.ph) * 0.12 * k;
        ctx.strokeStyle = c;
        ctx.lineWidth = Math.max(1, 0.03 * k);
        ctx.beginPath();
        ctx.moveTo(sx - 0.16 * k, sy - flap);
        ctx.lineTo(sx, sy);
        ctx.lineTo(sx + 0.16 * k, sy - flap);
        ctx.stroke();
        ellipse(sx, sy, 0.06 * k, 0.04 * k, c);
      }
      break;
    }
  }
}

// ---- Rendering: things on the tracks --------------------------------------
function drawTrain(o) {
  const s = span(o.wz, o.wz + o.len);
  if (!s) return;
  const { z0, z1, zm } = s;
  const x0 = o.x - 0.42, x1 = o.x + 0.42, h = TRAIN_H, cargo = o.style === "cargo";
  if (o.v && !s.clipped) wallY(0.02, x0 - 0.1, x1 + 0.1, Math.max(z0 - 4, NEAR), z0, "rgba(255,236,160,0.22)");
  wallY(h, x0, x1, z0, z1, col(o.rgb, zm, 1.15));
  wallY(h + 0.001, x0 + 0.18, x1 - 0.18, z0, z1, cargo ? col(DARK, zm, 1.6) : col(o.rgb, zm, 0.95));
  if (!cargo) {                                                       // flat roof vents (nothing to trip over)
    for (let wz = o.wz + 1.5; wz < o.wz + o.len - 1; wz += 4) {
      const z = cz(wz);
      if (z > NEAR && z < DETAIL_Z) wallY(h + 0.002, x0 + 0.24, x1 - 0.24, z, z + 1, col(DARK, z, 2));
    }
  }
  const sx = camX < x0 ? x0 : camX > x1 ? x1 : null;                 // which side face we can see
  if (sx !== null) {
    wallX(sx, 0, h, z0, z1, col(o.rgb, zm, 0.7));
    wallX(sx, 0, 0.18, z0, z1, col(DARK, zm, 1.2));                   // undercarriage
    if (cargo) {
      for (let wz = o.wz + 0.3; wz < o.wz + o.len - 0.2; wz += 0.7) {   // corrugated ribs
        const z = cz(wz);
        if (z < NEAR) continue;
        if (z > 30) break;
        wallX(sx, 0.2, h - 0.1, z, z + 0.09, col(o.rgb, z, 0.55));
      }
    } else {
      wallX(sx, 0.8, 1.15, z0, z1, col(GLASS, zm));
      for (let wz = o.wz + 0.9, i = 0; wz < o.wz + o.len - 0.2; wz += 1.1, i++) {   // window pillars & passengers
        const z = cz(wz);
        if (z < NEAR) continue;
        if (z > 30) break;
        if (z > 3 && z < DETAIL_Z && hash(o.seed, i) < 0.45) {
          // A passenger's head, foreshortened like everything else on this wall.
          const hz = cz(wz + 0.55), [hx, hy] = P(sx, 0.97, hz), r = 0.09 * F / hz;
          ellipse(hx, hy, r * clamp(Math.abs(sx - camX) / hz * 2, 0.2, 1), r, col([28, 30, 40], hz));
        }
        wallX(sx, 0.8, 1.15, z, z + 0.14, col(o.rgb, z, 0.7));
      }
      wallX(sx, 0.35, 0.45, z0, z1, col(o.stripe, zm));
    }
    if (o.graffiti) {
      const g = o.graffiti, gz = cz(o.wz + g.at * o.len);
      if (gz > NEAR && gz < FAR) {
        const y0 = cargo ? 0.3 : 0.2;
        wallX(sx, y0, y0 + (cargo ? g.h : 0.14), gz, gz + g.w, col(g.c, gz));
        if (cargo) wallX(sx, y0 + 0.08, y0 + g.h * 0.6, gz + g.w * 0.15, gz + g.w * 0.6, col(g.c2, gz));
      }
    }
    for (let wz = o.wz + 4; wz < o.wz + o.len - 0.5; wz += 4) {         // gaps between cars
      const z = cz(wz);
      if (z > NEAR && z < FAR) wallX(sx, 0, h, z - 0.06, z + 0.06, col(DARK, z));
    }
    for (let wz = o.wz; wz < o.wz + o.len - 0.5; wz += 4) {             // bogies at each car's ends
      for (const off of [0.3, Math.min(4, o.wz + o.len - wz) - 1.5]) {
        const za = cz(wz + off), zb = cz(wz + off + 1.2);
        if (zb < NEAR || za > DETAIL_Z) continue;
        wallX(sx, 0.02, 0.24, Math.max(za, NEAR), zb, col(DARK, za, 1.8));
        wallX(sx, 0.1, 0.14, Math.max(za, NEAR), zb, col(METAL, za, 0.8));
      }
    }
  }
  if (!s.clipped) {
    wallZ(z0, x0, x1, 0, h, col(o.rgb, z0));
    if (cargo) {
      wallZ(z0, x0 + 0.1, x1 - 0.1, 0.25, h - 0.12, col(o.rgb, z0, 0.8));
      for (const lx of [x0 + 0.14, x1 - 0.18]) wallZ(z0, lx, lx + 0.04, 0.2, h - 0.1, col(DARK, z0));
      if (z0 < DETAIL_Z) {                                             // hazard placard
        const [px, py] = P(o.x, 0.85, z0), r = 0.1 * F / z0;
        poly([[px, py - r], [px + r, py], [px, py + r], [px - r, py]], col([240, 150, 40], z0));
      }
    } else {
      wallZ(z0, x0 + 0.1, x1 - 0.1, 0.85, 1.25, col(GLASS, z0));
      wallZ(z0, x0 + 0.1, x1 - 0.1, 0.6, 0.68, col(o.stripe, z0));
      wallZ(z0, o.x - 0.15, o.x + 0.15, 1.28, 1.38, col([255, 150, 40], z0, env.light < 0.8 ? 1.4 : 1));  // route display
      if (z0 < DETAIL_Z) {                                             // wipers
        ctx.strokeStyle = col(DARK, z0);
        ctx.lineWidth = 1;
        ctx.beginPath();
        line3(P(o.x - 0.25, 0.87, z0), P(o.x - 0.05, 1.1, z0));
        line3(P(o.x + 0.05, 0.87, z0), P(o.x + 0.25, 1.1, z0));
        ctx.stroke();
      }
    }
    wallZ(z0, x0, x1, 0, 0.12, col(DARK, z0));
    wallZ(z0, o.x - 0.06, o.x + 0.06, 0.12, 0.22, col(DARK, z0, 1.3));   // coupler
    const hl = o.v ? "#ffffff" : "#fff6c0";
    wallZ(z0, x0 + 0.1, x0 + 0.24, 0.3, 0.42, hl);
    wallZ(z0, x1 - 0.24, x1 - 0.1, 0.3, 0.42, hl);
    if (o.v) {                                                         // oncoming: glaring lights
      for (const lx of [x0 + 0.17, x1 - 0.17]) {
        const [gx, gy] = P(lx, 0.36, z0);
        disc(gx, gy, 0.22 * F / z0 * (1 + 0.15 * Math.sin(t * 20)), "rgba(255,250,210,0.35)");
      }
    }
  }
}

function drawRamp(o) {
  const za0 = cz(o.wz), zb0 = cz(o.wz + o.len);
  if (zb0 < NEAR || za0 > FAR) return;
  const za = Math.max(za0, NEAR), zb = Math.min(zb0, FAR);
  const hA = TRAIN_H * (za - za0) / o.len, hB = TRAIN_H * (zb - za0) / o.len;
  const x0 = o.x - 0.4, x1 = o.x + 0.4;
  const sx = camX < x0 ? x0 : camX > x1 ? x1 : null;
  if (sx !== null) poly([P(sx, 0, za), P(sx, 0, zb), P(sx, hB, zb), P(sx, hA, za)], col(METAL, za, 0.6));
  poly([P(x0, hA, za), P(x1, hA, za), P(x1, hB, zb), P(x0, hB, zb)], col(METAL, za));
  for (const ex of [x0, x1 - 0.06]) {                                   // yellow edge rails
    poly([P(ex, hA + 0.002, za), P(ex + 0.06, hA + 0.002, za), P(ex + 0.06, hB + 0.002, zb), P(ex, hB + 0.002, zb)], col(YELLOW, za));
  }
  ctx.strokeStyle = col(METAL, za, 0.7);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 1; i < 8; i++) {                                         // treads
    const z = cz(o.wz + o.len * i / 8);
    if (z < NEAR || z > FAR) continue;
    line3(P(x0 + 0.06, TRAIN_H * i / 8, z), P(x1 - 0.06, TRAIN_H * i / 8, z));
  }
  ctx.stroke();
  if (za0 >= NEAR) wallZ(za0, x0, x1, 0, 0.07, col(YELLOW, za0));
}

function drawBlock(o) {
  const s = span(o.wz, o.wz + o.len);
  if (!s) return;
  const x0 = o.x - 0.44, x1 = o.x + 0.44, h = 1.1, z = s.z0;
  wallY(h, x0, x1, s.z0, s.z1, col(CONCRETE, z, 1.1));
  const sx = camX < x0 ? x0 : camX > x1 ? x1 : null;
  if (sx !== null) wallX(sx, 0, h, s.z0, s.z1, col(CONCRETE, z, 0.72));
  if (s.clipped) return;
  wallZ(z, x0, x1, 0, h, col(CONCRETE, z));
  for (let i = 0; i < 5; i++) {
    wallZ(z, x0 + i * 0.176, x0 + (i + 1) * 0.176, 0.7, 0.95, col(i % 2 ? WHITE : [220, 50, 40], z));
  }
  wallZ(z, x0 + 0.05, x1 - 0.05, 0.05, 0.12, col(DARK, z, 1.5));
  const on = Math.sin(t * 6) > 0;
  wallZ(z, x0 + 0.08, x0 + 0.2, 0.98, 1.08, on ? "#ff4030" : col([90, 30, 20], z));
  wallZ(z, x1 - 0.2, x1 - 0.08, 0.98, 1.08, on ? col([90, 30, 20], z) : "#ff4030");
}

function drawBarrier(o) {
  const z = cz(o.wz);
  if (z < NEAR || z > FAR) return;
  const x0 = o.x - 0.45, x1 = o.x + 0.45;
  const post = col([90, 90, 96], z);
  const stripes = (y0, y1, c) => {
    for (let i = 0; i < 4; i++) wallZ(z, x0 + 0.08 + i * 0.22, x0 + 0.17 + i * 0.22, y0, y1, c);
  };
  const feet = y => {                                                    // weighted feet so posts look planted
    wallZ(z, x0, x0 + 0.16, 0, 0.04, col(DARK, z, 1.5));
    wallZ(z, x1 - 0.16, x1, 0, 0.04, col(DARK, z, 1.5));
  };
  switch (o.variant) {
    case "crates":
      for (const [cx, h] of [[o.x - 0.22, 0.48], [o.x + 0.22, 0.4]]) {
        wallY(h, cx - 0.2, cx + 0.2, z, z + 0.4, col(WOOD, z, 1.15));
        wallZ(z, cx - 0.2, cx + 0.2, 0, h, col(WOOD, z));
        wallZ(z, cx - 0.2, cx + 0.2, h * 0.45, h * 0.55, col(WOOD, z, 0.7));
        wallZ(z, cx - 0.03, cx + 0.03, 0, h, col(WOOD, z, 0.7));
      }
      break;
    case "hurdle": {
      wallZ(z, x0 + 0.04, x0 + 0.1, 0, 0.48, post);
      wallZ(z, x1 - 0.1, x1 - 0.04, 0, 0.48, post);
      feet();
      wallZ(z, x0, x1, 0.22, 0.48, col([240, 200, 30], z));
      stripes(0.22, 0.48, col(DARK, z));
      const on = Math.sin(t * 8) > 0;
      wallZ(z, o.x - 0.06, o.x + 0.06, 0.48, 0.6, on ? "#ff7a2a" : col([90, 40, 20], z));
      if (on && env.light < 0.9) disc(...P(o.x, 0.54, z), 0.2 * F / z, "rgba(255,140,60,0.3)");
      break;
    }
    case "board":
      wallZ(z, x0 + 0.04, x0 + 0.12, 0, 0.5, post);
      wallZ(z, x1 - 0.12, x1 - 0.04, 0, 0.5, post);
      feet();
      wallY(0.5, x0, x1, z, z + 0.12, col([240, 240, 240], z, 0.9));
      wallZ(z, x0, x1, 0.18, 0.5, col([220, 50, 40], z));
      stripes(0.18, 0.5, col(WHITE, z));
      break;
    case "sign": {
      wallZ(z, x0 + 0.02, x0 + 0.1, 0, 1.3, post);
      wallZ(z, x1 - 0.1, x1 - 0.02, 0, 1.3, post);
      feet();
      wallZ(z, x0, x1, 0.8, 1.3, col([200, 40, 40], z));
      wallZ(z, x0 + 0.15, x1 - 0.15, 1.0, 1.1, col(WHITE, z));
      const on = Math.sin(t * 6) > 0;
      wallZ(z, x0, x0 + 0.1, 1.3, 1.38, on ? "#ffdd33" : post);
      wallZ(z, x1 - 0.1, x1, 1.3, 1.38, on ? post : "#ffdd33");
      break;
    }
    default:                                                            // "bar"
      wallZ(z, x0 + 0.04, x0 + 0.12, 0, 1.25, post);
      wallZ(z, x1 - 0.12, x1 - 0.04, 0, 1.25, post);
      feet();
      wallY(1.25, x0, x1, z, z + 0.12, col([240, 240, 240], z, 0.9));
      wallZ(z, x0, x1, 0.8, 1.25, col([240, 200, 30], z));
      stripes(0.8, 1.25, col(DARK, z));
  }
}

function drawCoin(c) {
  const z = cz(c.wz);
  if (z < NEAR || z > 40) return;
  const y = c.y + (c.pull ? 0 : Math.sin(t * 4 + c.wz) * 0.05);
  if (!c.pull && z < 16) {                                              // shadow
    const [gx, gy] = P(c.x, c.base + 0.005, z);
    ellipse(gx, gy, 0.12 * F / z, 0.03 * F / z, "rgba(0,0,0,0.18)");
  }
  const [sx, sy] = P(c.x, y, z);
  const r = 0.17 * F / z;
  const spin = Math.cos(t * 5 + c.wz);
  const w = Math.max(r * Math.abs(spin), 0.8);
  ellipse(sx, sy, w, r, col(spin > 0 ? [255, 205, 40] : [230, 170, 30], z));
  ellipse(sx, sy, w * 0.55, r * 0.6, col([255, 238, 150], z));
  if (z < 12 && ((t * 1.5 + c.wz * 0.37) % 2) < 0.15) {                // glint
    ctx.fillStyle = "rgba(255,255,255,0.9)";
    ctx.fillRect(sx - w * 0.4 - 1, sy - r * 0.6, 3, 1);
    ctx.fillRect(sx - w * 0.4, sy - r * 0.6 - 1, 1, 3);
  }
}

function drawMagnetIcon(x, y, r, c) {
  ctx.strokeStyle = c;
  ctx.lineWidth = r * 0.55;
  ctx.beginPath();
  ctx.moveTo(x - r * 0.7, y - r * 0.8);
  ctx.lineTo(x - r * 0.7, y);
  ctx.arc(x, y, r * 0.7, Math.PI, 0, true);
  ctx.lineTo(x + r * 0.7, y - r * 0.8);
  ctx.stroke();
  ctx.fillStyle = "#e8e8f0";
  ctx.fillRect(x - r * 0.98, y - r * 1.05, r * 0.56, r * 0.3);
  ctx.fillRect(x + r * 0.42, y - r * 1.05, r * 0.56, r * 0.3);
}

function drawPickup(p) {
  const z = cz(p.wz);
  if (z < NEAR || z > 40) return;
  const [gx, gy] = P(p.x, 0.005, z);
  ellipse(gx, gy, 0.2 * F / z, 0.05 * F / z, "rgba(0,0,0,0.2)");
  const [sx, sy] = P(p.x, p.y + Math.sin(t * 4) * 0.08, z);
  const r = 0.22 * F / z;
  if (p.kind === "magnet") {
    disc(sx, sy, r * 1.6, "rgba(255,90,90,0.25)");
    drawMagnetIcon(sx, sy, r, col([225, 40, 40], z));
  } else {                                                               // mystery box
    disc(sx, sy, r * 1.7, `rgba(200,150,255,${0.2 + 0.1 * Math.sin(t * 6)})`);
    ctx.save();
    ctx.translate(sx, sy);
    ctx.rotate(Math.sin(t * 3 + p.wz) * 0.2);
    ctx.fillStyle = col([130, 70, 210], z);
    ctx.fillRect(-r, -r, 2 * r, 2 * r);
    ctx.fillStyle = col([170, 120, 250], z);
    ctx.fillRect(-r, -r, 2 * r, r * 0.35);
    ctx.fillStyle = col(YELLOW, z);
    ctx.fillRect(-r * 0.15, -r, r * 0.3, 2 * r);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.font = `bold ${Math.max(4, r * 1.3)}px system-ui, sans-serif`;
    ctx.fillText("?", 0, r * 0.1);
    ctx.textBaseline = "alphabetic";
    ctx.restore();
  }
}

function drawPlayer() {
  const k = F / PLAYER_Z;
  const g = groundAt(player.x, dist);
  const above = Math.max(0, player.y - g);
  const [gx, gy] = P(player.x, g, PLAYER_Z);
  const ss = 1 / (1 + above * 0.6);
  ellipse(gx, gy, 0.32 * k * ss, 0.07 * k * ss, `rgba(0,0,0,${0.3 * ss})`);

  let [fx, fy] = P(player.x, player.y, PLAYER_Z);
  if (crash) fy -= Math.sin(Math.min(1, crash.t * 3) * Math.PI) * 0.4 * k;   // knocked up, then down
  ctx.save();
  ctx.translate(fx, fy);
  ctx.scale(k, k);                                  // 1 = one world unit
  // Lean into lane changes, spin during tricks, topple over on a crash.
  let rot = (player.lane - player.x) * 0.3;
  if (player.trick >= 0) rot += player.trick * TAU * Math.sign(player.lane - player.x || 1);
  if (crash) rot = crash.dir * 1.35 * Math.min(1, crash.t * 5);
  ctx.translate(0, -0.5);
  ctx.rotate(rot);
  ctx.translate(0, 0.5);
  let sx = 1, sy = 1;
  if (player.squash > 0) { const q = player.squash / 0.14; sx = 1 + 0.16 * q; sy = 1 - 0.2 * q; }
  else if (above > 0.05) { const st = clamp(player.vy * 0.012, -0.06, 0.1); sy = 1 + st; sx = 1 - st * 0.5; }
  ctx.scale(sx, sy);

  // Drawn from behind; y is measured upwards from the feet.
  const o = outfit, D = c => c.map(v => v * 0.72);
  const R = (c, x, y, w, h) => { ctx.fillStyle = col(c, PLAYER_Z); ctx.fillRect(x, -y - h, w, h); };
  const C = (c, x, y, r) => { ctx.fillStyle = col(c, PLAYER_Z); ctx.beginPath(); ctx.arc(x, -y, r, 0, TAU); ctx.fill(); };
  const limb = (c, x, y, len, w, ang, hand) => {       // hangs down from (x, y), rotated by ang
    ctx.save();
    ctx.translate(x, -y);
    ctx.rotate(ang);
    ctx.fillStyle = col(c, PLAYER_Z);
    ctx.fillRect(-w / 2, 0, w, len);
    if (hand) { ctx.fillStyle = col(SKIN, PLAYER_Z); ctx.beginPath(); ctx.arc(0, len, w * 0.6, 0, TAU); ctx.fill(); }
    ctx.restore();
  };
  if (player.rollT >= 0 && !crash) {
    const a = player.rollT * 18;
    ctx.scale(1.08, 0.92);
    C(o.hoodie, 0, 0.28, 0.28);
    ctx.save();
    ctx.translate(0, -0.28);
    ctx.rotate(a);
    ctx.fillStyle = col(D(o.hoodie), PLAYER_Z);
    ctx.fillRect(-0.28, -0.05, 0.56, 0.1);
    ctx.restore();
    C(o.pack, Math.cos(a) * 0.15, 0.28 + Math.sin(a) * 0.15, 0.11);
    C(o.shoes, Math.cos(a + 2.2) * 0.2, 0.28 + Math.sin(a + 2.2) * 0.2, 0.06);
    C(o.hat === "none" ? o.hair : o.cap, Math.cos(a + 4) * 0.17, 0.28 + Math.sin(a + 4) * 0.17, 0.08);
    ctx.strokeStyle = "rgba(255,255,255,0.5)";                        // speed arcs
    ctx.lineWidth = 0.025;
    ctx.beginPath();
    ctx.arc(0, -0.28, 0.36, Math.PI * 0.8, Math.PI * 1.2);
    ctx.moveTo(0.36 * Math.cos(-0.2), -0.28 + 0.36 * Math.sin(-0.2));
    ctx.arc(0, -0.28, 0.36, -0.2, 0.2);
    ctx.stroke();
    ctx.restore();
    return;
  }
  const air = above > 0.05 && !crash;
  const p = player.phase;
  const bob = air || crash ? 0 : Math.abs(Math.sin(p)) * 0.035;
  for (const i of [0, 1]) {                                            // legs
    const ph = p + i * Math.PI;
    let lift;
    if (crash) lift = 0.04;
    else if (air) lift = player.vy > 0 ? 0.22 - i * 0.06 : 0.08 + i * 0.04;
    else lift = Math.max(0, Math.sin(ph)) * 0.2;
    const hipY = 0.46 + bob, legX = i ? 0.025 : -0.145;
    R(o.pants, legX, lift + 0.06, 0.12, hipY - lift - 0.06);
    R(D(o.pants), legX, lift + (hipY - lift) * 0.45, 0.12, 0.025);     // knee crease
    R(o.shoes, legX - 0.01, lift, 0.14, 0.08);
    if (lift > 0.1) R([240, 238, 230], legX - 0.01, lift, 0.14, 0.03); // sole shows when the foot kicks back
  }
  const tY = 0.42 + bob;
  const swing = air || crash ? 0 : Math.sin(p) * 0.4;
  const armUp = crash ? 2.4 : air ? (player.vy > 0 ? 2.5 : 1.5) : 0.15;
  limb(D(o.hoodie), -0.22, tY + 0.4, 0.3, 0.09, armUp + swing, true);
  limb(D(o.hoodie), 0.22, tY + 0.4, 0.3, 0.09, -(armUp - swing), true);
  R(o.hoodie, -0.19, tY, 0.38, 0.46);
  R(D(o.hoodie), -0.19, tY, 0.38, 0.05);                               // waistband
  const pb = air ? -0.03 : Math.sin(p * 2) * 0.015;                     // backpack bounce
  R(D(o.pack), -0.15, tY + 0.3, 0.035, 0.14);                          // straps
  R(D(o.pack), 0.115, tY + 0.3, 0.035, 0.14);
  R(o.pack, -0.14, tY + 0.08 + pb, 0.28, 0.3);
  R(D(o.pack), -0.14, tY + 0.3 + pb, 0.28, 0.05);
  R(D(o.pack), -0.06, tY + 0.13 + pb, 0.12, 0.07);
  C(D(o.hoodie), 0, tY + 0.47, 0.13);                                   // hood
  const hy = tY + 0.58;
  R(SKIN, -0.045, hy - 0.08, 0.09, 0.06);
  C(o.hair, 0, hy + 0.02, 0.14);
  R(SKIN, -0.16, hy - 0.02, 0.04, 0.07);
  R(SKIN, 0.12, hy - 0.02, 0.04, 0.07);
  if (o.hat === "cap") {
    ctx.fillStyle = col(o.cap, PLAYER_Z);
    ctx.beginPath(); ctx.arc(0, -(hy + 0.03), 0.15, Math.PI, 0); ctx.fill();
    R(o.cap, -0.08, hy - 0.06, 0.16, 0.06);                              // backwards cap brim
    R(D(o.cap), -0.03, hy - 0.01, 0.06, 0.04);
  } else if (o.hat === "beanie") {
    ctx.fillStyle = col(o.cap, PLAYER_Z);
    ctx.beginPath(); ctx.arc(0, -(hy + 0.02), 0.15, Math.PI, 0); ctx.fill();
    R(D(o.cap), -0.15, hy - 0.01, 0.3, 0.05);
    C(WHITE, 0, hy + 0.19, 0.045);
  } else {
    C(D(o.hair), 0.04, hy + 0.14, 0.05);                                 // tuft
  }
  if (o.phones) {
    ctx.strokeStyle = col(DARK, PLAYER_Z, 1.5);
    ctx.lineWidth = 0.03;
    ctx.beginPath(); ctx.arc(0, -(hy + 0.02), 0.16, Math.PI, 0); ctx.stroke();
    C(DARK, -0.16, hy, 0.05);
    C(DARK, 0.16, hy, 0.05);
  }
  if (crash) {                                                           // dizzy stars
    for (let i = 0; i < 3; i++) {
      const a = t * 7 + i * TAU / 3;
      C([255, 230, 60], Math.cos(a) * 0.22, hy + 0.25 + Math.sin(a) * 0.05, 0.035);
    }
  }
  ctx.restore();
}

// ---- Rendering: overlays ---------------------------------------------------
function drawParticles() {
  for (const p of particles) {
    ctx.fillStyle = rgba(p.c, clamp(p.life / p.max, 0, 1));
    ctx.fillRect(p.x - p.s / 2, p.y - p.s / 2, p.s, p.s);
  }
}

function drawSpeedLines() {
  if (crash || speed < 11.5) return;
  ctx.strokeStyle = `rgba(255,255,255,${Math.min(0.3, (speed - 11.5) * 0.07)})`;
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let i = 0; i < 6; i++) {
    const a = rand(0, TAU), c = Math.cos(a), s = Math.sin(a);
    if (s > 0 && Math.abs(c) < 0.45) continue;       // keep clear of the runner
    const r0 = rand(0.5, 0.65) * IH, r1 = r0 + rand(0.1, 0.25) * IH;
    ctx.moveTo(CX + c * r0, HOR + s * r0 * 0.8);
    ctx.lineTo(CX + c * r1, HOR + s * r1 * 0.8);
  }
  ctx.stroke();
}

function drawVignette() {
  const r = Math.max(IW, IH);
  const g = ctx.createRadialGradient(IW / 2, IH / 2, r * 0.35, IW / 2, IH / 2, r * 0.75);
  g.addColorStop(0, "rgba(0,0,0,0)");
  g.addColorStop(1, magnetT > 0 ? "rgba(90,0,0,0.3)" : boostT > 0 ? "rgba(30,0,70,0.32)" : "rgba(0,0,0,0.3)");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, IW, IH);
}

function outlinedText(s, x, y, fill, align, size, weight = 800) {
  ctx.font = `${weight} ${size}px system-ui, sans-serif`;
  ctx.textAlign = align;
  ctx.lineJoin = "round";
  ctx.lineWidth = Math.max(3, size * 0.22);
  ctx.strokeStyle = "rgba(0,0,0,0.8)";
  ctx.strokeText(s, x, y);
  ctx.fillStyle = fill;
  ctx.fillText(s, x, y);
}

function drawPopups() {
  const p = popups[0];
  if (p) {
    const u = p.t / p.life;
    const s = p.t < 0.25 ? easeOutBack(p.t / 0.25) : 1;
    const a = u > 0.8 ? (1 - u) / 0.2 : 1;
    const size = Math.round(IH * 0.07);
    ctx.save();
    ctx.globalAlpha = clamp(a, 0, 1);
    ctx.translate(IW / 2, IH * 0.3 - p.t * 6);
    ctx.rotate(Math.sin(p.t * 5) * 0.03);
    ctx.font = `900 ${size}px system-ui, sans-serif`;
    const fit = Math.min(1, IW * 0.9 / ctx.measureText(p.text).width);
    ctx.scale(s * fit, s * fit);
    if (p.sub) outlinedText(p.sub, 0, -size * 0.95, "#ffffff", "center", Math.round(size * 0.45));
    outlinedText(p.text, 2, 2, "rgba(0,0,0,0.35)", "center", size, 900);   // drop shadow
    outlinedText(p.text, 0, 0, p.color, "center", size, 900);
    ctx.restore();
  }
  for (const f of floaters) {
    const u = f.t / f.life;
    ctx.save();
    ctx.globalAlpha = u > 0.7 ? (1 - u) / 0.3 : 1;
    ctx.translate(f.x, f.y - u * IH * 0.08);
    const s = f.t < 0.15 ? easeOutBack(f.t / 0.15) : 1;
    ctx.scale(s, s);
    outlinedText(f.text, 0, 0, f.color, "center", Math.round(IH * 0.045));
    ctx.restore();
  }
}

function hudCoinPos() {
  const fs = Math.round(IH * 0.05), top = Math.round(IH * 0.09);
  ctx.font = `800 ${fs}px system-ui, sans-serif`;
  return [IW - 20 - ctx.measureText(String(coins)).width * 1.1, top + 4 + fs * 1.65];
}

function drawHud() {
  const fs = Math.round(IH * 0.05);
  const top = Math.round(IH * 0.09);                // leave room for the close button
  const [hx, hy] = hudCoinPos();
  for (const c of flyCoins) {                       // collected coins fly into the counter
    if (c.t < 0) continue;
    const u = clamp(c.t / 0.45, 0, 1), e = u * u;
    const x = c.x + (hx - c.x) * e, y = c.y + (hy - c.y) * e - Math.sin(u * Math.PI) * IH * 0.08;
    disc(x, y, fs * 0.3, "#ffd84a");
    disc(x - 1, y - 1, fs * 0.14, "#fff3b0");
  }
  ctx.save();
  ctx.translate(IW - 8, top + fs);
  ctx.scale(1 + scorePunch * 0.12, 1 + scorePunch * 0.12);
  outlinedText(String(Math.floor(score)).padStart(6, "0"), 0, 0, "#fff", "right", fs);
  ctx.restore();
  ctx.save();
  ctx.translate(IW - 8, top + 4 + fs * 2);
  ctx.scale(1 + coinPunch * 0.25, 1 + coinPunch * 0.25);
  outlinedText(String(coins), 0, 0, "#ffd84a", "right", fs);
  ctx.restore();
  disc(hx, hy, fs * 0.36 * (1 + coinPunch * 0.3), "#b8860b");
  disc(hx, hy, fs * 0.3 * (1 + coinPunch * 0.3), "#ffd84a");
  if (best > 0) outlinedText(`BEST ${best}`, IW - 8, top + 10 + fs * 2.8, "rgba(255,255,255,0.8)", "right", Math.round(fs * 0.55), 700);

  const m = multiplier();
  outlinedText(`x${m}`, 8, 8 + fs, boostT > 0 ? "#d6a4ff" : "#9cf36b", "left", fs);
  let y = 16 + fs * 2;
  if (magnetT > 0) {
    drawMagnetIcon(16, y, fs * 0.45, "#e23a3a");
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(28, y - 3, 44, 6);
    ctx.fillStyle = "#ff6a5a";
    ctx.fillRect(29, y - 2, 42 * magnetT / MAGNET_T, 4);
    y += fs * 1.1;
  }
  if (boostT > 0) {
    outlinedText("2X", 8, y + fs * 0.35, "#d6a4ff", "left", Math.round(fs * 0.7));
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(28, y - 3, 44, 6);
    ctx.fillStyle = "#c89bff";
    ctx.fillRect(29, y - 2, 42 * boostT / BOOST_T, 4);
  }
}

function drawCrash() {
  if (crash.t < 0.15) {
    ctx.fillStyle = `rgba(255,255,255,${1 - crash.t / 0.15})`;
    ctx.fillRect(0, 0, IW, IH);
  }
  if (crash.t > 0.45) {
    const u = Math.min(1, (crash.t - 0.45) / 0.3), s = easeOutBack(u);
    ctx.fillStyle = `rgba(0,0,0,${0.45 * u})`;
    ctx.fillRect(0, 0, IW, IH);
    const w = Math.min(IW * 0.86, IH * 0.6), h = IH * 0.3;
    ctx.save();
    ctx.translate(IW / 2, IH * 0.46);
    ctx.scale(s, s);
    ctx.fillStyle = "rgba(20,24,40,0.85)";
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(-w / 2, -h / 2, w, h, 12); else ctx.rect(-w / 2, -h / 2, w, h);
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.25)";
    ctx.lineWidth = 2;
    ctx.stroke();
    outlinedText("💥 BONK!", 0, -h * 0.18, "#fff", "center", Math.round(IH * 0.07), 900);
    outlinedText(`score ${Math.floor(score)}`, 0, h * 0.08, "#ffffff", "center", Math.round(IH * 0.042), 700);
    outlinedText(`coins ${coins}`, 0, h * 0.25, "#ffd84a", "center", Math.round(IH * 0.036), 700);
    if (crash.newBest && best > 0 && Math.sin(crash.t * 10) > -0.4) {
      outlinedText("NEW BEST!", 0, h * 0.42, "#ff9ff3", "center", Math.round(IH * 0.04), 900);
    }
    ctx.restore();
  }
}

const SCENERY_DRAW = { building: drawBuilding, tree: drawTree, bush: drawBush, lamp: drawLamp, bridge: drawBridge,
                       tunnel: drawTunnel, station: drawStation };
const TRACK_DRAW = { train: drawTrain, ramp: drawRamp, block: drawBlock, low: drawBarrier, high: drawBarrier };
const FLAT_DECOR = new Set(["puddle", "stain", "manhole", "paper", "flowers"]);

// Sort key for things on the tracks. A train or ramp the player is standing
// on must be drawn *before* the player (and before its own roof coins), so it
// is keyed by its far end instead of its near end.
function trackKey(o) {
  const near = Math.max(cz(o.wz), NEAR);
  const under = (o.type === "train" || o.type === "ramp") && Math.abs(o.x - player.x) < 0.7 &&
                near < PLAYER_Z && cz(o.wz + o.len) > PLAYER_Z - 0.2;
  if (!under) return near;
  return Math.max(PLAYER_Z + 0.01, cz(o.wz + o.len) - (o.type === "ramp" ? 0.001 : 0));
}

function draw() {
  setProjection();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  if (shake > 0) ctx.translate(rand(-shake, shake), rand(-shake, shake));
  drawSky();
  drawTrack();
  drawFloors();
  scenery.sort((a, b) => b.z0 - a.z0);
  for (const o of scenery) SCENERY_DRAW[o.kind]?.(o);
  drawPolesAndWires();
  const props = decor.filter(d => !FLAT_DECOR.has(d.kind)).sort((a, b) => b.wz - a.wz);
  for (const d of props) drawProp(d);

  // Everything on the tracks, far to near (painter's algorithm). Coins that
  // sit on a train roof or ramp ride along with it so the roof can't hide them.
  const items = [], riders = new Map();
  for (const o of obstacles) items.push([trackKey(o), o]);
  for (const c of coinList) {
    if (c.taken) continue;
    const sup = !c.pull && c.base > 0.05 &&
      obstacles.find(o => (o.type === "train" || o.type === "ramp") && o.x === c.x && c.wz >= o.wz && c.wz <= o.wz + o.len);
    if (sup) { if (!riders.has(sup)) riders.set(sup, []); riders.get(sup).push(c); }
    else items.push([cz(c.wz), c]);
  }
  for (const p of pickups) if (!p.taken) items.push([cz(p.wz), p]);
  items.push([PLAYER_Z, player]);
  items.sort((a, b) => b[0] - a[0]);
  for (const [, it] of items) {
    if (it === player) drawPlayer();
    else if (it.type) {
      TRACK_DRAW[it.type](it);
      const r = riders.get(it);
      if (r) for (const c of r.sort((a, b) => b.wz - a.wz)) drawCoin(c);
    } else if (it.kind) drawPickup(it);
    else drawCoin(it);
  }

  ctx.setTransform(1, 0, 0, 1, 0, 0);
  drawParticles();
  drawSpeedLines();
  drawVignette();
  drawPopups();
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
