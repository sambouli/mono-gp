// ---- projection -------------------------------------------------------
function project(p, camX, camY, camZ, camDepth, width, height, roadWidth) {
  p.camera.x = (p.world.x || 0) - camX;
  p.camera.y = (p.world.y || 0) - camY;
  p.camera.z = (p.world.z || 0) - camZ;
  var zz = p.camera.z === 0 ? 1 : p.camera.z;
  p.screen.scale = camDepth / zz;
  p.screen.x = Math.round((width / 2) + (p.screen.scale * p.camera.x * width / 2));
  p.screen.y = Math.round((height / 2) - (p.screen.scale * p.camera.y * height / 2));
  p.screen.w = Math.round(p.screen.scale * roadWidth * width / 2);
}

function segColors(w, seg) {
  var band = Math.floor(seg.index / RUMBLE) % 2 === 0;
  var fog = seg.fogLevel;                      // 0 near .. 3 far
  return {
    road: PAT.road[fog],
    grass: band ? PAT.grassA[fog] : PAT.grassB[fog],
    rumble: band ? PAT.rumbleA[fog] : PAT.rumbleB[fog],
    lane: band ? null : PAT.lane[fog]
  };
}

function poly(ctx, x1, y1, x2, y2, x3, y3, x4, y4, fill) {
  if (!fill) return;
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(x1, y1); ctx.lineTo(x2, y2); ctx.lineTo(x3, y3); ctx.lineTo(x4, y4);
  ctx.closePath();
  ctx.fill();
}

// ---- sprite drawing ---------------------------------------------------
function drawSprite(ctx, img, cx, cy, destW, destH, clipY, alpha) {
  if (!img || !img.canvas) return;
  if (destW < 1 || destH < 1) return;
  var clipH = Math.max(0, Math.min(destH, cy + destH - clipY));
  if (clipH >= destH) clipH = 0;
  if (alpha !== undefined) ctx.globalAlpha = alpha;
  ctx.drawImage(img.canvas,
    0, 0, img.w, img.h - (img.h * clipH / destH),
    Math.round(cx - destW / 2), Math.round(cy),
    Math.round(destW), Math.round(destH - clipH));
  if (alpha !== undefined) ctx.globalAlpha = 1;
}

function spriteImg(type) { return SPRITES[type] || null; }

// ---- main render ------------------------------------------------------
function renderScene(ctx, w, W, H) {
  var p = w.player;
  var camPos = p.pos - PLAYER_Z;
  if (camPos < 0) camPos += w.trackLength;
  var base = findSegment(w, camPos);
  var basePercent = (camPos % SEG_LEN) / SEG_LEN;
  var camY = CAM_H + (base.p1.world.y + (base.p2.world.y - base.p1.world.y) * basePercent);
  var skyY = Math.round(H * 0.5 - camY * 0.00018 * H);

  var shakeX = 0, shakeY = 0;
  if (w.shake > 0.01) {
    shakeX = (Math.random() - 0.5) * w.shake * 14;
    shakeY = (Math.random() - 0.5) * w.shake * 10;
  }
  ctx.save();
  ctx.translate(Math.round(shakeX), Math.round(shakeY));

  drawSky(ctx, w, W, H, skyY, base);

  var maxy = H;
  var x = 0, dx = -(base.curve * basePercent);
  var i, seg, n = w.n;
  var drawn = [];

  for (i = 0; i < DRAW_DIST; i++) {
    seg = w.segments[(base.index + i) % n];
    seg.looped = (base.index + i) >= n;
    seg.fog = Math.exp(-(i / DRAW_DIST) * (i / DRAW_DIST) * FOG_DENSITY);
    seg.fogLevel = seg.fog > 0.72 ? 0 : (seg.fog > 0.42 ? 1 : (seg.fog > 0.16 ? 2 : 3));
    seg.clip = maxy;

    var camZ = camPos - (seg.looped ? w.trackLength : 0);
    project(seg.p1, (p.x * ROAD_W) - x, camY, camZ, CAM_DEPTH, W, H, ROAD_W);
    project(seg.p2, (p.x * ROAD_W) - x - dx, camY, camZ, CAM_DEPTH, W, H, ROAD_W);
    x += dx;
    dx += seg.curve;

    if (seg.p1.camera.z <= CAM_DEPTH || seg.p2.screen.y >= seg.p1.screen.y || seg.p2.screen.y >= maxy) continue;

    renderSegment(ctx, W, seg);
    if (seg.index < 2) renderStartLine(ctx, W, seg);
    maxy = seg.p2.screen.y;
    drawn.push(seg);
  }

  // back-to-front: sprites + cars
  for (i = drawn.length - 1; i >= 0; i--) {
    seg = drawn[i];
    renderSegmentSprites(ctx, w, seg);
  }

  renderParticles(ctx, w);

  if (w.flash > 0.01) {
    ctx.globalAlpha = Math.min(0.6, w.flash);
    ctx.fillStyle = PAT.levels[3];
    ctx.fillRect(-20, -20, W + 40, H + 40);
    ctx.globalAlpha = 1;
  }

  ctx.restore();
}

