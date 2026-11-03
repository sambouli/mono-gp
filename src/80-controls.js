// ---- on-screen controls ----------------------------------------------
function drawControls(ctx, w, ui, L) {
  var live = (w.state === 'quali' || w.state === 'race' || w.state === 'grid');
  drawPedal(ctx, L.brake, 'BRAKE', ui.brake > 0.02, PAT.levels[1], live);
  drawPedal(ctx, L.gas, 'GAS', ui.gas > 0.02, PAT.levels[2], live);
  drawWheel(ctx, w, ui, L, live);
}

function drawPedal(ctx, r, label, down, fill, live) {
  ctx.globalAlpha = live ? 1 : 0.35;
  panel(ctx, r.x, r.y, r.w, r.h, 'rgba(4,23,11,0.72)');
  ctx.fillStyle = down ? fill : PAT.inkFaint;
  var inset = 3;
  ctx.fillRect(r.x + inset, r.y + inset, r.w - inset * 2, r.h - inset * 2);
  if (down) {
    ctx.fillStyle = PAT.levels[3];
    ctx.fillRect(r.x + inset, r.y + inset, r.w - inset * 2, 3);
  }
  // tread lines
  ctx.fillStyle = down ? PAT.levels[0] : PAT.ink;
  for (var i = 0; i < 4; i++) {
    ctx.fillRect(r.x + 8, r.y + 10 + i * (r.h - 22) / 3, r.w - 16, 2);
  }
  text(ctx, label, r.x + r.w / 2, r.y + r.h - 11, 1, down ? PAT.levels[0] : PAT.ink, 'center');
  ctx.globalAlpha = 1;
}

function drawWheel(ctx, w, ui, L, live) {
  var cx = L.wheel.cx, cy = L.wheel.cy, r = L.wheel.r;
  var a = (w.player.wheel || 0) * Math.PI / 180;
  ctx.globalAlpha = live ? 1 : 0.35;
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(a);

  var ring = PAT.ink;
  var thick = 4;
  // tyre ring drawn as thick arc
  ctx.strokeStyle = ring;
  ctx.lineWidth = thick;
  ctx.beginPath();
  ctx.arc(0, 0, r - 3, 0, Math.PI * 2);
  ctx.stroke();

  // grip notches
  ctx.fillStyle = ring;
  for (var i = 0; i < 24; i++) {
    var t = (i / 24) * Math.PI * 2;
    ctx.fillRect(Math.cos(t) * (r - 7) - 1, Math.sin(t) * (r - 7) - 1, 2, 2);
  }
  // spokes
  ctx.lineWidth = 5;
  ctx.strokeStyle = ring;
  ctx.beginPath();
  ctx.moveTo(-r + 5, 0); ctx.lineTo(r - 5, 0);
  ctx.moveTo(0, 0); ctx.lineTo(0, r - 4);
  ctx.stroke();
  // top marker
  ctx.fillStyle = PAT.levels[3];
  ctx.fillRect(-4, -r + 1, 8, 6);
  // hub
  ctx.fillStyle = ring;
  ctx.fillRect(-8, -8, 16, 16);
  ctx.fillStyle = PAT.levels[0];
  ctx.fillRect(-5, -5, 10, 10);
  ctx.restore();

  // steer hint arrows
  if (live) {
    var sgn = w.player.steer;
    ctx.globalAlpha = 0.9;
    text(ctx, '<', cx - r - 9, cy - 3, 2, sgn < -0.15 ? PAT.levels[3] : PAT.inkFaint, 'center');
    text(ctx, '>', cx + r + 9, cy - 3, 2, sgn > 0.15 ? PAT.levels[3] : PAT.inkFaint, 'center');
  }
  ctx.globalAlpha = 1;
}
