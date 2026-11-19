/* Emberfall — map.js
 * The full-page map: dungeon floors (only what you have seen), found secret
 * doors and traps, stairs, towns, and the wilderness map. */
(function () {
  const EF = (globalThis.EF = globalThis.EF || {});
  const M = {};
  EF.MapPage = M;

  M.open = function () { EF.UI.show('fullmap'); };

  EF.UI.register('fullmap', wrap => {
    const st = EF.Game.state;
    const box = EF.UI.panel('wide map-panel');
    if (st.mode === 'overland') {
      box.appendChild(EF.UI.h('The wilds of ' + (EF.Adventures[st.adventureId].townName || '')));
      const cv = document.createElement('canvas');
      cv.className = 'wild-canvas big';
      wrap.appendChild(box); box.appendChild(cv); box.appendChild(closeBtn());
      // draw via overland sizing but into this canvas
      const w = EF.Wilds.gen(st.adventureId);
      const cell = Math.max(8, Math.floor(cv.clientWidth / w.W) || 12);
      cv.width = cell * w.W; cv.height = cell * w.H;
      const g = cv.getContext('2d');
      for (let y = 0; y < w.H; y++) for (let x = 0; x < w.W; x++) {
        if (!st.overlandVisited[x + ',' + y]) continue;
        g.fillStyle = EF.Wilds.TCOLOR[w.grid[y][x]];
        g.fillRect(x * cell, y * cell, cell, cell);
      }
      for (const s of w.sites) {
        if (!st.overlandVisited[s.x + ',' + s.y]) continue;
        g.fillStyle = { town: '#d9b23f', dungeon: '#8e3b3b', hamlet: '#b08a5a', healer: '#4aa86b', holy: '#e8e4d2', lair: '#7a2c2c', camp: '#5b8fb5' }[s.kind] || '#999';
        g.beginPath(); g.arc(s.x * cell + cell / 2, s.y * cell + cell / 2, cell * 0.45, 0, 7); g.fill();
      }
      const p = st.overlandPos;
      g.fillStyle = '#f2e6b8'; g.beginPath(); g.arc(p.x * cell + cell / 2, p.y * cell + cell / 2, cell * 0.55, 0, 7); g.fill();
      return;
    }
    if (st.mode === 'dungeon') {
      const adv = EF.Adventures[st.adventureId];
      const f = EF.Game.floorState();
      box.appendChild(EF.UI.h(adv.floors[st.dungeonFloor].name));
      const grid = f.grid;
      const cell = Math.max(6, Math.min(22, Math.floor(680 / grid[0].length)));
      const cv = document.createElement('canvas');
      cv.width = grid[0].length * cell; cv.height = grid.length * cell;
      cv.className = 'map-canvas';
      const g = cv.getContext('2d');
      for (let y = 0; y < grid.length; y++) for (let x = 0; x < grid[y].length; x++) {
        const seen = f.visited[x + ',' + y];
        const px = x * cell, py = y * cell;
        if (!seen) { g.fillStyle = '#0a0a0c'; g.fillRect(px, py, cell, cell); continue; }
        const k = x + ',' + y;
        let ch = grid[y][x];
        if (ch === 'S' && !f.secretsFound[k]) ch = '#';
        const c = EF.Game.cell(x, y);
        if (c.solid && ch !== '~') g.fillStyle = '#565a60';
        else if (ch === '~') g.fillStyle = '#33506e';
        else if (ch === '>') g.fillStyle = '#d07b3f';
        else if (ch === '<') g.fillStyle = '#3fa0d0';
        else if (ch === '+' || ch === 'L') g.fillStyle = (f.doors[k] === 'open' || f.doors[k] === 'busted') ? '#6b5636' : '#8a6f42';
        else if (ch === 'S') g.fillStyle = '#7a5f8f';
        else g.fillStyle = '#23262a';
        g.fillRect(px, py, cell, cell);
      }
      const adv2 = EF.Adventures[st.adventureId];
      for (const t of adv2.floors[st.dungeonFloor].traps) {
        const k = t.x + ',' + t.y;
        if (!f.trapsFound[k]) continue;
        g.fillStyle = f.trapsDone[k] ? '#666' : '#c0392b';
        g.fillRect(t.x * cell + cell * 0.28, t.y * cell + cell * 0.28, cell * 0.44, cell * 0.44);
      }
      for (const m of f.mons) if (m.alive && EF.Game.seeMonster(m)) {
        g.fillStyle = '#c2453f'; g.beginPath(); g.arc(m.x * cell + cell / 2, m.y * cell + cell / 2, cell * 0.36, 0, 7); g.fill();
      }
      for (const h of adv2.floors[st.dungeonFloor].treasure) {
        if (st.flags['h' + st.dungeonFloor + ':' + h.x + ',' + h.y]) continue;
        if (!f.visited[h.x + ',' + h.y]) continue;
        g.fillStyle = '#e6c14f'; g.fillRect(h.x * cell + cell * 0.3, h.y * cell + cell * 0.3, cell * 0.4, cell * 0.4);
      }
      g.fillStyle = '#f2e6b8';
      g.beginPath(); g.arc(st.pos.x * cell + cell / 2, st.pos.y * cell + cell / 2, cell * 0.5, 0, 7); g.fill();
      box.appendChild(cv);
      box.appendChild(EF.UI.dim('Grey unseen walls are shown only where you have looked. Purple = found secret door. Red = trap.'));
    } else {
      const adv = EF.Adventures[st.adventureId];
      box.appendChild(EF.UI.h(adv.town.name));
      const grid = adv.town.grid;
      const cell = Math.max(10, Math.min(22, Math.floor(680 / grid[0].length)));
      const cv = document.createElement('canvas');
      cv.width = grid[0].length * cell; cv.height = grid.length * cell;
      cv.className = 'map-canvas';
      const g = cv.getContext('2d');
      g.fillStyle = '#3c4238'; g.fillRect(0, 0, cv.width, cv.height);
      for (let y = 0; y < grid.length; y++) for (let x = 0; x < grid[y].length; x++) {
        if (grid[y][x] === '#') { g.fillStyle = '#6a5a45'; g.fillRect(x * cell, y * cell, cell, cell); }
      }
      for (const o of adv.town.objects) {
        g.fillStyle = { shop_general: '#4c7a3d', shop_weapons: '#7a3d3d', shop_armour: '#3d5a7a', temple: '#b9a13f', inn: '#7a5f3d', training: '#5f7a3d', patron: '#8a5f3d', dungeon: '#2c2c34', wildexit: '#7f9f5a', well: '#4d7fa6', fountain: '#6d9fc6' }[o.kind] || '#888';
        g.beginPath(); g.arc(o.x * cell + cell / 2, o.y * cell + cell / 2, cell * 0.42, 0, 7); g.fill();
      }
      g.fillStyle = '#f2e6b8';
      g.beginPath(); g.arc(st.pos.x * cell + cell / 2, st.pos.y * cell + cell / 2, cell * 0.5, 0, 7); g.fill();
      box.appendChild(cv);
    }
    box.appendChild(closeBtn());
    wrap.appendChild(box);
  });
  function closeBtn() {
    const b = document.createElement('button'); b.className = 'bigbtn'; b.textContent = 'Fold the map';
    b.onclick = () => EF.UI.close();
    return b;
  }
})();
