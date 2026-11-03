// ---- sprite factory: everything drawn once into tiny offscreen canvases
function mkSprite(w, h, scale, paint) {
  var c = document.createElement('canvas');
  c.width = w; c.height = h;
  var g = c.getContext('2d');
  g.imageSmoothingEnabled = false;
  paint(g, w, h);
  return { canvas: c, w: w, h: h, scale: scale || 1 };
}

function px(g, x, y, w, h, col) { g.fillStyle = col; g.fillRect(x | 0, y | 0, Math.max(1, w | 0), Math.max(1, h | 0)); }

function buildSprites() {
  var A = PAT.levels[3], B = PAT.levels[2], C = PAT.levels[1], D = PAT.levels[0];

  SPRITES = {};
  CAR_SPRITES = [];

  // conifer
  SPRITES.TREE_A = mkSprite(22, 34, 1.0, function (g, w, h) {
    px(g, 9, 26, 4, 8, C);
    for (var i = 0; i < 6; i++) {
      var y = 4 + i * 4, half = 2 + i * 1.7;
      px(g, w / 2 - half, y, half * 2, 4, i % 2 ? B : A);
    }
    px(g, 0, 0, 2, 2, C);
  });

  // broadleaf
  SPRITES.TREE_B = mkSprite(28, 30, 1.05, function (g, w, h) {
    px(g, 12, 20, 4, 10, C);
    px(g, 4, 6, 20, 14, B);
    px(g, 7, 3, 14, 6, A);
    px(g, 2, 12, 6, 8, C);
    px(g, 20, 12, 6, 8, C);
  });

  // palm
  SPRITES.PALM = mkSprite(26, 40, 1.1, function (g, w, h) {
    px(g, 12, 12, 3, 28, C);
    px(g, 11, 10, 5, 3, B);
    for (var i = 0; i < 6; i++) {
      var ang = (i / 6) * Math.PI * 2;
      for (var t = 1; t < 9; t++) {
        var x = 13 + Math.cos(ang) * t * 1.4;
        var y = 11 + Math.sin(ang) * t * 0.9 + t * 0.28;
        px(g, x, y, 2, 2, t < 5 ? A : B);
      }
    }
  });

  // kerb post / marshal post
  SPRITES.POST = mkSprite(7, 30, 1.0, function (g, w, h) {
    px(g, 2, 6, 3, 24, C);
    px(g, 0, 2, 7, 6, A);
    px(g, 0, 2, 7, 2, B);
  });

  // advertising board
  SPRITES.BOARD = mkSprite(52, 26, 1.0, function (g, w, h) {
    px(g, 2, 18, 4, 8, C);
    px(g, 46, 18, 4, 8, C);
    px(g, 0, 2, 52, 17, D);
    px(g, 0, 2, 52, 1, A);
    px(g, 1, 3, 50, 15, B);
    var r = mulberry32(31);
    for (var i = 0; i < 5; i++) {
      var bw = 6 + Math.floor(r() * 16);
      px(g, 4 + i * 9, 6 + Math.floor(r() * 4), bw, 4, i % 2 ? A : D);
    }
  });

  // grandstand
  SPRITES.STAND = mkSprite(84, 34, 1.0, function (g, w, h) {
    px(g, 0, 4, w, 4, B);
    px(g, 0, 0, w, 3, A);
    for (var r = 0; r < 6; r++) {
      var y = 9 + r * 4;
      px(g, r * 2, y, w - r * 4, 4, C);
      var rr = mulberry32(r * 7 + 3);
      for (var x = r * 2; x < w - r * 4; x += 3) {
        if (rr() > 0.45) px(g, x, y + 1, 2, 2, rr() > 0.6 ? A : D);
      }
    }
    px(g, 0, 32, w, 2, D);
  });

  // tyre stack
  SPRITES.TYRES = mkSprite(20, 16, 1.0, function (g, w, h) {
    for (var r = 0; r < 3; r++) {
      px(g, 2, 2 + r * 5, 16, 5, D);
      px(g, 3, 3 + r * 5, 14, 3, B);
      px(g, 6, 4 + r * 5, 8, 1, A);
    }
  });

  // corner warning sign
  SPRITES.SIGN = mkSprite(18, 26, 1.0, function (g, w, h) {
    px(g, 8, 12, 2, 14, C);
    px(g, 1, 0, 16, 13, D);
    px(g, 2, 1, 14, 11, A);
    px(g, 5, 4, 8, 2, D);
    px(g, 5, 8, 8, 2, D);
  });

  // ---- opponent cars (rear 3/4 view, 4 shades)
  for (var s = 0; s < 4; s++) {
    CAR_SPRITES.push(mkSprite(46, 26, 1.0, mkCarPaint(s)));
  }
}

