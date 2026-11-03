// ---- boot: DOM shell, sizing, input, main loop ------------------------
(function (global) {
  // headless export so tests exercise this exact shipping code
  global.__game = global.__game || {};
  global.__game.CORE = {
    step: step, createWorld: createWorld, buildTrack: buildTrack,
    buildRacingLine: buildRacingLine, spawnField: spawnField,
    toQuali: toQuali, toGrid: toGrid, autopilot: autopilot,
    fmtTime: fmtTime, findSegment: findSegment, rankField: rankField,
    qualiBoard: qualiBoard, computeLayout: computeLayout, hudLayout: hudLayout,
    text: text, textW: textW, GLYPHS: GLYPHS,
    consts: { SEG_LEN: SEG_LEN, MAX_SPEED: MAX_SPEED, RACE_LAPS: RACE_LAPS,
      QUALI_TIME: QUALI_TIME, LAP_TARGET: LAP_TARGET, DRAW_DIST: DRAW_DIST }
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = global.__game.CORE;
  if (typeof document === 'undefined') return;

  var screen = document.getElementById('screen');
  var sctx = screen.getContext('2d', { alpha: false });
  var fontsReady = false;
  var buf = makeBuffer();
  var bctx = buf.ctx;
  // HUD + overlay screens live in a second buffer-resolution layer so they
  // stay pixel-locked to the scene when everything is upscaled.
  var ovl = document.createElement('canvas');
  var octx = ovl.getContext('2d');

  var world = createWorld({ seed: 20261103 });
  buildRacingLine(world);
  spawnField(world, 6, 1);
  world.state = 'attract';

  var ui = { steer: 0, gas: 0, brake: 0 };
  var keys = {};
  var touches = {};
  var L = computeLayout(340, 200);
  var scale = 1, dpr = 1;
  var cssW = 340, cssH = 200;
  function dprNow() { return dpr; }
  var lastBeep = -1;
  var paused = false;
  var fontsTried = 0;
  var fps = 60, fpsAcc = 0, fpsN = 0;

  // ---- sizing ---------------------------------------------------------
  function resize() {
    var vw = global.innerWidth, vh = global.innerHeight;
    var vv = global.visualViewport;
    if (vv && vv.width > 0) { vw = vv.width; vh = vv.height; }
    cssW = Math.max(240, Math.floor(vw));
    cssH = Math.max(240, Math.floor(vh));
    dpr = Math.min(2, global.devicePixelRatio || 1);
    screen.width = Math.floor(cssW * dpr);
    screen.height = Math.floor(cssH * dpr);
    screen.style.width = cssW + 'px';
    screen.style.height = cssH + 'px';
    sctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    sctx.imageSmoothingEnabled = false;

    // Two fixed internal resolutions (one per orientation) keep pixels square
    // and the control cluster a predictable size on every device.
    var bw, bh;
    if (cssH > cssW) { bw = 250; bh = Math.round(bw * cssH / cssW); }
    else { bh = 176; bw = Math.round(bh * cssW / cssH); if (bw > 440) bw = 440; }
    buf.canvas.width = bw;
    buf.canvas.height = bh;
    buf.w = bw; buf.h = bh;
    ovl.width = Math.round(cssW * dpr);
    ovl.height = Math.round(cssH * dpr);
    bctx = buf.ctx = buf.canvas.getContext('2d', { alpha: false });
    octx = ovl.getContext('2d');
    bctx.imageSmoothingEnabled = false;
    octx.imageSmoothingEnabled = false;
    bctx.textBaseline = 'top';
    octx.textBaseline = 'top';
    scale = cssW / bw;
    L = computeLayout(bw, bh);
    if (world) { world.hud = null; }
    LAY = L;
  }

  // ---- audio ----------------------------------------------------------
  function audioKick() { SND.kick(); }

  function handleEvents(w) {
    for (var i = 0; i < w.events.length; i++) {
      var e = w.events[i];
      if (e.t > 0 || e.done) continue;
      e.done = 1;
      if (e.type === 'crash') SND.crash(e.mag);
      else if (e.type === 'best') SND.sweep(760, 1500, 0.26, 0.10);
    }
    if (w.state === 'grid') {
      var n = Math.ceil(w.countdown - 1);
      if (n !== lastBeep && n >= 0 && n <= 3) {
        lastBeep = n;
        if (n > 0) SND.blip(520, 0.13, 0.12);
        else SND.blip(1040, 0.42, 0.14);
      }
    } else {
      lastBeep = -1;
    }
  }

  // ---- input ----------------------------------------------------------
  function toBuf(clientX, clientY) {
    var r = screen.getBoundingClientRect();
    return { x: (clientX - r.left) / scale, y: (clientY - r.top) / scale };
  }

  function tapChip(p) {
    if (p.y > 22) return false;
    if (p.x < 20) { togglePause(); return true; }
    if (p.x < 46) { SND.toggle(); return true; }
    return false;
  }

  function advance() {
    if (world.state === 'attract') { audioKick(); toQuali(world); SND.blip(660, 0.18, 0.10); }
    else if (world.state === 'qualiDone') { toGrid(world); }
    else if (world.state === 'results') {
      Store.save(world.player.best);
      spawnField(world, 6, 1);
      toQuali(world);
    }
  }

  function roleAt(p) {
    if (inRect(p, L.gas)) return 'gas';
    if (inRect(p, L.brake)) return 'brake';
    if (inWheel(p, L)) return 'wheel';
    if (p.x < buf.w * 0.46 && p.y > buf.h - L.band - 30) return 'drag';
    return null;
  }

  function wheelSteer(role, x, ox, st0) {
    var r = L.wheel.r;
    if (role === 'wheel') return clamp((x - L.wheel.cx) / (r * 0.95), -1, 1);
    return clamp(st0 + (x - ox) / (r * 0.9), -1, 1);
  }

  function pressStart(id, p) {
    audioKick();
    if (paused) { togglePause(); return; }
    if (tapChip(p)) return;
    if (world.state === 'attract' || world.state === 'qualiDone' || world.state === 'results') { advance(); return; }
    var role = roleAt(p);
    if (!role) return;
    touches[id] = { role: role, x: p.x, y: p.y, ox: p.x, st0: ui.steer };
    if (role === 'gas') ui.gas = 1;
    else if (role === 'brake') ui.brake = 1;
    else ui.steer = wheelSteer(role, p.x, p.x, 0);
  }

  function pressMove(id, p) {
    var t = touches[id];
    if (!t) return;
    if (t.role === 'wheel' || t.role === 'drag') {
      ui.steer = wheelSteer(t.role, p.x, t.ox, t.st0);
    } else {
      var r = t.role === 'gas' ? L.gas : L.brake;
      if (!inRect(p, r)) { delete touches[id]; ui[t.role] = 0; }
    }
  }

  function pressEnd(id) {
    var t = touches[id];
    if (!t) return;
    if (t.role === 'wheel' || t.role === 'drag') ui.steer = 0;
    else ui[t.role] = 0;
    delete touches[id];
  }

  function bindPointer() {
    var opts = { passive: false };
    function each(ev, fn) {
      ev.preventDefault();
      for (var i = 0; i < ev.changedTouches.length; i++) {
        var t = ev.changedTouches[i];
        fn(t.identifier, toBuf(t.clientX, t.clientY));
      }
    }
    screen.addEventListener('touchstart', function (ev) { each(ev, pressStart); }, opts);
    screen.addEventListener('touchmove', function (ev) { each(ev, pressMove); }, opts);
    var ender = function (ev) {
      ev.preventDefault();
      for (var i = 0; i < ev.changedTouches.length; i++) pressEnd(ev.changedTouches[i].identifier);
    };
    screen.addEventListener('touchend', ender, opts);
    screen.addEventListener('touchcancel', ender, opts);

    var down = false;
    screen.addEventListener('mousedown', function (ev) {
      down = true; pressStart('m', toBuf(ev.clientX, ev.clientY));
    });
    screen.addEventListener('mousemove', function (ev) {
      if (down) pressMove('m', toBuf(ev.clientX, ev.clientY));
    });
    global.addEventListener('mouseup', function () { down = false; pressEnd('m'); });

    global.addEventListener('keydown', function (ev) {
      var k = ev.key.toLowerCase();
      keys[k] = 1;
      if (k === ' ' || k === 'enter') {
        audioKick();
        if (world.state === 'attract' || world.state === 'qualiDone' || world.state === 'results') advance();
      }
      if (k === 'p') togglePause();
      if (k === 'm') SND.toggle();
      if (ev.key.indexOf('Arrow') === 0) ev.preventDefault();
    });
    global.addEventListener('keyup', function (ev) { keys[ev.key.toLowerCase()] = 0; });
    global.addEventListener('blur', function () { keys = {}; ui.steer = ui.gas = ui.brake = 0; });
  }

  function togglePause() {
    paused = !paused;
    if (paused) SND.quiet();
  }

  function keyboardInput() {
    var i = { steer: ui.steer, gas: ui.gas, brake: ui.brake };
    if (keys['arrowleft'] || keys['a']) i.steer = -1;
    if (keys['arrowright'] || keys['d']) i.steer = 1;
    if (keys['arrowup'] || keys['w']) i.gas = 1;
    if (keys['arrowdown'] || keys['s']) i.brake = 1;
    return i;
  }

  // ---- frame ----------------------------------------------------------
  var acc = 0, prev = 0;
  function frameLoop(ts) {
    if (!prev) prev = ts;
    var dt = (ts - prev) / 1000;
    prev = ts;
    if (dt > 0 || dt < 0) {
      dt = Math.min(0.25, Math.abs(dt));
    }
    fpsAcc += dt; fpsN++;
    if (fpsAcc > 0.5) { fps = fpsN / fpsAcc; fpsAcc = 0; fpsN = 0; }

    if (!paused) {
      acc += dt;
      var guard = 0;
      var inp = keyboardInput();
      while (acc >= 1 / 60 && guard < 4) {
        step(world, 1 / 60, inp);
        acc -= 1 / 60;
        guard++;
      }
      if (guard >= 4) acc = 0;
      SND.engine(world.player.speed / MAX_SPEED, inp.gas > 0.5 ? 1 : 0,
        Math.abs(world.player.x) > 1 ? 1 : 0);
      handleEvents(world);
    }
    draw();
    global.requestAnimationFrame(frameLoop);
  }

  function tryFonts() {
    if (fontsReady || fontsTried > 8) { fontsReady = true; return; }
    fontsTried++;
    var probe = 'MW0@#';
    try {
      octx.font = '16px ' + FONT_STACK;
      var w1 = octx.measureText(probe).width;
      octx.font = '16px monospace';
      var w2 = octx.measureText(probe).width;
      octx.font = '16px sans-serif';
      var w3 = octx.measureText(probe).width;
      if (w1 > 0 && Math.abs(w1 - w2) > 0.4 && Math.abs(w1 - w3) > 0.4) fontsReady = true;
    } catch (e) { fontsReady = true; }
  }

  function draw() {
    tryFonts();
    var W = buf.w, H = buf.h;
    renderScene(bctx, world, W, H);
    drawCockpit(bctx, world, L, W, H);
    drawControls(bctx, world, ui, L);
    postLCD(bctx, W, H, sctx, cssW, cssH, 3, true);

    // HUD is drawn in buffer coordinates but at device-pixel resolution, so
    // the retro scene stays chunky while the text stays crisp.
    var k = (cssW / W) * dprNow();
    octx.setTransform(k, 0, 0, k, 0, 0);
    octx.clearRect(0, 0, W, H);
    if (fontsReady) hudPanels(octx, world, L, W, H);
    if (!fontsReady) { text(octx, 'LOADING', W / 2, H * 0.5, 2, PAT.ink, 'center'); }
    else if (world.state === 'attract') screenAttract(octx, world, L, W, H);
    else if (world.state === 'qualiDone') screenQualiDone(octx, world, L, W, H);
    else if (world.state === 'grid') screenGrid(octx, world, L, W, H);
    else if (world.state === 'results') screenResults(octx, world, L, W, H);
    if (paused) screenPaused(octx, world, L, W, H);
    octx.setTransform(1, 0, 0, 1, 0, 0);
    sctx.imageSmoothingEnabled = false;
    sctx.drawImage(ovl, 0, 0, cssW, cssH);
  }

  // ---- go -------------------------------------------------------------
  buildSprites();
  rebuildLuts();
  resize();
  bindPointer();
  global.addEventListener('resize', resize);
  global.addEventListener('orientationchange', function () { setTimeout(resize, 150); });
  if (global.visualViewport) global.visualViewport.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', function () { if (document.hidden) SND.quiet(); });

  global.__game.getFps = function () { return fps; };
  Object.defineProperty(global.__game, 'world', { get: function () { return world; } });
  global.__game.startQuali = function () { audioKick(); toQuali(world); };
  global.__game.resize = resize;
  Object.defineProperty(global.__game, 'layout', { get: function () { return L; } });
  global.__game.setPaused = function (v) { paused = !!v; if (paused) SND.quiet(); };
  global.__game.ui = ui;
  global.__game.dump = function (kind) {
    var c = kind === 'hud' ? ovl : (kind === 'scene' ? buf.canvas : screen);
    try { return c.toDataURL('image/png'); } catch (e) { return 'ERR ' + e.message; }
  };


  global.requestAnimationFrame(frameLoop);
})(typeof window !== 'undefined' ? window : globalThis);
