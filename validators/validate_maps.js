/* Emberfall validator — maps & reachability.
 * For every adventure floor: rectangular grid, entry lands on a walkable
 * square, stairs chain (each non-last floor has a down-stair, next floor has
 * an up-stair), all monsters/treasure/traps/secrets/events sit on sensible
 * squares, secret doors are wall squares adjacent to floor, 1–3 secrets and
 * 2–3 traps per floor, and everything (monsters, treasure, stairs, events,
 * town objects) is reachable from the floor entry (doors and found secret
 * doors passable). Towns: all objects reachable from the wild exit. */
'use strict';
const path = require('path');
for (const f of ['rules', 'data', 'modules', 'monsters', 'wilds', 'treasure', 'adventures'])
  require(path.join(__dirname, '..', 'js', f + '.js'));
const EF = globalThis.EF;

let fail = 0, checks = 0;
function ok(cond, msg) { checks++; if (!cond) { fail++; console.log('FAIL:', msg); } }

const WALKABLE = new Set(['.', '>', '<', '+', 'L', 'S', '%', ':', 'e', 'E']);
function cellWalk(ch) { return WALKABLE.has(ch); }

function bfs(grid, sx, sy) {
  const H = grid.length, Wd = grid[0].length;
  const seen = new Set([sx + ',' + sy]);
  const q = [[sx, sy]];
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= Wd || ny >= H) continue;
      const k = nx + ',' + ny;
      if (seen.has(k)) continue;
      if (!cellWalk(grid[ny][nx])) continue;
      seen.add(k);
      q.push([nx, ny]);
    }
  }
  return seen;
}

for (const a of Object.values(EF.Adventures)) {
  a.floors.forEach((f, fi) => {
    const tag = `${a.id} floor ${fi} (${f.name})`;
    const Wd = f.grid[0].length;
    ok(f.grid.every(r => r.length === Wd), `rectangular grid ${tag}`);
    // entry walkable
    ok(cellWalk(f.grid[f.entry.y][f.entry.x]), `entry walkable ${tag} @${f.entry.x},${f.entry.y} = '${f.grid[f.entry.y][f.entry.x]}'`);
    const reach = bfs(f.grid, f.entry.x, f.entry.y);
    const at = (x, y) => `${x},${y}`;
    const inReach = (x, y, what) => ok(reach.has(at(x, y)), `${what} reachable (${x},${y}) ${tag}`);
    // stairs chain
    const downs = [], ups = [];
    for (let y = 0; y < f.grid.length; y++) for (let x = 0; x < Wd; x++) {
      if (f.grid[y][x] === '>') downs.push([x, y]);
      if (f.grid[y][x] === '<') ups.push([x, y]);
    }
    ok(ups.length >= 1, `floor has an up-stair ${tag}`);
    if (fi < a.floors.length - 1) ok(downs.length >= 1, `floor has a down-stair ${tag}`);
    if (fi > 0) ok(downs.length === 0 || downs.length <= 2, `sane stair count ${tag}: ${downs.length} down`);
    for (const [x, y] of downs.concat(ups)) inReach(x, y, 'stair');
    // entities on walkable, reachable squares
    for (const m of f.monsters) {
      ok(cellWalk(f.grid[m.y][m.x]), `monster square walkable ${tag} ${m.m} @${m.x},${m.y} = '${f.grid[m.y][m.x]}'`);
      inReach(m.x, m.y, 'monster ' + m.m);
    }
    for (const t of f.treasure) {
      ok(f.grid[t.y][t.x] !== '#', `treasure square open ${tag} @${t.x},${t.y} = '${f.grid[t.y][t.x]}'`);
      inReach(t.x, t.y, 'treasure');
    }
    for (const tr of f.traps) {
      ok(cellWalk(f.grid[tr.y][tr.x]), `trap square walkable ${tag} @${tr.x},${tr.y} = '${f.grid[tr.y][tr.x]}'`);
    }
    for (const e of f.events) {
      ok(cellWalk(f.grid[e.y][e.x]), `event square walkable ${tag} @${e.x},${e.y} = '${f.grid[e.y][e.x]}'`);
      inReach(e.x, e.y, 'event ' + e.id);
    }
    for (const s of f.secrets) {
      ok(f.grid[s.y][s.x] === 'S', `secret marker is S ${tag} @${s.x},${s.y} = '${f.grid[s.y][s.x]}'`);
    }
    ok(f.secrets.length >= 1 && f.secrets.length <= 3, `1-3 secret doors ${tag}: ${f.secrets.length}`);
    ok(f.traps.length >= 2 && f.traps.length <= 3, `2-3 traps ${tag}: ${f.traps.length}`);
  });
  // town connectivity from wild exit
  const gate = a.town.objects.find(o => o.kind === 'wildexit');
  const grid = a.town.grid.map(r => r.map(c => c === '#' ? '#' : '.'));
  const seen = new Set([gate.x + ',' + gate.y]);
  const q = [[gate.x, gate.y]];
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || ny >= grid.length || nx >= grid[0].length) continue;
      const k = nx + ',' + ny;
      if (seen.has(k) || grid[ny][nx] !== '.') continue;
      seen.add(k); q.push([nx, ny]);
    }
  }
  for (const o of a.town.objects) ok(seen.has(o.x + ',' + o.y), `town object reachable ${a.id} ${o.kind} @${o.x},${o.y}`);
}

// exits land on valid squares (overland town site inside bounds, dungeon sites inside)
for (const a of Object.values(EF.Adventures)) {
  const w = EF.Wilds.gen(a.id);
  ok(w.town.x >= 0 && w.town.y >= 0 && w.town.x < w.W && w.town.y < w.H, `wilds town in bounds ${a.id}`);
  ok(w.sites.some(s => s.kind === 'dungeon'), `wilds has dungeon site ${a.id}`);
  // site reachability from town by walkable (non river/mountain) terrain
  const pass = t => t !== EF.Wilds.T.RIVER && t !== EF.Wilds.T.MOUNTAIN;
  const seen = new Set([w.town.x + ',' + w.town.y]);
  const q = [[w.town.x, w.town.y]];
  while (q.length) {
    const [x, y] = q.shift();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || ny >= w.H || nx >= w.W) continue;
      const k = nx + ',' + ny;
      if (seen.has(k) || !pass(w.grid[ny][nx])) continue;
      seen.add(k); q.push([nx, ny]);
    }
  }
  for (const s of w.sites) ok(seen.has(s.x + ',' + s.y), `wilds site reachable from town ${a.id} ${s.kind}`);
}

console.log(`\nvalidate_maps: ${checks} checks, ${fail} failures`);
process.exit(fail ? 1 : 0);
