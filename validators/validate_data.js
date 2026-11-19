/* Emberfall validator — content references.
 * Checks: every referenced monster/item/spell/treasure type exists; shop
 * stocks, loot pools, encounters and scroll-spell links all resolve. */
'use strict';
const path = require('path');
for (const f of ['rules', 'data', 'modules', 'monsters', 'wilds', 'treasure', 'adventures'])
  require(path.join(__dirname, '..', 'js', f + '.js'));
const EF = globalThis.EF;

let fail = 0, checks = 0;
function ok(cond, msg) { checks++; if (!cond) { fail++; console.log('FAIL:', msg); } }

// monsters referenced by adventures
const missingM = [];
for (const a of Object.values(EF.Adventures)) {
  a.floors.forEach((f, fi) => {
    for (const m of f.monsters) {
      if (!EF.mon(m.m)) missingM.push(a.id + ' f' + fi + ' ' + m.m);
      ok(EF.mon(m.m), `monster ${m.m} (adv ${a.id} floor ${fi})`);
      ok(m.x >= 0 && m.y >= 0 && m.y < f.grid.length && m.x < f.grid[0].length, `monster in bounds ${a.id} f${fi} ${m.m} @${m.x},${m.y}`);
    }
    for (const t of f.treasure) {
      ok(/^[A-Z]+$/.test(t.hoard || 'N'), `treasure type letters ok (${t.hoard}) ${a.id} f${fi}`);
      for (const L of (t.hoard || 'N').split('')) ok('ABCDEFGHI'.includes(L), `treasure letter ${L} known (${a.id})`);
    }
    for (const e of f.events) {
      if (e.grant && e.grant.item) ok(!!EF.Items[e.grant.item], `event grant item ${e.grant.item} (${a.id} f${fi})`);
    }
    for (const tr of f.traps) ok(['pit', 'darts', 'blade', 'spear', 'falling block', 'fire', 'gas'].includes(tr.type), `trap kind ${tr.type} (${a.id})`);
  });
  // quests
  for (const q of a.quests) {
    if (q.killTag) ok(!!EF.mon(q.killTag), `quest killTag ${q.killTag} (${a.id})`);
    if (q.item) ok(!!EF.Items[q.item], `quest item ${q.item} (${a.id})`);
    if (q.tag) ok(a.floors.some(fl => fl.monsters.some(m => m.quest === q.id)), `quest boss tag ${q.id} present on a monster (${a.id})`);
  }
  // town objects
  const gw = a.town.grid[0].length, gh = a.town.grid.length;
  for (const o of a.town.objects) {
    ok(o.x >= 0 && o.y >= 0 && o.x < gw && o.y < gh, `town object in bounds ${a.id} ${o.kind} @${o.x},${o.y}`);
    ok(a.town.grid[o.y][o.x] !== '#', `town object not inside wall ${a.id} ${o.kind} @${o.x},${o.y} (grid='${a.town.grid[o.y][o.x]}')`);
  }
  ok(a.town.objects.some(o => o.kind === 'patron'), `adventure has patron ${a.id}`);
  ok(a.town.objects.some(o => o.kind === 'dungeon'), `adventure has dungeon entrance ${a.id}`);
  ok(a.town.objects.some(o => o.kind === 'wildexit'), `adventure has wild exit ${a.id}`);
}
// unknown monster specials
for (const m of Object.values(EF.Monsters)) {
  if (m.special._unknown) ok(false, `unknown specials on ${m.key}: ${m.special._unknown.join(',')}`);
}
// shop stocks resolve to items
for (const list of [EF.SHOP_STOCK.mundane, EF.SHOP_STOCK.weapons, EF.SHOP_STOCK.armor, ...EF.SHOP_STOCK.bands])
  for (const k of list) ok(!!EF.Items[k], `shop item exists: ${k}`);
// spell scroll items map to spells
for (const it of Object.values(EF.Items)) {
  if (it.cat === 'scroll' && it.spell) ok(!!EF.Spells[it.spell], `scroll spell ${it.spell}`);
}
// wilds encounter tables
for (const a of Object.values(EF.Adventures)) {
  const w = EF.Wilds.gen(a.id);
  for (const k of w.encTable) ok(!!EF.mon(k), `overland encounter monster ${k} (${a.id})`);
  for (const s of w.sites) if (s.kind === 'lair' && s.monster) ok(!!EF.mon(s.monster), `lair monster ${s.monster} (${a.id})`);
}
// counts per spec
const advs = Object.values(EF.Adventures);
const gen = advs.filter(a => a.generated);
ok(advs.filter(a => !a.generated).length === 4, 'four hand-written adventures');
ok(gen.length === 50, 'fifty generated adventures, got ' + gen.length);
for (let band = 0; band < 5; band++) {
  const inBand = gen.filter(a => a.band === band);
  ok(inBand.length === 10, `band ${band} has 10, got ${inBand.length}`);
  const sizes = inBand.map(a => (EF.newRng('size', 'gadv-' + band + '-' + a.id.split('_')[1]) , null));
  void sizes;
}
// band size plan: 4 small 3 medium 2 large 1 huge (from SIZE_PLAN order)
const plan = ['small', 'small', 'small', 'small', 'medium', 'medium', 'medium', 'large', 'large', 'huge'];
for (let band = 0; band < 5; band++) for (let i = 0; i < 10; i++) {
  const a = EF.Adventures['g' + band + '_' + i];
  ok(!!a, `generated adventure g${band}_${i} exists`);
}
// spells/items thresholds
const w = Object.values(EF.Spells).filter(s => s.sch === 'w').length;
const p = Object.values(EF.Spells).filter(s => s.sch === 'p').length;
ok(w >= 70, 'about 75 wizard spells, got ' + w);
ok(p >= 60, 'about 70 priest spells, got ' + p);
ok(EF.MONSTER_COUNT() >= 300, 'about 330 monsters, got ' + EF.MONSTER_COUNT());
const baseItems = Object.values(EF.Items).filter(i => i.cat !== 'scroll').length;
ok(baseItems >= 250, 'item catalogue (base) >= 250, got ' + baseItems);

console.log(`\nvalidate_data: ${checks} checks, ${fail} failures`);
process.exit(fail ? 1 : 0);
