// ---- deterministic rng ------------------------------------------------
function mulberry32(a) {
  return function () {
    a = (a + 0x6D2B79F5) | 0;
    var t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }
function lerp(a, b, t) { return a + (b - a) * t; }
function easeIn(a, b, p) { return a + (b - a) * Math.pow(p, 2); }
function easeOut(a, b, p) { return a + (b - a) * (1 - Math.pow(1 - p, 2)); }
function easeInOut(a, b, p) { return a + (b - a) * (-Math.cos(p * Math.PI) / 2 + 0.5); }

// ---- track geometry ---------------------------------------------------
// A track is an array of segments. Each segment:
//   { index, curve, y1, y2, absCurve, dir, sprites:[{type,offset,flip}], cars:[] }
// The loop closes by index wrap; elevation returns to 0 by construction.

function TrackBuilder() {
  this.segments = [];
}

TrackBuilder.prototype.lastY = function () {
  var n = this.segments.length;
  return n ? this.segments[n - 1].y2 : 0;
};

TrackBuilder.prototype.addSegment = function (curve, spriteSeed) {
  var n = this.segments.length;
  var y1 = this.lastY();
  var seg = {
    index: n,
    curve: curve,
    y1: y1,
    y2: y1,
    absCurve: Math.abs(curve),
    dir: curve < 0 ? -1 : (curve > 0 ? 1 : 0),
    sprites: [],
    cars: [],
    clip: 0,
    fog: 1,
    p1: { world: { y: y1, z: n * SEG_LEN }, camera: {}, screen: {} },
    p2: { world: { y: y1, z: (n + 1) * SEG_LEN }, camera: {}, screen: {} }
  };
  this.segments.push(seg);
  return seg;
};

// extend: add n segments interpolating curve from c0->c1 and elevation dy total
// dyIn / dyOut are absolute elevations so sections join seamlessly
TrackBuilder.prototype.extend = function (n, curveIn, curveOut, dyIn, dyOut) {
  for (var i = 0; i < n; i++) {
    var p = (i + 1) / n;
    var seg = this.addSegment(easeInOut(curveIn, curveOut, p));
    seg.y2 = easeInOut(dyIn, dyOut, p);
  }
  return this;
};

TrackBuilder.prototype.relink = function () {
  var y = 0;
  for (var i = 0; i < this.segments.length; i++) {
    var s = this.segments[i];
    s.y1 = y;
    s.y2 = (i === this.segments.length - 1) ? 0 : s.y2;
    y = s.y2;
    s.p1.world.y = s.y1;
    s.p2.world.y = s.y2;
  }
  return this;
};

function straight(tb, n) { return tb.extend(n, 0, 0, tb.lastY(), tb.lastY()); }

function curve(tb, n, strength, dy) {
  var y0 = tb.lastY();
  return tb.extend(n, 0, strength, y0, y0 + (dy || 0));
}

function sCurve(tb, n, strength, dy) {
  var y0 = tb.lastY();
  tb.extend(n, 0, strength, y0, y0 + (dy || 0) * 0.5);
  return tb.extend(n, strength, 0, y0 + (dy || 0) * 0.5, y0 + (dy || 0));
}

function hill(tb, n, height) {
  var y0 = tb.lastY();
  tb.extend(Math.floor(n / 2), 0, 0, y0, y0 + height);
  return tb.extend(Math.ceil(n / 2), 0, 0, y0 + height, y0);
}

// ---- scenery ----------------------------------------------------------
var SPRITE_TYPES = {
  TREE_A: { key: 'TREE_A', w: 2.60, solid: 0.16 },
  TREE_B: { key: 'TREE_B', w: 3.60, solid: 0.16 },
  PALM:   { key: 'PALM',   w: 2.20, solid: 0.16 },
  POST:   { key: 'POST',   w: 0.70, solid: 0.07 },
  BOARD:  { key: 'BOARD',  w: 4.20, solid: 0.16 },
  STAND:  { key: 'STAND',  w: 7.00, solid: 0.22 },
  TYRES:  { key: 'TYRES',  w: 1.40, solid: 0.12 },
  SIGN:   { key: 'SIGN',   w: 1.50, solid: 0.12 }
};

function addSprite(tb, index, type, offset) {
  var n = tb.segments.length;
  if (index < 0 || index >= n) return;
  var seg = tb.segments[index];
  for (var i = 0; i < seg.sprites.length; i++) if (seg.sprites[i].type === type) return;
  seg.sprites.push({ type: type, offset: offset, flip: offset < 0 });
}
