/* Emberfall — data.js
 * Spells and items. All text original. Registers into EF.Spells and EF.Items.
 * Scroll items for every spell are generated at the bottom. */
(function () {
  const EF = (globalThis.EF = globalThis.EF || {});
  EF.Spells = EF.Spells || {};
  EF.Items = EF.Items || {};

  // ================================================================ SPELLS
  // fx kinds interpreted by combat.js / game.js:
  //  {kind:'dmg', dice, dtype, save}            save: 'none'|'spell'|'breath'|'paralysis'|'rod' (half on save unless 'half:' omitted)
  //  {kind:'heal', dice} {kind:'sleep', dice} {kind:'missile', dice, each}
  //  {kind:'buff', status, amt, dur} {kind:'smite', status, dur}
  //  {kind:'hold'|'paralyse'|'stun'|'confuse'|'fear'|'slow'|'haste'|'invis'|'silence'|'blind'}
  //  {kind:'cloud', ctype}                     ctype: stink|fog|acid|incendiary|stinking
  //  {kind:'wall', wtype} fire|stone|ice|wind
  //  {kind:'web'} {kind:'bolt', dice} (line) {kind:'cone', dice, dtype}
  //  {kind:'summon', monster, n, hostile} {kind:'animate'} {kind:'findSteading'}
  //  {kind:'special', name} teleport|raiseDead|animateDead|polymorph|petrify|disintegrate|
  //    fingerOfDeath|trueSight|mirrorImage|blur|detectEvil|detectMagic|detectSecrets|
  //    knowAlignment|tongues|esp|light|darkness|infravision|protevil|neutralize|blessWeapon|
  //    dimensionDoor|gate|earthquake|prismatic|feeblemind|geas|clone|astral|ethereal|wordRecall
  const S = (id, name, lvl, sch, rng, dur, area, fx, s) => {
    EF.Spells[id] = { id, name, lvl, sch, rng, dur, area: area || 0, fx, s };
  };
  const W = (n, l, fx, o) => S('w_' + n.replace(/[^a-z0-9]/gi, '_').toLowerCase(), n, l, 'w', o && o.rng != null ? o.rng : 4, o && o.dur || 'inst', o && o.area, fx, o && o.s || '');

  // ---- wizard level 1 (9)
  W('detect magic', 1, { kind: 'special', name: 'detectMagic' }, { rng: 2, dur: 2, s: 'Senses magical auras within 60 feet for 2 rounds.' });
  W('detect evil', 1, { kind: 'special', name: 'detectEvil' }, { rng: 2, dur: 2, s: 'Evil creatures and places glow within 60 feet.' });
  W('shield', 1, { kind: 'buff', status: 'shield', amt: 4, dur: 5 }, { rng: 0, dur: 5, s: 'Magical invisible barrier: AC 4 until dispelled or struck away.' });
  W('magic missile', 1, { kind: 'missile', dice: 1, each: 2 }, { rng: 5, s: 'One or more unerring darts; +1 dart per five caster levels. Never misses.' });
  W('burning hands', 1, { kind: 'cone', dice: '1d2+1 per level (max 5d2)', dtype: 'fire', cap: 5 }, { rng: 0, s: 'Rolling flame from the caster, 1d2 per level (max 5).' });
  W('charm person', 1, { kind: 'special', name: 'charm' }, { rng: 4, dur: 'special', s: 'Humanoid foe obeys friendly suggestions; saves vs spell (no bonus for allies).' });
  W('sleep', 1, { kind: 'sleep', dice: '4d4' }, { rng: 8, s: 'Roll 4d4 hit dice of creatures fall unconscious; lowest first.' });
  W('ventriloquism', 1, { kind: 'special', name: 'ventriloquism' }, { rng: 6, dur: 'special', s: 'Move your voice elsewhere on the map; curious creatures investigate.' });
  W('unerring hunter', 1, { kind: 'special', name: 'infallible' }, { rng: 0, dur: 20, s: 'Your next thrown or shot missile flies true: +2 to hit and never bounces off armour.' });

  // ---- wizard level 2 (9)
  W('detect secret doors', 2, { kind: 'special', name: 'detectSecrets' }, { rng: 1, dur: 5, s: 'Adjacent concealed openings shimmer for the caster.' });
  W('web', 2, { kind: 'web' }, { rng: 3, dur: 'special', s: 'Sticky web snared on a spot; creatures caught in it struggle.' });
  W('stinking cloud', 2, { kind: 'cloud', ctype: 'stink' }, { rng: 6, area: 2, dur: 6, s: 'Nauseating vapor in a 2-square radius for 1d4+2 rounds; save vs poison or retch (lose actions).' });
  W('spider climb', 2, { kind: 'buff', status: 'spiderclimb', amt: 1, dur: 20 }, { rng: 0, dur: 20, s: 'Walk on walls and ceilings as easily as floors.' });
  W('invisibility', 2, { kind: 'invis' }, { rng: 0, dur: 'special', s: 'Invisible until attack or 24 rounds; the party may pass unnoticed.' });
  W('blindness', 2, { kind: 'blind' }, { rng: 4, s: 'A single target gropes about; save negates.' });
  W('pyrotechnics', 2, { kind: 'dmg', dice: '1d4', dtype: 'fire', save: 'spell' }, { rng: 6, area: 1, s: 'Flashing sparks and smoke from an existing flame; blinded foes strike at penalty.' });
  W('wizard lock', 2, { kind: 'special', name: 'wizardLock' }, { rng: 0, s: 'Seals a door or chest; only knock, a successful open, or knockdown will serve.' });
  W('lesser conjuration', 2, { kind: 'summon', monster: 'wolf', n: 1 + Math.floor(1), hostile: false, dur: 5 }, { rng: 3, dur: 5, s: 'Summons one normal creature of not more than 2 Hit Dice to serve for 5 rounds.' });

  // ---- wizard level 3 (9)
  W('fireball', 3, { kind: 'dmg', dice: '1d6/level (max 10d6)', dyn: 'fireball', dtype: 'fire', save: 'breath' }, { rng: 8, area: 2, s: 'Sphere of blasting flame, 1d6 per caster level, in a 2-square radius; breath save for half.' });
  W('lightning bolt', 3, { kind: 'bolt', dice: '1d6/level (max 10d6)', dtype: 'electric', save: 'breath' }, { rng: 8, s: 'Line of lightning 40 yards long, 5 feet wide; breath save for half.' });
  W('haste', 3, { kind: 'haste' }, { rng: 5, dur: 'special', s: 'One ally gains an extra attack each round; ends with a fatigue lag.' });
  W('slow', 3, { kind: 'slow' }, { rng: 5, s: 'Target moves and strikes at half rate; save negates.' });
  W('fly', 3, { kind: 'buff', status: 'fly', amt: 1, dur: 12 }, { rng: 0, dur: 12, s: 'One creature soars at movement 18 for as long as the spell holds.' });
  W('explosive runes', 3, { kind: 'dmg', dice: '2d6', dtype: 'magic', save: 'breath' }, { rng: 0, area: 1, s: 'Set upon a page or door; bursts for 2d6 in a small radius when read.' });
  W('hold person', 3, { kind: 'hold' }, { rng: 5, s: 'One humanoids freezes in place until attacked or freed; save negates.' });
  W('spectral force', 3, { kind: 'dmg', dice: '1d6/2 levels', dyn: 'spectral', dtype: 'magic' }, { rng: 5, dur: 4, s: 'A shimmering axe of your mind strikes once per round, growing mightier with level.' });
  W('monster summoning I', 3, { kind: 'summon', monster: 'random_less', n: 1, hostile: true, dur: 5 }, { rng: 6, dur: 5, s: 'Drag a lesser outer creature forth; it resents the summoning.' });

  // ---- wizard level 4 (9)
  W('wall of fire', 4, { kind: 'wall', wtype: 'fire' }, { rng: 6, dur: 'special', s: 'A shimmering wall of flame; creatures passing through take 1d3+1.' });
  W('ice storm', 4, { kind: 'dmg', dice: '3d6', dtype: 'cold', save: 'breath' }, { rng: 8, area: 2, s: 'Hail crashes down in a 2-square area for 3d6.' });
  W('emotion: hopelessness', 4, { kind: 'smite', status: 'fear', dur: 4 }, { rng: 6, area: 2, s: 'A wave of despair; affected foes lose heart and may flee.' });
  W('minor globe of invulnerability', 4, { kind: 'buff', status: 'globeminor', amt: 1, dur: 8 }, { rng: 0, dur: 8, s: 'Shelters you from lesser (1st–2nd level) spells.' });
  W('confusion', 4, { kind: 'confuse' }, { rng: 6, s: 'A victim acts at random; save negates.' });
  W('polymorph self', 4, { kind: 'special', name: 'polymorphSelf' }, { rng: 0, dur: 'special', s: 'Assume the shape of a small or normal creature; hit points unchanged.' });
  W('polymorph other', 4, { kind: 'special', name: 'polymorphOther' }, { rng: 4, s: 'Turn a foe into a harmless creature; save negates.' });
  W('lesser restoration', 4, { kind: 'special', name: 'lesserRestoration' }, { rng: 0, s: 'Cures one paralysis, blindness, deafness or curse from an ally.' });
  W('shadow monsters', 4, { kind: 'summon', monster: 'shadow', n: 3, hostile: false, dur: 6 }, { rng: 6, dur: 6, s: 'Conjure 1d4+2 shadow beasts that fade if disbelieved.' });
  W('enlarge', 4, { kind: 'buff', status: 'giant', amt: 1, dur: 8 }, { rng: 3, dur: 8, s: 'Doubles size of one creature or object; blows weapons double damage.' });

  // ---- wizard level 5 (9)
  W('cloudkill', 5, { kind: 'cloud', ctype: 'kill' }, { rng: 8, area: 2, dur: 6, s: 'Rolling green fog; save vs poison each round or die.' });
  W('cone of cold', 5, { kind: 'cone', dice: '1d6/level (max 10d6)', dtype: 'cold', save: 'breath', cap: 10 }, { rng: 0, s: 'Cone of freezing cold, 1d6 per level; breath save for half.' });
  W('wall of stone', 5, { kind: 'wall', wtype: 'stone' }, { rng: 5, dur: 'permanent', s: 'Raises a barrier of granite where none was.' });
  W('phantom steed', 5, { kind: 'special', name: 'findSteading' }, { rng: 0, dur: 'special', s: 'A semi-real warhorse appears, carrying you across the wilds at a swift pace.' });
  W('domination', 5, { kind: 'special', name: 'charm', strong: true }, { rng: 6, s: 'Total command of one creature; save vs spell negates.' });
  W('telekinesis', 5, { kind: 'special', name: 'telekinesis' }, { rng: 6, s: 'Move objects or attempt to sunder a weapon from a grasp.' });
  W('wall of fog', 5, { kind: 'cloud', ctype: 'fog' }, { rng: 4, area: 2, dur: 8, s: 'Thick fog blocks sight in a 2-square radius.' });
  W('minor summoning', 5, { kind: 'summon', monster: 'random_lesser', n: 2, hostile: false, dur: 3 }, { rng: 5, dur: 3, s: 'Two summoned servants (up to 4 Hit Dice) obey for a few rounds.' });
  W('teleport', 5, { kind: 'special', name: 'teleport' }, { rng: 0, s: 'Blast away and rematerialize; on a bad roll the wanderer is lost a day.' });

  // ---- wizard level 6 (8)
  W('disintegrate', 6, { kind: 'special', name: 'disintegrate' }, { rng: 6, s: 'One target or 10-foot cube crumbles to dust; magic items resist.' });
  W('petrification', 6, { kind: 'petrify' }, { rng: 6, s: 'Flesh turns to stone; save vs petrification negates.' });
  W('acid arrow', 6, { kind: 'dmg', dice: '2d6+1', dtype: 'acid', first: 5 }, { rng: 6, s: 'A streak of acid: 2d6 at once, then 1d6 per round while it burns.' });
  W('circle of dust', 6, { kind: 'summon', monster: 'dervish', n: 1, hostile: true, dur: 4 }, { rng: 5, dur: 4, s: 'Whirling dervishes of razor dust spring from a pinch of the stuff.' });
  W('true seeing', 6, { kind: 'special', name: 'trueSight' }, { rng: 0, dur: 3, s: 'See through illusions, invisibility and shapes for 3 rounds.' });
  W('geas', 6, { kind: 'special', name: 'geas' }, { rng: 0, s: 'Bind a willing or helpless creature to a quest; betrayal wastes them.' });
  W('guard of whirling steel', 6, { kind: 'special', name: 'steelShield' }, { rng: 0, dur: 2, s: 'Blades whirl about you for 2 rounds, shredding all who approach.' });
  W('invisible stalker', 6, { kind: 'summon', monster: 'invisible_stalker', n: 1, hostile: false, dur: 12 }, { rng: 5, dur: 12, s: 'An unseen hunter tracks one designated quarry.' });

  // ---- wizard level 7 (7)
  W('project image', 7, { kind: 'special', name: 'projectImage' }, { rng: 10, dur: 7, s: 'Send a harmless duplicate of yourself to scout and speak.' });
  W('summon monster IV', 7, { kind: 'summon', monster: 'random_greater', n: 1, hostile: true, dur: 5 }, { rng: 6, dur: 5, s: 'A greater outer creature is compelled to serve — briefly.' });
  W('finger of death', 7, { kind: 'special', name: 'fingerOfDeath' }, { rng: 6, s: 'The black finger points; the living save vs death or perish.' });
  W('phase door', 7, { kind: 'special', name: 'teleport', short: true }, { rng: 3, s: 'Pass briefly into the Ethereal; cross one obstacle or wall.' });
  W('prismatic spray', 7, { kind: 'special', name: 'prismatic' }, { rng: 4, s: 'Seven rays of random power: stun, burning, paralyzing, neutralizing, confusion, sleep, death.' });
  W('spell turning', 7, { kind: 'buff', status: 'turning', amt: 1, dur: 'special' }, { rng: 0, dur: 'special', s: 'One incoming spell rebounds; the ring then shatters.' });
  W('statistics read', 7, { kind: 'special', name: 'trueSight' }, { rng: 3, dur: 5, s: 'Learn the inmost qualities of one creature seen within 30 feet.' });

  // ---- wizard level 8 (7)
  W('power word stun', 8, { kind: 'stun', noSave: true }, { rng: 6, s: 'The spoken word fells up to three beings of 7 hit dice or less.' });
  W('polymorph any object', 8, { kind: 'special', name: 'polymorphOther' }, { rng: 4, s: 'Transform one creature or thing into something else.' });
  W('mind blank', 8, { kind: 'buff', status: 'mindblank', amt: 1, dur: 18 }, { rng: 0, dur: 18, s: 'No scrying, charm, ESP or possession can enter while the blank holds.' });
  W('labrador mind probe', 8, { kind: 'special', name: 'esp' }, { rng: 4, s: 'Read the surface thoughts of one creature; it saves vs spell.' });
  W('gate', 8, { kind: 'special', name: 'gate' }, { rng: 3, s: 'Tear a way between the planes; what answers is never guaranteed.' });
  W('incendiary cloud', 8, { kind: 'cloud', ctype: 'incendiary' }, { rng: 8, area: 2, dur: 4, s: 'A writhing smoke that ignites; save vs death or burn each round.' });
  W('symbol', 8, { kind: 'special', name: 'symbol' }, { rng: 0, s: 'Trace a glowing rune of sleep, stunning or shock; triggered when seen.' });

  // ---- wizard level 9 (7)
  W('power word kill', 9, { kind: 'special', name: 'powerKill' }, { rng: 6, noSave: true, s: 'Up to three creatures of 19 hit dice or less perish; no saving throw.' });
  W('imprisonment', 9, { kind: 'special', name: 'petrify', death: true }, { rng: 5, s: 'The victim vanishes into a tiny ruby prison; save vs petrification (with great penalty) or be lost.' });
  W('prismatic wall', 9, { kind: 'wall', wtype: 'prismatic' }, { rng: 4, dur: 5, s: 'Curtain of seven lethal colours; only a rod can cancel the colours.' });
  W('disintegrate swarm', 9, { kind: 'dmg', dice: '10d6', dtype: 'acid', save: 'spell' }, { rng: 8, area: 3, s: 'A crawling green curtain of dust and acid engulfs a wide area.' });
  W('cloning', 9, { kind: 'special', name: 'clone' }, { rng: 0, s: 'Grow a reserve body over a year; on death the soul migrates whole.' });
  W('meteor swarm', 9, { kind: 'dmg', dice: '6d6', dtype: 'fire', save: 'breath', many: 4 }, { rng: 8, area: 2, s: 'Four blazing globes, each 6d6 in a 2-square radius; breath saves for half.' });
  W('wish', 9, { kind: 'special', name: 'wish' }, { rng: 0, s: 'The fabric of the Emberwild bends once around your desire — and may snap.' });

  // ================================================================ PRIEST SPELLS (levels 1-7)
  const C = (n, l, fx, o) => S('c_' + n.replace(/[^a-z0-9]/gi, '_').toLowerCase(), n, l, 'p', o && o.rng != null ? o.rng : 4, o && o.dur || 'inst', o && o.area, fx, o && o.s || '');

  // level 1 (10)
  C('bless', 1, { kind: 'buff', status: 'bless', amt: 1, dur: 20 }, { rng: 3, area: 1, dur: 20, s: 'Up to 6 allies within hearing gain +1 to hit and saving throws.' });
  C('command', 1, { kind: 'special', name: 'command' }, { rng: 4, s: 'One word binds a creature: approach, flee, halt, fall, or leave.' });
  C('create water', 1, { kind: 'special', name: 'createWater' }, { rng: 0, s: 'Conjure a skin of clean, fresh water from holy will.' });
  C('cure light wounds', 1, { kind: 'heal', dice: '1d8' }, { rng: 0, s: 'Lay hands closes one wound: 1d8 points restored.' });
  C('curse', 1, { kind: 'smite', status: 'curse', dur: 10 }, { rng: 5, s: 'A loathsome burden: -1 to hit, -2 to AC for many rounds.' });
  C('detection of evil', 1, { kind: 'special', name: 'detectEvil' }, { rng: 2, dur: 2, s: 'Evil pulses within 60 feet.' });
  C('light, continual', 1, { kind: 'special', name: 'light' }, { rng: 3, dur: 'permanent', s: 'An object glows steadily for six turns per caster level.' });
  C('portent', 1, { kind: 'buff', status: 'lucky', amt: 1, dur: 8 }, { rng: 0, dur: 8, s: 'You read an omen: +1 to attack and saving throws for a time.' });
  C('pure food & drink', 1, { kind: 'special', name: 'createFood' }, { rng: 0, s: 'Nourishment for three persons appears from nowhere.' });
  C('sanctuary', 1, { kind: 'buff', status: 'sanctuary', amt: 1, dur: 'special' }, { rng: 0, dur: 'special', s: 'Evil creatures cannot strike you while you remain passive.' });

  // level 2 (10)
  C('aid', 2, { kind: 'buff', status: 'aid', amt: 2, dur: 20 }, { rng: 3, dur: 20, s: 'Target gains +1 to hit and +2 temporary hit points.' });
  C('chill touch', 2, { kind: 'dmg', dice: '1d6/2 levels (max 5d6)', dyn: 'chill', dtype: 'cold', drain: true }, { rng: 0, s: 'A cold, undead-caressing touch; drained hit points do not return by normal healing.' });
  C('find traps', 2, { kind: 'special', name: 'detectTraps' }, { rng: 2, dur: 5, s: 'Mechanical and magical snare-works within 10 feet glimmer.' });
  C('hold person', 2, { kind: 'hold' }, { rng: 5, s: 'One humanoids hangs motionless; save negates.' });
  C('know alignment', 2, { kind: 'special', name: 'knowAlignment' }, { rng: 3, s: 'The true heart of one creature is laid bare.' });
  C('resist fire', 2, { kind: 'buff', status: 'resfire', amt: 1, dur: 12 }, { rng: 0, dur: 12, s: 'Fire does half damage; a +2 bonus on fire saving throws.' });
  C('speak with animals', 2, { kind: 'special', name: 'tongues' }, { rng: 0, dur: 6, s: 'Beasts of one kind converse plainly for six rounds.' });
  C('spiritual hammer', 2, { kind: 'dmg', dice: '2d4', force: true }, { rng: 5, dur: 4, s: 'A ghostly mallet strikes unerringly once each round.' });
  C('sticks to snakes', 2, { kind: 'summon', monster: 'venomous_snake', n: 3, hostile: true }, { rng: 5, s: 'Up to six wooden or bone items writhe into constricting or venomous serpents.' });
  C('warm shield', 2, { kind: 'buff', status: 'warshield', amt: 1, dur: 12 }, { rng: 0, dur: 12, s: 'Your shield glows: +2 to AC and half cold damage.' });

  // level 3 (10)
  C('continual light', 3, { kind: 'special', name: 'light' }, { rng: 3, dur: 'permanent', s: 'Daylight radiance until dispelled.' });
  C('cure serious wounds', 3, { kind: 'heal', dice: '2d8' }, { rng: 0, s: 'Grievous flesh knits: 2d8 points restored.' });
  C('dispel magic', 3, { kind: 'special', name: 'dispel' }, { rng: 6, s: 'Undoes one magical working within range.' });
  C('glyph of warding', 3, { kind: 'special', name: 'explosiveRunes' }, { rng: 0, s: 'A hidden rune detonates with fire and thunder when read by the unworthy.' });
  C('locate object', 3, { kind: 'special', name: 'locateObject' }, { rng: 0, dur: 7, s: 'A known object tugs at your sense of direction.' });
  C('magical vestment', 3, { kind: 'buff', status: 'vestment', amt: 1, dur: 12 }, { rng: 0, dur: 12, s: 'Vestments harden like leather: +2 to AC.' })
  C('prayer', 3, { kind: 'buff', status: 'prayer', amt: 1, dur: 6 }, { rng: 5, area: 2, dur: 6, s: 'Allies +1 to all, enemies -1, in a wide area.' });
  C('speak with dead', 3, { kind: 'special', name: 'speakDead' }, { rng: 0, s: 'Ask three questions of the recently slain.' });
  C('summon insect', 3, { kind: 'summon', monster: 'random_insect', n: 1, hostile: true }, { rng: 6, dur: 5, s: 'Bidding flies, beetles or spiders answers the call.' });
  C('wrath of the faithful', 3, { kind: 'dmg', dice: '1d6/level (max 7d6)', dyn: 'wrath', dtype: 'holy', save: 'spell' }, { rng: 6, s: 'Heaven-fire scorches the undeserving. 1d6 per level, save for half.' });

  // level 4 (10)
  C('cure critical wounds', 4, { kind: 'heal', dice: '3d8' }, { rng: 0, s: '3d8 hit points restored.' });
  C('curse, great', 4, { kind: 'smite', status: 'curse', dur: 20, big: true }, { rng: 5, s: '-2 to hit, -4 to AC until atonement or dispelling.' });
  C('divination', 4, { kind: 'special', name: 'divination' }, { rng: 0, s: 'One plain answer about wood, stone, or metal within 30 yards.' });
  C('gauntlet', 4, { kind: 'special', name: 'steelShield' }, { rng: 0, dur: 2, s: 'Whirling blades defend the faithful for two rounds.' });
  C('neutralize poison', 4, { kind: 'special', name: 'neutralize' }, { rng: 0, s: 'Toxins wither from one creature or one cask.' });
  C('negative plane protection', 4, { kind: 'buff', status: 'negprot', amt: 1, dur: 12 }, { rng: 0, dur: 12, s: 'Shelters a touched ally from the drain of the undead.' });
  C('plant doors', 4, { kind: 'wall', wtype: 'stone' }, { rng: 3, dur: 12, s: 'Living wood seals like iron until opened by the caster.' });
  C('protection from evil, 10\' radius', 4, { kind: 'buff', status: 'protevil', amt: 1, dur: 12 }, { rng: 0, dur: 12, s: 'A circle repels evils: +2 AC and saves vs their attacks.' });
  C('giant vermin', 4, { kind: 'summon', monster: 'large_spider', n: 2, hostile: false, dur: 6 }, { rng: 6, dur: 6, s: 'Two great beasts of the web answer, obedient to their kind-caller.' });
  C('snake staff', 4, { kind: 'special', name: 'snakeStaff' }, { rng: 0, s: 'Your wooden staff becomes a serpent that strikes for you.' });

  // level 5 (10)
  C('air walk', 5, { kind: 'buff', status: 'airwalk', amt: 1, dur: 8 }, { rng: 3, dur: 8, s: 'One subject treads the air as air were a stair.' });
  C('auspicious answer', 5, { kind: 'special', name: 'commune' }, { rng: 0, s: 'Three truthful yes-or-no answers from the powers above.' });
  C('combat favor', 5, { kind: 'buff', status: 'combatbless', amt: 2, dur: 12 }, { rng: 3, dur: 12, s: '+2 to hit and damage for the chosen warrior.' });
  C('commune', 5, { kind: 'special', name: 'commune' }, { rng: 0, s: 'The beyond answers three questions truly.' });
  C('creation', 5, { kind: 'special', name: 'creation' }, { rng: 0, s: 'Bring forth stone, wood, or metal from nothing — it lasts a day.' });
  C('destructive wave', 5, { kind: 'dmg', dice: '5d6', dtype: 'holy', save: 'spell' }, { rng: 0, area: 1, s: 'Holy fury bursts outward, 5d6, save for half.' });
  C('flame strike', 5, { kind: 'dmg', dice: '8d6 (half fire, half holy)', dtype: 'fire', save: 'breath' }, { rng: 6, area: 1, s: 'A vertical column of heavenly fire, 8d6; breath save for half.' });
  C('insect plague', 5, { kind: 'cloud', ctype: 'insects' }, { rng: 8, area: 2, dur: 8, s: 'A crawling cloud of biting and stinging things; 1d6 each round.' });
  C('plant growth', 5, { kind: 'special', name: 'plantGrowth' }, { rng: 6, area: 2, s: 'Thickets choke and harden; movement through the area halves.' });
  C('true seeing', 5, { kind: 'special', name: 'trueSight' }, { rng: 0, dur: 3, s: 'See all things within 30 feet as they truly are.' });

  // level 6 (9)
  C('cure wounds, light -> mass', 6, { kind: 'heal', dice: '1d8+1', mass: 6 }, { rng: 4, area: 2, s: 'Every ally in a wide area is healed of 1d8+1.' });
  C('find the path', 6, { kind: 'special', name: 'findPath' }, { rng: 3, dur: 6, s: 'Mazes and tangles unravel before the faithful.' });
  C('forbid action', 6, { kind: 'special', name: 'forbid' }, { rng: 4, s: 'A creature cannot perform one named act while you watch.' });
  C('giant form', 6, { kind: 'buff', status: 'giantform', amt: 1, dur: 8 }, { rng: 0, dur: 8, s: 'Become a fire, frost, stone, or hill giant of your faith; strikes as a huge foe.' });
  C('holy word', 6, { kind: 'special', name: 'holyWord' }, { rng: 3, area: 1, s: 'Extraterrestrials slain or banished, the evil stunned, undead destroyed.' });
  C('reincarnation', 6, { kind: 'special', name: 'reincarnate' }, { rng: 0, s: 'A slain ally is reborn in a new shape given by the land.' });
  C('slash of the faithful', 6, { kind: 'dmg', dice: '2d6+2/level', dyn: 'slash', dtype: 'holy' }, { rng: 0, s: 'Your weapon blazes: next blow adds 2d6+2 per level (max 5).' });
  C('sunfire', 6, { kind: 'dmg', dice: '3d6', dtype: 'holy', save: 'spell', undead: 1.5 }, { rng: 5, area: 2, s: 'Unhallowed flesh blisters under sudden noon-light; undead suffer double.' });
  C('turn of the tide', 6, { kind: 'special', name: 'dispel', mass: true }, { rng: 5, s: 'All spells cast upon your allies within sight unravel.' });

  // level 7 (9)
  C('astral spirit', 7, { kind: 'special', name: 'astral' }, { rng: 0, dur: 'special', s: 'Your spirit walks the Star Road; the body waits, breathing.' });
  C('earthquake', 7, { kind: 'special', name: 'earthquake' }, { rng: 4, s: 'The ground gapes; walls topple and the unwary fall.' });
  C('holy transformation', 7, { kind: 'buff', status: 'holy', amt: 1, dur: 5 }, { rng: 0, dur: 5, s: 'The gods lend you their arm: +2 to hit and +10 damage.' });
  C('implore', 7, { kind: 'special', name: 'wish', mild: true }, { rng: 0, s: 'A humbled request: a single modest miracle.' });
  C('legal vision', 7, { kind: 'special', name: 'trueSight' }, { rng: 3, dur: 12, s: 'Lies, charms and shapes cannot cloud the sight of the just.' });
  C('regenerate', 7, { kind: 'buff', status: 'regen', amt: 1, dur: 12 }, { rng: 0, dur: 12, s: 'Flesh regrows; 1 hit point regained each round for 12 rounds.' });
  C('resurrection', 7, { kind: 'special', name: 'resurrect' }, { rng: 0, s: 'Death itself yields, though the slain lose a life-force (level).' });
  C('revivify', 7, { kind: 'special', name: 'raise' }, { rng: 0, s: 'One recently slain ally returns with strength restored.' });
  C('thurmaturgy', 7, { kind: 'special', name: 'creation', big: true }, { rng: 0, s: 'Mighty material wonders: stone walls, whole ships, gold from gravel (briefly).' });

  // ================================================================ ITEMS
  const I = (key, name, cat, cost, wt, extra) => {
    const it = Object.assign({ key, name, cat, cost, wt }, extra || {});
    EF.Items[key] = it;
    return it;
  };

  // ---- weapons  (dmg strings 'a/b' = small vs large; rng yards; size S/M/L/P=pierce)
  const wp = (key, name, cost, wt, dmg, o) => I(key, name, 'weapon', cost, wt, Object.assign({ dmg, prof: true }, o));
  wp('w_dagger', 'Dagger', 2, 1, '1d6/1d4', { size: 'P', speed: 2, hand: 1 });
  wp('w_dart', 'Dart', 1, 1, '1d4/1d3', { size: 'P', speed: 3, missile: { rng: 1 }, ammo: true });
  wp('w_knife', 'Besaq Knife', 3, 2, '1d5/1d4', { size: 'P', speed: 2, hand: 1 });
  wp('w_hatchet', 'Hatchet', 3, 2, '1d6/1d5', { size: 'S', speed: 3, hand: 1, thrown: { rng: 2 } });
  wp('w_mace', 'Mace', 5, 5, '1d6/1d6+1', { size: 'B', speed: 4, hand: 1 });
  wp('w_hammer_light', 'Light Warhammer', 4, 5, '1d6/1d6', { size: 'B', speed: 4, hand: 1 });
  wp('w_sling', 'Sling', 1, 1, '1d4/1d5', { size: 'B', speed: 4, missile: { rng: 6 }, ammo: 'bullets', strBonus: true });
  wp('w_staff', 'Cudgel Staff', 3, 8, '1d6/1d6', { size: 'B', speed: 4, hand: 2 });
  wp('w_spear', 'Spear', 2, 5, '1d6/1d8', { size: 'P', speed: 5, hand: 1, thrown: { rng: 3 }, long: true, set: true });
  wp('w_axe', 'Hand Axe', 6, 4, '1d6/1d8', { size: 'S', speed: 3, hand: 1, thrown: { rng: 2 } });
  wp('w_flail', 'Footman\u2019s Flail', 4, 7, '1d6+1/2d4', { size: 'B', speed: 5, hand: 1 });
  wp('w_warhammer', 'War Hammer', 5, 12, '2d4/2d4+1', { size: 'B', speed: 5, hand: 1 });
  wp('w_morningstar', 'Morning Star', 12, 12, '2d4+1/2d4+2', { size: 'B', speed: 6, hand: 1 });
  wp('w_pick_light', 'Light Pick', 8, 6, '1d6+1/2d4+1', { size: 'P', speed: 3, hand: 1 });
  wp('w_rapier', 'Long Rapier', 50, 4, '1d6/2d4', { size: 'P', speed: 3, hand: 1 });
  wp('w_scimitar', 'Scimitar', 15, 4, '1d6+1/2d4', { size: 'S', speed: 4, hand: 1 });
  wp('w_short_sword', 'Short Sword', 10, 3, '1d6/1d8', { size: 'S', speed: 3, hand: 1 });
  wp('w_battle_axe', 'Battle Axe', 7, 8, '1d8/1d12', { size: 'S', speed: 6, hand: 1 });
  wp('w_flail_heavy', 'Heavy Flail', 15, 15, '2d4+2/3d4', { size: 'B', speed: 6, hand: 1 });
  wp('w_halberd', 'Halberd', 10, 15, '1d10/1d10+1', { size: 'P', speed: 7, hand: 2, long: true, set: true });
  wp('w_lance', 'Light Lance', 20, 12, '1d8/3d6', { size: 'P', speed: 13, hand: 2, set: true });
  wp('w_long_sword', 'Long Sword', 15, 4, '1d8/1d12', { size: 'S', speed: 5, hand: 1 });
  wp('w_mace_heavy', 'Heavy Mace', 12, 10, '2d4+1/3d4', { size: 'B', speed: 5, hand: 1 });
  wp('w_maul', 'Maul', 10, 15, '2d4+2/3d4+1', { size: 'B', speed: 7, hand: 2 });
  wp('w_oil_hammer', 'Hearth Hammer', 5, 10, '1d6/1d6', { size: 'B', speed: 4, hand: 1 });
  wp('w_pike', 'Pike', 8, 20, '1d10/3d4', { size: 'P', speed: 13, hand: 2, long: true, set: true });
  wp('w_pick_heavy', 'Heavy Pick', 16, 12, '2d4+2/4d4', { size: 'P', speed: 5, hand: 1 });
  wp('w_quarterstaff', 'Quarterstaff', 1, 8, '1d6+1/1d6+2', { size: 'B', speed: 4, hand: 2 });
  wp('w_two_sword', 'Two-Handed Sword', 50, 15, '1d10+1/3d4', { size: 'S', speed: 8, hand: 2 });
  wp('w_two_axe', 'Two-Handed Axe', 30, 15, '1d10/2d6+1', { size: 'S', speed: 8, hand: 2 });
  wp('w_bastard', 'Bastard Sword', 35, 10, '1d10+1/2d8+1', { size: 'S', speed: 7, hand: 2 });
  wp('w_claymore', 'Emberfell Claymore', 60, 12, '2d6/3d6', { size: 'S', speed: 7, hand: 2 });
  wp('w_bow_short', 'Short Bow', 30, 3, '1d6/1d8', { size: 'M', speed: 3, missile: { rng: 7 }, strBonus: true, ammo: 'arrows' });
  wp('w_bow_long', 'Long Bow', 60, 5, '1d8/1d10', { size: 'M', speed: 5, missile: { rng: 10 }, strBonus: true, ammo: 'arrows' });
  wp('w_crossbow_light', 'Light Crossbow', 35, 7, '1d8/1d10', { size: 'M', speed: 5, missile: { rng: 8 }, ammo: 'bolts' });
  wp('w_crossbow_heavy', 'Heavy Crossbow', 50, 12, '2d4+1/2d4+2', { size: 'M', speed: 7, missile: { rng: 11 }, ammo: 'bolts', strBonus: true });
  wp('w_bow_composite', 'Horn Composite Bow', 75, 4, '1d7/1d9', { size: 'M', speed: 4, missile: { rng: 8 }, strBonus: true, ammo: 'arrows' });
  wp('w_throwing_axe', 'Beaked Throwing Axe', 12, 4, '1d6/2d4', { size: 'S', speed: 3, thrown: { rng: 3 } });
  wp('w_net', 'Cast Net', 3, 5, '—', { size: 'M', speed: 4, thrown: { rng: 1 }, special: 'net' });
  wp('w_whip', 'Barbed Whip', 15, 4, '1d2/1d3', { size: 'S', speed: 5, hand: 1, reach: true });
  wp('w_bolas', 'Bolas', 5, 2, '1d4/1d4', { size: 'B', speed: 4, thrown: { rng: 2 }, special: 'net' });

  // ---- special/melee magic weapons handled as generic +X in items below; a few named:
  I('w_sunblade', 'Sunblade', 'weapon', 8000, 3, { dmg: '1d8+2/2d6+2', size: 'S', speed: 4, hand: 1, bonus: 2, holy: true, glow: true, note: 'Glows as torchlight in the presence of the undead.' });
  I('w_thornbite', 'Thornbite', 'weapon', 4000, 4, { dmg: '1d6+1/1d8+1', size: 'P', speed: 3, hand: 1, bonus: 2, note: 'A longsword of the old wardens; +3 vs shapechangers.' });

  // ---- armour & shields (AC improves as value falls)
  const ar = (key, name, cost, wt, ac, o) => I(key, name, 'armor', cost, wt, Object.assign({ ac }, o));
  ar('a_leather', 'Soft Leather', 5, 15, 9, { maxDex: 5 });
  ar('a_studded', 'Studded Leather', 20, 25, 8, { maxDex: 4 });
  ar('a_hide', 'Layered Hide', 15, 25, 8, { maxDex: 3 });
  ar('a_padded', 'Padded Jack', 4, 10, 9, { maxDex: 4 });
  ar('a_ring', 'Ring Mail', 30, 30, 8, { maxDex: 3 });
  ar('a_chain', 'Chain Shirt', 30, 40, 6, { maxDex: 3 });
  ar('a_banded', 'Banded Mail', 75, 50, 5, { maxDex: 2 });
  ar('a_splint', 'Splint Mail', 80, 60, 4, { maxDex: 1 });
  ar('a_plate', 'Field Plate', 200, 70, 3, { maxDex: 1 });
  ar('a_full', 'Full Emberguard', 600, 80, 2, { maxDex: 0 });
  ar('a_robe_magi', 'Robe of the Arcane', 2500, 7, 5, { mageOnly: true, maxDex: 2, note: 'Light wizardry-woven silk; counts as armour without hampering spellwork.' });
  ar('a_brigandine', 'Brigandine', 120, 45, 6, { maxDex: 2 });
  I('a_shield_sm', 'Small Wooden Shield', 3, 7, { shield: true, acBonus: 1 });
  I('a_shield_lg', 'Great Tower Shield', 10, 15, { shield: true, acBonus: 2, heavy: true });
  I('a_helmet', 'Kettle Helm', 4, 3, { helmet: true, acBonus: 1 });
  I('a_gauntlets', 'Iron Gauntlets', 3, 2, { gauntlets: true, acBonus: 1 });

  // ---- mundane gear
  const g = (key, name, cost, wt) => I(key, name, 'gear', cost, wt);
  g('g_torch', 'Torch', 1, 1); g('g_lantern', 'Horn Lantern', 8, 3); g('g_oil', 'Flask of Lamp Oil', 1, 2);
  g('g_rations', 'Iron Rations (3 days)', 3, 2); g('g_water', 'Waterskin', 1, 2);
  g('g_rope50', 'Hempen Rope, 50 ft', 1, 6); g('g_silkrope', 'Silken Rope, 50 ft', 125, 4);
  g('g_spike', 'Iron Spike', 1, 1); g('g_hammer', 'Tinker Hammer', 2, 3); g('g_crowbar', 'Crowbar', 2, 5);
  g('g_mirror', 'Steel Mirror', 10, 1); g('g_holy', 'Holy Symbol (silver)', 25, 1);
  g('g_emberstone', 'Emberstone of the Hearthfather', 50, 1); g('g_bag', 'Belt Pouch', 1, 1);
  g('g_backpack', 'Backpack', 2, 2); g('g_bedroll', 'Bedroll', 1, 5); g('g_tent', 'Ranger Tent', 10, 20);
  g('g_ironpit', 'Iron Pitons', 1, 2); g('g_climbing', 'Climbing Claws', 20, 2);
  g('g_thieves', 'Thieves\u2019 Picks', 30, 1); g('g_mirrorglass', 'Signal Glass', 40, 1);
  g('g_manacles', 'Iron Manacles', 3, 4); g('g_rep', 'Chalk & Charcoal Kit', 2, 1);
  g('g_herbkit', 'Hearth-herb Kit', 15, 3); g('g_incense', 'Temple Incense', 5, 1);
  g('g_blanket', 'Wool Blanket', 2, 3); g('g_flint', 'Flint & Ember Box', 1, 1);
  g('g_ammo_arrows', 'Arrows (20)', 1, 5); g('g_ammo_bolts', 'Crossbow Bolts (20)', 2, 6);
  g('g_ammo_bullets', 'Sling Bullets (20)', 1, 5);
  I('g_horse', 'Riding Pony (led, not carried)', 75, 0, { mount: true });
  I('g_pardon', 'Bishop\u2019s Pardon', 500, 0, { note: 'One lawful transgression forgiven.' });

  // ---- potions & oils  (fx applied on quaff/smeared)
  const pot = (key, name, cost, fx, s) => I(key, name, 'potion', cost, 1, { fx, s });
  pot('p_clw', 'Potion of Cure Light Wounds', 100, { kind: 'heal', dice: '1d8+1' });
  pot('p_csw', 'Potion of Cure Serious Wounds', 300, { kind: 'heal', dice: '3d8' });
  pot('p_ccw', 'Potion of Cure Critical Wounds', 600, { kind: 'heal', dice: '5d8' });
  pot('p_heal', 'Potion of Vigorous Healing', 1200, { kind: 'heal', dice: '6d8+3' });
  pot('p_superior', 'Elixir of Superior Healing', 2400, { kind: 'heal', dice: '8d8+6', full: true });
  pot('p_raised', 'Draught of Raised Strength', 1500, { kind: 'special', name: 'potStat', stat: 'str', amt: 1 });
  pot('p_giant', 'Draught of Hill Giant Strength', 2000, { kind: 'special', name: 'potGiant' });
  pot('p_heroism', 'Draught of Heroism', 750, { kind: 'buff', status: 'heroism', amt: 1, dur: 12 });
  pot('p_invis', 'Potion of Invisibility', 350, { kind: 'invis' });
  pot('p_flight', 'Draught of Feather Flight', 750, { kind: 'buff', status: 'fly', amt: 1, dur: 12 });
  pot('p_speed', 'Draught of Haste', 750, { kind: 'haste' });
  pot('p_resist', 'Potion of Fire Breath', 500, { kind: 'special', name: 'potFireBreath' });
  pot('p_water', 'Draught of Water Breathing', 400, { kind: 'buff', status: 'waterbreath', amt: 1, dur: 60 });
  pot('p_black', 'Potion of Cloudy Dreaming (sleep)', 150, { kind: 'sleep', dice: '4d4', friend: true });
  pot('p_esca', 'Draught of Escape', 600, { kind: 'special', name: 'teleport' });
  pot('p_clarity', 'Draught of Mind Clarity (remove curse)', 600, { kind: 'special', name: 'lesserRestoration' });
  pot('p_vitality', 'Draught of Vitality (heal ability drain)', 900, { kind: 'special', name: 'lesserRestoration' });
  pot('p_explosion', 'Flask of Alchemist\u2019s Thunder', 150, { kind: 'dmg', dice: '2d6', dtype: 'fire', save: 'breath', area: 1, thrown: true });
  pot('p_acid', 'Vial of Rendering Acid', 120, { kind: 'dmg', dice: '2d4', dtype: 'acid', thrown: true, area: 0 });
  I('o_sharpen', 'Oil of Sharpness (+1 weapon, 12 turns)', 150, 1, { kind: 'buff', status: 'sharp', amt: 1, dur: 12, oil: true });
  I('o_slip', 'Oil of Slipiness', 100, 1, { oil: true, note: 'A floor made treacherous; saves vs breath or prone.' });

  // ---- scrolls (spell scrolls generated below); misc scroll items:
  I('s_map', 'Cartographer\u2019s Animated Scroll', 500, 1, { note: 'Maps each floor walked upon; the ink moves.' });
  I('s_absolve', 'Scroll of Absolution', 1200, 1, { fx: { kind: 'special', name: 'removeCurse' } });
  I('s_gate', 'Scroll of the Open Way', 2500, 1, { fx: { kind: 'special', name: 'knock' } });
  I('s_recalling', 'Scroll of Memory\u2019s Return', 1500, 1, { fx: { kind: 'special', name: 'restoreLevel' } });
  I('s_summon_bane', 'Scroll of the Banished Name', 3000, 1, { fx: { kind: 'special', name: 'banishment' } });

  // ---- wands (charges)
  const wand = (key, name, cost, charges, fx) => I(key, name, 'wand', cost, 2, { charges, maxCharges: charges, fx, command: 'A command word wakes the wand.' });
  wand('wd_mmagic', 'Wand of Magic Missiles', 3500, 50, { kind: 'missile', dice: 1, each: 2 });
  wand('wd_fire', 'Wand of Fireballs', 7500, 50, { kind: 'dmg', dice: '6d6', dtype: 'fire', save: 'breath', area: 2 });
  wand('wd_lightning', 'Wand of Lightning', 6000, 50, { kind: 'dmg', dice: '7d6', dtype: 'electric', save: 'breath', line: true });
  wand('wd_cold', 'Wand of Frost', 6000, 50, { kind: 'cone', dice: '6d6', dtype: 'cold', save: 'breath' });
  wand('wd_slow', 'Wand of Sloth', 6500, 50, { kind: 'slow' });
  wand('wd_light', 'Wand of Steady Light', 500, 50, { kind: 'special', name: 'light' });
  wand('wd_death', 'Wand of Withering', 12500, 25, { kind: 'dmg', dice: '6d6+6', dtype: 'necro', save: 'spell' });
  wand('wd_paralysis', 'Wand of Rigid Stone (flesh to stone)', 9000, 25, { kind: 'petrify' });
  wand('wd_polymorph', 'Wand of Changing Plumes', 8500, 25, { kind: 'special', name: 'polymorphOther' });
  wand('wd_web', 'Wand of Spinning Dark', 4000, 40, { kind: 'web' });
  wand('wd_sleep', 'Wand of Quietude', 4500, 40, { kind: 'sleep', dice: '5d4' });
  wand('wd_burning', 'Wand of Endless Embers', 5500, 50, { kind: 'dmg', dice: '4d6', dtype: 'fire', save: 'breath' });
  wand('wd_held', 'Wand of Binding Words', 7000, 25, { kind: 'hold' });
  wand('wd_cancellation', 'Wand of Cancellation', 5000, 25, { kind: 'special', name: 'dispel' });
  wand('wd_secrets', 'Wand of Hidden Ways', 3000, 25, { kind: 'special', name: 'detectSecrets' });
  wand('wd_warding', 'Wand of Hearth-Warding', 4000, 25, { kind: 'buff', status: 'protevil', amt: 1, dur: 12 });
  wand('wd_lightning_orb', 'Wand of the Ball Lightning', 8000, 50, { kind: 'dmg', dice: '8d6', dtype: 'electric', save: 'breath', area: 1 });
  wand('wd_ice_storm', 'Wand of White Hail', 7000, 50, { kind: 'dmg', dice: '4d6', dtype: 'cold', save: 'breath', area: 2 });
  wand('wd_healing', 'Wand of Mending Hands', 3000, 25, { kind: 'heal', dice: '2d8' });
  wand('wd_flame_ward', 'Wand of the Fiery Wall', 6000, 25, { kind: 'wall', wtype: 'fire' });

  // ---- rings
  const ring = (key, name, cost, o) => I(key, name, 'ring', cost, 0, o);
  ring('r_protection1', 'Ring of Protection +1', 2000, { passive: { ac: 1 } });
  ring('r_protection2', 'Ring of Protection +2', 8000, { passive: { ac: 2 } });
  ring('r_protection3', 'Ring of Protection +3', 20000, { passive: { ac: 3 } });
  ring('r_shielding', 'Ring of the Sheltered Heart', 12000, { passive: { saveAll: 2 } });
  ring('r_fireresist', 'Ring of Ember-Repulsion', 8500, { passive: { resistFire: true } });
  ring('r_freeresist', 'Ring of Winter Blood', 8500, { passive: { resistCold: true } });
  ring('r_invisibility', 'Ring of Vanished Footfalls', 12000, { use: { kind: 'invis' }, charges: -1 });
  ring('r_feather', 'Ring of the Feather Step', 3000, { passive: { feather: true } });
  ring('r_water', 'Ring of Gilled Throats', 6000, { passive: { waterbreath: true } });
  ring('r_xray', 'Ring of True-Sight (one use/day)', 10000, { use: { kind: 'special', name: 'trueSight' }, perDay: 1 });
  ring('r_regeneration', 'Ring of the Living Bark', 12000, { passive: { regen: 1 } });
  ring('r_freeaction', 'Ring of Unbound Limbs', 10000, { passive: { free: true } });
  ring('r_warning', 'Ring of the Sleepless Watch', 4000, { passive: { noSurprise: true } });
  ring('r_strength', 'Ring of the Iron Grip', 9000, { passive: { str: 1 } });
  ring('r_charm', 'Ring of Winning Graces', 8000, { passive: { cha: 2 } });
  ring('r_cloaking', 'Ring of the Dusk-Stepper', 15000, { use: { kind: 'special', name: 'teleport', short: true }, perDay: 3 });
  ring('r_spell_store', 'Ring of the Sealed Verse', 14000, { passive: { storeSpell: true } });
  ring('r_finance', 'Ring of Coin-Counting', 2500, { passive: { appraise: true } });

  // ---- rods
  const rod = (key, name, cost, o) => I(key, name, 'rod', cost, 5, o);
  rod('rd_smalling', 'Rod of Smallings', 4000, { charges: 50, maxCharges: 50, use: { kind: 'special', name: 'enlarge', shrink: true } });
  rod('rd_absorption', 'Rod of Spell-Swallowing', 16000, { charges: 50, maxCharges: 50, use: { kind: 'special', name: 'absorb' } });
  rod('rd_cancellation', 'Rod of Annulment', 11000, { charges: 25, maxCharges: 25, use: { kind: 'special', name: 'dispel', auto: true } });
  rod('rd_negation', 'Rod of Negation (undead)', 10000, { charges: 25, maxCharges: 25, use: { kind: 'special', name: 'turnUndead' } });
  rod('rd_promotion', 'Rod of Exalted Worth', 25000, { use: { kind: 'special', name: 'promotion' } });
  rod('rd_prismatic', 'Rod of the Seven Veils', 30000, { charges: 25, maxCharges: 25, use: { kind: 'special', name: 'prismatic' } });

  // ---- staves
  const st = (key, name, cost, o) => I(key, name, 'staff', cost, 8, o);
  st('st_swarming_insects', 'Staff of Writhing Legions', 9500, { charges: 50, maxCharges: 50, use: { kind: 'summon', monster: 'random_insect', n: 3, hostile: true, dur: 4 } });
  st('st_fire', 'Staff of Embers', 12500, { charges: 50, maxCharges: 50, use: { kind: 'dmg', dice: '6d6', dtype: 'fire', save: 'breath', area: 1 } });
  st('st_frost', 'Staff of the Long Winter', 12500, { charges: 50, maxCharges: 50, use: { kind: 'cone', dice: '6d6', dtype: 'cold', save: 'breath' } });
  st('st_healing', 'Bough of regrowth (staff of healing)', 8500, { charges: 25, maxCharges: 25, use: { kind: 'heal', dice: '4d8' } });
  st('st_power', 'Staff of the Thorned Crown', 27500, { charges: 50, maxCharges: 50, use: { kind: 'special', name: 'staffPower' } });
  st('st_wood', 'Greenwood Staff (str+2 while held)', 7000, { passive: { str: 2, asWeapon: { dmg: '1d6+2/2d4', size: 'B', speed: 4 } } });
  st('st_sw', 'Staff of Beasts\u2019 Tongue', 6500, { charges: 20, maxCharges: 20, use: { kind: 'special', name: 'tongues' } });
  st('st_absorb', 'Staff of Reprisal', 15000, { charges: 50, maxCharges: 50, use: { kind: 'special', name: 'absorb' } });
  st('st_thunder', 'Rodlik\u2019s Speaking-Staff (lightning)', 11000, { charges: 50, maxCharges: 50, use: { kind: 'dmg', dice: '7d6', dtype: 'electric', save: 'breath', line: true } });
  st('st_command', 'Staff of Bonded Service', 13000, { charges: 30, maxCharges: 30, use: { kind: 'special', name: 'command', mass: true } });

  // ---- misc magic
  const mm = (key, name, cost, o) => I(key, name, 'misc', cost, o && o.wt != null ? o.wt : 3, o);
  mm('m_bag_eating', 'Bag of Holding (never overfills)', 2000, { wt: 2, passive: { bagOfHolding: true } });
  mm('m_cloak_elven', 'Elven Cape of the Green Glade', 3000, { passive: { hide: 15, saveSurprise: -2 } });
  mm('m_boots_speed', 'Boots of Swift Marching', 2500, { passive: { move: 3 } });
  mm('m_boots_rock', 'Boots through Rock and Root', 7500, { passive: { passwall: true }, charges: 3, maxCharges: 3 });
  mm('m_girdle_hp', 'Girdle of Second Wind', 2200, { passive: { tempHp: 10 } });
  mm('m_gloves_thief', 'Gloves of the Silent Hand', 4000, { passive: { thief: { openLocks: 10, findRemoveTraps: 10 } } });
  mm('m_horn_fog', 'Horn of Rolling Grey', 3500, { charges: 3, maxCharges: 3, use: { kind: 'cloud', ctype: 'fog' } });
  mm('m_horse_figure', 'Chessman of the Phantom Destrier', 8000, { wt: 1, use: { kind: 'special', name: 'findSteading', trueForm: true } });
  mm('m_idol', 'Weeping Idol of Saint Cerena', 5000, { use: { kind: 'heal', dice: '3d8' }, perDay: 1 });
  mm('m_lantern_revealing', 'Lantern of Revealing', 30000, { passive: { lightReveal: true }, wt: 5 });
  mm('m_gauntlet_ogre', 'Gauntlets of Ogre Prowess', 14000, { passive: { strSet18_00: true } });
  mm('m_amulet_natural', 'Amulet of Natural Armor', 1800, { passive: { ac: 1 } });
  mm('m_amulet_health', 'Amulet of Life\u2019s Reserves', 7000, { passive: { con: 2 } });
  mm('m_belt_dexterity', 'Belt of Silken Twisting', 5000, { passive: { dex: 2 } });
  mm('m_circlet_int', 'Circlet of Clear Fire', 4500, { passive: { int: 2 } });
  mm('m_ioun_hot', 'Ioun Stone of Smoldering Thought', 9000, { wt: 1, passive: { int: 1, fireBolt: '1d6' } });
  mm('m_kit_mending', 'Alchemist\u2019s Mending Kit', 120, { wt: 4, use: { kind: 'special', name: 'mug' } });
  mm('m_navel', 'The Hearthfather\u2019s Navel Stone (relic)', 0, { wt: 12, note: 'A cathedral relic. It wants to go home.' });
  mm('m_crown_thorn', 'Crown of Thornmoor (cursed: cannot remove, -2 cha)', 0, { cursed: true, passive: { cha: -2, undeathServant: true } });
  mm('m_medallion', 'Medallion of Ascension (light as featherfall)', 4500, { passive: { feather: true, light: true } });
  mm('m_chalice', 'Chalice of Morning Dew', 3200, { wt: 2, use: { kind: 'special', name: 'createWater' }, perDay: 3 });
  mm('m_lute', 'Lute of Waking Passions', 4500, { wt: 4, use: { kind: 'special', name: 'charm', mass: true } });
  mm('m_statue_servant', 'Miniature Stone Seneschal', 6000, { wt: 3, use: { kind: 'special', name: 'servant' } });
  mm('m_oil_lamp_et', 'Everburning Hearth-lamp', 1800, { wt: 4, passive: { light: true } });

  // ---- treasure goods (registered by treasure.js tables; a few here for shops)
  I('gold_coins', 'Gold Pieces', 1, 0, { coins: true });
  I('silver_coins', 'Silver Pieces', 1, 0, { coins: true, silver: true });
  I('gems_batch', 'Gem Pouch (assorted)', 0, 0, { gems: true });
  I('jewelry_batch', 'Jewellery Chest', 0, 0, { jewels: true });
  I('artwork_batch', 'Artwork Crate', 0, 0, { art: true });

  // ---- arrows etc ammo
  I('quiver_arrows', 'Silver-tipped Arrows (12)', 120, 3, { ammoBonus: 1 });

  // ================================================================ scroll items from spells
  for (const sp of Object.values(EF.Spells)) {
    const key = 'scroll_' + sp.id;
    const base = sp.lvl * sp.lvl * 100 + 100;
    I(key, 'Scroll: ' + sp.name, 'scroll', base, 1, {
      spell: sp.id, spellLevel: sp.lvl, priest: sp.sch === 'p',
      note: sp.sch === 'p' ? 'A prayer-leaf; priests read it directly, mages cannot scribe it.' : 'A mage may study this to add the spell to the spellbook (one-time); anyone may attempt to cast it.'
    });
  }

  EF.SPELL_COUNT_W = Object.values(EF.Spells).filter(s => s.sch === 'w').length;
  EF.SPELL_COUNT_P = Object.values(EF.Spells).filter(s => s.sch === 'p').length;

  // Shop stock by level band (0: levels 1-2 ... 4: 12-20)
  EF.SHOP_STOCK = {
    mundane: ['g_torch', 'g_lantern', 'g_oil', 'g_rations', 'g_water', 'g_rope50', 'g_spike', 'g_hammer', 'g_crowbar', 'g_mirror', 'g_bag', 'g_backpack', 'g_bedroll', 'g_tent', 'g_thieves', 'g_holy', 'g_flint', 'g_ammo_arrows', 'g_ammo_bolts', 'g_ammo_bullets', 'g_herbkit', 'g_blanket', 'g_rep', 'g_ironpit', 'g_climbing', 'g_manacles', 'g_incense', 'g_silkrope', 'g_mirrorglass', 'g_pardon', 'g_horse', 'quiver_arrows'],
    weapons: ['w_dagger', 'w_dart', 'w_knife', 'w_hatchet', 'w_mace', 'w_hammer_light', 'w_sling', 'w_staff', 'w_spear', 'w_axe', 'w_rapier', 'w_short_sword', 'w_scimitar', 'w_battle_axe', 'w_warhammer', 'w_flail', 'w_morningstar', 'w_pick_light', 'w_lance', 'w_long_sword', 'w_mace_heavy', 'w_maul', 'w_pike', 'w_pick_heavy', 'w_quarterstaff', 'w_halberd', 'w_bastard', 'w_two_sword', 'w_two_axe', 'w_claymore', 'w_bow_short', 'w_bow_long', 'w_bow_composite', 'w_crossbow_light', 'w_crossbow_heavy', 'w_throwing_axe', 'w_whip', 'w_net', 'w_bolas', 'w_sunblade', 'w_thornbite'],
    armor: ['a_padded', 'a_leather', 'a_hide', 'a_studded', 'a_ring', 'a_chain', 'a_brigandine', 'a_banded', 'a_splint', 'a_plate', 'a_full', 'a_robe_magi', 'a_shield_sm', 'a_shield_lg', 'a_helmet', 'a_gauntlets'],
    bands: [
      ['p_clw', 'p_black', 'o_sharpen', 'p_explosion'],
      ['p_clw', 'p_csw', 'p_invis', 'p_heroism', 'p_esca', 'o_slip', 'p_acid', 'wd_light', 'wd_secrets', 'r_protection1', 'm_amulet_natural', 'm_bag_eating', 'm_cloak_elven', 'm_boots_speed', 's_gate'],
      ['p_csw', 'p_ccw', 'p_speed', 'p_flight', 'p_raised', 'wd_mmagic', 'wd_burning', 'wd_sleep', 'wd_slow', 'r_protection2', 'r_feather', 'r_warning', 'm_gloves_thief', 'm_girdle_hp', 'm_chalice', 'm_lute', 's_absolve'],
      ['p_ccw', 'p_heal', 'p_giant', 'p_resist', 'p_clarity', 'wd_fire', 'wd_lightning', 'wd_cold', 'wd_web', 'wd_held', 'wd_healing', 'r_shielding', 'r_fireresist', 'r_freeresist', 'r_strength', 'r_water', 'r_invisibility', 'm_boots_rock', 'm_horn_fog', 'm_idol', 'st_sw', 'st_healing', 'rd_cancellation'],
      ['p_heal', 'p_superior', 'p_vitality', 'wd_death', 'wd_paralysis', 'wd_polymorph', 'wd_flame_ward', 'wd_ice_storm', 'wd_lightning_orb', 'wd_warding', 'wd_cancellation', 'r_protection3', 'r_xray', 'r_regeneration', 'r_freeaction', 'r_charm', 'r_cloaking', 'r_spell_store', 'r_finance', 'm_gauntlet_ogre', 'm_amulet_health', 'm_belt_dexterity', 'm_circlet_int', 'm_ioun_hot', 'm_lantern_revealing', 'm_horse_figure', 'm_statue_servant', 'm_oil_lamp_et', 'st_fire', 'st_frost', 'st_power', 'st_wood', 'st_command', 'st_absorb', 'st_swarming_insects', 'st_thunder', 'rd_smalling', 'rd_absorption', 'rd_negation', 'rd_promotion', 'rd_prismatic', 's_recalling', 's_summon_bane', 's_map']
    ]
  };

  EF.itemCount = () => Object.keys(EF.Items).length;
})();
