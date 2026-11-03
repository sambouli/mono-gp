// ---- HUD + full-screen panels (bright overlay, after the LCD pass) ----
function hudPanels(ctx, w, L, W, H) {
  var p = w.player;
  var R = w.hud || (w.hud = hudLayout(W, H, L));

  // --- chips
  panel(ctx, R.pause.x, R.pause.y, R.pause.w, R.pause.h, PAT.panel);
  text(ctx, '||', R.pause.x + R.pause.w / 2, R.pause.y + 3, 1, PAT.ink, 'center');
  var muted = SND.muted;
  panel(ctx, R.audio.x, R.audio.y, R.audio.w, R.audio.h, PAT.panel);
  text(ctx, muted ? 'OFF' : 'AUD', R.audio.x + R.audio.w / 2, R.audio.y + 3, 1,
    muted ? PAT.inkFaint : PAT.ink, 'center');

  panel(ctx, R.pos.x, R.pos.y, R.pos.w, R.pos.h, PAT.panel);
  text(ctx, 'POS', R.pos.x + 3, R.pos.y + 3, 1, PAT.inkDim);
  text(ctx, 'P' + (w.currentPos || 1), R.pos.x + R.pos.w - 4, R.pos.y + 3, 1, PAT.ink, 'right');

  // --- lap
  var lapTxt = (w.state === 'quali') ? 'Q'
    : String(Math.min(p.lap + 1, RACE_LAPS)) + '/' + RACE_LAPS;
  panel(ctx, R.lap.x, R.lap.y, R.lap.w, R.lap.h, PAT.panel);
  text(ctx, 'LAP', R.lap.x + 3, R.lap.y + 3, 1, PAT.inkDim);
  text(ctx, lapTxt, R.lap.x + R.lap.w - 4, R.lap.y + 3, 1, PAT.ink, 'right');

  // --- session clock
  var clockTxt, clockLbl;
  if (w.state === 'quali') { clockTxt = Math.max(0, Math.ceil(w.qualiLeft)) + 'S'; clockLbl = 'QUALI'; }
  else {
    clockTxt = fmtTime((w.state === 'attract' || w.state === 'qualiDone') ? 0 : (w.raceTime - p.lapStart));
    clockLbl = 'TIME';
  }
  panel(ctx, R.clock.x, R.clock.y, R.clock.w, R.clock.h, PAT.panel);
  text(ctx, clockLbl, R.clock.x + 3, R.clock.y + 3, 1, PAT.inkDim);
  text(ctx, clockTxt, R.clock.x + R.clock.w - 4, R.clock.y + 3, 1, PAT.ink, 'right');

  // --- last / best
  panel(ctx, R.last.x, R.last.y, R.last.w, R.last.h, 'rgba(4,23,11,0.55)');
  text(ctx, 'LAST ' + fmtTime(p.lapTimes[p.lapTimes.length - 1]), R.last.x + 3, R.last.y + 2, 1, PAT.inkDim);
  panel(ctx, R.best.x, R.best.y, R.best.w, R.best.h, 'rgba(4,23,11,0.55)');
  text(ctx, 'BEST ' + fmtTime((w.state === 'quali') ? w.qualiBest : p.best),
    R.best.x + 3, R.best.y + 2, 1, PAT.ink);

  // --- speed + gear
  var kmhTxt = String(kmh(p.speed));
  text(ctx, kmhTxt, R.speed.x, R.speed.y, 3, PAT.ink);
  text(ctx, 'KM/H', R.speed.x + textW(kmhTxt, 3) + 4, R.speed.y + 14, 1, PAT.inkDim);
  var gear = p.speed < 1 ? 'N' : String(clamp(Math.ceil(p.speed / MAX_SPEED * 6), 1, 6));
  text(ctx, 'G' + gear, R.gear.x, R.gear.y + 4, 2, PAT.ink);

  drawRevTape(ctx, w, R.tape);
  drawMirror(ctx, w, R.mirror);

  // --- centre message
  if (w.messageT > 0 && w.message) {
    var blink = (w.messageT > 1.2) || (Math.floor(w.clock * 6) % 2 === 0);
    if (blink) {
      panel(ctx, R.msg.x, R.msg.y, R.msg.w, R.msg.h, 'rgba(4,23,11,0.85)');
      text(ctx, w.message, W / 2, R.msg.y + 6, 2, PAT.ink, 'center');
    }
  }
  if (w.state === 'quali' && w.qualiLeft < 10 && w.qualiLeft > 0 &&
      Math.floor(w.clock * 4) % 2 === 0) {
    text(ctx, 'LAST CHANCE', W / 2, R.msg.y + 26, 1, PAT.ink, 'center');
  }
}

