// ---- car (opponent) ---------------------------------------------------
function Car(offset, z, skill, hue) {
  this.offset = offset;         // road units, -1..1
  this.z = z;                   // world z within a lap
  this.lap = 0;
  this.speed = 0;
  this.skill = skill;           // 0.90 .. 0.99 pace multiplier
  this.hue = hue;               // shade index for drawing
  this.targetOffset = offset;
  this.lane = 0;
  this.hitCd = 0;
  this.best = 0;
  this.lapStart = 0;
  this.stumble = 0;             // seconds of penalty after a sprite hit
  this.total = z;               // cumulative distance (lap*len + z)
  this.boost = 0;
}

// ---- world ------------------------------------------------------------
function createWorld(opts) {
  opts = opts || {};
  var segments = opts.segments || buildTrack();
  var w = {
    segments: segments,
    n: segments.length,
    trackLength: segments.length * SEG_LEN,
    state: 'attract',
    clock: 0,
    qualiLeft: QUALI_TIME,
    raceTime: 0,
    lap: 0,
    lapStart: 0,
    lapTimes: [],
    bestLap: 0,
    qualiBest: 0,
    countdown: 0,
    gridIndex: 0,
    finishPos: 0,
    shake: 0,
    flash: 0,
    message: '',
    messageT: 0,
    offRoadT: 0,
    player: {
      pos: 0, speed: 0, x: 0,
      steer: 0,                    // -1..1 smoothed steering wheel
      wheel: 0,                    // display angle, deg
      lap: 0, lapStart: 0, lapTimes: [], best: 0,
      hits: 0, offRoad: 0, drifting: 0, total: 0, finished: false
    },
    cars: [],
    aiTimes: [],
    ranking: [],
    seed: opts.seed || 20261103,
    rnd: mulberry32(opts.seed || 20261103),
    events: []                     // transient events for FX layer
  };
  for (var i = 0; i < w.segments.length; i++) w.segments[i].cars = [];
  if (w.cars.length) seedAiTimes(w);
  return w;
}

function clearCars(w) {
  for (var i = 0; i < w.n; i++) w.segments[i].cars.length = 0;
  w.cars.length = 0;
}

// ---- opponents --------------------------------------------------------
var AI_NAMES = ['VESTER', 'KOVAC', 'AMARI', 'DELACROIX', 'NORDBERG', 'HAZZARD'];

function spawnField(w, count, pace) {
  clearCars(w);
  count = count || 6;
  pace = pace || 1;
  var rnd = mulberry32(w.seed ^ 0x5A17);
  for (var i = 0; i < count; i++) {
    var skill = 0.880 + (i / (count - 1)) * 0.100 + rnd() * 0.006;
    var c = new Car(0, 0, clamp(skill, 0.86, 0.995), i % 4);
    c.name = AI_NAMES[i % AI_NAMES.length];
    c.lane = (i % 3) - 1;
    c.offset = c.lane * 0.58;
    c.targetOffset = c.offset;
    c.speed = MAX_SPEED * 0.7 * pace;
    c.z = ((i + 1) * Math.floor(w.n / (count + 1))) * SEG_LEN;
    c.total = c.z;
    w.cars.push(c);
  }
  return w.cars;
}

// simulated single-lap times so qualifying has something to beat
function seedAiTimes(w) {
  var rnd = mulberry32(w.seed ^ 0xBEEF);
  w.aiTimes = [];
  for (var i = 0; i < w.cars.length; i++) {
    var c = w.cars[i];
    var base = LAP_TARGET * (2 - c.skill) * (1 + (rnd() - 0.5) * 0.012);
    w.aiTimes.push({ name: c.name, time: base, skill: c.skill, car: c });
  }
  w.aiTimes.sort(function (a, b) { return a.time - b.time; });
}

// ---- racing line ------------------------------------------------------
// Target lateral offset per segment: ease into the apex, run wide on exit.
function buildRacingLine(w) {
  var n = w.n, seg = w.segments;
  var line = new Array(n);
  for (var i = 0; i < n; i++) {
    var ahead = 0, look = 0;
    for (var k = 1; k <= 16; k++) {
      var s = seg[(i + k) % n];
      var wt = 1 - k / 17;
      ahead += s.curve * wt;
      look += wt;
    }
    var target = clamp(-ahead / Math.max(1, look) * 0.20, -0.74, 0.74);
    if (seg[i].absCurve < 0.35) target = seg[i].dir * 0.10;
    line[i] = target;
  }
  // smooth pass
  var out = new Array(n);
  for (var j = 0; j < n; j++) {
    out[j] = (line[(j - 2 + n) % n] + 2 * line[(j - 1 + n) % n] + 3 * line[j] +
              2 * line[(j + 1) % n] + line[(j + 2) % n]) / 9;
  }
  w.raceLine = out;
  return out;
}

// slowest safe speed entering the corner ahead
function cornerLimit(w, segIndex) {
  var n = w.n, seg = w.segments;
  var worst = 0;
  for (var k = 0; k < 30; k++) {
    var s = seg[(segIndex + k) % n];
    var wt = 1 - k / 32;
    var v = s.absCurve * wt;
    if (v > worst) worst = v;
  }
  var f = 1 / (1 + 0.052 * worst * worst);
  return MAX_SPEED * clamp(f, 0.50, 1);
}
