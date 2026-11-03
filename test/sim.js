// headless tests: exercise the SHIPPING code from index.html
const fs = require('fs');
const vm = require('vm');

const html = fs.readFileSync(__dirname + '/../index.html', 'utf8');
const m = html.match(/<script>([\s\S]*?)<\/script>/);
if (!m) { console.error('no inline script'); process.exit(1); }

const store = {};
const sandbox = {
  module: { exports: {} },
  window: {}, globalThis: null, console,
  Math, Date, JSON, Uint8Array, Array, Object, String, Number, isNaN, parseInt, parseFloat,
  setTimeout, clearTimeout
};
sandbox.window = sandbox;
sandbox.globalThis = sandbox;
sandbox.localStorage = {
  getItem: k => (k in store ? store[k] : null),
  setItem: (k, v) => { store[k] = String(v); }
};
vm.createContext(sandbox);
vm.runInContext(m[1], sandbox, { filename: 'game.js' });

const G = sandbox.__game;
const C = G.CORE;
let fails = 0, runs = 0;
function ok(name, cond, extra) {
  runs++;
  if (cond) console.log('  ok   ' + name);
  else { fails++; console.log('  FAIL ' + name + (extra !== undefined ? '  -> ' + extra : '')); }
}
function near(a, b, tol) { return Math.abs(a - b) <= tol; }

console.log('\n== track ==');
const segs = C.buildTrack();
ok('track built', segs.length > 800, segs.length);
let totalCurve = 0, maxCurve = 0;
for (const s of segs) { totalCurve += s.curve; maxCurve = Math.max(maxCurve, Math.abs(s.curve)); }
ok('net loop curvature turns left+right (abs net < half lap)', Math.abs(totalCurve) < 400, totalCurve.toFixed(1));
ok('has real corners', maxCurve > 3, maxCurve);
ok('elevation closes to 0', segs[segs.length - 1].y2 === 0);
let yjerk = 0;
for (let i = 1; i < segs.length; i++) yjerk = Math.max(yjerk, Math.abs(segs[i].y1 - segs[i - 1].y2));
ok('elevation continuous', yjerk < 0.001, yjerk);
let sprites = 0; for (const s of segs) sprites += s.sprites.length;
ok('scenery populated', sprites > 500, sprites);
ok('no solid sprite within the racing lanes', (() => {
  for (const s of segs) for (const sp of s.sprites) {
    if (Math.abs(sp.offset) < 1.02) return false;
  }
  return true;
})());
const lapFlatOut = segs.length * C.consts.SEG_LEN / C.consts.MAX_SPEED;
ok('flat-out lap ~25s (race pace ~30s)', lapFlatOut > 21 && lapFlatOut < 28, lapFlatOut.toFixed(1));

console.log('\n== bot lap time (race-pace reference) ==');
function botRun(seed, inputFn, secs) {
  const w = C.createWorld({ seed: seed });
  C.buildRacingLine(w);
  C.spawnField(w, 6, 1);
  C.toQuali(w);
  const dt = 1 / 60;
  let t = 0, best = 0;
  const limit = Math.min(secs, C.consts.QUALI_TIME - 0.5);
  while (t < limit && w.state === 'quali') {
    const inp = inputFn(w, dt);
    C.step(w, dt, inp);
    t += dt;
    if (w.qualiBest > 0) best = w.qualiBest;
  }
  return { w, best, t };
}
const bot = botRun(4242, (w) => C.autopilot(w), 74);
ok('bot completes at least one clean lap', bot.best > 24 && bot.best < 37, bot.best.toFixed(2));
const aiTimes = bot.w.aiTimes.map(a => a.time).sort((a, b) => a - b);
ok('AI reference laps sit near 30s', aiTimes[0] > 25 && aiTimes[aiTimes.length - 1] < 38,
  aiTimes.map(x => x.toFixed(1)).join(' '));
ok('AI field is spread out', aiTimes[aiTimes.length - 1] - aiTimes[0] > 1.2,
  (aiTimes[aiTimes.length - 1] - aiTimes[0]).toFixed(2));