function drawRevTape(ctx, w, r) {
  var p = w.player;
  var segs = Math.max(8, Math.floor(r.w / 5));
  var sw = Math.max(2, Math.floor(r.w / segs));
  var lit = Math.round(segs * clamp(p.speed / MAX_SPEED, 0, 1));
  ctx.fillStyle = PAT.levels[0];
  ctx.fillRect(r.x - 1, r.y - 1, segs * sw + 1, r.h + 2);
  for (var s = 0; s < segs; s++) {
    var on = s < lit;
    var red = s >= segs - 4;
    ctx.fillStyle = on ? (red ? PAT.levels[3] : PAT.levels[2]) : PAT.levels[1];
    ctx.fillRect(r.x + s * sw, r.y, sw - 1, r.h);
  }
}

function drawMirror(ctx, w, m) {
  panel(ctx, m.x, m.y, m.w, m.h, PAT.levels[1]);
  var back = w.carsBehind || [];
  for (var i = 0; i < back.length && i < 4; i++) {
    var b = back[i];
    var bw = Math.max(4, Math.round(15 / (1 + b.dz / (SEG_LEN * 9))));
    var bh = Math.max(3, Math.round(bw * 0.5));
    var bx = m.x + 2 + Math.round(clamp((b.dx + 1) / 2, 0, 1) * (m.w - bw - 4));
    ctx.fillStyle = PAT.car[b.hue];
    ctx.fillRect(bx, m.y + m.h - bh - 2, bw, bh);
  }
  ctx.strokeStyle = PAT.inkFaint;
  ctx.lineWidth = 1;
  ctx.strokeRect(m.x + 0.5, m.y + 0.5, m.w - 1, m.h - 1);
}

// ---- overlay screens ---------------------------------------------------
function screenAttract(ctx, w, L, W, H) {
  scrim(ctx, W, H, 0.74);
  var y = Math.round(H * 0.16);
  var big = W < 200 ? 5 : 6;
  text(ctx, 'MONO', W / 2, y, big, PAT.ink, 'center');
  text(ctx, 'GRAND  PRIX', W / 2, y + 8 * big + 10, 2, PAT.ink, 'center');
  rule(ctx, Math.round(W / 2 - 62), y + 8 * big + 30, 124);
  var rows = [
    ['QUALIFY ' + QUALI_TIME + 'S  THEN ' + RACE_LAPS + ' LAPS', PAT.ink],
    ['6 RIVALS ON THE GRID', PAT.inkDim],
    ['STEER WITH THE WHEEL', PAT.inkDim],
    ['GAS + BRAKE ON THE RIGHT', PAT.inkDim],
    ['BEST LAP SETS YOUR SLOT', PAT.inkDim]
  ];
  for (var i = 0; i < rows.length; i++) {
    text(ctx, rows[i][0], W / 2, y + 8 * big + 42 + i * 13, 1, rows[i][1], 'center');
  }
  var best = Store.best();
  if (best > 0) text(ctx, 'RECORD ' + fmtTime(best), W / 2, y + 8 * big + 42 + 5 * 13 + 4, 1, PAT.ink, 'center');
  if (Math.floor(w.clock * 2) % 2 === 0) {
    text(ctx, 'TAP TO START', W / 2, H - L.band - 34, 2, PAT.ink, 'center');
  }
}

function screenQualiDone(ctx, w, L, W, H) {
  var rows = w.qualified || qualiBoard(w);
  tableScreen(ctx, w, L, W, H, 'QUALIFYING', rows, 'YOU',
    [['BEST LAP SETS YOUR GRID SLOT', PAT.inkDim]], 'TAP TO TAKE THE GRID');
}

