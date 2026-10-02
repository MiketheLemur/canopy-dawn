/* canopy-dawn — a generative dawn chorus machine.
 *
 * The engine is pure scheduling. It knows nothing about audio: it conducts
 * species calls and weather beds through whatever backend you hand it. Give
 * it a fake backend and it will happily conduct an entire silent dawn, which
 * is exactly how test/smoke.js runs it headless. The browser wires a real
 * Web Audio backend in index.html.
 *
 * One dawn = 04:30 to 08:00, compressed into ARC.realSeconds of real time,
 * then it loops. There is no full day here. Only the waking.
 */
(function (root) {
'use strict';

var ARC = { startMinutes: 270, spanMinutes: 210, realSeconds: 480 };

function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
function smoothstep(a, b, x) {
  var t = clamp01((x - a) / (b - a));
  return t * t * (3 - 2 * t);
}
function bell(x, c, w) {
  var d = (x - c) / w;
  return Math.exp(-d * d);
}

/* How awake each voice is at dawn-position t (0..1). Gaussians and
 * smoothsteps — the honest mathematics of waking up. */
function activityProfiles(t) {
  return {
    nightjar:   bell(t, 0.05, 0.07),
    insects:    clamp01(0.95 - 0.75 * t),
    ringtail:   bell(t, 0.36, 0.16),
    sifaka:     bell(t, 0.60, 0.14),
    mouselemur: bell(t, 0.82, 0.12) * 0.9,
    birds:      smoothstep(0.12, 0.45, t) * (1 - 0.25 * smoothstep(0.80, 1.00, t)),
    wind:       clamp01(0.30 + 0.22 * Math.sin(t * 23.7) * Math.sin(t * 7.3) + 0.10 * Math.sin(t * 3.1))
  };
}

function clockString(t) {
  var mins = ARC.startMinutes + clamp01(t) * ARC.spanMinutes;
  var h = Math.floor(mins / 60), m = Math.floor(mins % 60);
  return (h < 10 ? '0' + h : '' + h) + ':' + (m < 10 ? '0' + m : '' + m);
}

/* The voices. Each emitter asks the backend for sound; every call carries a
 * `tag` so a fake backend can audit who sang when. */
var EMIT = {
  nightjar: function (c) {
    /* a low churr in the dark: an amplitude-modulated low tone */
    c.backend.pulse({
      tag: 'nightjar',
      freq: 150 + c.rng() * 40,
      dur: 0.9 + c.rng() * 0.8,
      amRate: 20 + c.rng() * 8,
      vol: 0.20
    });
  },
  ringtail: function (c) {
    /* contact calls: a burst of descending yips */
    var n = 2 + Math.floor(c.rng() * 3), i;
    for (i = 0; i < n; i++) {
      c.backend.chirp({
        tag: 'ringtail', f0: 950, f1: 470, dur: 0.13,
        type: 'sawtooth', vol: 0.22, delay: i * 0.19, vibrato: 6
      });
    }
  },
  sifaka: function (c) {
    /* the famous "tchi-fak": two sharp barks */
    c.backend.chirp({ tag: 'sifaka', f0: 1500, f1: 900, dur: 0.09, type: 'square', vol: 0.13 });
    c.backend.chirp({ tag: 'sifaka', f0: 820, f1: 480, dur: 0.16, type: 'square', vol: 0.15, delay: 0.14 });
  },
  mouselemur: function (c) {
    /* tiny trills, high and quick, on the way home to sleep */
    var n = 4 + Math.floor(c.rng() * 4), i;
    for (i = 0; i < n; i++) {
      c.backend.chirp({
        tag: 'mouselemur', f0: 5200 + c.rng() * 1500, f1: 4200,
        dur: 0.05, vol: 0.07, delay: i * 0.07
      });
    }
  },
  birds: function (c) {
    /* a pentatonic phrase, different every time */
    var scale = [0, 2, 4, 7, 9, 12, 14];
    var baseF = 2200 + c.rng() * 1400;
    var n = 3 + Math.floor(c.rng() * 4), i, t = 0;
    for (i = 0; i < n; i++) {
      var f = baseF * Math.pow(2, scale[Math.floor(c.rng() * scale.length)] / 12);
      c.backend.chirp({
        tag: 'birds', f0: f * (0.92 + c.rng() * 0.08), f1: f,
        dur: 0.12 + c.rng() * 0.12, vol: 0.12, delay: t, vibrato: 9
      });
      t += 0.14 + c.rng() * 0.16;
    }
  }
};

var SPECIES = [
  { key: 'nightjar',   base: 10, note: 'nightjar churring in the dark' },
  { key: 'ringtail',   base: 7,  note: 'first ring-tail contact calls — the troop is awake' },
  { key: 'sifaka',     base: 12, note: 'sifaka "tchi-fak" from the far ridge' },
  { key: 'mouselemur', base: 6,  note: 'mouse-lemur trills — the night shift clocks out' },
  { key: 'birds',      base: 4,  note: 'the chorus proper begins' }
];

function createChorus(backend, hooks, opts) {
  opts = opts || {};
  hooks = hooks || {};
  var rng = opts.rng || Math.random;
  var arcSeconds = opts.arcSeconds || ARC.realSeconds;

  function note(text) {
    if (hooks.onEvent) hooks.onEvent(clockString(api.t), text);
  }

  var api = {
    backend: backend,
    rng: rng,
    t: 0,               /* dawn position, 0..1 */
    density: (typeof opts.density === 'number' && opts.density > 0) ? opts.density : 1,
    wet: false,
    storm: 0,           /* seconds of storm remaining */
    relief: 0,          /* post-storm liveliness, seconds remaining */
    playing: false,
    _seen: {},
    _next: {},
    _thunderIn: 0,
    _beds: { insects: 0, rain: 0, wind: 0 }
  };

  SPECIES.forEach(function (s) { api._next[s.key] = 1 + rng() * s.base; });

  api.play = function () { api.playing = true; };
  api.pause = function () { api.playing = false; };
  api.setT = function (x) { api.t = clamp01(x); };
  api.setDensity = function (d) { api.density = Math.max(0.1, Math.min(3, d)); };

  api.toggleWet = function () {
    api.wet = !api.wet;
    note(api.wet ? 'humidity rises — wet season settles over the canopy'
                 : 'the air dries — wet season lifts');
    return api.wet;
  };

  api.summonStorm = function () {
    if (api.storm > 0) return api.storm;
    api.storm = 50;
    api._thunderIn = 1.5 + rng() * 2;
    note('a storm rolls over the canopy — the troop goes silent');
    return api.storm;
  };

  function setBed(name, level) {
    level = clamp01(level);
    if (Math.abs(level - api._beds[name]) > 0.004) {
      api._beds[name] = level;
      backend.setBed(name, level);
    }
  }

  api.tick = function (dt) {
    if (!api.playing || dt <= 0) return;
    api.t += dt / arcSeconds;
    if (api.t >= 1) {
      api.t -= 1;
      api._seen = {};
      note('the dawn begins again — it always does');
    }

    var stormMul = api.storm > 0 ? 0.03 : 1;
    var prof = activityProfiles(api.t);
    var i, s, act;

    for (i = 0; i < SPECIES.length; i++) {
      s = SPECIES[i];
      api._next[s.key] -= dt;
      if (api._next[s.key] > 0) continue;
      act = prof[s.key] * stormMul * api.density;
      if ((s.key === 'birds' || s.key === 'ringtail') && api.relief > 0) act *= 1.6;
      if (act > 0.03) {
        EMIT[s.key](api);
        if (!api._seen[s.key]) {
          api._seen[s.key] = true;
          note(s.note);
        }
        api._next[s.key] = s.base / act * (0.6 + rng() * 0.9);
      } else {
        api._next[s.key] = 2 + rng() * 3;
      }
    }

    setBed('insects', prof.insects * (api.storm > 0 ? 0.3 : 1) * 0.5);
    setBed('rain', api.storm > 0 ? 1 : (api.wet ? 0.35 : 0));
    setBed('wind', prof.wind * 0.6);

    if (rng() < dt * 0.04) backend.gust();

    if (api.storm > 0) {
      api.storm -= dt;
      api._thunderIn -= dt;
      if (api._thunderIn <= 0) {
        backend.thunder();
        api._thunderIn = 6 + rng() * 14;
      }
      if (api.storm <= 0) {
        api.storm = 0;
        api.relief = 25;
        note('the storm passes — the chorus resumes, louder than before');
      }
    }
    if (api.relief > 0) api.relief -= dt;
  };

  api.getState = function () {
    return {
      t: api.t,
      clock: clockString(api.t),
      storm: api.storm > 0,
      wet: api.wet,
      relief: api.relief > 0,
      playing: api.playing,
      beds: { insects: api._beds.insects, rain: api._beds.rain, wind: api._beds.wind }
    };
  };

  return api;
}

var ns = {
  ARC: ARC,
  createChorus: createChorus,
  activityProfiles: activityProfiles,
  clockString: clockString
};

if (typeof module !== 'undefined' && module.exports) module.exports = ns;
root.CanopyDawn = ns;

})(typeof window !== 'undefined' ? window : globalThis);
