// ---- palette (4-level green LCD) -------------------------------------
// Scene colours are drawn near-solid; the post pass quantises the buffer to
// PAT.levels with a Bayer matrix, which is what produces the dithered
// monochrome look (and the fog bands).
var PAT = {
  levels: ['#04170b', '#0c3f20', '#1f8f47', '#8bffc0'],
  sky: ['#04170b', '#051d0e', '#06240f', '#072b12', '#083315'],
  hill: ['#0a3a1e', '#062112'],
  star: '#1f8f47',
  road: ['#0e4a26', '#0b3a1e', '#082a16', '#051c0f'],
  grassA: ['#06220f', '#051c0c', '#041609', '#041208'],
  grassB: ['#0a3318', '#072712', '#051c0d', '#041409'],
  rumbleA: ['#2fbf68', '#1f8f47', '#12602f', '#083019'],
  rumbleB: ['#04170b', '#04170b', '#051c0f', '#051c0f'],
  lane: ['#8bffc0', '#3fbb78', '#1f6f45', '#0c3f20'],
  solid: ['#8bffc0', '#4fd488', '#2a9a55', '#115a2e'],
  car: ['#8bffc0', '#3fbb78', '#1f8f47', '#0f5a2c'],
  ink: '#8bffc0',
  inkDim: '#2a9a55',
  inkFaint: '#12602f',
  panel: 'rgba(4,23,11,0.72)'
};

// ---- offscreen LCD buffer ---------------------------------------------
function makeBuffer() {
  var b = document.createElement('canvas');
  b.width = 2; b.height = 2;
  var ctx = b.getContext('2d', { alpha: false });
  return { canvas: b, ctx: ctx, w: 2, h: 2 };
}

// ---- post pass: ordered-dither quantise to the LCD palette ------------
var BAYER8 = [
  0, 32, 8, 40, 2, 34, 10, 42,
  48, 16, 56, 24, 50, 18, 58, 26,
  12, 44, 4, 36, 14, 46, 6, 38,
  60, 28, 52, 20, 62, 30, 54, 22,
  3, 35, 11, 43, 1, 33, 9, 41,
  51, 19, 59, 27, 49, 17, 57, 25,
  15, 47, 7, 39, 13, 45, 5, 37,
  63, 31, 55, 23, 61, 29, 53, 21
];
var LEVELS_RGB = [[4, 23, 11], [12, 63, 32], [31, 143, 71], [139, 255, 192]];
var LUT = new Uint8Array(256 * 64);

// Built at boot from the FINAL palette so the quantiser and the art agree.
function rebuildLuts() {
  LEVELS_RGB.length = 0;
  for (var i = 0; i < PAT.levels.length; i++) {
    var h = String(PAT.levels[i]).replace('#', '');
    LEVELS_RGB.push([
      parseInt(h.substring(0, 2), 16),
      parseInt(h.substring(2, 4), 16),
      parseInt(h.substring(4, 6), 16)
    ]);
  }
  var top = LEVELS_RGB.length - 1;
  for (var lum = 0; lum < 256; lum++) {
    var scaled = (lum / 255) * top;
    for (var t = 0; t < 64; t++) {
      // classic ordered dithering: dither amplitude = one quant step
      var li = Math.round(scaled + (t / 63 - 0.5));
      if (li < 0) li = 0;
      if (li > top) li = top;
      LUT[lum * 64 + t] = li;
    }
  }
}

function postLCD(srcCtx, W, H, outCtx, OW, OH, cell, scan) {
  var img = srcCtx.getImageData(0, 0, W, H);
  var d = img.data;
  var i = 0, y, x, t, li, px;
  for (y = 0; y < H; y++) {
    var row = (y & 7) << 3;
    var gridY = scan && (y % cell === 0);
    for (x = 0; x < W; x++) {
      t = BAYER8[row | (x & 7)];
      li = LUT[(((d[i] * 77 + d[i + 1] * 150 + d[i + 2] * 29) >> 8) << 6) | t];
      px = LEVELS_RGB[li];
      if (scan && (gridY || (x % cell === 0))) {
        d[i] = (px[0] * 3) >> 2; d[i + 1] = (px[1] * 3) >> 2; d[i + 2] = (px[2] * 3) >> 2;
      } else {
        d[i] = px[0]; d[i + 1] = px[1]; d[i + 2] = px[2];
      }
      i += 4;
    }
  }
  srcCtx.putImageData(img, 0, 0);
  outCtx.imageSmoothingEnabled = false;
  outCtx.drawImage(srcCtx.canvas, 0, 0, OW, OH);
}
