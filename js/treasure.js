/* Emberfall — treasure.js
 * First-edition-style treasure types (A–I plus M for money-only and N for none),
 * with gems, jewellery and artwork tables. Gem/jewellery/art entries register as
 * items so shops, loot and validators all speak the same language. */
(function () {
  const EF = (globalThis.EF = globalThis.EF || {});
  const rng = () => EF.dice;

  // ---- treasure type probability tables (percentage dice)
  // Each entry: [chance, spec] ; spec kinds: coins gp value via 'g'/'s'/'e' with dice, 'gems','jewels','art','item:<cat>','magic'
  const T = {
    A: [['g', '2d6'], ['gems', '2d6'], ['jewels', '2d6'], ['item', '1']],
    B: [['g', '1d6'], ['s', '2d6'], ['gems', '1d4'], ['jewels', '1d4'], ['art', '1d4'], ['item', '1']],
    C: [['g', '2d6'], ['s', '2d6'], ['e', '2d6'], ['gems', '1d6'], ['jewels', '1d6'], ['art', '1d6'], ['item', '1']],
    D: [['g', '4d6'], ['e', '4d6'], ['gems', '2d6'], ['jewels', '2d6'], ['art', '2d6'], ['item', '2']],
    E: [['g', '2d6', 30], ['gems', '2d6', 55], ['jewels', '2d6', 55], ['art', '1d6', 55], ['item', '2', 75]],
    F: [['g', '3d6', 75], ['s', '1d6', 75], ['gems', '2d6', 75], ['jewels', '2d6', 75], ['art', '2d6', 75], ['item', '2', 90]],
    G: [['g', '6d6', 60], ['e', '4d6', 60], ['gems', '3d6', 70], ['jewels', '3d6', 70], ['art', '3d6', 70], ['item', '3', 75]],
    H: [['g', '8d6', 100], ['s', '1d6', 20], ['e', '3d6', 90], ['gems', '4d6', 60], ['jewels', '4d6', 60], ['art', '3d6', 50], ['item', '4', 75]],
    I: [['g', '10d6', 65], ['e', '12d6', 35], ['gems', '6d6', 75], ['jewels', '6d6', 75], ['art', '6d6', 60], ['item', '6', 85]],
    M: [['g', '1d4', 50], ['s', '1d6', 50]],
    N: []
  };
  // standard 1e-style per-type item roll odds kept simple: chance = first-listed percentages
  const TYPE_PCT = {
    A: { g: 10, gems: 25, jewels: 25, art: 0, item: 40 },
    B: { g: 30, s: 40, gems: 25, jewels: 25, art: 25, item: 35 },
    C: { g: 30, s: 40, e: 20, gems: 25, jewels: 25, art: 25, item: 30 },
    D: { g: 40, e: 40, gems: 30, jewels: 30, art: 30, item: 40 },
    E: { g: 30, gems: 40, jewels: 40, art: 20, item: 75 },
    F: { g: 50, s: 50, gems: 40, jewels: 40, art: 40, item: 60 },
    G: { g: 40, e: 40, gems: 45, jewels: 45, art: 30, item: 55 },
    H: { g: 70, s: 70, e: 50, gems: 45, jewels: 45, art: 25, item: 65 },
    I: { g: 75, e: 60, gems: 55, jewels: 55, art: 40, item: 80 },
    M: { g: 50, s: 50 },
    N: {}
  };

  // ---- gems & jewellery & art (registered as items)
  const GEMS = [
    ['bort black diamond', 400], ['diamond', 2000], ['ruby', 1500], ['emerald', 1200],
    ['star ruby', 4000], ['star sapphire',3000], ['opalescent black cat', 600], ['garnet', 200],
    ['beryl', 300], ['moonstone', 200], ['pearl', 150], ['pink pearl', 600], ['rose pearl', 1200],
    ['amethyst', 150], ['aquatic agate', 200], ['blue quartz', 150], ['lapis lazuli', 180],
    ['malachite', 150], ['bloodstone', 250], ['fire opal', 500], ['black opal', 1000], ['jewel beetle wing', 900]
  ];
  const JEWELS = [
    ['silver circlet', 75], ['gold circlet', 150], ['platinum circlet', 250],
    ['silver brooch', 50], ['gold brooch set with garnets', 250], ['amber necklace', 180],
    ['pearl necklace', 400], ['gold bracelet', 100], ['jade bracelet', 350],
    ['silver anklet', 40], ['gold ring with a sapphire', 500], ['cameo ring', 300],
    ['tiara of spun silver', 700], ['diadem of black iron and rubies', 900],
    ['earrings of twisted gold', 200], ['girdle of gold links', 600],
    ['girdle set with emeralds', 1400], ['silver crown', 500], ['gold crown', 1000], ['watcher\u2019s signet ring', 220]
  ];
  const ART = [
    ['carved walrus-ivory dice', 300], ['bone-handled knives, inlaid gold', 300], ['brass idol of a forgotten sea', 250],
    ['carved jade toad', 500], ['jade screen, twelve panels', 4000], ['porcelain figurines (set)', 500],
    ['silk hanging, the hunt of the white hind', 1000], ['silver candelabra (7 bars)', 1000],
    ['silver basin, engraved marsh-birds', 500], ['gold chalice, ruby rim', 1200],
    ['gold chess set (red and black jasper)', 5000], ['miniature siege engines in silver', 1500],
    ['clockwork orrery of brass', 2500], ['harp with a pearl-stringed neck', 1500],
    ['murrain glass urn', 750], ['tortoiseshell box of miniatures', 600], ['oak cabinet, ebony inlay', 300],
    ['map of the Emberwild on hammered gold', 3000], ['crown of antlered bronze', 900], ['reliquary of Saint Cerena', 2500]
  ];
  function regTreasure(list, cat) {
    for (const [name, value] of list) {
      const key = cat + '_' + name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, '');
      EF.Items[key] = { key, name, cat, cost: value, wt: cat === 'gem' ? 1 : cat === 'jewel' ? 1 : 5, treasure: true };
    }
  }
  regTreasure(GEMS, 'gem'); regTreasure(JEWELS, 'jewel'); regTreasure(ART, 'art');

  // ---- rolls
  EF.rollCoins = function (type) {
    const r = rng(), out = [];
    const table = T[type] || [];
    for (const spec of table) {
      const kind = spec[0], dice = spec[1];
      const pct = TYPE_PCT[type] ? (TYPE_PCT[type][kind] || 0) : 0;
      if (!pct || r.d(100) > pct) continue;
      const n = r.roll(dice) * (kind === 'g' ? 1 : kind === 's' ? 0.1 : kind === 'e' ? 2 : 0);
      if (kind === 'g') out.push({ item: 'gold_coins', qty: r.roll(dice), gp: n });
      else if (kind === 's') out.push({ item: 'silver_coins', qty: r.roll(dice) * 10, gp: n });
      else if (kind === 'e') out.push({ item: 'electrum_coins', qty: r.roll(dice) * 5, gp: n });
    }
    return out;
  };
  EF.Items['electrum_coins'] = { key: 'electrum_coins', name: 'Electrum Pieces', cat: 'coins', cost: 1, wt: 0, coins: true };

  EF.rollGemBatch = function (dice) {
    const r = rng(), n = r.roll(dice);
    const picks = [];
    for (let i = 0; i < n; i++) {
      const g = GEMS[r.int(GEMS.length)];
      picks.push({ item: 'gem_' + g[0].toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, ''), qty: 1, gp: g[1] });
    }
    return picks;
  };
  EF.rollJewelBatch = function (dice) {
    const r = rng(), n = r.roll(dice), picks = [];
    for (let i = 0; i < n; i++) {
      const j = JEWELS[r.int(JEWELS.length)];
      picks.push({ item: 'jewel_' + j[0].toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, ''), qty: 1, gp: j[1] });
    }
    return picks;
  };
  EF.rollArtBatch = function (dice) {
    const r = rng(), n = r.roll(dice), picks = [];
    for (let i = 0; i < n; i++) {
      const a = ART[r.int(ART.length)];
      picks.push({ item: 'art_' + a[0].toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_+/g, '_').replace(/^_|_$/g, ''), qty: 1, gp: a[1] });
    }
    return picks;
  };
  // magic item roll for a treasure type; levelBand 0..4 biases the pool
  EF.rollMagicItem = function (type, levelBand) {
    const r = rng();
    const spec = (T[type] || []).find(s => s[0] === 'item');
    if (!spec) return [];
    const count = r.roll(spec[1]);
    const out = [];
    const pool = [];
    const bands = EF.SHOP_STOCK.bands;
    for (let b = 0; b <= Math.min(4, levelBand + 1); b++) for (const k of bands[b]) {
      const it = EF.Items[k];
      if (!it) continue;
      if (['potion', 'wand', 'ring', 'rod', 'staff', 'misc', 'scroll', 'weapon'].indexOf(it.cat) >= 0) pool.push(k);
      }
    for (let i = 0; i < count; i++) {
      if (!pool.length) break;
      out.push({ item: r.pick(pool), qty: 1 });
    }
    return out;
  };
  // master hoard roll for a treasure-type string (e.g. 'ABC', 'HI', 'E')
  EF.rollHoard = function (typesStr, levelBand) {
    const out = { coins: [], gems: [], jewels: [], art: [], items: [], gp: 0 };
    const letters = String(typesStr || 'N').toUpperCase().split('');
    for (const L of letters) {
      if (!T[L]) continue;
      for (const c of EF.rollCoins(L)) { out.coins.push(c); out.gp += c.gp || 0; }
      for (const g of EF.rollGemBatch('1d4')) { out.gems.push(g); out.gp += g.gp; }
      for (const j of EF.rollJewelBatch('1d3')) { out.jewels.push(j); out.gp += j.gp; }
      for (const a of EF.rollArtBatch('1d2')) { out.art.push(a); out.gp += a.gp; }
      for (const m of EF.rollMagicItem(L, levelBand || 0)) out.items.push(m);
    }
    out.gp = Math.round(out.gp);
    return out;
  };
  // per-monster single-type roll (uses first letter of its treasure)
  EF.rollMonsterTreasure = function (m, levelBand) {
    const t = (m.treasure || 'N').charAt(0);
    return EF.rollHoard(t, levelBand);
  };
})();
