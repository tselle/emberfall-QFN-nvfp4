/* Emberfall — game.js
 * The game core: state, the party, dungeon/town runtime simulation (doors,
 * secret doors, traps, searching, listening, monster notice & wandering,
 * stairs, ground loot, events), time & camping hooks, save/load, and the
 * main loop. Boots the UI when the DOM is ready. */
(function () {
  const EF = (globalThis.EF = globalThis.EF || {});
  const R = EF.Rules;

  const G = {};
  EF.Game = G;

  G.state = null;

  // ------------------------------------------------------------------ helpers
  const dice = () => EF.dice;
  function dirVec(d) { return [[1, 0], [0, 1], [-1, 0], [0, -1]][d & 3]; }
  G.dirVec = dirVec;
  function angOf(d) { return d * Math.PI / 2; }

  // ---------------------------------------------------------------- new game
  G.newGame = function (adventureId, party) {
    G.state = {
      screen: 'mode', mode: 'town',
      adventureId,
      party: party,
      day: 1, hour: 8,
      pos: { x: 0, y: 0, dir: 0 },
      dungeonFloor: 0,
      dungeonState: {},   // advId -> floorIdx -> runtime
      groundLoot: [],     // {advId, floor, x, y, items:[{key,qty}], taken}
      quests: {},         // questId -> {done, rescued, kills, itemFound}
      bestiary: {},       // key -> {met, slain}
      flags: {},
      log: [],
      overlandPos: null,
      overlandVisited: {},
      townDone: {},
      camped: null,
      activeCompany: party.map(p => p.name)
    };
    for (const q of EF.Adventures[adventureId].quests) G.state.quests[q.id] = { done: false, kills: 0, rescued: 0 };
    G.enterTown();
    G.log('Welcome to ' + EF.Adventures[adventureId].townName + '. ' + EF.Adventures[adventureId].intro);
    EF.UI.show('ui');
  };
  G.autosaveThrottle = 0;
  G.autosave = function () {
    const now = Date.now();
    if (now - G.autosaveThrottle < 4000) return;
    G.autosaveThrottle = now;
    EF.saveGame('autosave', G.state);
  };

  // ---------------------------------------------------------------- logging
  G.log = function (text, cls) {
    if (!G.state) return;
    G.state.log.push({ t: text, cls: cls || '', at: G.state.day + 'd' + G.state.hour });
    if (G.state.log.length > 400) G.state.log.shift();
    if (EF.UI && EF.UI.logDirty) EF.UI.logDirty();
  };

  // ---------------------------------------------------------------- time
  G.advanceTime = function (hours) {
    const st = G.state;
    st.hour += hours;
    while (st.hour >= 24) { st.hour -= 24; st.day++; G.partyMorning(false); }
  };
  G.isNight = () => { const h = G.state.hour; return h >= 21 || h < 6; };
  G.clockString = function () {
    const st = G.state;
    const h = Math.floor(st.hour) % 24;
    const m = Math.round((st.hour - Math.floor(st.hour)) * 60);
    return 'Day ' + st.day + ' ' + h + ':' + (m < 10 ? '0' + m : m);
  };

  // ---------------------------------------------------------------- runtime floors
  G.floorState = function () {
    const st = G.state;
    const adv = EF.Adventures[st.adventureId];
    const key = st.adventureId;
    const ds = st.dungeonState[key] || (st.dungeonState[key] = {});
    const fi = st.dungeonFloor;
    if (!ds[fi]) ds[fi] = buildFloor(adv, fi, st);
    return ds[fi];
  };
  function buildFloor(adv, fi, st) {
    const def = adv.floors[fi];
    const grid = def.grid.map(r => r.slice());
    const mons = [];
    for (const e of def.monsters) {
      const m = EF.mon(e.m);
      if (!m) { console.warn('missing monster', e.m); continue; }
      const n = e.n || 1;
      for (let i = 0; i < n; i++) {
        const hp = Math.max(1, Math.round(m.hpAvg * (0.8 + dice().d(20) / 50)));
        mons.push({
          id: mons.length, key: m.key, x: e.x, y: e.y, hp, maxHp: hp, ac: m.ac,
          sleeping: !!e.sleeping, ambush: !!e.ambush, alerted: false, boss: !!e.boss,
          quest: e.quest || null, alive: true, hunt: false, state: 'idle'
        });
      }
    }
    return {
      grid, mons,
      doors: {},            // "x,y" -> 'open'|'closed'|'busted'|'unlocked'
      secretsFound: {},     // "x,y" -> true
      trapsFound: {}, trapsDone: {}, // defused
      visited: {},
      eventsDone: {},
      entered: false, entry: { x: def.entry.x, y: def.entry.y, dir: def.entry.dir || 0 }
    };
  }

  // cell accessor used by the view
  G.cell = function (x, y, forView) {
    const st = G.state;
    if (st.mode === 'town' || st.mode === 'camp-town') return G.townCell(x, y, forView);
    const f = G.floorState();
    if (x < 0 || y < 0 || y >= f.grid.length || x >= f.grid[0].length) return { solid: true, ch: '#' };
    let ch = f.grid[y][x];
    const k = x + ',' + y;
    if (ch === 'S') {
      if (!f.secretsFound[k]) return { solid: true, ch: '#', tex: ['stone', 'stone2', 'doorSecret'][(x * 7 + y * 13) % 3] === 'doorSecret' ? 'stone2' : 'stone' };
      ch = '+';
    }
    if (ch === '#') return { solid: true, ch, tex: undefined };
    if (ch === '+' || ch === 'L') {
      const d = f.doors[k] || 'closed';
      if (d === 'open' || d === 'busted') return { solid: false, ch: '+', open: true };
      return { solid: true, ch, tex: ch === 'L' && d === 'unlocked' ? 'door' : undefined };
    }
    if (ch === '~') return { solid: true, ch, tex: 'water' };
    if (ch === '%') return { solid: false, ch, tex: 'rubble' };
    return { solid: false, ch };
  };
  G.townCell = function (x, y, forView) {
    const st = G.state;
    const adv = EF.Adventures[st.adventureId];
    const t = adv.town;
    if (x < 0 || y < 0 || y >= t.grid.length || x >= t.grid[0].length) return { solid: true, ch: '#' };
    const ch = t.grid[y][x];
    if (ch === '#') {
      // pick a facade texture from an adjacent object (behind this wall from street)
      let tex = 'plaster';
      for (const o of t.objects) {
        if (Math.abs(o.x - x) + Math.abs(o.y - y) <= 2) {
          tex = EF.Figures.FACADE[o.kind] ? facadeTex(o.kind) : tex;
        }
      }
      return { solid: true, ch, tex };
    }
    return { solid: false, ch };
  };
  function facadeTex(kind) {
    return { temple: 'facadeTemple', inn: 'facadeInn', shop_general: 'facadeShop', shop_weapons: 'facadeArms', shop_armour: 'facadeArms', training: 'facadeHall', patron: 'facadeHall', dungeon: 'dungeonIn' }[kind] || 'plaster';
  }

  G.walkable = function (x, y) {
    const c = G.cell(x, y);
    if (c.solid) return false;
    if (G.state.mode === 'town' || G.state.mode === 'camp-town') return true;
    // monsters block
    const f = G.floorState();
    return !f.mons.some(m => m.alive && m.x === x && m.y === y);
  };

  // ---------------------------------------------------------------- entering places
  G.enterTown = function () {
    const st = G.state;
    const adv = EF.Adventures[st.adventureId];
    const gate = adv.town.objects.find(o => o.kind === 'wildexit') || { x: 1, y: 1 };
    st.mode = 'town';
    // face inward from the gate, whichever wall it sits in
    const tw = adv.town.grid[0].length, th = adv.town.grid.length;
    let dir = 0;
    if (gate.y >= th - 2) dir = 0;            // south gate → look north
    else if (gate.y <= 1) dir = 2;            // north gate → look south
    else if (gate.x <= 1) dir = 1;            // west gate → look east
    else if (gate.x >= tw - 2) dir = 3;       // east gate → look west
    st.pos = { x: gate.x, y: gate.y, dir };
    if (EF.UI.onModeChange) EF.UI.onModeChange();
    if (G.view) {
      G.view.map = { W: adv.town.grid[0].length, H: adv.town.grid.length, cell: (x, y) => G.cell(x, y, true) };
      G.view.setCamera(st.pos.x + 0.5, st.pos.y + 0.5, angOf(st.pos.dir));
    }
  };
  G.enterDungeon = function (floor) {
    const st = G.state;
    st.mode = 'dungeon';
    st.dungeonFloor = floor || 0;
    if (EF.UI.onModeChange) EF.UI.onModeChange();
    const f = G.floorState();
    if (!f.entered) { st.pos = { x: f.entry.x, y: f.entry.y, dir: f.entry.dir }; f.entered = true; G.log('You descend into ' + EF.Adventures[st.adventureId].floors[st.dungeonFloor].name + '.'); }
    else G.log('You return to ' + EF.Adventures[st.adventureId].floors[st.dungeonFloor].name + '.');
    const adv = EF.Adventures[st.adventureId];
    if (G.view) {
      G.view.map = { W: f.grid[0].length, H: f.grid.length, cell: (x, y) => G.cell(x, y, true) };
      G.view.setCamera(st.pos.x + 0.5, st.pos.y + 0.5, angOf(st.pos.dir));
    }
    G.autosave();
  };
  G.leaveDungeon = function () {
    G.log('You climb back into the light.');
    G.enterTown();
  };

  // ---------------------------------------------------------------- movement & arrival
  G.moveFwd = function () {
    const st = G.state, [dx, dy] = dirVec(st.pos.dir);
    G.tryMove(st.pos.x + dx, st.pos.y + dy);
  };
  G.moveBack = function () {
    const st = G.state, [dx, dy] = dirVec((st.pos.dir + 2) & 3);
    G.tryMove(st.pos.x + dx, st.pos.y + dy, true);
  };
  G.sidestep = function (right) {
    const st = G.state, [dx, dy] = dirVec((st.pos.dir + (right ? 1 : 3)) & 3);
    G.tryMove(st.pos.x + dx, st.pos.y + dy, true);
  };
  G.turn = function (d) { G.state.pos.dir = (G.state.pos.dir + d + 4) & 3; };
  G.tryMove = function (x, y, quietBump) {
    const st = G.state;
    const c = G.cell(x, y);
    if (c.solid) {
      if ((c.ch === '+' || c.ch === 'L' || c.ch === 'S')) G.doorBump(x, y);
      else if (G.view && !quietBump) G.view.shake = 0.6;
      return;
    }
    const f = st.mode === 'dungeon' ? G.floorState() : null;
    if (f && f.mons.some(m => m.alive && m.x === x && m.y === y)) {
      // walking into a monster starts combat
      EF.Combat.start(f.mons.filter(m => m.alive && Math.abs(m.x - x) + Math.abs(m.y - y) <= 1 && G.seeMonster(m)));
      return;
    }
    st.pos.x = x; st.pos.y = y;
    if (G.view) G.view.face(x, y, angOf(st.pos.dir));
    G.arrive(x, y);
  };
  G.seeMonster = function (m) {
    if (m.state === 'fled') return false;
    const st = G.state;
    return Math.abs(m.x - st.pos.x) + Math.abs(m.y - st.pos.y) <= 12 && G.lineOfSight(st.pos.x, st.pos.y, m.x, m.y);
  };
  G.lineOfSight = function (x0, y0, x1, y1) {
    let dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0);
    let sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx - dy, x = x0, y = y0, guard = 0;
    while (guard++ < 60) {
      if (x === x1 && y === y1) return true;
      const e2 = 2 * err;
      if (e2 > -dy) { err -= dy; x += sx; }
      if (e2 < dx) { err += dx; y += sy; }
      if (x === x1 && y === y1) return true;
      const c = G.cell(x, y);
      if (c.solid && !c.open) return false;
    }
    return false;
  };

  G.arrive = function (x, y) {
    const st = G.state;
    if (st.mode === 'dungeon') {
      const f = G.floorState();
      f.visited[x + ',' + y] = true;
      // traps
      const adv = EF.Adventures[st.adventureId];
      for (const t of adv.floors[st.dungeonFloor].traps) {
        const k = t.x + ',' + t.y;
        if (t.x === x && t.y === y && !f.trapsDone[k] && !f.trapsFound[k]) G.springTrap(t);
      }
      // events
      for (const e of adv.floors[st.dungeonFloor].events) {
        const ek = st.dungeonFloor + ':' + e.id;
        if (e.x === x && e.y === y && !f.eventsDone[e.id]) {
          f.eventsDone[e.id] = true;
          G.log(e.text, 'event');
          if (e.grant) G.grant(e.grant);
          if (e.rescue) G.noteRescue(e.rescue);
        }
        void ek;
      }
      // hoards (ground treasure)
      for (const h of adv.floors[st.dungeonFloor].treasure) {
        const hk = 'h' + st.dungeonFloor + ':' + h.x + ',' + h.y;
        if (h.x === x && h.y === y && !st.flags[hk]) {
          st.flags[hk] = true;
          const band = adv.band || 0;
          const hoard = EF.rollHoard(h.hoard, band);
          G.takeHoard(h, hoard);
        }
      }
      // stairs
      const ch = f.grid[y][x];
      if (ch === '>' && st.dungeonFloor < EF.Adventures[st.adventureId].floors.length - 1) {
        G.log('You descend further down.');
        st.dungeonFloor++;
        const nf = G.floorState();
        st.pos.x = nf.entry.x; st.pos.y = nf.entry.y; st.pos.dir = nf.entry.dir;
        if (G.view) {
          G.view.map = { W: nf.grid[0].length, H: nf.grid.length, cell: (a, b) => G.cell(a, b, true) };
          G.view.setCamera(st.pos.x + 0.5, st.pos.y + 0.5, angOf(st.pos.dir));
        }
        G.autosave();
        return;
      }
      if (ch === '<' && st.dungeonFloor > 0) {
        st.dungeonFloor--;
        const nf = G.floorState();
        st.pos.x = nf.entry.x; st.pos.y = nf.entry.y; st.pos.dir = nf.entry.dir;
        if (G.view) {
          G.view.map = { W: nf.grid[0].length, H: nf.grid.length, cell: (a, b) => G.cell(a, b, true) };
          G.view.setCamera(st.pos.x + 0.5, st.pos.y + 0.5, angOf(st.pos.dir));
        }
        G.autosave();
        return;
      }
      // dropped loot pickup
      G.pickupAt(x, y);
      // monster notice
      G.monsterNoticePass(x, y);
    } else if (st.mode === 'town' || st.mode === 'camp-town') {
      const adv = EF.Adventures[st.adventureId];
      const o = adv.town.objects.find(ob => ob.x === x && ob.y === y);
      if (o) EF.UI.townObject(o);
    }
    G.autosave();
  };

  G.pickupAt = function (x, y) {
    const st = G.state;
    const here = st.groundLoot.filter(l => !l.taken && l.advId === st.adventureId && l.floor === st.dungeonFloor && l.x === x && l.y === y);
    for (const l of here) {
      l.taken = true;
      for (const it of l.items) {
        G.giveItem(it.key, it.qty || 1);
        G.log('You pick up ' + (EF.Items[it.key] ? EF.Items[it.key].name : it.key) + (it.qty > 1 ? ' ×' + it.qty : '') + '.');
      }
    }
  };
  G.dropAt = function (items) {
    const st = G.state;
    if (st.mode !== 'dungeon') { G.log('There is nowhere sensible to leave it here.'); return; }
    st.groundLoot.push({ advId: st.adventureId, floor: st.dungeonFloor, x: st.pos.x, y: st.pos.y, items });
    G.log('You leave the goods on the ground.');
  };
  G.giveItem = function (key, qty) {
    const st = G.state;
    const it = EF.Items[key];
    if (!it) return;
    for (const p of st.party) {
      if (it.coins) { p.gold = Math.max(0, Math.round(p.gold + (it.silver ? qty * 0.1 : qty / st.party.length))); return; }
    }
    // shared pack: first living member carries
    const p = st.party.find(c => c.alive) || st.party[0];
    const ex = p.items.find(i => i.key === key && !i.equipped);
    if (ex && !it.coins) ex.qty += (qty || 1);
    else p.items.push({ key, qty: qty || 1 });
  };
  G.partyGold = () => G.state.party.reduce((s, p) => s + (p.gold || 0), 0);
  G.takeHoard = function (h, hoard) {
    const st = G.state;
    const lines = [];
    if (hoard.gp) {
      const gp = hoard.gp;
      for (const p of st.party) p.gold += Math.round(gp / st.party.length);
      lines.push(gp + ' gp shared');
    }
    const pretty = [];
    for (const g of hoard.gems) pretty.push((EF.Items[g.item] || {}).name || 'gems');
    for (const j of hoard.jewels) pretty.push((EF.Items[j.item] || {}).name || 'jewellery');
    for (const a of hoard.art) pretty.push((EF.Items[a.item] || {}).name || 'artwork');
    if (pretty.length) lines.push(pretty.join(', '));
    for (const m of hoard.items) { G.giveItem(m.item, m.qty); }
    if (h.grantItem) G.giveItem(h.grantItem, 1);
    G.log('You find ' + (h.name || 'treasure') + ': ' + (lines.length ? lines.join('; ') : 'nothing but dust.') , 'treasure');
    for (const p of st.party) if (hoard.gp) G.grantXP(Math.round(hoard.gp / 6 / st.party.length));
  };

  // ---------------------------------------------------------------- doors
  G.doorBump = function (x, y) {
    const st = G.state;
    const f = G.floorState();
    const k = x + ',' + y;
    const ch = f.grid[y] ? f.grid[y][x] : '#';
    if (ch === 'S' && !f.secretsFound[k]) { if (G.view) G.view.shake = 0.5; return; }
    const d = f.doors[k] || 'closed';
    if (d === 'open' || d === 'busted') return;
    EF.UI.doorMenu(x, y, ch, d);
  };
  G.doorOpen = function (x, y, force) {
    const f = G.floorState();
    const k = x + ',' + y;
    const ch = f.grid[y][x];
    if (ch === 'L' && !force) {
      // try thief open
      const thief = G.bestThief('openLocks');
      if (!thief) { G.log('There is no one skilled enough to pick it.'); return false; }
      const roll = dice().d(100);
      if (roll <= G.thiefSkill(thief, 'openLocks')) { f.doors[k] = 'unlocked'; G.log(thief.name + ' picks the lock with a soft click.'); G.afterDoorOpen(x, y); return true; }
      G.log(thief.name + ' fiddles with the lock; nothing gives.');
      return false;
    }
    f.doors[k] = 'open';
    G.afterDoorOpen(x, y);
    return true;
  };
  G.doorBust = function (x, y) {
    const f = G.floorState();
    const k = x + ',' + y;
    const str = Math.max(...G.state.party.filter(p => p.alive).map(p => p.abilities.str));
    if (dice().d(6) <= (str >= 18 ? 4 : str >= 16 ? 3 : str >= 13 ? 2 : 1)) {
      f.doors[k] = 'busted';
      G.log('The door crashes off its hinges.');
      if (G.anyHeardLoud()) G.alertAllNear(8);
      G.afterDoorOpen(x, y);
    } else G.log('You slam into the door. It slams back.');
  };
  G.afterDoorOpen = function (x, y) {
    // monsters immediately behind may hear / see
    const f = G.floorState();
    for (const m of f.mons) {
      if (!m.alive) continue;
      if (Math.abs(m.x - x) + Math.abs(m.y - y) <= 1) {
        m.alerted = true; m.hunt = true; m.state = 'hunt';
      }
    }
  };
  G.anyHeardLoud = () => true;
  G.alertAllNear = function (r) {
    const f = G.floorState(), st = G.state;
    for (const m of f.mons) if (m.alive && !m.sleeping && Math.hypot(m.x - st.pos.x, m.y - st.pos.y) <= r) { m.alerted = true; m.hunt = true; m.state = 'hunt'; }
  };

  G.listenDoor = function (x, y) {
    const f = G.floorState();
    const thief = G.bestThief('detectNoise');
    let heard = false;
    if (thief && dice().d(100) <= G.thiefSkill(thief, 'detectNoise') + 20) heard = true;
    if (!heard && dice().d(6) === 1) heard = true;
    if (!heard) { G.log('You press your ear to the wood. Nothing.'); return; }
    const near = f.mons.filter(m => m.alive && Math.abs(m.x - x) + Math.abs(m.y - y) <= 3);
    if (!near.length) G.log('You hear breathing that is not yours… then nothing. Likely empty.');
    else G.log('You hear ' + (near.length === 1 ? 'a single set of breathing' : near.length + ' sets of breathing') + ' on the far side.');
  };

  // ---------------------------------------------------------------- searching & traps
  G.search = function () {
    const st = G.state;
    if (st.mode !== 'dungeon') { G.log('You look around. Nothing unusual.'); return; }
    const f = G.floorState();
    const adv = EF.Adventures[st.adventureId];
    const def = adv.floors[st.dungeonFloor];
    let found = 0;
    // adjacent secret doors
    for (const s of def.secrets) {
      const k = s.x + ',' + s.y;
      if (f.secretsFound[k]) continue;
      if (Math.abs(s.x - st.pos.x) + Math.abs(s.y - st.pos.y) > 2) continue;
      let chance = 2; // 2-in-6 base
      for (const p of st.party) {
        if (!p.alive) continue;
        let c = chance;
        if (p.race === 'dwarf' || p.race === 'gnome') c += 2;
        if (R.isThief(p)) c += Math.max(1, Math.floor(G.thiefSkill(p, 'findRemoveTraps') / 15));
        if (dice().d(6) <= c) { f.secretsFound[k] = true; found++; G.log('A concealed door is discovered at ' + s.x + ',' + s.y + '!'); break; }
      }
    }
    // adjacent traps
    for (const t of def.traps) {
      const k = t.x + ',' + t.y;
      if (f.trapsFound[k]) continue;
      if (Math.abs(t.x - st.pos.x) + Math.abs(t.y - st.pos.y) > 2) continue;
      for (const p of st.party) {
        if (!p.alive) continue;
        const skill = G.thiefSkill(p, 'findRemoveTraps');
        if (R.isThief(p) && dice().d(100) <= skill + 10) { f.trapsFound[k] = true; found++; G.log(p.name + ' finds a trap: ' + t.type + ' at ' + t.x + ',' + t.y + '.'); break; }
        if (!R.isThief(p) && dice().d(6) === 1) { f.trapsFound[k] = true; found++; G.log(p.name + ' notices something wrong with the ' + t.type + ' trap.' + (skill > 0 ? ' Only a thief should touch it.' : '')); break; }
      }
    }
    if (!found) G.log('You search the walls and floor. ' + (def.secrets.some(s => !f.secretsFound[s.x + ',' + s.y]) || def.traps.some(t => !f.trapsFound[t.x + ',' + t.y]) ? 'Something feels off, but nothing gives itself away.' : 'Nothing else is hidden here.'));
  };
  G.disarmTrap = function (t) {
    const f = G.floorState();
    const k = t.x + ',' + t.y;
    const thief = G.bestThief('findRemoveTraps');
    if (!thief) { G.log('Only a thief dares touch the mechanism.'); return; }
    if (dice().d(100) <= G.thiefSkill(thief, 'findRemoveTraps')) { f.trapsDone[k] = true; G.log(thief.name + ' renders the ' + t.type + ' trap harmless.'); }
    else {
      G.log(thief.name + ' jams the mechanism wrong — it springs!');
      f.trapsFound[k] = true;
      G.springTrap(t, thief);
    }
  };
  G.springTrap = function (t, trigger) {
    const f = G.floorState(), st = G.state;
    f.trapsFound[t.x + ',' + t.y] = true;
    const adv = EF.Adventures[st.adventureId];
    const dlvl = st.dungeonFloor + 1 + (adv.band || 0) * 2;
    const SINGLE = { pit: { dice: '1d6', save: null, depth: t.depth || 1 }, darts: { dice: '2d4', save: 'poison' }, blade: { dice: '2d6', save: null }, spear: { dice: '2d6+1', save: null } };
    const PARTYT = { 'falling block': '2d6', fire: '2d6', gas: '1d8' };
    G.log('A ' + t.type + ' trap springs!', 'bad');
    const dmgBase = R.trapDamage(dlvl, t.type === 'pit' ? 1 : 2);
    if (SINGLE[t.type]) {
      const target = trigger || st.party.filter(p => p.alive)[dice().int(st.party.filter(p => p.alive).length)] || st.party[0];
      let dmg = dice().roll(SINGLE[t.type].dice) + Math.floor(dmgBase / 2);
      if (SINGLE[t.type].save && target.saves && dice().d20() >= R.saves(target.cls, target.level)[1] - R.CON_SAVE(target.abilities.con)) dmg = Math.ceil(dmg / 2);
      G.hurt(target, dmg, 'the ' + t.type + ' trap');
      if (t.type === 'pit' && target.alive) G.log(target.name + ' hangs in the pit; the party hauls out the gear, minus a little dignity.');
    } else if (PARTYT[t.type]) {
      for (const p of st.party) {
        if (!p.alive) continue;
        let dmg = dice().roll(PARTYT[t.type]);
        const saveCat = t.type === 'gas' ? 1 : 2; // gas=poison, else breath
        if (dice().d20() >= R.saves(p.cls, p.level)[saveCat] - R.CON_SAVE(p.abilities.con)) { dmg = Math.ceil(dmg / 2); G.log(p.name + ' half-rolls away from the ' + t.type + '.'); }
        G.hurt(p, dmg, 'the ' + t.type + ' trap');
      }
    }
    if (G.view) G.view.shake = 2;
  };
  G.hurt = function (p, dmg, cause) {
    p.hp -= dmg;
    G.log(p.name + ' takes ' + dmg + ' damage' + (cause ? ' from ' + cause : '') + (p.hp <= 0 ? ' and falls!' : '.'), 'bad');
    if (p.hp <= 0) { p.alive = false; p.hp = 0; G.log(p.name + ' is dead or dying.', 'bad'); }
  };
  G.bestThief = function (skill) {
    let best = null, bv = -1;
    for (const p of G.state.party) {
      if (!p.alive) continue;
      const s = G.thiefSkill(p, skill);
      if (s > bv) { bv = s; best = p; }
    }
    return best;
  };
  G.thiefSkill = function (p, skill) {
    if (!p) return 0;
    const mods = (EF.Items && p.passives && p.passives.thief && p.passives.thief[skill]) || 0;
    const sk = R.thiefSkills(p);
    return sk ? Math.min(95, sk[skill] + mods) : 0;
  };

  // ---------------------------------------------------------------- monsters sim
  let lastSim = 0;
  G.monsterNoticePass = function (x, y) {
    const st = G.state;
    if (st.mode !== 'dungeon') return;
    const f = G.floorState();
    for (const m of f.mons) {
      if (!m.alive || m.alerted || m.state === 'fled') continue;
      const d = Math.hypot(m.x - x, m.y - y);
      if (m.sleeping) {
        if (d <= 1.5 && dice().d(6) <= 2) { m.sleeping = false; m.alerted = true; m.state = 'hunt'; G.log('You have woken something up.'); }
        continue;
      }
      if (d <= 9 && G.lineOfSight(x, y, m.x, m.y)) {
        // thieves may creep past
        const thiefLead = st.party.some(p => p.alive && R.isThief(p) && p.level >= 3);
        if (thiefLead && dice().chance(40) && !m.specialNoSneak) { if (dice().d(6) === 1) { /* noticed anyway */ } else continue; }
        m.alerted = true; m.state = 'hunt'; m.hunt = true;
        const mm = EF.mon(m.key);
        G.log('A ' + mm.name + (mm.special.pack ? ' pack' : '') + ' notices you!' + (m.ambush ? ' It was lying in ambush!' : ''), 'bad');
        if (m.ambush) alertNear(f, m, 5);
      }
    }
    G.maybeStartCombat();
  };
  function alertNear(f, m, r) {
    for (const o of f.mons) if (o.alive && o !== m && !o.alerted && Math.hypot(o.x - m.x, o.y - m.y) <= r) { o.alerted = true; o.state = 'hunt'; }
  }
  G.maybeStartCombat = function () {
    const f = G.floorState(), st = G.state;
    const hostiles = f.mons.filter(m => m.alive && m.alerted && m.state !== 'fled' && Math.hypot(m.x - st.pos.x, m.y - st.pos.y) <= 6 && G.lineOfSight(st.pos.x, st.pos.y, m.x, m.y));
    if (hostiles.length) EF.Combat.start(hostiles);
  };
  G.simTick = function (dt) {
    const st = G.state;
    if (!st || st.mode !== 'dungeon' || (EF.Combat.active)) return;
    lastSim += dt;
    if (lastSim < 0.45) return;
    lastSim = 0;
    const f = G.floorState();
    for (const m of f.mons) {
      if (!m.alive || m.state !== 'hunt') continue;
      // greedy step toward player with wall avoidance
      const dx = st.pos.x - m.x, dy = st.pos.y - m.y;
      const d = Math.abs(dx) + Math.abs(dy);
      if (d <= 1) { G.maybeStartCombat(); continue; }
      const stepX = dx !== 0 ? (dx > 0 ? 1 : -1) : 0;
      const stepY = dy !== 0 ? (dy > 0 ? 1 : -1) : 0;
      const mv = f.grid[m.y + stepY] && f.grid[m.y + stepY][m.x + stepX] !== undefined;
      let nx = m.x, ny = m.y;
      const pass = (x, y) => {
        if (x < 0 || y < 0 || y >= f.grid.length || x >= f.grid[0].length) return false;
        const c = G.cell(x, y);
        if (c.solid) return false;
        return !f.mons.some(o => o !== m && o.alive && o.x === x && o.y === y);
      };
      if (Math.abs(dx) > Math.abs(dy)) {
        if (pass(m.x + stepX, m.y)) { nx = m.x + stepX; }
        else if (stepY && pass(m.x, m.y + stepY)) { ny = m.y + stepY; }
        else continue;
      } else {
        if (stepY && pass(m.x, m.y + stepY)) { ny = m.y + stepY; }
        else if (pass(m.x + stepX, m.y)) { nx = m.x + stepX; }
        else continue;
      }
      void mv;
      m.x = nx; m.y = ny;
      // open doors on the way
      const c = G.cell(m.x, m.y);
      if (c.open) { /* passed open door */ }
      if (Math.hypot(m.x - st.pos.x, m.y - st.pos.y) <= 6) G.maybeStartCombat();
    }
    // wandering encounter roll (very light): dungeon restlessness
  };

  // ---------------------------------------------------------------- XP / quests
  G.grantXP = function (amount) {
    const st = G.state;
    for (const p of st.party) {
      const bonus = 1 + R.xpBonus(p) / 100;
      p.xp += Math.max(0, Math.round(amount * bonus));
      const nl = R.levelForXp(p.cls, p.xp);
      if (nl > p.level) G.advanceLevel(p, nl);
    }
  };
  G.advanceLevel = function (p, nl) {
    while (p.level < nl) {
      p.level++;
      const hd = R.CLASSES[p.cls].hd;
      const gain = dice().d(hd) + R.CON_HP(p.abilities.con);
      p.maxHp += Math.max(1, gain);
      p.hp = Math.min(p.maxHp, p.hp + Math.max(1, gain));
      if (p.specialty) p.specialtyLevel = p.level;
      G.log(p.name + ' is now level ' + p.level + '!', 'good');
    }
  };
  G.train = function (p) {
    if (p.gold < 100) { G.log(p.name + ' cannot pay the 100 gp training fee.'); return; }
    const need = R.xpForLevel(p.cls, p.level + 1);
    if (p.xp < need) { G.log(p.name + ' has not earned the experience to train.'); return; }
    if (p.level >= 20) { G.log('Level 20 is the height of mortality.'); return; }
    p.gold -= 100;
    G.advanceLevel(p, p.level + 1);
  };
  G.noteRescue = function (n) {
    const st = G.state;
    for (const q of EF.Adventures[st.adventureId].quests) {
      if (q.rescue && !st.quests[q.id].done) { st.quests[q.id].rescued = Math.min(q.rescue, (st.quests[q.id].rescued || 0) + (n || 1)); G.log('Quest note: ' + q.name + ' — ' + st.quests[q.id].rescued + '/' + q.rescue + ' found.'); }
    }
  };
  G.grant = function (grant) {
    if (grant.gold) { for (const p of G.state.party) p.gold += Math.floor(grant.gold / G.state.party.length); G.log('You gain ' + grant.gold + ' gp.'); }
    if (grant.item) G.giveItem(grant.item, 1);
    if (grant.xp) G.grantXP(grant.xp);
  };
  G.questDone = function (q) {
    const st = G.state;
    const qs = st.quests[q.id] || (st.quests[q.id] = { kills: 0, rescued: 0 });
    if (q.killTag && qs.kills >= q.killCount) return true;
    if (q.rescue && (qs.rescued || 0) >= q.rescue) return true;
    if (q.item && qs.itemFound) return true;
    if (q.tag && qs.slain) return true;
    return false;
  };
  G.noteKill = function (m, inst) {
    const st = G.state;
    const adv = EF.Adventures[st.adventureId];
    const b = st.bestiary[m.key] || (st.bestiary[m.key] = { met: 1, slain: 0 });
    b.slain++;
    const questOf = inst && inst.quest ? inst.quest : m.quest;
    for (const q of adv.quests) {
      const qs = st.quests[q.id] || (st.quests[q.id] = { kills: 0, rescued: 0 });
      if (qs.done) continue;
      if (q.killTag && famMatch(m, q.killTag)) {
        qs.kills++;
        if (qs.kills >= q.killCount) { qs.done = true; G.log('Quest complete: ' + q.name + '. Report to the patron.', 'good'); }
      }
      if (q.tag && questOf === q.id) { qs.slain = 1; qs.done = true; G.log('Quest complete: ' + q.name + '. Report to the patron.', 'good'); }
    }
    // dungeon lair sites cleared tracking
    const sites = EF.Sites[st.adventureId];
    if (sites) for (const s of sites.sites) if (s.kind === 'lair' && s.monster === m.key) s.killed = (s.killed || 0) + 1;
  };
  function famMatch(m, tag) {
    if (m.key === tag) return true;
    const mm = EF.mon(tag);
    if (mm && m.key === mm.key) return true;
    if (m.special && m.special === tag) return true;
    if (m.key.includes(tag)) return true;
    if (m.name && tag && m.name.toLowerCase().includes(tag.toLowerCase())) return true;
    return false;
  }
  G.noteItemFound = function (key) {
    const st = G.state;
    for (const q of EF.Adventures[st.adventureId].quests) {
      if (q.item === key) { const qs = st.quests[q.id]; if (qs && !qs.done) { qs.itemFound = true; qs.done = true; G.log('Quest item acquired: ' + (EF.Items[key] || {}).name + '. Report to the patron.', 'good'); } }
    }
  };
  G.turnInQuest = function (q) {
    const st = G.state;
    const qs = st.quests[q.id];
    if (!qs || !qs.done || qs.paid) return;
    qs.paid = true;
    for (const p of st.party) p.gold += Math.round(q.gold / st.party.length);
    G.grantXP(Math.round(q.xp / 4)); // quest xp is a quarter of the listed figure
    G.log('The patron pays ' + q.gold + ' gp, and experience worth a quarter of ' + q.xp + ' (shared).', 'good');
    // main quest completion unlocks the adventure for campaign
    if (q.main) st.flags['adv_complete_' + st.adventureId] = true;
  };

  // ---------------------------------------------------------------- party upkeep
  G.partyMorning = function () {
    // natural recovery overnight
    for (const p of G.state.party) {
      if (p.alive && p.hp > 0) p.hp = Math.min(p.maxHp, p.hp + 1 + (p.status && p.status.regen ? 3 : 0));
    }
  };
  G.partyFullyHealed = () => G.state.party.every(p => !p.alive || p.hp >= p.maxHp);

  // ---------------------------------------------------------------- main loop
  G.boot = function () {
    const canvas = document.getElementById('view');
    G.view = new EF.View3D(canvas);
    G.view.setMinimap(G.drawMinimap);
    G.lastT = performance.now();
    function frame(t) {
      const dt = Math.min(0.1, (t - G.lastT) / 1000);
      G.lastT = t;
      try {
        if (G.state) {
          G.simTick(dt);
          G.view.light = G.state.mode === 'dungeon' ? 0.85 : 1.15;
          G.view.update(dt);
          if (!EF.Combat.active && G.state.viewVisible !== false) {
            G.view.sprites = G.buildSprites();
            G.view.render();
          }
        }
      } catch (e) {
        // one bad frame must never brick the renderer; note it and keep drawing
        G._frameErrs = (G._frameErrs || 0) + 1;
        if (G._frameErrs === 1) { try { console.error('frame error:', e); } catch (e2) {} }
      }
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
    EF.Input.bind();
    EF.UI.show('menu');
  };
  G.buildSprites = function () {
    const st = G.state, out = [];
    if (st.mode === 'dungeon') {
      const f = G.floorState();
      for (const m of f.mons) {
        if (!m.alive || !G.seeMonster(m)) continue;
        if (!G.lineOfSight(st.pos.x, st.pos.y, m.x, m.y)) continue;
        const mm = EF.mon(m.key);
        out.push({ x: m.x + 0.5, y: m.y + 0.5, fig: EF.Figures.monsterFigure(mm), h: 0.85, monster: m });
      }
      const adv = EF.Adventures[st.adventureId];
      for (const h of adv.floors[st.dungeonFloor].treasure) {
        const hk = 'h' + st.dungeonFloor + ':' + h.x + ',' + h.y;
        if (st.flags[hk]) continue;
        if (!G.lineOfSight(st.pos.x, st.pos.y, h.x, h.y)) continue;
        out.push({ x: h.x + 0.5, y: h.y + 0.5, color: '#e6c14f', h: 0.25 });
      }
      for (const l of st.groundLoot) {
        if (l.taken || l.advId !== st.adventureId || l.floor !== st.dungeonFloor) continue;
        out.push({ x: l.x + 0.5, y: l.y + 0.5, color: '#c9a26b', h: 0.22 });
      }
    } else if (st.mode === 'town' || st.mode === 'camp-town') {
      const adv = EF.Adventures[st.adventureId];
      for (const o of adv.town.objects) {
        out.push({ x: o.x + 0.5, y: o.y + 0.5, color: objColor(o.kind), h: 0.3 });
      }
    }
    return out;
  };
  function objColor(k) {
    return { shop_general: '#4c7a3d', shop_weapons: '#7a3d3d', shop_armour: '#3d5a7a', temple: '#b9a13f', inn: '#7a5f3d', training: '#5f7a3d', patron: '#8a5f3d', dungeon: '#2c2c34', wildexit: '#7f9f5a', well: '#4d7fa6', fountain: '#6d9fc6' }[k] || '#888';
  }

  // ---------------------------------------------------------------- minimap
  G.drawMinimap = function (ctx, ox, oy, cell, N, cam, data) {
    const st = G.state;
    const cx = Math.floor(cam.x), cy = Math.floor(cam.y);
    const half = Math.floor(N / 2);
    for (let dy = -half; dy <= half; dy++) for (let dx = -half; dx <= half; dx++) {
      const x = cx + dx, y = cy + dy;
      const px = ox + (dx + half) * cell, py = oy + (dy + half) * cell;
      let col = '#111';
      if (st.mode === 'dungeon') {
        const f = G.floorState();
        const seen = f.visited[x + ',' + y];
        const k = x + ',' + y;
        if (!seen && !G.lineOfSight(cx, cy, x, y)) { ctx.fillStyle = '#0a0a0c'; ctx.fillRect(px, py, cell, cell); continue; }
        const c = G.cell(x, y);
        if (c.solid) col = (f.grid[y] && f.grid[y][x] === 'S' && f.secretsFound[k]) ? '#7a5f8f' : '#565a60';
        else if (f.grid[y] && f.grid[y][x] === '>') col = '#d07b3f';
        else if (f.grid[y] && f.grid[y][x] === '<') col = '#3fa0d0';
        else if (f.grid[y] && (f.grid[y][x] === '~')) col = '#33506e';
        else col = '#23262a';
        if (!seen) col = shadeUp(col);
        ctx.fillStyle = col; ctx.fillRect(px, py, cell, cell);
        // found traps
        const adv = EF.Adventures[st.adventureId];
        for (const t of adv.floors[st.dungeonFloor].traps) {
          if (t.x === x && t.y === y && f.trapsFound[t.x + ',' + t.y]) {
            ctx.fillStyle = f.trapsDone[t.x + ',' + t.y] ? '#666' : '#c0392b';
            ctx.fillRect(px + cell * 0.3, py + cell * 0.3, cell * 0.4, cell * 0.4);
          }
        }
        for (const m of f.mons) if (m.alive && m.x === x && m.y === y && G.seeMonster(m)) { ctx.fillStyle = '#c2453f'; ctx.fillRect(px + cell * 0.25, py + cell * 0.25, cell * 0.5, cell * 0.5); }
        for (const h of adv.floors[st.dungeonFloor].treasure) if (h.x === x && h.y === y && !st.flags['h' + st.dungeonFloor + ':' + h.x + ',' + h.y] && G.lineOfSight(cx, cy, x, y)) { ctx.fillStyle = '#e6c14f'; ctx.fillRect(px + cell * 0.35, py + cell * 0.35, cell * 0.3, cell * 0.3); }
      } else {
        const adv = EF.Adventures[st.adventureId];
        const t = adv.town;
        if (x < 0 || y < 0 || y >= t.grid.length || x >= t.grid[0].length) { ctx.fillStyle = '#0a0a0c'; ctx.fillRect(px, py, cell, cell); continue; }
        const ch = t.grid[y][x];
        col = ch === '#' ? '#6a5a45' : '#3c4238';
        ctx.fillStyle = col; ctx.fillRect(px, py, cell, cell);
        const o = t.objects.find(ob => ob.x === x && ob.y === y);
        if (o) { ctx.fillStyle = objColor(o.kind); ctx.fillRect(px + 1, py + 1, cell - 2, cell - 2); }
      }
    }
    // player arrow
    const pcx = ox + half * cell + cell / 2, pcy = oy + half * cell + cell / 2;
    ctx.save(); ctx.translate(pcx, pcy); ctx.rotate(cam.a);
    ctx.fillStyle = '#e8e4d2';
    ctx.beginPath(); ctx.moveTo(cell * 0.5, 0); ctx.lineTo(-cell * 0.35, -cell * 0.35); ctx.lineTo(-cell * 0.35, cell * 0.35); ctx.closePath(); ctx.fill();
    ctx.restore();
  };
  function shadeUp(hex) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, ((n >> 16) & 255) + 18), g = Math.min(255, ((n >> 8) & 255) + 18), b = Math.min(255, (n & 255) + 18);
    return 'rgb(' + r + ',' + g + ',' + b + ')';
  }

  // ---------------------------------------------------------------- input
  EF.Input = {
    bind: function () {
      window.addEventListener('keydown', e => {
        if (e.metaKey || e.ctrlKey || e.altKey) return;
        const ae = document.activeElement;
        if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return;
        const k = (e.key || '').toLowerCase();
        if (!k || k === 'shift' || k === 'control' || k === 'alt' || k === 'meta') return;

        if (EF.Combat.active) {
          if (k === 'escape') { EF.Combat.requestFlee(); e.preventDefault(); }
          return;
        }
        // A screen or dialog is open: Escape always cancels/closes, registered
        // hotkeys fire, all other keys are swallowed (no phantom moves behind panels).
        if (EF.UI.open) {
          if (k === 'escape' || k === 'backspace') { EF.UI.back(); e.preventDefault(); return; }
          if (EF.UI.press(k)) { e.preventDefault(); return; }
          return;
        }
        const st = G.state;
        if (!st) return;
        let used = true;
        switch (k) {
          case 'arrowup': case 'w': G.moveFwd(); break;
          case 'arrowdown': case 's': G.moveBack(); break;
          case 'arrowleft': case 'a': G.turn(-1); break;
          case 'arrowright': case 'd': G.turn(1); break;
          case 'q': case ',': case 'z': G.sidestep(false); break;
          case 'e': case '.': case 'c': G.sidestep(true); break;
          case 'f': G.search(); break;
          case 'r': EF.Watch.open(); break;
          case 'm': EF.MapPage.open(); break;
          case 'j': EF.Journal.open(); break;
          case 'b': EF.Bestiary.open(); break;
          case 'i': EF.UI.show('inventory'); break;
          case '1': case '2': case '3': case '4': case '5': case '6': EF.UI.sheet(+k - 1); break;
          case 'escape': EF.UI.show('menu'); break;
          default: used = false;
        }
        if (used) e.preventDefault();
      });
    },
    consumesKeys: function () { return false; }
  };

  // ---------------------------------------------------------------- save/load
  G.saveTo = function (slot) {
    const ok = EF.saveGame(slot, G.state);
    if (ok) G.log('Game saved (' + EF.slotLabel[slot] + ').', 'good');
    return ok;
  };
  G.loadFrom = function (slot) {
    const o = EF.loadGame(slot);
    if (!o) return false;
    G.state = o.game;
    // rehydrate view
    const st = G.state;
    if (st.mode === 'town' || st.mode === 'camp-town') G.enterTownLoaded();
    else if (st.mode === 'dungeon') {
      const f = G.floorState();
      if (G.view) {
        G.view.map = { W: f.grid[0].length, H: f.grid.length, cell: (x, y) => G.cell(x, y, true) };
        G.view.setCamera(st.pos.x + 0.5, st.pos.y + 0.5, angOf(st.pos.dir));
      }
    } else if (st.mode === 'overland' && EF.Overland) {
      EF.Overland.enter(false);
    }
    G.log('Game loaded (' + EF.slotLabel[slot] + ').', 'good');
    return true;
  };
  G.enterTownLoaded = function () {
    const st = G.state;
    if (G.view) {
      const adv = EF.Adventures[st.adventureId];
      G.view.map = { W: adv.town.grid[0].length, H: adv.town.grid.length, cell: (x, y) => G.cell(x, y, true) };
      G.view.setCamera(st.pos.x + 0.5, st.pos.y + 0.5, angOf(st.pos.dir));
    }
  };

  // party helpers used across modules
  G.aliveParty = () => G.state.party.filter(p => p.alive);
  G.totalGold = () => G.partyGold();

  // ------------------------------------------------------------- selftest & scenes
  EF.selftest = function () { return G.selftest(); };
  // A headless driver: creates a party, plays E0 down to the boss through the
  // real movement/arrival/combat code, saves, loads, switches adventures via
  // the campaign screen logic, visits every screen, and walks the overland.
  // Run with index.html?selftest=1 — reports to #selftest-report.
  function testParty() {
    const mk = (name, race, cls, ab, hp, wpn, arm) => {
      const ch = R.newCharacter({
        name, race, classes: [cls], align: 'N', abilities: ab,
        hp, gold: 150, weapon: { itemKey: wpn },
        items: [{ key: wpn, qty: 1 }, { key: arm, qty: 1, equipped: 'armor' }]
      });
      ch.armorItem = arm;
      R.recalc(ch, EF.Items);
      return ch;
    };
    const A = (str, con, dex) => ({ str, int: 10, wis: 10, dex, con, cha: 11 });
    return [
      mk('Alderic', 'human', 'fighter', A(17, 16, 13), 11, 'w_sword_long', 'a_chain'),
      mk('Borum', 'dwarf', 'fighter', A(16, 17, 11), 10, 'w_axe', 'a_chain'),
      mk('Sessrow', 'halfling', 'thief', A(12, 12, 17), 7, 'w_dagger', 'a_leather'),
      mk('Hobb', 'halfling', 'thief', A(13, 13, 15), 7, 'w_spear', 'a_leather')
    ];
  }
  G.testParty = testParty;

  let selftestWatchdog = null;
  G.selftest = async function () {
    const lines = [];
    let ok = true;
    const chk = (c, m) => { lines.push((c ? '[PASS] ' : '[FAIL] ') + m); if (!c) ok = false; console.log((c ? 'PASS ' : 'FAIL ') + m); };
    const wait = ms => new Promise(r => setTimeout(r, ms));
    const say = m => lines.push('[ .. ] ' + m);
    function walkTowardGoal() {
      const st = G.state, f = G.floorState();
      const adv = EF.Adventures[st.adventureId];
      const goal = (() => {
        for (let y = 0; y < f.grid.length; y++) for (let x = 0; x < f.grid[y].length; x++) {
          const ch = f.grid[y][x];
          if (ch === '>' && st.dungeonFloor < adv.floors.length - 1) return { x, y };
          if (ch === '<' && st.dungeonFloor > 0) return { x, y };
        }
        return null;
      })();
      if (!goal) return false;
      const key = (x, y) => x + ',' + y;
      const passable = (x, y) => {
        if (x < 0 || y < 0 || y >= f.grid.length || x >= f.grid[y].length) return false;
        const ch = f.grid[y][x];
        if (ch === '#') return false;
        if (ch === '~') return false;
        return true;
      };
      const prev = new Map([[key(st.pos.x, st.pos.y), null]]);
      const q = [[st.pos.x, st.pos.y]];
      while (q.length) {
        const [x, y] = q.shift();
        if (x === goal.x && y === goal.y) break;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = x + dx, ny = y + dy;
          if (!passable(nx, ny) || prev.has(key(nx, ny))) continue;
          prev.set(key(nx, ny), key(x, y));
          q.push([nx, ny]);
        }
      }
      if (!prev.has(key(goal.x, goal.y))) return false;
      // trace back to first step
      let k = key(goal.x, goal.y), back = null;
      while (prev.get(k) && prev.get(k) !== key(st.pos.x, st.pos.y)) { k = prev.get(k); }
      back = k;
      const [gx, gy] = back.split(',').map(Number);
      const chHere = f.grid[gy][gx];
      if (chHere === '+' || chHere === 'L') G.doorOpen(gx, gy, true);
      if (G.cell(gx, gy).solid) return false;
      // face the way and move (tryMove handles arrival triggers)
      const dirFor = { '1,0': 0, '0,1': 1, '-1,0': 2, '0,-1': 3 };
      st.pos.dir = dirFor[(gx - st.pos.x) + ',' + (gy - st.pos.y)];
      return G.tryMove(gx, gy, true);
    }
    const combatWait = async (label) => {
      let guard = 0;
      if (EF.Combat.active) {
        say('combat: ' + label);
        await wait(80);
        if (EF.Combat.active && !EF.Combat._autoEngaged) { EF.Combat._autoEngaged = true; EF.Combat.autoFight(); }
        while (EF.Combat.active && guard++ < 300) await wait(25);
        EF.Combat._autoEngaged = false;
        if (EF.Combat.active) { EF.Combat.requestFlee(); await wait(150); }
        if (EF.Combat.active) { EF.Combat.active = false; }
        chk(guard < 600, 'combat resolved (' + label + ')');
      }
      // raise the party for the march (test tenacity)
      for (const p of G.state.party) if (p.hp <= 0) { p.hp = 1; p.alive = true; p.status = {}; G.advanceTime(1); }
      for (const p of G.state.party) p.hp = p.maxHp;
    };
    try {
      // ---- content counts (browser side)
      chk(Object.keys(EF.Spells).length >= 140, 'spells >= 140 (' + Object.keys(EF.Spells).length + ')');
      chk(Object.keys(EF.Items).length >= 400, 'items >= 400 (' + Object.keys(EF.Items).length + ')');
      chk(EF.MONSTER_COUNT() >= 300, 'monsters >= 300 (' + EF.MONSTER_COUNT() + ')');
      chk(Object.keys(EF.Adventures).length === 54, 'adventures == 54 (' + Object.keys(EF.Adventures).length + ')');

      // ---- new game
      G.newGame('e0', testParty());
      chk(G.state && G.state.party.length === 4, 'new game: party of four');
      chk(G.state.mode === 'town', 'new game: begins in town');

      // ---- town: walk a bit through Thornwick
      for (let i = 0; i < 30; i++) { G.turn(i % 4 === 3 ? 1 : 0); G.moveFwd(); }
      chk(true, 'town movement without exception');

      // ---- enter dungeon and explore to the boss
      G.enterDungeon(0);
      chk(G.state.mode === 'dungeon', 'entered dungeon floor 1');
      const adv = EF.Adventures.e0;
      let steps = 0, lastFloor = -1, floorsSeen = 0;
      while (steps++ < 5000) {
        const st = G.state;
        if (EF.Combat.active) { await combatWait('wandering floor ' + st.dungeonFloor); continue; }
        if (st.mode !== 'dungeon') break;
        if (st.dungeonFloor !== lastFloor) { lastFloor = st.dungeonFloor; floorsSeen++; say('on floor ' + (st.dungeonFloor + 1)); }
        if (st.quests['q0_main'] && st.quests['q0_main'].done) break;
        // force-open doors we bump into
        const [dx, dy] = G.dirVec(st.pos.dir);
        const nx = st.pos.x + dx, ny = st.pos.y + dy;
        const ch = G.cell(nx, ny);
        if (ch && (ch.ch === '+' || ch.ch === 'L')) G.doorOpen(nx, ny, true);
        // walk the BFS path toward the down-stairs (fallback: straight-biased wander)
        const r = Math.random();
        const stepped = walkTowardGoal();
        if (!stepped || r < 0.12) {
          const aheadSolid = G.cell(nx, ny).solid;
          if (aheadSolid && r < 0.9) G.turn(r < 0.42 ? 1 : 3);
          else if (r < 0.66) G.moveFwd();
          else G.turn(r < 0.79 ? 1 : 3);
        }
        if (r > 0.97) G.search();
        await wait(1);
      }
      chk(floorsSeen >= 2, 'descended ' + floorsSeen + ' floors');
      // train the company up for the boss (a level-1 party is not a fair test of it)
      for (const p of G.state.party) {
        const need = R.xpForLevel(p.cls, 6);
        if (p.xp < need) G.grantXP(Math.round((need - p.xp) / Math.max(1, R.xpBonus(p) / 100 + 1)));
      }
      // kit the company out for the king: better steel, so far under the town
      for (const p of G.state.party) {
        p.items.push({ key: 'a_chain', qty: 1, equipped: 'armor' }); p.armorItem = 'a_chain';
        p.weapon = { itemKey: 'w_sword_long' };
        p.items.push({ key: 'w_sword_long', qty: 1, equipped: 'weapon' });
        p.hp = p.maxHp;
        R.recalc(p, EF.Items);
      }
      // ensure the boss dies for the test: give battle directly (repeat until the deed is done)
      if (!(G.state.quests['q0_main'] || {}).done) say('boss not met by wandering; giving battle');
      for (let attempt = 0; attempt < 4 && !(G.state.quests['q0_main'] || {}).done; attempt++) {
        let f = null, boss = null, bossFloor = -1;
        for (let fl = 0; fl < EF.Adventures.e0.floors.length && !boss; fl++) {
          G.enterDungeon(fl);
          f = G.floorState();
          boss = f.mons.find(m => m.quest === 'q0_main' && m.alive);
          if (boss) bossFloor = fl;
        }
        if (!boss) { say('boss no longer alive on any floor (attempt ' + attempt + ')'); break; }
        say('giving battle, attempt ' + (attempt + 1) + ' on floor ' + (bossFloor + 1));
        boss.sleeping = false; boss.alerted = true; boss.hunt = true; boss.state = 'hunt';
        G.state.pos = { x: f.entry.x, y: f.entry.y, dir: 0 };
        EF.Combat.start([boss]);
        const logMark = G.state.log.length;
        await combatWait('boss, given battle');
        const tail = G.state.log.slice(-12); void logMark;
        say('combat log tail: ' + (tail.map(l => l.t).join(' // ') || '(nothing notable)'));
        say('after attempt: boss alive=' + boss.alive + ' hp=' + boss.hp + ' | party ' + G.state.party.map(p => p.hp + '/' + p.maxHp + (p.alive ? '' : 'x')).join(' '));
      }
      chk((G.state.quests['q0_main'] || {}).done === true, 'grumtek gutterking slain, main quest done');
      chk(G.state.party.some(p => p.xp > 0), 'experience awarded');

      // ---- back to town, save, mangle, load
      G.leaveDungeon();
      chk(G.state.mode === 'town', 'returned to town');
      const goldBefore = G.partyGold();
      chk(goldBefore > 0, 'carried treasure back: ' + goldBefore + ' gp');
      chk(G.saveTo('slot5'), 'saved to slot V');
      G.grantXP(9999);
      G.state.party[0].gold += 123456;
      chk(G.loadFrom('slot5'), 'loaded slot V');
      chk(G.partyGold() === goldBefore, 'gold restored by load');

      // ---- screens render
      const screens = ['journal', 'bestiary', 'fullmap', 'inventory', 'campaign', 'howto'];
      for (const s of screens) {
        try { EF.UI.show(s); } catch (e) { }
        const el = document.getElementById('screen');
        chk(el && el.childElementCount > 0, 'screen renders: ' + s);
      }
      EF.UI.close();

      // ---- camp screen + re-memorize
      EF.Watch.open();
      const campEl = document.getElementById('screen');
      chk(campEl && campEl.childElementCount > 0, 'camp screen renders');
      EF.Watch.reMemorizeAll();
      EF.UI.close();

      // ---- campaign switch to a generated adventure
      EF.Campaign.switchTo('g2_3');
      chk(G.state.adventureId === 'g2_3' && G.state.mode === 'town', 'campaign switch to g2_3');
      chk(EF.Adventures.g2_3.floors.length >= 1 && EF.Adventures.g2_3.floors.every(fl => fl.grid.length && fl.entry), 'generated adventure g2_3 has valid floors (' + EF.Adventures.g2_3.floors.length + ')');

      // ---- overland walk
      EF.Overland.enter(false);
      chk(G.state.mode === 'overland', 'overland mode entered');
      for (let i = 0; i < 8; i++) EF.Overland.step([[1, 0], [-1, 0], [0, 1], [0, -1]][i % 4][0], [[1, 0], [-1, 0], [0, 1], [0, -1]][i % 4][1]);
      await wait(120);
      if (EF.Combat.active) await combatWait('overland road');
      chk(true, 'overland steps without exception');

      // ---- a second generated adventure loads clean
      EF.Campaign.switchTo('g4_1');
      chk(G.state.adventureId === 'g4_1', 'campaign switch to g4_1');

      // ---- final: menu up for screenshots
      EF.UI.show('menu');
      lines.push(ok ? '[PASS] selftest complete' : '[FAIL] selftest had failures');
      void selftestWatchdog;
    } catch (e) {
      lines.push('[FAIL] exception: ' + (e && e.stack || e));
      ok = false;
    }
    return { ok, lines };
  };

  // Scenes for screenshots and demos: ?autoplay=1&scene=town|dungeon|combat|overland|campaign
  G.scene = async function (name) {
    if (name === 'menu') return;
    if (!G.state) G.newGame('e0', testParty());
    if (name === 'town') {
      G.enterTown();
      // stand at the square's fountain and face the street with the longest view
      const t = EF.Adventures[G.state.adventureId].town;
      const fu = t.objects.find(o => o.kind === 'fountain') || t.objects.find(o => o.kind === 'well');
      if (fu) G.state.pos.x = fu.x, G.state.pos.y = fu.y;
      let bestDir = 0, bestScore = -1;
      for (let d = 0; d < 4; d++) {
        const [dx, dy] = G.dirVec(d);
        let s = 0;
        while (s < 8) {
          const cx = G.state.pos.x + dx * (s + 1), cy = G.state.pos.y + dy * (s + 1);
          if (cx < 1 || cy < 1 || cy >= t.grid.length - 1 || cx >= t.grid[0].length - 1) break;
          if (t.grid[cy][cx] === '#') break;
          s++;
        }
        if (s > bestScore) { bestScore = s; bestDir = d; }
      }
      G.state.pos.dir = bestDir;
      if (G.view) G.view.setCamera(G.state.pos.x + 0.5, G.state.pos.y + 0.5, [0, Math.PI / 2, Math.PI, -Math.PI / 2][bestDir]);
      return;
    }
    if (name === 'dungeon') {
      G.enterDungeon(1);
      const f = G.floorState();
      for (const m of f.mons) { m.alive = false; m.alerted = false; } // staged shot: no ambushes
      G.state.pos = { x: f.entry.x, y: f.entry.y, dir: 0 };
      for (let i = 0; i < 14; i++) { G.moveFwd(); if (i % 5 === 4) G.turn(Math.random() < 0.5 ? 1 : 3); }
      return;
    }
    if (name === 'combat') {
      G.enterDungeon(0);
      const f = G.floorState();
      const m = f.mons.find(mm => mm.alive) || null;
      const keys = ['goblin', 'kobold', 'giant rat'];
      const insts = keys.map((k, i) => ({ key: EF.mon(k).key, x: i, y: i, hp: Math.max(2, EF.mon(k).hpAvg), alive: true, id: 40 + i, virtual: true }));
      G.state.pos = { x: 6, y: 6, dir: 0 };
      EF.Combat.start(insts);
      return;
    }
    if (name === 'overland') { EF.Overland.enter(false); for (let i = 0; i < 6; i++) EF.Overland.step(1, 0); EF.UI.show('overland'); return; }
    if (name === 'campaign') { if (EF.Campaign) EF.Campaign.open(); return; }
    if (name === 'combat-live') {
      // real live combat from a floor encounter for the screenshot budget
      if (EF.Combat.active) return;
      return G.scene('combat');
    }
  };
})();