console.log('\n== qualifying flow ==');
{
  const w = C.createWorld({ seed: 7 });
  C.buildRacingLine(w);
  C.spawnField(w, 6, 1);
  C.toQuali(w);
  ok('starts in quali', w.state === 'quali');
  ok('quali clock = 75', Math.abs(w.qualiLeft - 75) < 0.01, w.qualiLeft);
  const dt = 1 / 60;
  let t = 0;
  while (t < 76.5 && w.state === 'quali') { C.step(w, dt, C.autopilot(w)); t += dt; }
  ok('quali ends on the clock', w.state === 'qualiDone', w.state);
  ok('clock does not go negative', w.qualiLeft >= 0);
  ok('board has player + 6 rivals', w.qualified && w.qualified.length === 7, w.qualified && w.qualified.length);
  ok('board sorted ascending', w.qualified.every((r, i) => i === 0 || r.time >= w.qualified[i - 1].time));
  C.toGrid(w);
  ok('goes to grid', w.state === 'grid');
  ok('grid countdown set', w.countdown > 3);
  ok('player parked behind the field', w.player.pos < w.cars[0].z || w.gridIndex >= 0);
  while (w.state === 'grid') C.step(w, dt, { steer: 0, gas: 0, brake: 0 });
  ok('race starts after countdown', w.state === 'race');
}

console.log('\n== 5-lap race finishes, order is sane ==');
{
  const w = C.createWorld({ seed: 99 });
  C.buildRacingLine(w);
  C.spawnField(w, 6, 1);
  C.toQuali(w);
  const dt = 1 / 60;
  let t = 0;
  while (w.state === 'quali') { C.step(w, dt, C.autopilot(w)); t += dt; }
  C.toGrid(w);
  while (w.state === 'grid') C.step(w, dt, { steer: 0, gas: 0, brake: 0 });
  let guard = 0;
  const start = t;
  while (w.state === 'race' && guard++ < 60 * 400) C.step(w, dt, C.autopilot(w));
  const raceTime = guard / 60;
  ok('race reaches results', w.state === 'results', w.state);
  ok('player completed 5 laps', w.player.lap >= 5, w.player.lap);
  ok('exactly 5 recorded laps', w.player.lapTimes.length === 5, w.player.lapTimes.length);
  ok('race length plausible (90-200s)', raceTime > 90 && raceTime < 200, raceTime.toFixed(1));
  ok('every lap plausible (24-42s)', w.player.lapTimes.every(x => x > 24 && x < 42),
    w.player.lapTimes.map(x => x.toFixed(1)).join(' '));
  const r = C.rankField(w);
  ok('ranking has 7 entries', r.length === 7, r.join(','));
  ok('player is classified', r.indexOf('YOU') >= 0, r.join(','));
  ok('AI also completed ~5 laps', w.cars.every(c => c.lap >= 4), w.cars.map(c => c.lap).join(','));
  ok('finish times finite', w.rankInfo.every(x => isFinite(x.total)));
}

console.log('\n== collisions ==');
{
  // aim the player into a rival: put a slow car on the line ahead
  const w = C.createWorld({ seed: 5 });
  C.buildRacingLine(w);
  C.spawnField(w, 1, 1);
  C.toQuali(w);
  const c = w.cars[0];
  c.z = w.player.pos + C.consts.SEG_LEN * 2;
  c.offset = 0; c.targetOffset = 0; c.speed = 0; c.skill = 0.5;
  const dt = 1 / 60;
  for (let i = 0; i < 120; i++) C.step(w, dt, { steer: 0, gas: 1, brake: 0 });
  ok('rear-end registers a contact', w.player.hits >= 1, w.player.hits);
  ok('contact costs speed', w.player.speed < C.consts.MAX_SPEED, (w.player.speed / C.consts.MAX_SPEED).toFixed(2));
}
{
  // run-off room: on a straight the player can leave the road without dying
  const w = C.createWorld({ seed: 11 });
  C.buildRacingLine(w);
  C.spawnField(w, 0, 1);
  C.toQuali(w);
  const dt = 1 / 60;
  for (let i = 0; i < 60 * 3.5; i++) C.step(w, dt, { steer: -1, gas: 0.7, brake: 0 });
  ok('run-off area exists (off-road without a hit)', w.player.hits === 0 && Math.abs(w.player.x) > 1.6,
    'hits=' + w.player.hits + ' x=' + w.player.x.toFixed(2));
  ok('leaving the road scrubs speed', w.player.speed < C.consts.MAX_SPEED * 0.55,
    (w.player.speed / C.consts.MAX_SPEED).toFixed(2));
}
{
  // scenery hit: aim at a corner hazard
  const w = C.createWorld({ seed: 11 });
  C.buildRacingLine(w);
  C.spawnField(w, 0, 1);
  C.toQuali(w);
  let target = null;
  for (let i = 0; i < w.n && !target; i++) {
    for (const sp of w.segments[i].sprites) {
      if (Math.abs(sp.offset) < 2.0) { target = { i: i, off: sp.offset }; break; }
    }
  }
  ok('corner hazards sit off the apex', !!target && Math.abs(target.off) > 1.0, target && target.off);
  w.player.pos = Math.max(0, (target.i - 3) * C.consts.SEG_LEN);
  w.player.x = target.off - Math.sign(target.off) * 0.24;
  w.player.speed = C.consts.MAX_SPEED * 0.22;
  const dt = 1 / 60;
  for (let i = 0; i < 120 && w.player.hits === 0; i++) {
    C.step(w, dt, { steer: Math.sign(target.off), gas: 0.3, brake: 0 });
  }
  ok('hitting scenery registers a contact', w.player.hits >= 1, w.player.hits);
  ok('a crash kills most of the speed', w.player.speed < C.consts.MAX_SPEED * 0.35,
    (w.player.speed / C.consts.MAX_SPEED).toFixed(2));
}

