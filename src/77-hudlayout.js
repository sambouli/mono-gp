// ---- HUD geometry -----------------------------------------------------
// Every HUD element is placed here and drawn from the rects returned, so
// panels cannot drift into each other. The test suite asserts the rects stay
// disjoint and on-screen across several aspect ratios.
function hudLayout(W, H, L) {
  var top = 3, h = 13;
  var R = {};

  // top row: chips left, position right, mirror centre (cockpit draws it)
  R.pause = { x: 3, y: top, w: 13, h: h };
  R.audio = { x: R.pause.x + R.pause.w + 2, y: top, w: 22, h: h };
  R.pos = { x: W - 3 - 34, y: top, w: 34, h: h };

  // second row: lap left, session clock right
  var r2 = top + h + 2;
  R.lap = { x: 3, y: r2, w: 47, h: h };
  R.clock = { x: W - 3 - 74, y: r2, w: 74, h: h };

  // third row: last / best
  R.last = { x: 3, y: r2 + h + 2, w: 84, h: 11 };
  R.best = { x: 3, y: R.last.y + 12, w: 84, h: 11 };

  // speed + gear: big, bottom-left, but kept ABOVE the wheel's reach so the
  // readout is never hidden under a thumb on the wheel
  var spY = Math.max(top + 2 * (h + 2) + 24, H - L.band - 24 - L.wheel.r - 4);
  if (spY < R.best.y + R.best.h + 4) spY = R.best.y + R.best.h + 4;
  R.speed = { x: 3, y: Math.round(spY), w: 74, h: 24 };
  R.gear = { x: R.speed.x + R.speed.w + 2, y: Math.round(spY) + 6, w: 22, h: 18 };

  // rev tape rides just above the pedal cluster, under the thumbs
  var tapeX = L.brake.x;
  var tapeW = L.gas.x + L.gas.w - L.brake.x;
  R.tape = { x: Math.round(tapeX), y: Math.round(H - L.band - 11), w: Math.round(tapeW), h: 6 };

  // centre banner for messages
  R.msg = { x: Math.round(W * 0.5) - 78, y: Math.round(H * 0.30), w: 156, h: 20 };

  // rear-view mirror: centre, below the chip row, clear of everything
  var mw = Math.round(Math.min(W * 0.30, 84)), mh = 17;
  R.mirror = { x: Math.round(W / 2 - mw / 2), y: R.best.y + R.best.h + 2, w: mw, h: mh };

  R.chips = [R.pause, R.audio, R.pos, R.lap, R.clock, R.last, R.best, R.speed, R.gear, R.tape, R.mirror];
  return R;
}