function mkCarPaint(shade) {
  return function (g, w, h) {
    var body = PAT.car[shade];
    var dark = PAT.levels[0];
    var hi = PAT.levels[3];
    // shadow
    g.globalAlpha = 0.55;
    px(g, 2, 21, 42, 5, dark);
    g.globalAlpha = 1;
    // rear tyres
    px(g, 1, 12, 8, 11, dark);
    px(g, 37, 12, 8, 11, dark);
    px(g, 2, 13, 6, 3, PAT.levels[1]);
    px(g, 38, 13, 6, 3, PAT.levels[1]);
    // diffuser + body
    px(g, 6, 18, 34, 4, dark);
    px(g, 5, 9, 36, 10, body);
    px(g, 9, 4, 28, 7, body);
    // cockpit / helmet
    px(g, 17, 2, 12, 6, dark);
    px(g, 19, 3, 8, 4, hi);
    // rear wing
    px(g, 3, 0, 40, 3, dark);
    px(g, 4, 0, 38, 2, body);
    px(g, 10, 3, 3, 5, dark);
    px(g, 33, 3, 3, 5, dark);
    // rain light + number panel
    px(g, 22, 12, 2, 3, hi);
    px(g, 14, 15, 18, 4, PAT.levels[0]);
    px(g, 15, 16, 16, 2, shade === 3 ? PAT.levels[1] : hi);
  };
}

var SPRITES = null;
var CAR_SPRITES = null;

// ---- particles (dust / smoke / sparks) --------------------------------
var PARTS = [];
function spawnPart(x, y, vx, vy, life, kind) {
  if (PARTS.length > 140) return;
  PARTS.push({ x: x, y: y, vx: vx, vy: vy, t: 0, life: life, kind: kind });
}

function updateParts(dt) {
  for (var i = PARTS.length - 1; i >= 0; i--) {
    var q = PARTS[i];
    q.t += dt;
    q.x += q.vx * dt;
    q.y += q.vy * dt;
    q.vy += 26 * dt;
    if (q.t >= q.life) PARTS.splice(i, 1);
  }
}

function renderParticles(ctx, w) {
  var p = w.player;
  var speedPct = p.speed / MAX_SPEED;

  // emitters anchored to the car on screen
  if (p.offRoad > 0.02 && speedPct > 0.10) {
    var nx = ctx.canvas.width / 2;
    var ny = ctx.canvas.height - (LAY ? LAY.band : 90) * 0.42;
    for (var k = 0; k < 3; k++) {
      spawnPart(nx + (Math.random() - 0.5) * 90, ny + Math.random() * 10,
        (Math.random() - 0.5) * 46, -20 - Math.random() * 40, 0.5, 'dirt');
    }
  }
  if (p.drifting > 0.4 && speedPct > 0.4) {
    spawnPart(ctx.canvas.width / 2 + (Math.random() - 0.5) * 120, ctx.canvas.height - (LAY ? LAY.band : 90) * 0.36, (Math.random() - 0.5) * 30, -14, 0.42, 'smoke');
  }
  void w;

  for (var i = 0; i < PARTS.length; i++) {
    var q = PARTS[i];
    var a = 1 - q.t / q.life;
    var sz = q.kind === 'smoke' ? 3 + q.t * 9 : 2 + q.t * 4;
    ctx.globalAlpha = Math.max(0, a * (q.kind === 'smoke' ? 0.75 : 1));
    ctx.fillStyle = q.kind === 'smoke' ? PAT.levels[2] : PAT.levels[3];
    ctx.fillRect(q.x | 0, q.y | 0, sz | 0, sz | 0);
  }
  ctx.globalAlpha = 1;
}