function renderSegment(ctx, W, seg) {
  var p1 = seg.p1.screen, p2 = seg.p2.screen;
  var col = segColors(0, seg);
  var r1 = p1.w / 6.4, r2 = p2.w / 6.4;
  var l1 = p1.w / 46, l2 = p2.w / 46;

  // grass (full-width band)
  ctx.fillStyle = col.grass;
  ctx.fillRect(0, p2.y, W, p1.y - p2.y);

  // rumble strips
  poly(ctx, p1.x - p1.w - r1, p1.y, p1.x - p1.w, p1.y, p2.x - p2.w, p2.y, p2.x - p2.w - r2, p2.y, col.rumble);
  poly(ctx, p1.x + p1.w + r1, p1.y, p1.x + p1.w, p1.y, p2.x + p2.w, p2.y, p2.x + p2.w + r2, p2.y, col.rumble);

  // road
  poly(ctx, p1.x - p1.w, p1.y, p1.x + p1.w, p1.y, p2.x + p2.w, p2.y, p2.x - p2.w, p2.y, col.road);

  // lane markers
  if (col.lane) {
    for (var ln = 1; ln < LANES; ln++) {
      var o1 = (-1 + (2 * ln) / LANES), o2 = o1;
      poly(ctx,
        p1.x + o1 * p1.w - l1, p1.y, p1.x + o1 * p1.w + l1, p1.y,
        p2.x + o2 * p2.w + l2, p2.y, p2.x + o2 * p2.w - l2, p2.y, col.lane);
    }
  }
}

function renderStartLine(ctx, W, seg) {
  var p1 = seg.p1.screen, p2 = seg.p2.screen;
  void W;
  var cells = 12;
  for (var i = 0; i < cells; i++) {
    if (i % 2 !== (seg.index % 2)) continue;
    var a = -1 + (2 * i) / cells, b = -1 + (2 * (i + 1)) / cells;
    poly(ctx,
      p1.x + a * p1.w, p1.y, p1.x + b * p1.w, p1.y,
      p2.x + b * p2.w, p2.y, p2.x + a * p2.w, p2.y, PAT.solid[seg.fogLevel]);
  }
}

function renderSegmentSprites(ctx, w, seg) {
  var p1 = seg.p1.screen;
  var i, sp, img, destW, destH;
  var alpha = seg.fog;
  if (alpha < 0.06) return;

  for (i = 0; i < seg.sprites.length; i++) {
    sp = seg.sprites[i];
    img = spriteImg(sp.type);
    if (!img) continue;
    var st = SPRITE_TYPES[sp.type];
    destW = (p1.w * 2) * (st.w / 4.2) * img.scale;
    destH = destW * (img.h / img.w);
    var sx = p1.x + (p1.w * sp.offset);
    drawSprite(ctx, img, sx, p1.y - destH, destW, destH, seg.clip, alpha);
  }

  for (i = 0; i < seg.cars.length; i++) {
    var c = seg.cars[i];
    var cimg = CAR_SPRITES[c.hue];
    destW = (p1.w * 2) * 0.30;
    destH = destW * (cimg.h / cimg.w);
    var cx = p1.x + (p1.w * c.offset);
    drawSprite(ctx, cimg, cx, p1.y - destH, destW, destH, seg.clip, alpha);
  }
}

// ---- sky --------------------------------------------------------------
function drawSky(ctx, w, W, H, skyY, base) {
  ctx.fillStyle = PAT.levels[0];
  ctx.fillRect(0, 0, W, H);
  var hz = clamp(skyY, H * 0.30, H * 0.72);

  // dithered horizon glow
  for (var b = 0; b < 5; b++) {
    var y = hz - 26 + b * 5;
    ctx.fillStyle = PAT.sky[b];
    ctx.fillRect(0, y, W, 5);
  }

  // hills (parallax with curve accumulation + player x)
  var off = -(base.index * 1.4 + w.player.x * 26) % (W * 2);
  drawHills(ctx, W, hz, off, PAT.hill[1], 30, 0.9);
  drawHills(ctx, W, hz, off * 1.7 + 40, PAT.hill[0], 20, 1.5);

  // stars
  ctx.fillStyle = PAT.star;
  var rnd = mulberry32(7);
  for (var i = 0; i < 46; i++) {
    var sx = Math.floor(rnd() * W);
    var sy = Math.floor(rnd() * Math.max(4, hz - 40));
    ctx.fillRect(sx, sy, 1, 1);
  }
}

function drawHills(ctx, W, hz, off, fill, amp, freq) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.moveTo(-W, hz + 4);
  for (var x = -W; x <= W * 2; x += 4) {
    var t = (x + off) / (W * freq);
    var y = hz - 6 - amp * (0.55 * Math.sin(t * 1.7) + 0.32 * Math.sin(t * 4.3 + 1.2) + 0.13 * Math.sin(t * 9.1));
    ctx.lineTo(x, y);
  }
  ctx.lineTo(W * 2, hz + 4);
  ctx.closePath();
  ctx.fill();
}
