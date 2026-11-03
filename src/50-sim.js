// ---- helpers ----------------------------------------------------------
function findSegment(w, z) {
  var i = Math.floor(z / SEG_LEN) % w.n;
  if (i < 0) i += w.n;
  return w.segments[i];
}

function segIndexOf(w, z) {
  var i = Math.floor(z / SEG_LEN) % w.n;
  return i < 0 ? i + w.n : i;
}

function kmh(speed) { return Math.round(speed / MAX_SPEED * TOP_GEAR_KMH); }

function pushEvent(w, type, mag) {
  w.events.push({ type: type, t: 0, mag: mag || 1 });
  if (w.events.length > 16) w.events.shift();
}

function say(w, msg, secs) {
  w.message = msg;
  w.messageT = secs || 1.6;
}

// ---- state machine ----------------------------------------------------
function toQuali(w) {
  w.state = 'quali';
  w.clock = 0;
  w.qualiLeft = QUALI_TIME;
  w.qualiBest = 0;
  var p = w.player;
  p.pos = 0; p.speed = 0; p.x = 0; p.steer = 0; p.wheel = 0;
  p.lap = 0; p.lapStart = 0; p.lapTimes = []; p.best = 0;
  p.hits = 0; p.offRoad = 0; p.total = 0; p.finished = false;
  seedAiTimes(w);
  say(w, 'QUALIFYING  ' + QUALI_TIME + 's', 2.4);
}

function toGrid(w) {
  w.state = 'grid';
  w.countdown = 4.6;
  w.raceTime = 0;
  w.lap = 0;
  var p = w.player;
  p.lap = 0; p.lapStart = 0; p.lapTimes = []; p.best = 0;
  p.speed = 0; p.steer = 0; p.wheel = 0; p.finished = false;
  // starting slot from qualifying position
  var rank = w.ranking.indexOf('YOU');
  if (rank < 0) rank = w.cars.length;
  var row = Math.floor(rank / GRID_ROWS);
  var col = rank % GRID_ROWS;
  p.x = (col - 1) * 0.58;
  p.pos = (row * 3 + 2) * SEG_LEN;
  p.total = p.pos;
  w.gridIndex = rank;
  // park the field on the grid ahead of the player
  for (var i = 0; i < w.cars.length; i++) {
    var c = w.cars[i];
    var slot = i;
    var crow = GRID_ROWS + Math.floor(slot / GRID_ROWS);
    var ccol = slot % GRID_ROWS;
    c.offset = (ccol - 1) * 0.58;
    c.targetOffset = c.offset;
    c.z = (crow * 3 + 6) * SEG_LEN;
    c.lap = 0; c.total = c.z; c.speed = 0; c.hitCd = 0; c.stumble = 0;
  }
  relinkCars(w);
  say(w, 'GRID  P' + (rank + 1), 2.4);
}

function toRace(w) { w.state = 'race'; }

function toResults(w) {
  w.state = 'results';
  rankField(w);
  w.finishPos = w.ranking.indexOf('YOU') + 1;
  pushEvent(w, 'win', 1);
}

// ---- ranking ----------------------------------------------------------
function rankField(w) {
  var rows = [];
  for (var i = 0; i < w.cars.length; i++) {
    var c = w.cars[i];
    rows.push({ name: c.name, key: c, total: c.total, finished: true });
  }
  var p = w.player;
  rows.push({ name: 'YOU', key: 'YOU', total: p.total, finished: p.finished, best: p.best });
  rows.sort(function (a, b) {
    if (a.finished !== b.finished) return a.finished ? -1 : 1;
    return b.total - a.total;
  });
  w.ranking = [];
  w.rankInfo = rows;
  for (var r = 0; r < rows.length; r++) w.ranking.push(rows[r].name);
  return w.ranking;
}

function qualiBoard(w) {
  var rows = [];
  for (var i = 0; i < w.aiTimes.length; i++) {
    rows.push({ name: w.aiTimes[i].name, time: w.aiTimes[i].time });
  }
  if (w.qualiBest > 0) rows.push({ name: 'YOU', time: w.qualiBest });
  rows.sort(function (a, b) { return a.time - b.time; });
  w.ranking = [];
  for (var r = 0; r < rows.length; r++) w.ranking.push(rows[r].name);
  return rows;
}

// ---- opponents --------------------------------------------------------
function relinkCars(w) {
  for (var i = 0; i < w.n; i++) w.segments[i].cars.length = 0;
  for (var j = 0; j < w.cars.length; j++) {
    var c = w.cars[j];
    findSegment(w, c.z).cars.push(c);
  }
}