console.log('\n== determinism ==');
{
  function run(seed) {
    const w = C.createWorld({ seed: seed });
    C.buildRacingLine(w);
    C.spawnField(w, 6, 1);
    C.toQuali(w);
    for (let i = 0; i < 60 * 30; i++) C.step(w, 1 / 60, C.autopilot(w));
    return w.player.total.toFixed(9) + '|' + w.cars.map(c => c.total.toFixed(6)).join(',');
  }
  ok('same seed -> identical sim', run(31) === run(31));
  ok('different seed -> diverges', run(31) !== run(32));
}

console.log('\n== robustness ==');
{
  const w = C.createWorld({ seed: 3 });
  C.buildRacingLine(w);
  C.spawnField(w, 6, 1);
  C.toQuali(w);
  let bad = false;
  for (let i = 0; i < 60 * 90; i++) {
    const inp = {
      steer: (i % 97) / 48 - 1, gas: (i % 13) / 12, brake: (i % 31) / 30
    };
    C.step(w, 0.25, inp);   // worst-case dt
    const p = w.player;
    if (!isFinite(p.pos) || !isFinite(p.speed) || !isFinite(p.x)) bad = true;
    for (const c of w.cars) if (!isFinite(c.total) || !isFinite(c.speed)) bad = true;
    if (p.speed < 0 || p.speed > C.consts.MAX_SPEED + 1) bad = true;
    if (Math.abs(p.x) > 3) bad = true;
  }
  ok('no NaN / runaway state under hostile input + 0.25s steps', !bad);
  ok('event list stays bounded', w.events.length <= 16, w.events.length);
  ok('segment car lists stay consistent',
    (() => { let n = 0; for (const s of w.segments) n += s.cars.length; return n === w.cars.length; })());
}

console.log('\n== formatting ==');
ok('fmtTime zero -> dashes', C.fmtTime(0) === '--:--.---', C.fmtTime(0));
ok('fmtTime 65.5 -> 1:05.500', C.fmtTime(65.5) === '1:05.500', C.fmtTime(65.5));
ok('layout puts both pedals right of centre', (() => {
  const L = C.computeLayout(340, 200);
  return L.gas.x > 170 && L.brake.x > 170 && L.brake.x + L.brake.w < L.gas.x;
})());
ok('layout keeps the wheel clear of the pedals', (() => {
  const L = C.computeLayout(340, 200);
  return L.wheel.cx + L.wheel.r < L.brake.x;
})());
ok('layout fits the screen', (() => {
  const L = C.computeLayout(340, 200);
  return L.gas.y + L.gas.h <= 200 && L.gas.x + L.gas.w <= 340;
})());

