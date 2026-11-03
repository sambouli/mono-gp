// ---- WebAudio engine sound (no assets, created on first touch) --------
var SND = (function () {
  var G = GLOBAL;
  var ac = null, ready = false, muted = false, lastT = -1;
  var master, o1, o2, engF, engG, noiseG, noiseF, windG, noiseBuf;

  function noise(sec) {
    var sr = ac.sampleRate;
    var b = ac.createBuffer(1, Math.max(1, Math.floor(sr * sec)), sr);
    var d = b.getChannelData(0);
    var s = 12345;
    for (var i = 0; i < d.length; i++) {
      s = (s * 16807) % 2147483647;
      d[i] = ((s / 2147483647) - 0.5) * 1.6;
    }
    return b;
  }

  function init() {
    if (ac || muted) return;
    var Ctor = G.AudioContext || G.webkitAudioContext;
    if (!Ctor) { muted = true; return; }
    try { ac = new Ctor(); } catch (e) { muted = true; return; }

    master = ac.createGain(); master.gain.value = 0.9; master.connect(ac.destination);

    engG = ac.createGain(); engG.gain.value = 0;
    engF = ac.createBiquadFilter();
    engF.type = 'lowpass'; engF.frequency.value = 2400; engF.Q.value = 3;
    engF.connect(engG); engG.connect(master);

    o1 = ac.createOscillator(); o1.type = 'sawtooth'; o1.frequency.value = 60;
    o2 = ac.createOscillator(); o2.type = 'square'; o2.frequency.value = 92;
    var g1 = ac.createGain(); g1.gain.value = 0.5;
    var g2 = ac.createGain(); g2.gain.value = 0.20;
    o1.connect(g1); g1.connect(engF);
    o2.connect(g2); g2.connect(engF);
    o1.start(); o2.start();

    noiseBuf = noise(1.5);
    var n1 = ac.createBufferSource(); n1.buffer = noiseBuf; n1.loop = true;
    noiseF = ac.createBiquadFilter(); noiseF.type = 'bandpass';
    noiseF.frequency.value = 900; noiseF.Q.value = 1.1;
    noiseG = ac.createGain(); noiseG.gain.value = 0;
    n1.connect(noiseF); noiseF.connect(noiseG); noiseG.connect(master);
    n1.start();

    var n2 = ac.createBufferSource(); n2.buffer = noiseBuf; n2.loop = true;
    var wf = ac.createBiquadFilter(); wf.type = 'highpass'; wf.frequency.value = 1700;
    windG = ac.createGain(); windG.gain.value = 0;
    n2.connect(wf); wf.connect(windG); windG.connect(master);
    n2.start();

    ready = true;
  }

  function set(param, v, tau) {
    try { param.setTargetAtTime(v, ac.currentTime, tau || 0.07); } catch (e) { void e; }
  }

  return {
    get muted() { return muted; },
    init: init,
    kick: function () { init(); if (ac && ac.state === 'suspended') ac.resume(); },
    toggle: function () { muted = !muted; if (muted) this.quiet(); },
    engine: function (pct, gas, off) {
      if (!ready || muted || !ac) return;
      var now = ac.currentTime;
      if (now - lastT < 0.05) return;
      lastT = now;
      var f = 44 + pct * 196 + (gas ? 14 : 0);
      set(o1.frequency, f, 0.05);
      set(o2.frequency, f * 1.51, 0.05);
      set(engF.frequency, 650 + pct * 2700, 0.08);
      set(engG.gain, 0.030 + pct * 0.095 + (gas ? 0.030 : 0), 0.09);
      set(noiseG.gain, 0.010 + pct * 0.045 + off * 0.17, 0.06);
      set(noiseF.frequency, 480 + pct * 900 + off * 1300, 0.06);
      set(windG.gain, Math.max(0, pct - 0.45) * 0.10, 0.10);
    },
    quiet: function () {
      if (!ready || !ac) return;
      set(engG.gain, 0, 0.05); set(noiseG.gain, 0, 0.05); set(windG.gain, 0, 0.05);
    },
    blip: function (f, dur, vol, type) {
      if (!ready || muted || !ac) return;
      try {
        var o = ac.createOscillator(), g = ac.createGain();
        o.type = type || 'square'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, ac.currentTime);
        g.gain.linearRampToValueAtTime(vol || 0.09, ac.currentTime + 0.012);
        g.gain.exponentialRampToValueAtTime(0.0005, ac.currentTime + dur);
        o.connect(g); g.connect(master);
        o.start(); o.stop(ac.currentTime + dur + 0.05);
      } catch (e) { void e; }
    },
    sweep: function (f0, f1, dur, vol) {
      if (!ready || muted || !ac) return;
      try {
        var o = ac.createOscillator(), g = ac.createGain();
        o.type = 'square';
        o.frequency.setValueAtTime(f0, ac.currentTime);
        o.frequency.exponentialRampToValueAtTime(Math.max(40, f1), ac.currentTime + dur);
        g.gain.setValueAtTime(vol || 0.10, ac.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0005, ac.currentTime + dur);
        o.connect(g); g.connect(master);
        o.start(); o.stop(ac.currentTime + dur + 0.05);
      } catch (e) { void e; }
    },
    crash: function (mag) {
      if (!ready || muted || !ac) return;
      try {
        var s = ac.createBufferSource(); s.buffer = noiseBuf;
        var f = ac.createBiquadFilter(); f.type = 'lowpass';
        f.frequency.setValueAtTime(1600, ac.currentTime);
        f.frequency.exponentialRampToValueAtTime(110, ac.currentTime + 0.3);
        var g = ac.createGain();
        g.gain.setValueAtTime(Math.min(0.55, 0.18 + (mag || 1) * 0.3), ac.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0005, ac.currentTime + 0.36);
        s.connect(f); f.connect(g); g.connect(master);
        s.start(); s.stop(ac.currentTime + 0.45);
      } catch (e) { void e; }
    }
  };
})();