function updateCars(w, dt, allowMove) {
  var n = w.n;
  for (var i = 0; i < w.cars.length; i++) {
    var c = w.cars[i];
    if (!allowMove) continue;
    if (c.stumble > 0) c.stumble -= dt;
    if (c.hitCd > 0) c.hitCd -= dt;

    var idx = segIndexOf(w, c.z);
    var lim = cornerLimit(w, idx) * c.skill * (c.stumble > 0 ? 0.62 : 1);
    var line = w.raceLine[idx];
    // small personal bias so they do not drive in single file
    line += c.lane * 0.06;
    if (c.speed < lim) c.speed = Math.min(lim, c.speed + ACCEL * dt * 0.9);
    else c.speed = Math.max(lim, c.speed + BRAKING * dt * 0.55);

    // occasional overtaking lane change
    if (w.rnd() < dt * 0.20) {
      c.targetOffset = clamp(line + (w.rnd() - 0.5) * 0.72, -0.80, 0.80);
    }
    c.offset += clamp(c.targetOffset - c.offset, -1, 1) * dt * 1.3;
    if (c.stumble > 0) c.offset += (w.rnd() - 0.5) * dt * 0.5;

    c.z += c.speed * dt;
    while (c.z >= w.trackLength) {
      c.z -= w.trackLength;
      c.lap++;
      var lt = w.raceTime - c.lapStart;
      c.lapStart = w.raceTime;
      if (w.state === 'race' && lt > 4 && (c.best === 0 || lt < c.best)) c.best = lt;
    }
    c.total = c.lap * w.trackLength + c.z;
  }
  relinkCars(w);
}

// avoid the car directly ahead
function aiAvoid(w, c) {
  var seg = findSegment(w, c.z);
  for (var k = 0; k < seg.cars.length; k++) {
    var o = seg.cars[k];
    if (o === c) continue;
    var dz = o.z - c.z;
    if (dz > 0 && dz < SEG_LEN * 2.2 && Math.abs(o.offset - c.offset) < 0.30) {
      c.targetOffset = clamp(o.offset + (c.offset < o.offset ? -0.46 : 0.46), -0.82, 0.82);
      if (c.speed > o.speed) c.speed -= Math.abs(BRAKING) * 0.25 * (1 / 60);
    }
  }
}