function tableScreen(ctx, w, L, W, H, title, rows, highlight, footer, cta) {
  scrim(ctx, W, H, 0.90);
  text(ctx, title, W / 2, 12, 2, PAT.ink, 'center');
  var top = 36;
  var avail = H - L.band - top - 46;
  var rowH = clamp(Math.floor(avail / (rows.length + 1)), 11, 15);
  var pw = Math.min(W - 10, 180), px = Math.round(W / 2 - pw / 2);
  panel(ctx, px, top - 5, pw, rows.length * rowH + 9, 'rgba(4,23,11,0.88)');
  for (var i = 0; i < rows.length; i++) {
    var ry = top + i * rowH;
    var you = rows[i].name === highlight;
    if (you) panel(ctx, px + 1, ry - 2, pw - 2, rowH - 1, 'rgba(31,143,71,0.42)', false);
    text(ctx, String(i + 1), px + 4, ry, 1, you ? PAT.ink : PAT.inkDim);
    text(ctx, rows[i].name, px + 18, ry, 1, you ? PAT.ink : PAT.inkDim);
    text(ctx, fmtTime(rows[i].time), px + pw - 4, ry, 1, you ? PAT.ink : PAT.inkDim, 'right');
  }
  var fy = top + rows.length * rowH + 8;
  if (footer) {
    for (var f = 0; f < footer.length; f++) {
      text(ctx, footer[f][0], W / 2, fy + f * 12, 1, footer[f][1], 'center');
    }
  }
  if (Math.floor(w.clock * 2) % 2 === 0) {
    text(ctx, cta, W / 2, H - L.band - 26, 2, PAT.ink, 'center');
  }
}

function screenGrid(ctx, w, L, W, H) {
  var n = Math.ceil(w.countdown - 1);
  var cy = Math.round(H * 0.34);
  if (w.countdown > 1) text(ctx, String(Math.min(3, n)), W / 2, cy, 8, PAT.ink, 'center');
  else if (w.countdown > 0) text(ctx, 'GO', W / 2, cy, 8, PAT.ink, 'center');
  text(ctx, 'STARTING  P' + (w.gridIndex + 1), W / 2, cy + 76, 1, PAT.inkDim, 'center');
}

function screenResults(ctx, w, L, W, H) {
  var info = w.rankInfo || [];
  var rows = [];
  for (var i = 0; i < info.length; i++) {
    rows.push({
      name: info[i].name,
      time: info[i].name === 'YOU' ? (info[i].best || 0) : lapFor(w, info[i])
    });
  }
  var won = w.finishPos === 1;
  tableScreen(ctx, w, L, W, H, won ? 'RACE WON' : 'FINISH  P' + w.finishPos, rows, 'YOU',
    [['BEST ' + fmtTime(w.player.best) + '   CONTACTS ' + w.player.hits, PAT.ink]],
    'TAP TO RACE AGAIN');
}

function screenPaused(ctx, w, L, W, H) {
  scrim(ctx, W, H, 0.82);
  text(ctx, 'PAUSED', W / 2, Math.round(H * 0.40), 3, PAT.ink, 'center');
  if (Math.floor(w.clock * 2) % 2 === 0) {
    text(ctx, 'TAP TO RESUME', W / 2, Math.round(H * 0.40) + 36, 1, PAT.ink, 'center');
  }
}

function scrim(ctx, W, H, a) {
  ctx.fillStyle = 'rgba(4,23,11,' + a + ')';
  ctx.fillRect(0, 0, W, H);
}

function rule(ctx, x, y, wdt) {
  ctx.fillStyle = PAT.inkFaint;
  ctx.fillRect(x, y, wdt, 1);
  ctx.fillStyle = PAT.ink;
  ctx.fillRect(x, y, 8, 1);
  ctx.fillRect(x + wdt - 8, y, 8, 1);
}

function lapFor(w, row) {
  for (var i = 0; i < w.cars.length; i++) if (w.cars[i].name === row.name) return w.cars[i].best || 0;
  return 0;
}
