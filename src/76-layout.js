// ---- control layout, in buffer units ---------------------------------
// One layout drives both drawing and hit-testing, so the touch targets can
// never drift away from what the player sees. Every rect is clamped to stay
// on-screen and clear of its neighbours; the test suite asserts that.
function computeLayout(W, H) {
  var portrait = H > W;

  // control band: tall enough for thumb-sized pedals, short enough to leave
  // most of the screen for the road
  var band = Math.round(clamp(portrait ? H * 0.185 : H * 0.30, 54, 92));
  if (band > H * 0.34) band = Math.round(H * 0.34);

  // pedals: right-most, tallest first (gas), brake slightly inset
  var gw = Math.round(clamp(band * 0.60, 26, 58));
  var gh = band - 8;
  var bw = Math.round(clamp(gw * 0.9, 24, 54));
  var bh2 = gh - 10;
  var L = {};
  L.portrait = portrait;
  L.band = band;
  L.gas = { x: W - gw - 6, y: H - band + 4, w: gw, h: gh };
  L.brake = { x: L.gas.x - bw - 7, y: L.gas.y + 6, w: bw, h: bh2 };

  // wheel: bottom-left, radius clamped so the whole rim stays on screen
  var r = Math.round(clamp(band * 0.62, 24, 56));
  r = Math.min(r, Math.floor((W - 12) / 2), Math.floor((band - 6) / 2) + 12);
  var cx = Math.round(clamp(portrait ? W * 0.17 : W * 0.11, r + 5, W - r - 5));
  var cy = H - Math.round(band * 0.46);
  if (cy + r > H - 3) cy = H - 3 - r;
  if (cy - r < H - band - 26) cy = H - band - 26 + r;
  if (cy - r < 0) cy = r + 2;
  L.wheel = { cx: cx, cy: cy, r: r };

  // keep the wheel clear of the brake pedal
  var maxX = L.brake.x - 8;
  if (cx + r > maxX) {
    r = Math.max(18, maxX - cx);
    if (cy + r > H - 3) cy = H - 3 - r;
    L.wheel = { cx: cx, cy: cy, r: r };
  }
  return L;
}

function inRect(p, r) {
  return p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;
}

function inWheel(p, L) {
  var dx = p.x - L.wheel.cx, dy = p.y - L.wheel.cy;
  return (dx * dx + dy * dy) <= (L.wheel.r + 12) * (L.wheel.r + 12);
}