// ---- player -----------------------------------------------------------
function updatePlayer(w, dt, input) {
  var p = w.player;
  var seg = findSegment(w, p.pos);
  var speedPct = p.speed / MAX_SPEED;

  // --- steering: virtual wheel with speed-reduced ratio
  var want = input.steer;                       // -1..1
  var rate = 4.6 - 2.0 * speedPct;              // slower wheel at speed
  p.steer += clamp(want - p.steer, -1, 1) * dt * rate;
  if (Math.abs(want - p.steer) < 0.002) p.steer = want;
  p.wheel = lerp(p.wheel, p.steer * 200, Math.min(1, dt * 9));

  var dx = dt * 2.1 * speedPct * p.steer;
  dx -= dt * speedPct * seg.curve * CENTRIFUGAL;
  p.x += dx;

  // --- throttle / brake
  if (w.state === 'race' || w.state === 'quali' || w.state === 'attract') {
    if (input.gas > 0.02) p.speed += ACCEL * dt * input.gas * (p.offRoad > 0 ? 0.45 : 1);
    else p.speed += DECEL * dt;
    if (input.brake > 0.02) p.speed += BRAKING * dt * input.brake;
  } else {
    p.speed += DECEL * dt * 1.4;
  }

  // --- off track
  var grip = 1;
  if (Math.abs(p.x) > 1.0) {
    p.offRoad += dt;
    if (p.speed > OFF_ROAD_LIMIT) p.speed += OFF_ROAD_DECEL * dt;
    else p.speed += ACCEL * dt * 0.25;
    grip = 0.55;
    p.drifting = 0;
    if (p.speed > OFF_ROAD_LIMIT * 0.5) {
      w.shake = Math.max(w.shake, 0.055 * (p.speed / MAX_SPEED));
      if (w.rnd() < dt * 26) pushEvent(w, 'dirt', w.rnd());
    }
  } else {
    if (p.offRoad > 0.6 && p.offRoadT <= 0) { p.offRoad = 0; }
    p.offRoad = 0;
    if (Math.abs(p.steer) > 0.55 && speedPct > 0.62 && seg.absCurve > 1.6) {
      p.drifting = Math.min(1, p.drifting + dt * 3);
      if (w.rnd() < dt * 20) pushEvent(w, 'smoke', w.rnd());
    } else {
      p.drifting = Math.max(0, p.drifting - dt * 2.4);
    }
  }
  if (p.offRoadT > 0) p.offRoadT -= dt;
  p.speed = clamp(p.speed, 0, MAX_SPEED);

  // --- scenery collision
  for (var s = 0; s < seg.sprites.length; s++) {
    var sp = seg.sprites[s];
    var st = SPRITE_TYPES[sp.type];
    if (!st.solid) continue;
    if (Math.abs(p.x - sp.offset) < st.solid + CAR_HW && p.speed > MAX_SPEED * 0.06) {
      p.speed *= 0.16;
      p.x = sp.offset + (p.x < sp.offset ? -(st.solid + CAR_HW + 0.05) : (st.solid + CAR_HW + 0.05));
      p.hits++;
      w.shake = 0.55;
      w.flash = 0.35;
      pushEvent(w, 'crash', 1);
      say(w, 'CONTACT!', 1.0);
      break;
    }
  }

  // --- car to car
  for (var i = 0; i < w.cars.length; i++) {
    var c = w.cars[i];
    if (c.hitCd > 0) continue;
    var dz = c.z - p.pos;
    if (dz < -SEG_LEN) dz += w.trackLength;
    if (dz > SEG_LEN * 1.4) continue;
    if (dz > -SEG_LEN * 0.85 && dz < SEG_LEN * 0.85) {
      if (Math.abs(c.offset - p.x) < (CAR_HW + 0.34)) {
        var rel = (p.speed - c.speed) / MAX_SPEED;
        p.speed *= (rel > 0.03) ? HIT_SPEED_RETAIN : 0.92;
        c.speed = Math.min(MAX_SPEED, c.speed * (rel > 0.03 ? 1.12 : 0.86));
        var push = (p.x < c.offset) ? -1 : 1;
        p.x += push * 0.30;
        c.offset -= push * 0.22;
        c.stumble = 0.75;
        c.hitCd = 0.55;
        p.hits++;
        w.shake = Math.max(w.shake, 0.34 + Math.abs(rel));
        w.flash = Math.max(w.flash, 0.22);
        pushEvent(w, 'crash', 0.8);
        if (rel > 0.08) say(w, 'REAR END!', 0.9);
      }
    }
  }
  p.x = clamp(p.x, -2.4, 2.4);

  // --- forward motion + lap bookkeeping
  p.pos += p.speed * dt;
  while (p.pos >= w.trackLength) {
    p.pos -= w.trackLength;
    completeLap(w);
    if (p.finished) break;
  }
  p.total = p.lap * w.trackLength + p.pos;
  void grip;
}

function completeLap(w) {
  var p = w.player;
  if (w.state === 'attract') {
    p.lap = 0; p.lapTimes = []; p.pos = 0;
    return;
  }
  var t = (w.state === 'quali') ? (w.clock - p.lapStart) : (w.raceTime - p.lapStart);
  p.lapStart = (w.state === 'quali') ? w.clock : w.raceTime;
  if (w.state === 'quali') {
    if (t > 4 && (p.best === 0 || t < p.best)) p.best = t;
    if (w.qualiBest === 0 || t < w.qualiBest) { w.qualiBest = t; pushEvent(w, 'best', 1); }
    p.lapTimes.push(t);
    p.lap++;
    say(w, 'LAP ' + fmtTime(t), 2.0);
  } else {
    p.lapTimes.push(t);
    if (p.best === 0 || t < p.best) { p.best = t; pushEvent(w, 'best', 1); }
    p.lap++;
    if (p.lap >= RACE_LAPS) {
      p.finished = true;
      p.pos = 0;
      toResults(w);
    } else {
      say(w, 'LAP ' + p.lap + '/' + RACE_LAPS + '  ' + fmtTime(t), 1.9);
    }
  }
}

function fmtTime(t) {
  if (!t || t <= 0) return '--:--.---';
  var m = Math.floor(t / 60);
  var s = t - m * 60;
  var out = (s < 10 ? '0' : '') + Math.floor(s) + '.';
  var ms = Math.round((s - Math.floor(s)) * 1000);
  if (ms === 1000) ms = 999;
  out += (ms < 100 ? (ms < 10 ? '00' : '0') : '') + ms;
  return m + ':' + out;
}
