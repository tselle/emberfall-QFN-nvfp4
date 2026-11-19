/* Emberfall — wilds.js
 * Wilderness (overland) map generation for every adventure, from deterministic
 * seeded streams. Terrain grid, carved rivers, roads and bridges, and the sites
 * you can visit: home town, dungeon entrances, hamlets, healers, holy sites,
 * monster lairs and safe camps. Encounter tables and rumours per map. */
(function () {
  const EF = (globalThis.EF = globalThis.EF || {});
  const W = {};
  EF.Wilds = W;

  W.T = { GRASS: 0, ROAD: 1, BRIDGE: 2, FOREST: 3, HILLS: 4, FEN: 5, MOUNTAIN: 6, RIVER: 7 };
  W.TNAME = ['grass', 'road', 'bridge', 'forest', 'hills', 'fen', 'mountain', 'river'];
  W.TCOLOR = ['#7f9f5a', '#b9a678', '#a3865b', '#4c6f3c', '#8d8b6f', '#5d6f52', '#97979d', '#4d7fa6'];
  // travel hours per square at rate 12
  W.TCOST = { 0: 1, 1: 0.7, 2: 0.8, 3: 1.6, 4: 1.8, 5: 2.2, 6: 4, 7: 99 };

  W.W = 64; W.H = 44;

  function valueNoise(rng, w, h) {
    const g = [];
    const gw = Math.ceil(w / 6) + 2, gh = Math.ceil(h / 6) + 2;
    for (let i = 0; i < gw * gh; i++) g.push(rng.next());
    const at = (x, y) => g[EF.clamp(Math.floor(y / 6), 0, gh - 1) * gw + EF.clamp(Math.floor(x / 6), 0, gw - 1)];
    const at2 = (x, y) => g[EF.clamp(Math.floor(y / 12), 0, Math.floor((gh - 1) / 2)) * Math.ceil(gw / 2) + EF.clamp(Math.floor(x / 12), 0, Math.ceil(gw / 2) - 1)];
    const out = [];
    for (let y = 0; y < h; y++) {
      const row = [];
      for (let x = 0; x < w; x++) {
        const fx = (x % 6) / 6, fy = (y % 6) / 6;
        const a = at(x, y), b = at(x + 6, y), c = at(x, y + 6), d = at(x + 6, y + 6);
        const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
        const v = (a * (1 - sx) + b * sx) * (1 - sy) + (c * (1 - sx) + d * sx) * sy;
        row.push(v * 0.65 + (at2(x, y) || 0.5) * 0.35);
      }
      out.push(row);
    }
    return out;
  }

  const SITE_KINDS = ['town', 'dungeon', 'dungeon', 'hamlet', 'hamlet', 'healer', 'holy', 'holy', 'lair', 'lair', 'lair', 'camp', 'camp'];

  W.gen = function (adventureId) {
    if (EF.Sites[adventureId]) return EF.Sites[adventureId];
    const rng = EF.newRng('wilds', adventureId);
    const adv = EF.Adventures[adventureId] || {};
    const w = W.W, h = W.H;
    const hMap = valueNoise(rng, w, h);
    const mMap = valueNoise(EF.newRng('wilds-moist', adventureId), w, h);
    const grid = [];
    const fenBias = /fen|mire|marsh|bog|water/i.test((adv.townName || '') + (adv.title || '')) ? 0.14 : 0;
    const mountBias = /hill|barrow|mountain|iron|stone/i.test((adv.townName || '') + (adv.title || '')) ? 0.10 : 0;
    for (let y = 0; y < h; y++) {
      const row = [];
      for (let x = 0; x < w; x++) {
        const v = hMap[y][x] + mountBias * (1 - y / h), m = mMap[y][x] + fenBias;
        let t = W.T.GRASS;
        if (v > 0.78) t = W.T.MOUNTAIN;
        else if (v > 0.66) t = W.T.HILLS;
        else if (m > 0.72 && v < 0.5) t = W.T.FEN;
        else if (m > 0.55) t = W.T.FOREST;
        row.push(t);
      }
      grid.push(row);
    }
    // river: meanders west→east around mid-height
    const r = { y: Math.floor(h * (0.35 + rng.next() * 0.3)) };
    const riverPath = [];
    for (let x = 0; x < w; x++) {
      r.y += rng.chance(38) ? (rng.chance(50) ? 1 : -1) : 0;
      r.y = EF.clamp(r.y, 3, h - 4);
      riverPath.push({ x, y: r.y });
      grid[r.y][x] = W.T.RIVER;
      if (rng.chance(30) && r.y + 1 < h) grid[r.y + 1][x] = W.T.RIVER;
    }
    // sites
    const sites = [];
    const used = [];
    const kinds = SITE_KINDS.slice();
    // home town first: grass near river junction, roughly centre
    function place(kind, prefer) {
      let best = null, bestScore = -1;
      for (let tries = 0; tries < 160; tries++) {
        const x = rng.range(3, w - 4), y = rng.range(3, h - 4);
        const t = grid[y][x];
        let score = rng.next();
        if (kind === 'town' && t !== W.T.GRASS) score -= 1;
        if (kind === 'hamlet' && t !== W.T.GRASS && t !== W.T.HILLS) score -= 1;
        if (kind === 'lair' && t === W.T.GRASS) score -= 0.8;
        if (kind === 'lair' && (t === W.T.FEN || t === W.T.MOUNTAIN || t === W.T.FOREST)) score += 0.4;
        if (kind === 'holy' && t === W.T.HILLS) score += 0.4;
        if (kind === 'camp' && t === W.T.FOREST) score += 0.3;
        if (kind === 'dungeon' && t === W.T.MOUNTAIN) score += 0.3;
        for (const u of used) {
          const d = Math.hypot(u.x - x, u.y - y);
          if (d < 6) score -= (6 - d) * 0.5;
        }
        if (prefer) score += prefer(x, y, t);
        if (score > bestScore && grid[y][x] !== W.T.RIVER) { bestScore = score; best = { x, y }; }
      }
      if (!best) best = { x: rng.range(3, w - 4), y: rng.range(3, h - 4) };
      grid[best.y][best.x] = W.T.GRASS;
      used.push(best);
      sites.push(Object.assign({ kind }, best));
      return best;
    }
    const town = place('town', (x, y) => (riverPath.some(p => Math.abs(p.y - y) <= 2 && Math.abs(p.x - x) <= 6) ? 0.35 : 0));
    // adventure sites from adventure definitions
    place('dungeon');
    if ((adv.floors || []).length > 3 || (adv.no || 0) >= 2) place('dungeon');
    for (const k of kinds) if (k !== 'town' && k !== 'dungeon' || sites.filter(s => s.kind === 'dungeon').length < (adv.no >= 2 || (adv.floors || []).length > 3 ? 2 : 1)) { if (sites.filter(s => s.kind === k).length < (k === 'lair' ? 3 : k === 'holy' ? 2 : k === 'camp' ? 2 : k === 'hamlet' ? 2 : 1)) place(k); }
    // roads: connect town to each site via L-bend paths (with bridges over river)
    function road(a, b) {
      let x = a.x, y = a.y;
      const step = () => {
        if (grid[y][x] === W.T.RIVER) grid[y][x] = W.T.BRIDGE;
        else if (grid[y][x] !== W.T.GRASS) grid[y][x] = W.T.ROAD; // road ploughs through wood, hill, fell and fen
      };
      step();
      while (x !== b.x) { x += x < b.x ? 1 : -1; if (rng.chance(25) && y !== b.y) y += y < b.y ? 1 : -1; step(); }
      while (y !== b.y) { y += y < b.y ? 1 : -1; step(); }
      step();
    }
    for (const s of sites) if (s !== town) road(town, s);
    // naming
    const nameRng = EF.newRng('wildnames', adventureId);
    const HAM = ['Barleycot', 'Ashwick', 'Dunniwell', 'Pinfold', 'Rookery Bottom', 'Kettlehithe', 'Woolpack', 'Sixth Mile', 'Grimsdyke', 'Half-Ford', 'Nettlecote', 'Fir Bottom'];
    const HOL = ['Hill of the Dawn Oath', 'Saint Cerena’s Stone', 'The Quiet Kairn', 'Lady Well', 'The Ashen Shrine', 'First Forge of the Hearthfather', 'The Nine Pillars', 'Weeping Rock'];
    const HEA = ['Mab Banewright’s cottage', 'The Botanicherb House', 'Old Fishtooth (healer)', 'The Bellmaker’s Herbery'];
    const LAIR = ['troll-cave', 'barrow-house', 'ruined watch-tower', 'bonefen', 'smoke-pits', 'the Hollow Rock', 'broken shrine', 'raider-camp'];
    const CAMPS = ['drovers’ camp', 'old watch-fire', 'shepherd’s shelter', 'the Walled Spring', 'mill-ruin camp'];
    const usedH = [], usedL = [];
    for (const s of sites) {
      if (s.kind === 'town') s.name = (EF.Adventures[adventureId] || {}).townName || 'Town';
      else if (s.kind === 'dungeon') s.name = (EF.Adventures[adventureId] || {}).title ? 'Entrance to ' + EF.Adventures[adventureId].title : 'Dungeon Entrance';
      else if (s.kind === 'hamlet') s.name = HAM[(usedH.push(1) - 1 + nameRng.int(3)) % HAM.length] + ' ' + (usedH.length > 6 ? usedH.length : '');
      else if (s.kind === 'holy') s.name = HOL[nameRng.int(HOL.length)];
      else if (s.kind === 'healer') s.name = HEA[nameRng.int(HEA.length)];
      else if (s.kind === 'lair') s.name = 'Lair: ' + LAIR[nameRng.int(LAIR.length)];
      else if (s.kind === 'camp') s.name = CAMPS[nameRng.int(CAMPS.length)];
    }
    // lairs get a resident monster by band
    const band = (EF.Adventures[adventureId] || {}).band || 0;
    const POOLS = [
      ['goblin', 'kobold', 'orc', 'giant rat', 'wolf', 'skeleton warrior'],
      ['orc', 'hobgoblin', 'gnoll', 'bugbear', 'wight', 'ogre', 'giant spider'],
      ['troll', 'ogre mage', 'wight, elder', 'minotaur', 'manticore', 'basilisk'],
      ['wraith', 'mummy', 'cairn knight', 'ash hag', 'mire hag', 'greater basilisk', 'gazer'],
      ['vampire', 'frost giant', 'fire giant', 'cloud giant', 'gazer', 'death orb', 'mind hunter', 'young stormwyrm']
    ];
    for (const s of sites) if (s.kind === 'lair') {
      const pool = POOLS[Math.min(4, band)];
      s.monster = EF.mon(pool[nameRng.int(pool.length)]).key;
      s.count = nameRng.range(2, 5);
      s.hoard = ['C', 'D', 'E', 'F', 'G'][Math.min(4, band)];
      s.cleared = false;
    }
    // rumours & encounters
    const RUMOURS = [
      'A light burns in the high window of the old watch-tower at night, though no one lives there.',
      'The fen-light went out three nights running. That is, they say, the fen being full.',
      'Travelers report a mounted figure who rides beside them and answers every question with a better one.',
      'The bell at the ruined chapel tolls the hour a half-hour late. It has done so since your grandmother’s time.',
      'Something in the northern woods is learning to use tools. It started with the axes.',
      'The hamlet folk pay a tithe in eggs to a certain hill. Ask no further.',
      'If you meet a grey pilgrim counting stones, do not hand him one.',
      'A company came out of the entrance way last spring. One came back. He is not sociable now, but he is accurate.',
      'The road keeps itself, but the bridges keep themselves better. Be thankful which you cross.',
      'There is a spring that runs warm in the walled camp. Those who bathe there wake young. Not younger, mind: young.'
    ];
    const rumours = [];
    for (let i = 0; i < 5; i++) rumours.push(RUMOURS[(nameRng.int(RUMOURS.length)) % RUMOURS.length]);
    const encTable = [];
    const ENC_BY_BAND = [
      ['giant rat', 'kobold', 'goblin', 'orc', 'wolf', 'giant bat', 'horse leech', 'dire wolf', 'bandit'],
      ['orc', 'hobgoblin', 'gnoll', 'ogre', 'wight', 'bandit captain', 'dire wolf', 'shadow', 'giant spider', 'stepper? no: steppe rider'],
      ['troll', 'bugbear', 'wight, elder', 'minotaur', 'carn ape', 'brigand', 'griffon? no: gryphon', 'wyvern'],
      ['wraith', 'mummy', 'ettin', 'manticore', 'hill giant', 'ash hag', 'bone golem', 'basilisk'],
      ['vampire', 'frost giant', 'fire giant', 'storm giant', 'gazer', 'cairn knight', 'ember lord', 'young stormwyrm']
    ];
    for (const k of ENC_BY_BAND[Math.min(4, band)]) if (EF.mon(k)) encTable.push(k);
    const FRIENDLY = ['a wool-drover with three patient dogs', 'two pilgrims from Saint Cerena’s house', 'a carter whose wheel has just failed', 'a hedge-knight travelling light', 'a natural philosopher with butterfly nets', 'a band of steppe riders trading east', 'an old soldier walking the whole road of his youth'];
    EF.Sites[adventureId] = { grid, sites, town, rumours, encTable, friendly: FRIENDLY, W: w, H: h, seed: adventureId };
    return EF.Sites[adventureId];
  };
  void valueNoise;
})();
