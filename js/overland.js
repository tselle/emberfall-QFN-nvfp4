/* Emberfall — overland.js
 * The wilderness screen: terrain grid (grass, road, bridge, forest, hills, fen,
 * mountains, river), travel that costs time by terrain / hour / fatigue,
 * encounters from per-map tables, friendly travellers, rumours, and visits to
 * hamlets, healers, holy sites, lairs and safe camps. */
(function () {
  const EF = (globalThis.EF = globalThis.EF || {});
  const O = {};
  EF.Overland = O;
  const d = () => EF.dice;
  const W = () => EF.Wilds.gen(EF.Game.state.adventureId);

  O.enter = function (announce) {
    const st = EF.Game.state;
    st.mode = 'overland';
    if (!st.overlandPos) {
      const t = W().town;
      st.overlandPos = { x: t.x, y: t.y };
    }
    if (!st.overlandVisited) st.overlandVisited = {};
    O.reveal();
    EF.UI.show('overland');
    if (announce !== false) EF.Game.log('The road stretches out. The town gate shuts behind you.');
  };

  O.reveal = function () {
    const st = EF.Game.state, p = st.overlandPos, w = W();
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const x = p.x + dx, y = p.y + dy;
      if (x >= 0 && y >= 0 && x < w.W && y < w.H) st.overlandVisited[x + ',' + y] = true;
    }
  };

  function partySpeed() {
    const st = EF.Game.state;
    const alive = st.party.filter(p => p.alive);
    if (!alive.length) return 12;
    let mv = Math.min(...alive.map(p => EF.Rules.movementSquares(p)));
    // party travels at the speed of the slowest; demi-humans at ~15% less, not half
    if (O.fatigued()) mv = Math.max(6, Math.round(mv * 0.6));
    if (EF.Game.isNight()) mv = Math.round(mv * 0.75);
    return mv;
  }
  O.fatigued = () => (EF.Game.state.flags.overlandHours || 0) > 9;

  O.step = function (dx, dy) {
    const st = EF.Game.state;
    if (st.mode !== 'overland') return;
    const w = W();
    const nx = st.overlandPos.x + dx, ny = st.overlandPos.y + dy;
    if (nx < 0 || ny < 0 || nx >= w.W || ny >= w.H) return;
    const t = w.grid[ny][nx];
    if (t === EF.Wilds.T.RIVER) { EF.Game.log('The water is too deep and quick to wade here. Find a bridge.'); return; }
    if (t === EF.Wilds.T.MOUNTAIN) { EF.Game.log('The crags are unclimbable with gear. The road keeps to the passes.'); return; }
    st.overlandPos = { x: nx, y: ny };
    const cost = EF.Wilds.TCOST[t] * (12 / partySpeed());
    st.flags.overlandHours = (st.flags.overlandHours || 0) + cost;
    EF.Game.advanceTime(cost);
    if (O.fatigued() && !st.flags.fatiguedSaid) { st.flags.fatiguedSaid = true; EF.Game.log('The company is walking slow. Someone mutters about camping.'); }
    O.reveal();
    O.arriveSite(nx, ny);
    if (!O.checkEncounter(t)) { EF.UI.show('overland'); }
  };

  O.key = function (k) {
    switch (k) {
      case 'arrowup': case 'w': O.step(0, -1); break;
      case 'arrowdown': case 's': O.step(0, 1); break;
      case 'arrowleft': case 'a': O.step(-1, 0); break;
      case 'arrowright': case 'd': O.step(1, 0); break;
      case 'r': EF.Watch.open(); break;
      case 'j': EF.Journal.open(); break;
      case 'm': EF.MapPage.open(); break;
      case 'i': EF.UI.show('inventory'); break;
      case 'escape': EF.UI.show('menu'); break;
      default: break;
    }
  };

  O.checkEncounter = function (terrain) {
    const st = EF.Game.state;
    const w = W();
    let chance = { 0: 0.05, 1: 0.03, 2: 0.03, 3: 0.09, 4: 0.07, 5: 0.11, 6: 0.06, 7: 0 }[terrain] || 0.05;
    if (EF.Game.isNight()) chance *= 1.6;
    if (O.fatigued()) chance *= 1.3;
    if (st.flags.safeCamp) chance = 0;
    if (!d().chance(Math.round(chance * 100))) {
      // friendly travellers & rumours
      if (d().chance(6)) {
        const f = d().pick(w.friendly);
        const rum = d().pick(w.rumours);
        EF.Game.log('You meet ' + f + '. They say: “' + rum + '”');
      }
      return false;
    }
    const key = d().pick(w.encTable);
    const m = EF.mon(key);
    const n = Math.max(1, Math.round(d().range(1, 3) * (m.hd <= 2 ? 2 : 1)));
    EF.Game.log('Encounter on the road: ' + n + ' × ' + m.name + '!');
    const insts = [];
    for (let i = 0; i < n; i++) insts.push({ key: m.key, x: 0, y: 0, hp: Math.max(1, m.hpAvg), alive: true, sleeping: false, ambush: false, id: 900 + i, virtual: true });
    EF.Combat.startOverland(insts, m);
    return true;
  };

  O.arriveSite = function (x, y) {
    const w = W();
    const s = w.sites.find(s => s.x === x && s.y === y);
    if (!s) return;
    const st = EF.Game.state;
    st.flags.safeCamp = false;
    if (s.kind === 'town') { EF.Game.log('You return to ' + s.name + '.'); EF.Campaign.enterTownOfCurrent(); return; }
    if (s.kind === 'hamlet') { EF.UI.hamlet(s); return; }
    if (s.kind === 'healer') { EF.UI.healerSite(s); return; }
    if (s.kind === 'holy') { EF.UI.holySite(s); return; }
    if (s.kind === 'camp') { st.flags.safeCamp = true; EF.Game.log('You make camp at ' + s.name + '. It is walled and windy-but-safe; no wandering things tonight.'); return; }
    if (s.kind === 'lair' && !s.cleared) {
      EF.Game.log('You have come upon ' + s.name + '. Something inside stops chewing to listen.');
      const insts = [];
      for (let i = 0; i < (s.count || 3); i++) insts.push({ key: s.monster, x: 0, y: 0, hp: Math.max(1, EF.mon(s.monster).hpAvg), alive: true, id: 950 + i, site: s, virtual: true });
      s.pendingHoard = s.hoard;
      EF.Combat.startOverland(insts, EF.mon(s.monster), s);
      return;
    }
    if (s.kind === 'lair' && s.cleared) {
      EF.Game.log('The lair is quiet. You search it thoroughly.');
      const hoard = EF.rollHoard('B', 0);
      hoard.gp = Math.round(hoard.gp / 2);
      for (const p of st.party) p.gold += Math.round(hoard.gp / st.party.length);
      EF.Game.log('You find what the last visitors left: about ' + hoard.gp + ' gp worth.');
      s.cleared = 'looted';
    }
  };

  // ------------------------------------------------- rendering (overland screen)
  EF.UI.register('overland', wrap => {
    const box = EF.UI.panel('overland-panel');
    box.appendChild(EF.UI.h('The wilds of ' + (EF.Adventures[EF.Game.state.adventureId].townName || 'the Emberwild')));
    const info = EF.UI.dim('Hours walking today: ' + Math.round(EF.Game.state.flags.overlandHours || 0) + (O.fatigued() ? ' — fatigued' : '') + ' · ' + EF.Game.clockString() + ' · move with keys or tap a square');
    box.appendChild(info);
    const cv = document.createElement('canvas');
    cv.className = 'wild-canvas';
    cv.id = 'wildCanvas';
    box.appendChild(cv);
    const bar = EF.UI.cmdbar([
      ['Camp R', () => EF.Watch.open()],
      ['Journal J', () => EF.Journal.open()],
      ['Map M', () => EF.MapPage.open()],
      ['Pack I', () => EF.UI.show('inventory')],
      ['Menu Esc', () => EF.UI.show('menu')]
    ]);
    box.appendChild(bar);
    wrap.appendChild(box);
    drawMap();
    cv.onclick = e => {
      const cell = cellFromClick(e);
      if (!cell) return;
      const p = EF.Game.state.overlandPos;
      const dx = Math.sign(cell.x - p.x), dy = Math.sign(cell.y - p.y);
      if (Math.abs(cell.x - p.x) >= Math.abs(cell.y - p.y)) O.step(dx, 0); else O.step(0, dy);
    };
    if (O._timer) clearInterval(O._timer);
    O._timer = setInterval(() => { if (EF.UI.open === 'overland') { drawMap(); info.textContent = 'Hours walking today: ' + Math.round(EF.Game.state.flags.overlandHours || 0) + (O.fatigued() ? ' — fatigued' : '') + ' · ' + EF.Game.clockString() + ' · move with keys or tap a square'; } }, 400);
  });
  function cellFromClick(e) {
    const cv = document.getElementById('wildCanvas');
    if (!cv) return null;
    const rect = cv.getBoundingClientRect();
    const view = O._view || { ox: 0, oy: 0, cell: 12 };
    const x = Math.floor((e.clientX - rect.left - view.ox) / view.cell);
    const y = Math.floor((e.clientY - rect.top - view.oy) / view.cell);
    return { x, y };
  }
  function drawMap() {
    const cv = document.getElementById('wildCanvas');
    if (!cv) return;
    const st = EF.Game.state, w = W();
    const scale = Math.min(2, Math.max(1, Math.floor(cv.clientWidth / (w.W * 14))));
    const cell = Math.max(9, Math.floor(cv.clientWidth / w.W));
    cv.width = cv.clientWidth; cv.height = Math.floor(w.H * cell);
    const g = cv.getContext('2d');
    O._view = { ox: 0, oy: 0, cell };
    g.fillStyle = '#0d0f0c'; g.fillRect(0, 0, cv.width, cv.height);
    for (let y = 0; y < w.H; y++) for (let x = 0; x < w.W; x++) {
      if (!st.overlandVisited[x + ',' + y]) continue;
      const t = w.grid[y][x];
      g.fillStyle = EF.Wilds.TCOLOR[t];
      g.fillRect(x * cell, y * cell, cell, cell);
      if (t === EF.Wilds.T.FOREST) { g.fillStyle = 'rgba(20,40,15,0.6)'; g.fillRect(x * cell + cell * 0.3, y * cell + cell * 0.2, cell * 0.4, cell * 0.5); }
      if (t === EF.Wilds.T.MOUNTAIN) { g.fillStyle = 'rgba(255,255,255,0.25)'; g.beginPath(); g.moveTo(x * cell + cell / 2, y * cell + 2); g.lineTo(x * cell + cell - 2, y * cell + cell - 2); g.lineTo(x * cell + 2, y * cell + cell - 2); g.fill(); }
    }
    for (const s of w.sites) {
      if (!st.overlandVisited[s.x + ',' + s.y]) continue;
      g.fillStyle = siteColor(s.kind);
      g.beginPath();
      g.arc(s.x * cell + cell / 2, s.y * cell + cell / 2, cell * 0.42, 0, 7);
      g.fill();
      g.strokeStyle = '#0d0f0c'; g.stroke();
      if (s.kind === 'lair' && s.cleared) g.fillStyle = '#888', g.fillRect(s.x * cell + 2, s.y * cell + 2, cell - 4, cell - 4);
    }
    const p = st.overlandPos;
    g.fillStyle = '#f2e6b8';
    g.beginPath(); g.arc(p.x * cell + cell / 2, p.y * cell + cell / 2, cell * 0.5, 0, 7); g.fill();
    g.strokeStyle = '#1c1c18'; g.lineWidth = 2; g.stroke();
    g.strokeStyle = 'rgba(255,255,255,0.5)';
    g.strokeRect(p.x * cell, p.y * cell, cell, cell);
    void scale;
  }
  function siteColor(k) {
    return { town: '#d9b23f', dungeon: '#8e3b3b', hamlet: '#b08a5a', healer: '#4aa86b', holy: '#e8e4d2', lair: '#7a2c2c', camp: '#5b8fb5' }[k] || '#999';
  }
})();
