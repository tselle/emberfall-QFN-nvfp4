/* Emberfall: The Emberwild Saga — rules.js
 * Second-edition-style table-top rules engine (original expression of game mechanics).
 * Loaded first. No dependencies. Works in browser and Node (for validators). */
(function () {
  const EF = (globalThis.EF = globalThis.EF || {});
  const R = {};
  EF.Rules = R;

  R.VERSION = 1;

  // ---------------------------------------------------------------- abilities
  R.ABILITIES = ['str', 'int', 'wis', 'dex', 'con', 'cha'];
  R.ABILITY_NAMES = {
    str: 'Strength', int: 'Intelligence', wis: 'Wisdom',
    dex: 'Dexterity', con: 'Constitution', cha: 'Charisma'
  };

  R.mod = function (score) { // generic -4..+3 modifier curve
    if (score <= 3) return -3;
    if (score <= 5) return -2;
    if (score <= 8) return -1;
    if (score <= 12) return 0;
    if (score <= 15) return 1;
    if (score <= 17) return 2;
    if (score <= 20) return 3;
    return 4;
  };

  R.STR_TO_HIT = s => s >= 19 ? 3 : s >= 18 ? 2 : s >= 17 ? 1 : s >= 16 ? 1 : s >= 14 ? 0 : s >= 13 ? 0 : s >= 6 ? -1 : s >= 4 ? -2 : -3;
  // Damage bonus by strength; 18/xx percentile handled separately
  R.STR_TO_HIT_PCT = { '01-50': 0, '51-75': 0, '76-90': 1, '91-99': 1, '00': 2 };
  R.STR_TO_DMG_PCT = { '01-50': 1, '51-75': 2, '76-90': 3, '91-99': 4, '00': 5 };
  R.STR_OPEN_DOOR = { 3: '1-2', 4: '1-3', 5: '1-4', 6: '1-5', 7: '1-6', 8: '2-3', 9: '2-4', 10: '2-5', 11: '2-6', 12: '3-4', 13: '3-5', 14: '3-6', 15: '4-5', 16: '4-6', 17: '5-6', 18: '7-8', 19: '8-9', 20: '9-10' };

  R.STR_BOW_BONUS = s => (s >= 19 ? 3 : s === 18 ? 2 : s >= 16 ? 1 : 0);

  R.strAttack = function (ch) {
    const s = ch.abilities.str;
    if (s === 18 && ch.pct) {
      const b = R.STR_TO_HIT_PCT[R.pctBand(ch.pct)];
      return b + (ch.pctBand === '00' || ch.pct === 100 ? (s >= 18 ? 1 : 0) : 0);
    }
    return R.STR_TO_HIT(s);
  };
  R.strDamage = function (ch) {
    const s = ch.abilities.str;
    if (s === 18 && ch.pct != null) return R.STR_TO_DMG_PCT[R.pctBand(ch.pct)];
    if (s >= 19) return 5 + (s - 18) * 2;
    return s >= 18 ? 6 : s >= 17 ? 4 : s >= 16 ? 3 : s >= 14 ? 2 : s >= 13 ? 1 : s >= 6 ? -1 : s >= 4 ? -2 : -3;
  };
  R.pctBand = pct => pct >= 100 ? '00' : pct >= 91 ? '91-99' : pct >= 76 ? '76-90' : pct >= 51 ? '51-75' : '01-50';

  R.DEX_AC = s => s >= 19 ? 5 : s === 18 ? 4 : s === 17 ? 2 : s === 16 ? 1 : s >= 13 ? 0 : s >= 6 ? 0 : -1;
  R.DEX_ATK = s => s >= 18 ? 2 : s >= 15 ? 1 : s >= 13 ? 0 : s >= 9 ? 0 : s >= 6 ? -1 : -2;
  R.DEX_REFLEX = s => s >= 16 ? 1 : 0; // vs rod/staff/wand
  R.CON_SAVE = s => s >= 17 ? 2 : s >= 15 ? 1 : s <= 5 ? -2 : s <= 7 ? -1 : 0;
  R.CON_HP = s => s >= 18 ? 3 : s >= 16 ? 2 : s >= 14 ? 1 : s >= 7 ? 0 : s >= 5 ? -1 : -2;
  R.CON_SURV = s => s >= 18 ? 4 : s >= 15 ? 3 : s >= 11 ? 2 : s >= 7 ? 1 : s >= 5 ? -1 : -2;
  // Mage max spell level by intelligence; bonus slots per spell level
  R.INT_MAX_SPELL = i => i >= 18 ? 9 : i >= 17 ? 8 : i >= 16 ? 7 : i >= 15 ? 6 : i >= 13 ? 5 : i >= 9 ? 4 : i <= 3 ? 0 : 3;
  R.INT_BONUS_SLOTS = i => i >= 19 ? 3 : i >= 17 ? 2 : i >= 16 ? 1 : 0;
  // Priest max spell level by wisdom
  R.WIS_MAX_SPELL = w => w >= 18 ? 7 : w >= 17 ? 6 : w >= 16 ? 5 : w >= 14 ? 4 : w >= 9 ? 3 : w <= 3 ? 0 : 2;
  R.WIS_BONUS_SLOTS = w => w >= 18 ? 3 : w >= 17 ? 2 : w >= 16 ? 1 : 0;
  R.CHAR_MAX_HENCH = c => c >= 18 ? 4 : c >= 16 ? 3 : c >= 14 ? 2 : c >= 11 ? 1 : c >= 9 ? 0 : c >= 7 ? -1 : -2;
  R.CHAR_LUCKY = c => c >= 17 ? 1 : c <= 4 ? -1 : 0; // reaction rolls

  // ---------------------------------------------------------------- races
  R.RACES = {
    human: {
      name: 'Human', move: 12, light: 0, darkvision: 0,
      ranges: { str: [3, 18], int: [3, 18], wis: [3, 18], dex: [3, 18], con: [3, 18], cha: [3, 18] },
      mods: {}, classes: ['fighter', 'paladin', 'ranger', 'mage', 'cleric', 'thief'],
      thiefMods: {}, multiclass: [],
      note: 'Ambitious and adaptable. Humans earn a 5% extra experience in whichever class they take.'
    },
    dwarf: {
      name: 'Dwarf', move: 10, light: 0, darkvision: 3,
      ranges: { str: [3, 18], int: [3, 17], wis: [3, 18], dex: [3, 16], con: [4, 19], cha: [3, 15] },
      mods: { con: 1, cha: -1 }, classes: ['fighter', 'paladin', 'cleric', 'thief'],
      thiefMods: { findRemoveTraps: -10 }, multiclass: [],
      note: 'Stoneborn folk of the Emberwild hills. Sure-handed, stubborn, keen-eyed in the dark. +1 to saving throws vs poison, magic and paralysis; 60\' infravision.'
    },
    elf: {
      name: 'Elf', move: 11, light: 0, darkvision: 2,
      ranges: { str: [3, 18], int: [3, 18], wis: [3, 18], dex: [3, 19], con: [3, 17], cha: [3, 18] },
      mods: { dex: 1, con: -1 }, classes: ['fighter', 'mage', 'thief'],
      thiefMods: {}, multiclass: [['fighter', 'mage'], ['fighter', 'thief'], ['mage', 'thief'], ['fighter', 'mage', 'thief']],
      note: 'Long-lived wanderers of the deep green. Immune to sleep-spells and charm, low-light sight, 30\' infravision.'
    },
    gnome: {
      name: 'Gnome', move: 10, light: 0, darkvision: 3,
      ranges: { str: [3, 17], int: [3, 18], wis: [3, 18], dex: [3, 18], con: [4, 19], cha: [3, 17] },
      mods: { con: 1, str: -1 }, classes: ['fighter', 'mage', 'thief'],
      thiefMods: { findRemoveTraps: -5 }, multiclass: [],
      note: 'Small, merry folk of burrow-halls. Illusionists by tradition; resistant to illusion magic. 60\' infravision.'
    },
    halfelf: {
      name: 'Half-elf', move: 11, light: 0, darkvision: 2,
      ranges: { str: [3, 18], int: [3, 18], wis: [3, 18], dex: [3, 19], con: [3, 18], cha: [3, 18] },
      mods: {}, classes: ['fighter', 'paladin', 'ranger', 'mage', 'cleric', 'thief'],
      thiefMods: {}, multiclass: [['fighter', 'mage'], ['fighter', 'thief'], ['mage', 'thief'], ['cleric', 'thief'], ['fighter', 'mage', 'thief']],
      note: 'Between two peoples, wholly of neither. Low-light sight and 30\' infravision.'
    },
    halfling: {
      name: 'Halfling', move: 10, light: 0, darkvision: 0,
      ranges: { str: [3, 16], int: [3, 17], wis: [3, 17], dex: [4, 19], con: [4, 19], cha: [3, 18] },
      mods: { dex: 1, str: -1 }, classes: ['fighter', 'cleric', 'thief'],
      thiefMods: { moveSilently: 10, hideInShadows: 15, climbWalls: 5, openLocks: 5, findRemoveTraps: 5 }, multiclass: [],
      note: 'Hobbit-small and unbothered by the dark. +1 to hit with bows and slings, great agility in concealment.'
    }
  };

  // ---------------------------------------------------------------- classes
  R.CLASSES = {
    fighter: {
      name: 'Fighter', hd: 10, align: ['LG', 'N', 'NG', 'LE', 'NE', 'CE'],
      prime: ['str'], maxLevel: 20, conHpMax: 3,
      group: 'warrior', canSpecialize: true,
      note: 'Master of arms. May specialize in one weapon; gains attacks and bonus damage as they rise.'
    },
    paladin: {
      name: 'Paladin', hd: 10, align: ['LG'], prime: ['str', 'cha'], maxLevel: 20, conHpMax: 3,
      group: 'warrior', startsSpellsAt: 7, spellSource: 'priest', spellLevelOffset: 6,
      note: 'Knight of the Sacred Hearth. Lay on hands, turns undead as a cleric two levels lower, immune to disease, aura of protection 10\'. Weapon specialization at 7th level.'
    },
    ranger: {
      name: 'Ranger', hd: 10, align: ['LG', 'NG', 'N'], prime: ['str', 'dex', 'wis'], maxLevel: 20, conHpMax: 3,
      group: 'warrior', startsSpellsAt: 5, spellSource: 'priest', spellLevelOffset: 4,
      note: 'Warden of the wild borderlands. Never surprised, +1 attack and damage vs goblin-kind and giant-kind; two melee attacks per round from 7th level.'
    },
    mage: {
      name: 'Mage', hd: 4, align: ['LG', 'N', 'NG', 'LE', 'NE', 'CE'],
      prime: ['int'], maxLevel: 20, conHpMax: 2,
      group: 'wizard', startsSpellsAt: 1, spellSource: 'wizard',
      note: 'Reader of the ember-script. Learns spells from scrolls into a spellbook; memorizes by study.'
    },
    cleric: {
      name: 'Cleric', hd: 8, align: ['LG', 'N', 'NG', 'LE', 'NE', 'CE'],
      prime: ['wis'], maxLevel: 20, conHpMax: 2,
      group: 'priest', startsSpellsAt: 1, spellSource: 'priest',
      note: 'Shepherd of the flock. Turns undead, heals by prayer, and maces never feel wrong in the hand.'
    },
    thief: {
      name: 'Thief', hd: 6, align: ['LG', 'N', 'NG', 'LE', 'NE', 'CE'],
      prime: ['dex'], maxLevel: 20, conHpMax: 2,
      group: 'rogue', backstab: true,
      note: 'Professional opener of that which is closed. Find and remove traps; backstab for double damage.'
    }
  };

  R.ALIGNMENTS = {
    LG: 'Lawful Good', N: 'Neutral', NG: 'Neutral Good', LE: 'Lawful Evil',
    NE: 'Neutral Evil', CE: 'Chaotic Evil', CG: 'Chaotic Good', LN: 'Lawful Neutral', CN: 'Chaotic Neutral'
  };

  // ---------------------------------------------------------------- tables
  // Cumulative experience needed for each character level (index = level).
  const CUM = {
    fighter: [0, 0, 2000, 4000, 8000, 16000, 32000, 64000, 120000, 240000, 480000],
    paladin: [0, 0, 2250, 4500, 9000, 18000, 36000, 75000, 150000, 300000, 450000],
    ranger: [0, 0, 2250, 4500, 9000, 18000, 36000, 75000, 150000, 270000, 450000],
    cleric: [0, 0, 2250, 4500, 9000, 18000, 36000, 75000, 150000, 300000, 450000],
    mage: [0, 0, 2500, 5000, 10000, 20000, 40000, 60000, 90000, 135000, 200000],
    thief: [0, 0, 1500, 3000, 6000, 13000, 27500, 55000, 110000, 225000, 450000]
  };
  const CUM_STEP = {
    fighter: 270000, paladin: 450000, ranger: 450000, cleric: 350000, mage: 200000, thief: 300000
  };
  R.xpForLevel = function (cls, level) {
    const t = CUM[cls];
    if (level <= 10) return t[level];
    return t[10] + CUM_STEP[cls] * (level - 10);
  };
  R.levelForXp = function (cls, xp) {
    for (let l = 20; l >= 1; l--) if (xp >= R.xpForLevel(cls, l)) return l;
    return 1;
  };

  // THAC0 by class and level (descending attacks of class zero).
  R.thac0 = function (cls, level) {
    const l = Math.min(20, Math.max(1, level));
    switch (cls) {
      case 'fighter': return 20 - (l - 1);
      case 'paladin': case 'ranger': return 20 - Math.floor((l - 1) * 0.45);
      case 'cleric': case 'mage': return 20 - Math.floor((l - 1) / 3);
      case 'thief': return 20 - Math.floor((l + 2) / 3);
    }
    return 20;
  };

  // Saving throws: [paralysis, poison, breath, rod, spell] by group and level.
  const SAVE = {
    warrior: { a: [14, 16, 15, 17, 17], d: [12, 13, 11, 12, 11] },
    priest: { a: [11, 12, 10, 13, 13], d: [8, 8, 8, 8, 8] },
    rogue: { a: [14, 13, 14, 15, 13], d: [8, 8, 8, 8, 8], cap: 14 },
    wizard: { a: [14, 15, 16, 17, 17], d: [9, 9, 9, 8, 6] }
  };
  R.SAVE_CATS = ['paralysis', 'poison', 'breath', 'rod', 'spell'];
  R.saves = function (cls, level) {
    const g = R.CLASSES[cls] ? R.CLASSES[cls].group : 'warrior';
    const t = SAVE[g];
    const l = Math.min(20, Math.max(1, level));
    const lc = t.cap ? Math.min(l, t.cap) : l;
    return t.a.map((base, i) => base - Math.floor((lc - 1) * t.d[i] / 19));
  };

  // Spell slots per spell level, by class level (function of caster level).
  R.spellSlots = function (ch, spellLevel) {
    const cls = R.CLASSES[ch.cls];
    if (!cls.startsSpellsAt) return 0;
    let cl = ch.level;
    if (cls.spellLevelOffset) cl = ch.level - cls.spellLevelOffset;
    if (cl < spellLevel) return 0;
    const max = cls.spellSource === 'wizard' ? R.INT_MAX_SPELL(ch.abilities.int || 9) : R.WIS_MAX_SPELL(ch.abilities.wis || 9);
    if (spellLevel > max) return 0;
    let n = 1 + Math.floor((cl - spellLevel) * 0.55);
    if (cls.spellSource === 'wizard') n += R.INT_BONUS_SLOTS(ch.abilities.int || 9);
    else if (ch.cls === 'cleric') n += R.WIS_BONUS_SLOTS(ch.abilities.wis || 9);
    return Math.min(spellLevel >= 8 ? 4 : 9, n);
  };

  // Thief base skills (%), before race/dex modifiers.
  const THIEF_BASE = [
    /* lvl 1 */ { pickPocket: 15, openLocks: 10, findRemoveTraps: 5, moveSilently: 10, hideInShadows: 10, detectNoise: 3, climbWalls: 60 },
    /* step   */ { pickPocket: 4, openLocks: 4, findRemoveTraps: 4, moveSilently: 4, hideInShadows: 4, detectNoise: 1, climbWalls: 2 }
  ];
  R.thiefSkills = function (ch) {
    if (!R.isThief(ch)) return null;
    const lvl = ch.level, base = THIEF_BASE[0], st = THIEF_BASE[1];
    const raceMods = {};
    for (const clsKey of R.charClasses(ch)) {
      const rc = R.RACES[ch.race].thiefMods || {};
      for (const k in rc) raceMods[k] = (raceMods[k] || 0) + rc[k] / R.charClasses(ch).length;
    }
    const out = {};
    for (const k in base) {
      let v = base[k] + st[k] * (lvl - 1);
      v += raceMods[k] || 0;
      if (k === 'moveSilently' || k === 'hideInShadows' || k === 'openLocks' || k === 'findRemoveTraps') v += R.mod(ch.abilities.dex || 10);
      if (k === 'climbWalls') v += 2 * R.mod(ch.abilities.dex || 10);
      out[k] = Math.max(0, Math.min(95, Math.round(v)));
    }
    return out;
  };

  R.isThief = ch => R.charClasses(ch).indexOf('thief') >= 0;
  R.isCaster = ch => {
    return R.charClasses(ch).some(c => {
      const cls = R.CLASSES[c];
      return cls.startsSpellsAt && ch.level >= cls.startsSpellsAt;
    });
  };
  R.turnsUndead = ch => R.charClasses(ch).some(c => c === 'cleric') || R.charClasses(ch).indexOf('paladin') >= 0;
  R.turnLevel = ch => { // paladins turn as cleric two levels lower
    const cls = R.charClasses(ch);
    if (cls.indexOf('cleric') >= 0) return ch.level;
    if (cls.indexOf('paladin') >= 0) return Math.max(1, ch.level - 2);
    return 0;
  };
  R.layOnHands = ch => R.charClasses(ch).indexOf('paladin') >= 0 ? ch.level * 2 : 0;
  R.weaponSpecialty = ch => { // weapon key or null
    const cls = R.charClasses(ch);
    if (cls.indexOf('fighter') >= 0 && ch.specialty) return ch.specialty;
    if (cls.indexOf('paladin') >= 0 && ch.level >= 7 && ch.specialty) return ch.specialty;
    if (cls.indexOf('ranger') >= 0 && ch.level >= 7 && ch.specialty) return ch.specialty;
    return null;
  };
  R.meleeAttacks = function (ch) {
    const cls = R.charClasses(ch);
    let n = 1;
    const sp = R.weaponSpecialty(ch);
    if (sp && ch.specialtyLevel >= 3) n = 2; // specialization extra attack
    if (cls.indexOf('ranger') >= 0 && ch.level >= 7) n = Math.max(n, 2);
    if (ch.hasted) n += 1;
    return n;
  };
  R.specialtyBonus = function (ch, weaponKey) {
    const sp = R.weaponSpecialty(ch);
    if (!sp || sp !== weaponKey) return { toHit: 0, toDmg: 0, extra: 0 };
    const lvl = ch.level;
    if (lvl >= 7) return { toHit: 2, toDmg: 3, extra: ch.specialtyLevel >= 3 ? 1 : 0 };
    return { toHit: 1, toDmg: 2, extra: ch.specialtyLevel >= 3 ? 1 : 0 };
  };

  // ---- multiclass helpers (elf / half-elf): level applies to all classes; xp split evenly
  R.charClasses = ch => ch.classes || [ch.cls];
  R.xpBonus = function (ch) {
    let bonus = 0;
    const primes = R.charClasses(ch).reduce((acc, c) => acc.concat(R.CLASSES[c].prime), []);
    const worst = Math.min(...primes.map(p => ch.abilities[p] || 10));
    if (worst >= 18) bonus = 10;
    else if (worst >= 16) bonus = 5;
    else if (worst <= 3) bonus = -20;
    if (R.charClasses(ch).some(c => R.CLASSES[c].group === 'warrior')) {
      if ((ch.abilities.str || 9) >= 13 && (ch.abilities.con || 9) >= 16) bonus += (ch.pct >= 100 || (ch.abilities.str || 0) >= 19) ? 2 : 1;
    }
    if (ch.race === 'human') bonus += 5;
    return bonus;
  };

  // ---------------------------------------------------------------- characters
  R.roll3d8 = rng => rng.d8() + rng.d8() + rng.d8();
  R.rollAbility = function (rng) { // 3d6 with single reroll of 3 ones (house rule keeps creation brisk)
    let a = [rng.d6(), rng.d6(), rng.d6()];
    if (a[0] === 1 && a[1] === 1 && a[2] === 1) a = [rng.d6(), rng.d6(), rng.d6()];
    return a.reduce((s, v) => s + v, 0);
  };

  // Generate a legal ability set for a race: 3d6 six times, reroll any below race minimum (cap at race max).
  R.rollAbilities = function (rng, race) {
    const r = R.RACES[race].ranges;
    const ab = {};
    for (const k of R.ABILITIES) {
      let v;
      do { v = R.rollAbility(rng); } while (v < r[k][0]);
      ab[k] = Math.min(v, r[k][1]);
    }
    return ab;
  };

  R.adjustAbilities = function (race, ab) {
    const mods = R.RACES[race].mods || {};
    const out = Object.assign({}, ab);
    for (const k in mods) out[k] = Math.max(3, (out[k] || 10) + mods[k]);
    return out;
  };

  R.classesFor = function (race) { return R.RACES[race].classes.slice(); };
  R.multisFor = function (race) { return R.RACES[race].multiclass || []; };

  R.newCharacter = function (opts) {
    const ch = {
      name: opts.name, race: opts.race, cls: opts.classes[0], classes: opts.classes.slice(),
      align: opts.align, abilities: opts.abilities, pct: opts.pct || null,
      hp: opts.hp, maxHp: opts.hp, conLoss: 0, surv: R.CON_SURV(opts.abilities.con || 10),
      xp: 0, level: 1, gold: opts.gold != null ? opts.gold : 10 * (3 + (opts.abilities.cha || 10)),
      armorClass: 10, armorItem: null, shield: false,
      weapon: opts.weapon || null, // {itemKey, ammo}
      specialty: opts.specialty || null, specialtyLevel: opts.specialtyLevel || 0,
      spellsKnown: opts.spellsKnown || [], spellsMem: opts.spellsMem || [], spellbook: opts.spellbook || [],
      scrolls: opts.scrolls || [], items: opts.items || [],
      layOnHandsLeft: 0, turnTurned: false,
      status: {}, // fear, slow, haste, bless, curse, invis, held, poisoned...
      alive: true, cured: true
    };
    return ch;
  };

  R.recalc = function (ch, items) {
    // armor class
    let ac = 10;
    if (ch.armorItem && items && items[ch.armorItem]) ac = items[ch.armorItem].ac;
    else if (ch.armor) ac = ch.armor;
    ac -= R.DEX_AC(ch.abilities.dex || 10) * -1; // dex bonus improves AC
    if (ch.status && ch.status.shield) ac -= 4;
    if (ch.status && ch.status.curse) ac += 2;
    if (ch.status && ch.status.haste) ac += 1;
    if (ch.status && ch.status.slow) ac -= 1;
    ch.armorClass = Math.max(-10, Math.min(10, ac));
    ch.level = R.levelForXp(ch.cls, ch.xp);
    return ch;
  };

  R.attackScore = function (ch, targetAC, opts) {
    // roll d20 >= (THAC0 - AC); return needed roll target (2..30), clamped 2 (natural 1 always misses)
    const th = R.thac0(ch.cls, ch.level);
    const wb = (opts && opts.toHit) || 0;
    const strb = (opts && opts.missile) ? R.STR_BOW_BONUS(ch.abilities.str) : (opts && opts.noStr ? 0 : R.strAttack(ch));
    const dexb = R.DEX_ATK(ch.abilities.dex || 10);
    const blessb = (ch.status && ch.status.bless) ? 1 : 0;
    const curseb = (ch.status && ch.status.curse) ? -1 : (ch.status && ch.status.fear) ? -2 : 0;
    return { need: Math.max(2, th - targetAC - wb - strb - dexb - blessb - curseb), thac0: th };
  };

  R.moraleCheck = function (rng, morale, modified) {
    // 2e morale: roll 2d10 at or under the (modified) morale score to stand and fight
    const roll = rng.d10() + rng.d10();
    return roll <= morale + (modified || 0);
  };

  // Turning undead: returns 'U','T','G','S' or '' (no effect) for turn level vs undead HD/mul.
  R.turnResult = function (turnLevel, m) {
    const hd = m.hd + (m.hdMod || 0) + (m.special && m.special.mul ? 3 : 0);
    const cat = m.special && m.special.undead;
    if (!cat) return null;
    // category by undead type
    let col = 1; // 1 normal, 2 spectral/wight/ghast/wraith, 3 wraith/phantom, 4 vampire/liche
    if (/greater|wight|ghast|spectre/.test(m.special.undead)) col = 2;
    if (/wraith|phantom|shade/.test(m.special.undead)) col = 3;
    if (/vampire|liche|dragon-wight|archlich/.test(m.special.undead)) col = 4;
    const TABLE = [
      [10, 20, '—', '—'],
      [5, 10, 20, '—'],
      [3, 7, 12, 20],
      [2, 4, 8, 12],
      [1, 3, 6, 9]
    ]; // rows for turn levels 1-5 (6+ = row5 - (lvl-5)/2)
    const row = Math.min(4, Math.max(0, turnLevel - 1));
    let need = TABLE[row][col - 1];
    if (turnLevel > 5 && need !== '—') need = Math.max(2, Math.ceil(need / 2));
    if (need === '—') return '';
    return need <= 2 ? 'U' : need <= 9 ? 'T' : need <= 12 ? 'G' : 'S';
  };

  // ---------------------------------------------------------------- movement
  R.movementSquares = function (ch) { // overland squares per turn
    const base = R.RACES[ch.race].move;
    let mv = base;
    if (ch.heavyLoad) mv = Math.max(6, base - 3);
    if (ch.status && ch.status.slow) mv = Math.max(3, Math.round(mv * 0.5));
    if (ch.status && ch.status.haste) mv = Math.round(mv * 1.5);
    return mv;
  };
  R.combatSquares = ch => Math.max(1, Math.round(R.movementSquares(ch) / 3)); // 1 combat square = 10 ft

  // ---------------------------------------------------------------- traps
  R.trapDamage = function (dungeonLevel, base) { // scales with dungeon depth
    const dice = Math.max(1, Math.min(12, Math.round(base + dungeonLevel / 2)));
    return dice;
  };
})();
