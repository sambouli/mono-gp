// ---- persistent best --------------------------------------------------
var Store = {
  key: 'mono-gp-best-v1',
  best: function () {
    try { var v = parseFloat(GLOBAL.localStorage.getItem(this.key)); return v > 0 ? v : 0; }
    catch (e) { return 0; }
  },
  save: function (t) {
    try {
      if (t > 0 && (this.best() === 0 || t < this.best())) GLOBAL.localStorage.setItem(this.key, String(t));
    } catch (e) { void e; }
  }
};

// ---- autopilot (attract mode demo) ------------------------------------
function autopilot(w) {
  var p = w.player;
  var idx = segIndexOf(w, p.pos + SEG_LEN * 3);
  var want = w.raceLine[idx];
  var err = want - p.x;
  var steer = clamp(err * 2.4 - (p.x - w.raceLine[segIndexOf(w, p.pos)]) * 0.6, -1, 1);
  var lim = cornerLimit(w, segIndexOf(w, p.pos));
  var gas = p.speed < lim ? 1 : 0;
  var brake = p.speed > lim * 1.06 ? 0.8 : 0;
  return { steer: steer, gas: gas, brake: brake };
}

// ---- simulation step (pure: no DOM) -----------------------------------
function step(w, dt, input) {
  dt = Math.min(0.25, dt);
  w.clock += dt;
  if (w.shake > 0) w.shake = Math.max(0, w.shake - dt * 2.2);
  if (w.flash > 0) w.flash = Math.max(0, w.flash - dt * 3.0);
  if (w.messageT > 0) w.messageT -= dt;
  for (var e = w.events.length - 1; e >= 0; e--) {
    w.events[e].t += dt;
    if (w.events[e].t > 1.2) w.events.splice(e, 1);
  }

  var driving = (w.state === 'quali' || w.state === 'race');
  var aiMove = driving || w.state === 'attract';

  if (w.state === 'attract') {
    updatePlayer(w, dt, autopilot(w));
    updateCars(w, dt, true);
  } else if (w.state === 'quali') {
    w.qualiLeft -= dt;
    updatePlayer(w, dt, input);
    updateCars(w, dt, true);
    for (var i = 0; i < w.cars.length; i++) aiAvoid(w, w.cars[i]);
    if (w.qualiLeft <= 0) {
      w.qualiLeft = 0;
      w.qualified = qualiBoard(w);
      w.state = 'qualiDone';
      w.player.speed = 0;
    }
  } else if (w.state === 'qualiDone') {
    w.player.speed *= 0.92;
    updatePlayer(w, dt, { steer: 0, gas: 0, brake: 1 });
    updateCars(w, dt, false);
  } else if (w.state === 'grid') {
    w.countdown -= dt;
    updatePlayer(w, dt, { steer: 0, gas: 0, brake: 1 });
    updateCars(w, dt, false);
    if (w.countdown <= 0) {
      w.state = 'race';
      w.raceTime = 0;
      w.player.lapStart = 0;
      say(w, 'GO', 1.1);
    }
  } else if (w.state === 'race') {
    w.raceTime += dt;
    updatePlayer(w, dt, input);
    updateCars(w, dt, true);
    for (var k = 0; k < w.cars.length; k++) aiAvoid(w, w.cars[k]);
  } else if (w.state === 'results') {
    w.player.speed *= 0.95;
    updatePlayer(w, dt, { steer: 0, gas: 0, brake: 0.4 });
    updateCars(w, dt, true);
  }

  updateParts(dt);
  updateMirror(w);
  updatePosition(w);
  return w;
}

// who is behind us (for the mirror) and current race position
function updateMirror(w) {
  var p = w.player, out = [];
  for (var i = 0; i < w.cars.length; i++) {
    var c = w.cars[i];
    var dz = c.total - p.total;
    if (dz < -SEG_LEN * 2) dz += w.trackLength;
    if (dz < 0 && dz > -SEG_LEN * 40) out.push({ dx: c.offset - p.x, dz: -dz, hue: c.hue });
  }
  out.sort(function (a, b) { return a.dz - b.dz; });
  w.carsBehind = out.slice(0, 4);
}

function updatePosition(w) {
  if (w.state !== 'race' && w.state !== 'results') { w.currentPos = 1 + w.ranking.indexOf('YOU'); return; }
  var ahead = 1;
  for (var i = 0; i < w.cars.length; i++) {
    if (w.cars[i].total > w.player.total + 1) ahead++;
  }
  w.currentPos = ahead;
}
