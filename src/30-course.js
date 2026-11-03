// ---- the one track ----------------------------------------------------
var SC = 5;   // density scale: 1 "design unit" = SC segments (~1400 segs total)

function buildTrack() {
  var tb = new TrackBuilder();

  straight(tb, 24 * SC);                            // start / finish straight
  curve(tb, 18 * SC, 2.4, 0);                       // long right sweeper
  straight(tb, 8 * SC);
  sCurve(tb, 12 * SC, -3.2, 2400);                  // esses climbing
  straight(tb, 10 * SC);
  hill(tb, 14 * SC, 4600);                          // crest
  curve(tb, 16 * SC, 4.4, -2000);                   // right, dropping
  straight(tb, 10 * SC);
  sCurve(tb, 11 * SC, 3.6, -2200);                  // right-left descent
  straight(tb, 8 * SC);
  curve(tb, 15 * SC, -5.0, 0);                      // long left (hairpin-ish)
  hill(tb, 12 * SC, -3600);                         // dips into the bowl
  straight(tb, 14 * SC);
  curve(tb, 12 * SC, -2.8, 1700);
  straight(tb, 7 * SC);
  sCurve(tb, 10 * SC, 3.0, -1700);
  straight(tb, 20 * SC);                            // back straight to line

  tb.relink();
  decorate(tb);
  return tb.segments;
}

function decorate(tb) {
  var rnd = mulberry32(0xC0FFEE);
  var n = tb.segments.length;

  // grandstands + flags around the start/finish straight
  for (var i = 2 * SC; i < 26 * SC; i += 4) {
    addSprite(tb, i, 'STAND', -2.75);
    addSprite(tb, i + 2, 'STAND', 2.75);
  }
  addSprite(tb, 9 * SC, 'BOARD', -2.45);
  addSprite(tb, 17 * SC, 'SIGN', 2.30);

  // continuous tree band, denser off the racing line
  for (var s = 0; s < n; s++) {
    var r = rnd();
    if (r < 0.30) addSprite(tb, s, 'TREE_A', -(2.05 + rnd() * 2.4));
    if (r > 0.68) addSprite(tb, s, 'TREE_B', 2.05 + rnd() * 2.4);
    if (r > 0.955) addSprite(tb, s, 'PALM', -(2.30 + rnd() * 1.4));
    if (r < 0.045) addSprite(tb, s, 'PALM', 2.30 + rnd() * 1.4);
  }

  // hazard markers on the outside of every meaningful corner
  for (var q = 0; q < n; q++) {
    var seg = tb.segments[q];
    if (seg.absCurve > 2.6 && q % (3 * SC) === 0) {
      addSprite(tb, q, 'TYRES', seg.dir * 1.50);
      addSprite(tb, q + SC, 'SIGN', seg.dir * 1.75);
    }
    if (seg.absCurve > 3.8 && q % (2 * SC) === 0) {
      addSprite(tb, q, 'POST', seg.dir * 1.42);
    }
  }

  // advertising boards on the long straights
  for (var b = 0; b < n; b += 9 * SC) {
    if (tb.segments[b].absCurve < 0.4) {
      if (b > 4 * SC) addSprite(tb, b, 'BOARD', rnd() < 0.5 ? -2.45 : 2.45);
    }
  }
}
