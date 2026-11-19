/* Emberfall — modules.js
 * Shared infrastructure: seeded RNG streams, dice, save game slots, event log,
 * string utilities, and content registries. Loaded after rules.js. */
(function () {
  const EF = (globalThis.EF = globalThis.EF || {});
  const R = EF.Rules;

  // ---------------------------------------------------------------- RNG
  // Deterministic xorshift-ish 32-bit generator. Separate named streams keep
  // later-added content from shifting earlier generated worlds.
  function hashStr(s) {
    let h = 2166136261 >>> 0;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
    return h >>> 0;
  }
  class RNG {
    constructor(seed) {
      this.seed = (typeof seed === 'string' ? hashStr(seed) : (seed >>> 0)) || 1;
      if (this.seed === 0) this.seed = 0x9e3779b9;
      this.s = this.seed;
    }
    next() {
      let x = this.s;
      x ^= x << 13; x >>>= 0;
      x ^= x >> 17;
      x ^= x << 5; x >>>= 0;
      this.s = x;
      return x / 4294967296;
    }
    int(n) { return Math.floor(this.next() * n); }       // 0..n-1
    range(a, b) { return a + this.int(b - a + 1); }      // a..b inclusive
    d(faces) { return 1 + this.int(faces); }             // dN
    d6() { return this.d(6); } d8() { return this.d(8); } d10() { return this.d(10); }
    d12() { return this.d(12); } d20() { return this.d(20); } d100() { return this.d(100); }
    pick(arr) { return arr[this.int(arr.length)]; }
    shuffle(arr) {
      const a = arr.slice();
      for (let i = a.length - 1; i > 0; i--) { const j = this.int(i + 1); const t = a[i]; a[i] = a[j]; a[j] = t; }
      return a;
    }
    chance(pct) { return this.d(100) <= pct; }
    roll(spec) { // "3d6+2", "1d8", "d6", "2"
      if (typeof spec === 'number') return spec;
      const m = /^(\d*)d(\d+)([+-]\d+)?$/i.exec(spec.trim());
      if (!m) return 0;
      const n = m[1] ? +m[1] : 1, f = +m[2], mod = m[3] ? +m[3] : 0;
      let t = 0;
      for (let i = 0; i < n; i++) t += this.d(f);
      return t + mod;
    }
  }
  EF.RNG = RNG;
  const streams = {};
  EF.rng = function (name, extra) { // cached per-name stream factory seed
    const key = name + (extra != null ? '|' + extra : '');
    if (!streams[key]) streams[key] = new RNG('emberfall/' + key);
    return streams[key];
  };
  EF.newRng = function (name, extra) { return new RNG('emberfall/' + name + (extra != null ? '|' + extra : '')); };
  const mathRng = new RNG((Date.now() ^ (Math.random() * 0xffffffff)) >>> 0);
  EF.dice = mathRng; // nondeterministic rolls for live play

  // ---------------------------------------------------------------- dice helpers
  EF.roll = (spec) => mathRng.roll(spec);

  // ---------------------------------------------------------------- saves
  const SAVE_PREFIX = 'emberfall.save.';
  EF.SLOTS = ['slot1', 'slot2', 'slot3', 'slot4', 'slot5', 'autosave'];
  EF.slotLabel = { slot1: 'Slot I', slot2: 'Slot II', slot3: 'Slot III', slot4: 'Slot IV', slot5: 'Slot V', autosave: 'Autosave' };
  function storage() {
    try { const s = (typeof localStorage !== 'undefined') ? localStorage : (EF._memStorage || (EF._memStorage = memStore())); return s; }
    catch (e) { return EF._memStorage || (EF._memStorage = memStore()); }
  }
  function memStore() {
    const m = {};
    return {
      getItem: k => (k in m ? m[k] : null),
      setItem: (k, v) => { m[k] = String(v); },
      removeItem: k => { delete m[k]; },
      key: i => Object.keys(m)[i] || null,
      get length() { return Object.keys(m).length; }
    };
  }
  EF.saveGame = function (slot, obj) {
    try {
      storage().setItem(SAVE_PREFIX + slot, JSON.stringify({ v: R.VERSION, at: Date.now(), game: obj }));
      return true;
    } catch (e) { console.warn('save failed', e); return false; }
  };
  EF.loadGame = function (slot) {
    try {
      const raw = storage().getItem(SAVE_PREFIX + slot);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      return obj && obj.game ? obj : null;
    } catch (e) { return null; }
  };
  EF.slotInfo = function (slot) {
    const o = EF.loadGame(slot);
    if (!o) return null;
    const g = o.game;
    return {
      at: o.at, party: (g.party || []).map(p => p.name + ' (' + R.RACES[p.race].name + ' ' + R.CLASSES[p.cls].name + ' ' + p.level + ')').join(', '),
      adventure: g.adventureId || '?', gold: (g.party || []).reduce((s, p) => s + (p.gold || 0), 0)
    };
  };
  EF.deleteSlot = function (slot) { try { storage().removeItem(SAVE_PREFIX + slot); } catch (e) { void e; } };

  // ---------------------------------------------------------------- misc utils
  EF.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  EF.keyOrder = o => Object.keys(o);
  EF.fmtGold = n => n.toLocaleString ? n.toLocaleString('en-US') : String(n);
  EF.titleCase = s => s.replace(/\b\w/g, c => c.toUpperCase());
  EF.romanize = n => {
    const map = [[1000, 'M'], [900, 'CM'], [500, 'D'], [400, 'CD'], [100, 'C'], [90, 'XC'], [50, 'L'], [40, 'XL'], [10, 'X'], [9, 'IX'], [5, 'V'], [4, 'IV'], [1, 'I']];
    let out = '';
    for (const [v, s] of map) while (n >= v) { out += s; n -= v; }
    return out;
  };
  EF.ord = n => ['zeroth', 'first', 'second', 'third', 'fourth', 'fifth', 'sixth', 'seventh', 'eighth', 'ninth', 'tenth'][n] || (n + 'th');

  // ---------------------------------------------------------------- content registries
  EF.Items = EF.Items || {};      // key -> item
  EF.Spells = EF.Spells || {};    // key -> spell
  EF.Monsters = EF.Monsters || {}; // key -> monster template
  EF.Adventures = EF.Adventures || {}; // id -> adventure
  EF.Sites = EF.Sites || {};      // per adventure sites built by wilds.js

  // ---------------------------------------------------------------- grid utils
  EF.GRID_DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  EF.dirNames = ['east', 'south', 'west', 'north'];
  EF.dirNamesCap = ['East', 'South', 'West', 'North'];
  EFcompass = function (dx, dy) {
    if (dy < 0) return dx < 0 ? 'NW' : 'NE';
    if (dy > 0) return dx < 0 ? 'SW' : 'SE';
    return dx < 0 ? 'W' : dx > 0 ? 'E' : 'N';
  };
})();