console.log('\n== hud geometry ==');
function rectTests(W, H, tag) {
  const L = C.computeLayout(W, H);
  const R = C.hudLayout(W, H, L);
  const overlaps = [];
  for (let i = 0; i < R.chips.length; i++) {
    for (let j = i + 1; j < R.chips.length; j++) {
      const a = R.chips[i], b = R.chips[j];
      if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) {
        overlaps.push(i + '/' + j);
      }
    }
  }
  ok(tag + ': no HUD panel overlaps', overlaps.length === 0, overlaps.join(' '));
  const off = R.chips.filter(r => r.x < 0 || r.y < 0 || r.x + r.w > W || r.y + r.h > H);
  ok(tag + ': all HUD panels on screen', off.length === 0, off.map(r => r.x + ',' + r.y + ',' + r.w).join(' '));
  ok(tag + ': controls on the right half', L.gas.x > W / 2 && L.brake.x > W / 2, L.gas.x + '/' + L.brake.x);
  ok(tag + ': gas is the right-most control', L.gas.x + L.gas.w <= W && L.brake.x + L.brake.w <= L.gas.x);
  ok(tag + ': wheel clear of pedals', L.wheel.cx + L.wheel.r <= L.brake.x,
    (L.wheel.cx + L.wheel.r) + ' vs ' + L.brake.x);
  ok(tag + ': wheel on screen', L.wheel.cx - L.wheel.r >= 0 && L.wheel.cy + L.wheel.r <= H,
    L.wheel.cx + ',' + L.wheel.cy + ',' + L.wheel.r);
  ok(tag + ': pedals big enough for a thumb (>=40 buffer units tall)',
    L.gas.h >= 40 && L.brake.h >= 34, L.gas.h + '/' + L.brake.h);
  const ctrl = [L.gas, L.brake, { x: L.wheel.cx - L.wheel.r, y: L.wheel.cy - L.wheel.r,
                                  w: L.wheel.r * 2, h: L.wheel.r * 2 }];
  const hitCtrl = [];
  for (const r of R.chips) for (const c of ctrl) {
    if (r.x < c.x + c.w && c.x < r.x + r.w && r.y < c.y + c.h && c.y < r.y + r.h) {
      hitCtrl.push(r.x + ',' + r.y);
    }
  }
  ok(tag + ': no HUD panel sits on top of a control', hitCtrl.length === 0, hitCtrl.join(' '));
}
rectTests(250, 645, 'portrait');
rectTests(440, 176, 'landscape');
rectTests(320, 568, 'small portrait');
rectTests(440, 300, 'tablet');

console.log('\n== font rasterizer orientation ==');
// Render every glyph through the shipping text() and compare to an
// independent MSB-first decode of the table (bit 4 = LEFT pixel).
// Guards against the mirror bug where bit 0 was taken as the left column.
function rasterize(ch) {
  const px = new Set();
  const ctx = { font: '', textBaseline: '', fillStyle: '',
    fillRect: (x, y, w, h) => {
      for (let dx = 0; dx < w; dx++) for (let dy = 0; dy < h; dy++)
        px.add((x + dx) + ',' + (y + dy));
    } };
  C.text(ctx, ch, 0, 0, 1, '#fff', 'left');
  return px;
}
function expectBits(ch) {
  const g = C.GLYPHS[ch] || C.GLYPHS['?'];
  const px = new Set();
  for (let r = 0; r < 7; r++) for (let c = 0; c < 5; c++)
    if ((g[r] >> (4 - c)) & 1) px.add(c + ',' + r);
  return px;
}
const same = (a, b) => a.size === b.size && [...a].every(k => b.has(k));
let mirrorBad = [], asymChecked = 0;
for (const ch of Object.keys(C.GLYPHS)) {
  if (!same(rasterize(ch), expectBits(ch))) mirrorBad.push(ch);
}
ok('every glyph rasterizes in the correct (non-mirrored) orientation',
  mirrorBad.length === 0, mirrorBad.join(''));
// asymmetric glyphs must NOT equal their horizontal flip
for (const ch of ['2', '5', '6', '7', '9', 'A', 'B', 'E', 'F', 'G', 'J', 'K',
                  'L', 'P', 'R', 'S', 'Z', '/', '<', '>', '?', '!']) {
  const g = C.GLYPHS[ch]; if (!g) continue;
  const flipped = new Set();
  for (const [k] of expectBits(ch)) { const [c, r] = k.split(','); flipped.add((4 - +c) + ',' + r); }
  if (!same(rasterize(ch), flipped)) asymChecked++;
}
ok('asymmetric glyphs differ from their mirror image', asymChecked >= 20, asymChecked);
// the specific bug signature: 'L' (0x10 rows) must light the LEFT column
const Lpx = rasterize('L');
ok("'L' stem is on the left", Lpx.has('0,0') && !Lpx.has('4,0'));
ok("'7' top-right stroke descends leftward", rasterize('7').has('4,1') && !rasterize('7').has('0,1'));
ok("'2' second row is on the right", rasterize('2').has('4,1') && !rasterize('2').has('0,1'));

console.log('\n' + (fails ? 'FAILED ' + fails + '/' + runs : 'ALL PASS ' + runs + '/' + runs));
process.exit(fails ? 1 : 0);
