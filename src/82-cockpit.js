// ---- first-person cockpit frame (buffer space, quantised with scene) --
// Deliberately minimal: pillars + dash silhouette. All readouts live in the
// HUD layer so nothing is drawn twice and nothing collides.
function drawCockpit(ctx, w, L, W, H) {
  var band = L.band;
  var dashTop = H - band - 4;

  // A-pillars frame the windscreen
  ctx.fillStyle = PAT.levels[0];
  ctx.beginPath();
  ctx.moveTo(0, 0); ctx.lineTo(Math.round(W * 0.075), 0);
  ctx.lineTo(Math.round(W * 0.040), H * 0.52); ctx.lineTo(0, H * 0.52);
  ctx.closePath(); ctx.fill();
  ctx.beginPath();
  ctx.moveTo(W, 0); ctx.lineTo(Math.round(W * 0.925), 0);
  ctx.lineTo(Math.round(W * 0.960), H * 0.52); ctx.lineTo(W, H * 0.52);
  ctx.closePath(); ctx.fill();
  // roof rail
  ctx.fillRect(Math.round(W * 0.075), 0, Math.round(W * 0.85), 2);

  // dashboard slab
  ctx.fillStyle = PAT.levels[0];
  ctx.beginPath();
  ctx.moveTo(-6, H);
  ctx.lineTo(-6, dashTop + 16);
  ctx.lineTo(Math.round(W * 0.18), dashTop);
  ctx.lineTo(Math.round(W * 0.82), dashTop);
  ctx.lineTo(W + 6, dashTop + 16);
  ctx.lineTo(W + 6, H);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = PAT.inkFaint;
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(-6, dashTop + 16);
  ctx.lineTo(Math.round(W * 0.18), dashTop);
  ctx.lineTo(Math.round(W * 0.82), dashTop);
  ctx.lineTo(W + 6, dashTop + 16);
  ctx.stroke();

  // steering column shadow under the wheel
  ctx.fillStyle = PAT.levels[1];
  ctx.fillRect(L.wheel.cx - Math.round(L.wheel.r * 0.32), L.wheel.cy + L.wheel.r - 4,
    Math.round(L.wheel.r * 0.64), 6);
}
