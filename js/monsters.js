/* Emberfall — monsters.js
 * The bestiary of the Emberwild. Every entry original prose; classic creature
 * archetypes rendered in new words. Compact row syntax expanded into
 * EF.Monsters, then variant families are generated deterministically.
 *
 * Row: [name, hd, ac, move, attacks, align, size, morale, treasure, specials, look]
 *  hd        '2+2' or '1-1' (Hit Dice, +mod/-mod); 0 possible for tiny things
 *  attacks   melee damage spec or 'bite 1d8, claw 1d4'; '—' none
 *  specials  |-separated tokens read by combat.js (unknown tokens are flagged by validators)
 * Known specials: undead:<type> construct outer shapechanger swarm constrict poison
 *  poison:dmg poison:par poison:die poison:slay parasitize drain:<n> regen:<n>
 *  breath:<type>,<dice>,<shape> invisible incorporeal truesee web jet dust Petrify gaze
 *  needmagical(=+1 weapons only) need+2 need+3 need+4 no-weapons(immunity list)
 *  pack(+1 to hit in groups of 4+) sneak(-4 to AC if it wins surprise) pounce
 *  trample whirl spores stink fear goodarmour(uses armour like fighters) turnable?
 *  missile ranged:<n> amp? eggs morn:<n> xp:<n> cast:<class+n> hi5? (attacks 5+/rnd)
 *  immune:<list> resist:<list> achg:<n> (size of huge breath) inf:2 (infravision)
 */
(function () {
  const EF = (globalThis.EF = globalThis.EF || {});
  const M = {};

  const ALIGN = { LG: 1, NG: 1, CG: 1, LN: 1, N: 1, CN: 1, LE: 1, NE: 1, CE: 1 };
  const SIZE_ORDER = { T: 1, S: 2, M: 3, L: 4, H: 5, G: 6 };

  function hdOf(hd) {
    const m = /^(\d+)([+-](\d+))?$/.exec(String(hd).trim());
    const n = m ? +m[1] : 1;
    const mod = m && m[2] ? +m[2] : 0;
    return { n, mod };
  }

  function parseSpecials(str) {
    const out = {};
    if (!str || str === '—') return out;
    for (let tok of str.split('|')) {
      tok = tok.trim(); if (!tok) continue;
      const [k, ...rest] = tok.split(':');
      const v = rest.join(':');
      const VULT = ['fire','cold','electric','acid','poison','gas','slashing','blunt','piercing','magic','holy','sonic','iron','silver','wood','coldiron','salt','light','sleep','paralysis'];
      if (VULT.indexOf(k) >= 0 && /^(vuln|immune|resist|weak|spread|less|pain|stake)$/.test(v)) {
        out.vulns = out.vulns || {}; out.vulns[k] = v; continue;
      }
      switch (k) {
        case 'undead': if (v !== 'none') out.undead = v || 'common'; break;
        case 'construct': out.construct = (v && v !== 'none') || true; break;
        case 'outer': out.outer = (v && v !== 'none') || 'true'; break;
        case 'split': out.split = v; break;
        case 'no-weapons': out.noWeapons = true; break;
        case 'silver': out.weaponMaterial = 'silver'; out.weaponNeed = Math.max(out.weaponNeed || 0, 1); break;
        case 'coldiron': out.weaponMaterial = 'coldiron'; out.weaponNeed = Math.max(out.weaponNeed || 0, 1); break;
        case 'turn': out.turnMod = v; break;
        case 'spores': out.spores = v || 'asleep'; break;
        case 'cloud': out.spores = v || 'choking'; break;
        case 'charge': out.charge = +v || 2; break;
        case 'frenzy': out.frenzy = true; break;
        case 'riposte': out.riposte = true; break;
        case 'gill': out.gill = true; break;
        case 'horse': out.horse = true; break;
        case 'ambush': out.ambush = true; break;
        case 'mist': out.mist = true; break;
        case 'phylactery': out.phylactery = true; break;
        case 'digest': out.digest = true; break;
        case 'sound': out.vulns = Object.assign(out.vulns || {}, { sonic: v || 'pain' }); break;
        case 'touch': if (/drain/.test(v)) out.drain = Math.max(out.drain || 0, /str/.test(v) ? 2 : 1); break;
        case 'drown': out.drown = true; break;
        case 'charm': out.charm = true; break;
        case 'nohit': if (v === 'normal') out.weaponNeed = 9; break;
        case 'bite': out.bite = true; break;
        case 'stake': out.vulns = Object.assign(out.vulns || {}, { piercing: 'stake' }); break;
        case 'goodarmour': break;
        case 'fly': out.fly = true; break;
        case 'water': out.water = true; break;
        case 'burrow': out.burrow = true; break;
        case 'invisibility': out.invisible = true; break;
        case 'teleport': out.teleport = true; break;
        case 'summon devils': case 'summon demons': out.summoner = true; break;
        case 'death burst': out.deathBurst = true; break;
        case 'rays': out.rays = +v || 4; break;
        case 'size shift': out.grow = true; break;
        case 'immortal': out.immortal = true; break;
        case 'through walls': out.throughWalls = true; break;
        case 'smother': out.smother = true; break;
        case 'carry off': out.carry = true; break;
        case 'tooth paralysis': out.paralysis = true; break;
        case 'tongue grab': case 'tongue steal': out.pull = true; break;
        case 'spine storm': out.missile = v || '6'; break;
        case 'song:charm': case 'charm song': case 'pipe charm': case 'conch sleep': case 'sleep arrow': case 'confusion dance': case 'stare': case 'corpsesong': out.song = true; break;
        case 'mirror': out.mirror = true; break;
        case 'psionics': case 'psychic grasp': out.psionic = true; break;
        case 'fey': out.fey = true; break;
        case 'disease': out.disease = true; break;
        case 'lightning': out.vulns = Object.assign(out.vulns || {}, { electric: v || 'vuln' }); break;
        case 'slick': out.slick = true; break;
        case 'shapechanger': out.shapechanger = true; break;
        case 'swarm': out.swarm = true; break;
        case 'constrict': out.constrict = true; break;
        case 'poison': out.poison = v || 'die'; break;
        case 'parasitize': out.parasitize = +v || 2; break;
        case 'drain': if (v === 'hp') { out.drain = 1; out.drainHp = true; } else if (v === 'brain') { out.drainBrain = true; out.drain = 1; } else if (v === 'int') { out.drainInt = true; } else out.drain = +v || 1; break;
        case 'regrow': out.regen = +v || 1; break;
        case 'regen': out.regen = +v || 1; break;
        case 'breath': { const p = v.split(','); out.breath = { type: p[0], dice: p[1], shape: p[2] || 'cone', every: +(p[3] || 3) }; break; }
        case 'invisible': out.invisible = true; break;
        case 'incorporeal': out.incorporeal = true; break;
        case 'truesee': out.truesee = v !== 'none'; break;
        case 'web': out.web = true; break;
        case 'jet': out.jet = true; break;
        case 'dust': out.dust = true; break;
        case 'petrify': out.petrify = true; break;
        case 'gaze': out.gaze = v || 'petrify'; break;
        case 'needmagical': if (v !== 'none') out.weaponNeed = 1; break;
        case 'need+2': out.weaponNeed = 2; break;
        case 'need+3': out.weaponNeed = 3; break;
        case 'need+4': out.weaponNeed = 4; break;
        case 'pack': out.pack = true; break;
        case 'sneak': out.sneak = true; break;
        case 'pounce': out.pounce = true; break;
        case 'trample': out.trample = true; break;
        case 'whirl': out.whirl = true; break;
        case 'spores': out.spores = true; break;
        case 'stink': out.stink = true; break;
        case 'fear': out.fear = v || 'aura'; break;
        case 'missile': out.missile = v || '1'; break;
        case 'ranged': out.ranged = +v || 6; break;
        case 'eggs': out.eggs = true; break;
        case 'morn': out.morale = +v; break;
        case 'xp': out.xpFixed = +v; break;
        case 'cast': out.caster = v; break;
        case 'hi5': out.hi5 = true; break;
        case 'immune': out.immune = v; break;
        case 'resist': out.resist = v; break;
        case 'inf': out.inf = +v; break;
        case 'achg': out.acFromSize = true; break;
        case 'tunnel': out.tunnel = true; break;
        case 'camouflage': out.camouflage = true; break;
        case 'mirror': out.mirror = true; break;
        case 'spellResist': out.sr = +v || 20; break;
        case 'worry': out.worry = true; break;
        case 'lamp': out.lamp = true; break;
        case 'training': out.training = true; break;
        case 'retrieve': out.retrieve = true; break;
        case 'howl': out.howl = true; break;
        case 'paralyze': case 'paralysis': out.paralysis = true; break;
        case 'leveldrain': out.drain = +v || 1; break;
        case 'turn': out.turnsUndead = true; break;
        case 'goodAR': break;
        default: {
          const FLAVOR = ['shell','blind','climb','blood sense','ink','echolocation','wingless','levitation','guardian','holdfast','blink','phosphorescent','heal horn','horned serpent','two heads','pseudopod','fastness','goat','tree bound','healing water','weather call','storms','bone','invulnerable','scentless','astral','astral form','contracts','machine sabotage','frost hex','storm servant','familiar','invisible night','polymorph touch','barbed hide','leap','ink screen','speed trap','revenge spirit','half elemental','fly storm','six heads','illusion','gas','sleep','gaze:petrify slow','slumber','snow','stone:seen','gas form','water form','musk','vermin','snake','lumber','far seer','weaken','size','slime','stalker','furniture','flesh to stone','misty','howling','venom','glittering','winged','deep'];
          if (FLAVOR.indexOf(k) >= 0 || FLAVOR.indexOf(tok) >= 0) { out.flags = (out.flags || []).concat(tok); break; }
          out._unknown = (out._unknown || []).concat(tok);
        }
      }
    }
    return out;
  }

  function xpOf(hd, morale, sp) {
    if (sp.xpFixed) return sp.xpFixed;
    const h = hdOf(hd);
    const he = Math.max(0.5, h.n + h.mod * 0.5);
    let xp = Math.round(he * he * 14 + he * 5 * 6 + (h.n || 1) * 4);
    if (sp.poison) xp += 250;
    if (sp.paralysis) xp += 250;
    if (sp.drain) xp += 240 * sp.drain;
    if (sp.breath) xp += 400;
    if (sp.weaponNeed >= 1) xp += 200 * sp.weaponNeed;
    if (sp.regen) xp += 260;
    if (sp.incorporeal) xp += 350;
    if (sp.invisible) xp += 200;
    if (sp.petrify || sp.gaze) xp += 500;
    if (sp.swarm) xp += 150;
    if (sp.constrict) xp += 120;
    if (sp.trample) xp += 150;
    if (sp.spores) xp += 200;
    if (sp.fear) xp += 150;
    if (sp.caster) xp += 250;
    if (sp.outer) xp += 200;
    if (sp.hi5) xp += 200;
    return Math.max(7, xp);
  }

  function add(row) {
    const [name, hd, ac, mv, attacks, align, size, morale, treas, specials, look] = row;
    const key = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    const sp = parseSpecials(specials);
    const h = hdOf(hd);
    const hpAvg = Math.max(1, h.n * 5 + h.mod * (h.n || 1));
    const atks = [];
    if (attacks && attacks !== '—') {
      // "1d8" | "2x1d4" | "bite 1d6, claw 1d4"
      for (const part of String(attacks).split(',')) {
        const p = part.trim();
        let m = /^(\d+)x(\d+d\d+(?:[+-]\d+)?)$/.exec(p);
        if (m) { atks.push({ n: +m[1], dmg: m[2] }); continue; }
        m = /^([a-z'’ ]*?)\s*(\d+d\d+(?:[+-]\d+)?|—)$/.exec(p);
        if (m) { atks.push({ n: 1, dmg: m[2] === '—' ? '0' : m[2] }); continue; }
        atks.push({ n: 1, dmg: '1d6' });
      }
    }
    M[key] = {
      key, name, hd: h.n, hdMod: h.mod, ac: typeof ac === 'number' ? ac : +ac,
      mv: +mv || 9, atks, align: ALIGN[align] ? align : 'N', size: size || 'M',
      morale: sp.morale || morale || 7, treasure: (treas || 'N').trim(),
      special: sp, hpAvg, xp: xpOf(hd, morale, sp), look: look || ''
    };
  }
  EF.addMonsterRow = add; // exposed so generated-adventure tests can inject

  // ============================================================== bestiary rows
  const R = (rows) => rows.forEach(add);

  R([
  // ---------------- humanoid nations of the Emberwild
  ['kobold','1-1',9,8,'1d4','CE','S',5,'M','inf:2|pack','Rat-faced little sneak with a reed-thin spear.'],
  ['goblin','1',9,8,'1d6','NE','S',7,'C','inf:2|pack','Grey-green opportunist; a knife in tall grass.'],
  ['orc','1',7,9,'1d8','CE','M',8,'C','inf:2|pack','Pig-faced legionary of the rust wastes; loves fire as much as blood.'],
  ['hobgoblin','1',6,9,'1d8+1','LE','M',10,'C','inf:2|pack','Disciplined, iron-banded, patient; the orcs follow these.'],
  ['gnoll','2+1',7,9,'1d8+1','CE','L',12,'C','sneak','Hyena-jawed marauder that fights in stinking packs.'],
  ['bugbear','2+1',6,9,'2d4+1','NE','M',9,'D','sneak|inf:3|camouflage','Hairy lurking terror of dark places; silken-footed brute.'],
  ['ogre','4+1',7,8,'2d6+2','CE','L',10,'E','—','Stupid, cruel, and strong enough to fold a man like cloth.'],
  ['ettin','10',0,9,'2d6+2','CE','H',14,'F','—','Twin-headed hill lord; sleeps with one eye half open.'],
  ['troll','6+1',3,9,'1d8+1, 2claw 1d4','CE','L',13,'E','regen:3|pounce|sneak','Leathery, rubber-limbed devourer; limbs regrow unless burned.'],
  ['minotaur','6',6,9,'2d6','CN','L',14,'C','charge:2','Labyrinth warden with a bull’s grudge and an axe-lunge.'],
  ['harpy','3',7,9,'1d6+1','CE','M',9,'D','fear:voice|missile:rock','Feathered song-hag; her sweetness is a trap.'],
  ['siren','4',7,6,'1d6+1','CE','M',10,'D','fear:voice|charm','Fen singer who lures the curious under the water.'],
  ['medusa','4',5,9,'snakebite 1d4+1','LE','M',12,'C','gaze:petrify|poison:dmg','Snakelocked and stone-eyed; pity her, then shut your eyes.'],
  ['dusk elf','4',6,9,'1d8+1','CE','M',12,'D','light:weak','Deep-dwelling kin of the surface elves; loathes the sun.'],
  ['deep dwarf','3',4,9,'1d10+2','LE','M',12,'D','needmagical','Grey-clad slavers of the under-halls; turn invisible when outmatched.'],
  ['deep gnome','3',6,8,'1d6','NE','S',10,'D','camouflage','Stone-faced burrower who blends with the rock it loves.'],
  ['hollow gnome','2+1',6,8,'1d6+1','CE','S',8,'C','cast:cleric+2','Mad cap in a tin hat; gabbles and then stabs.'],
  ['oxfolk','3',7,9,'1d10','CN','M',11,'C','charge:2','Horned, broad-chested wanderer of the south grasslands.'],
  ['merekine','2',7,8,'1d8','CE','M',9,'C','gill','Fish-folk of the black pools; their drums carry across water.'],
  ['brackish','3',6,10,'2d4+1','LE','M',11,'D','gill|sneak','Shark-toothed reavers of the reef towns.'],
  ['shoal-folk','2',8,7,'1d8','N','M',8,'C','gill','Amphibious shallows-dwellers with nets and coral spears.'],
  ['tide elf','4',6,8,'1d8+1','NG','M',11,'D','gill','Green-scaled elf of the kelp courts.'],
  ['bandit','1',8,9,'1d6','N','M',7,'M','—','Cutpurse with a borrowed sword and borrowed nerve.'],
  ['bandit captain','3',5,9,'1d8+2','N','M',10,'C','—','One-eyed ringleader; knows every ford on the king’s road.'],
  ['brigand','1',7,10,'1d6+1','CE','M',9,'M','ambush|pack','Road-reever waiting behind the deadfall.'],
  ['cultist','1',8,9,'1d4','NE','M',8,'M','cast:mage+1','Hooded zealot of a name beneath the hill.'],
  ['cult hierophant','5',6,9,'1d6','NE','M',12,'D','cast:mage+5|fear:aura','Robed voice of the buried god; smiles too long.'],
  ['pirate','1',8,9,'1d6','CE','M',8,'M','—','Salt-bitten reaver with hooks for fingers.'],
  ['steppe rider','2',6,12,'1d8','CN','M',10,'C','missile:bow|horse','Horse-lord of the sea of grass; outruns a rumor.'],
  ['berserker','2',9,9,'2d4+1','CN','M',16,'C','frenzy','Painted axe-madman; feels nothing until he falls.'],
  ['veteran sergeant','3',4,9,'1d10+1','LG','M',12,'C','—','Scarred, unhurried, right about everything.'],
  ['gladiator','4',5,9,'2d4+2','N','M',13,'C','—','Crowd-pet of the sand rings; kills with flourish.'],
  ['noble duelist','3',5,9,'1d8+1','LG','M',11,'C','riposte','Fine cloak, finer wrist; will not be insulted twice.'],
  ['straw giant','7',5,9,'3d6','NG','H',12,'F','—','Gentle, lanky giant-child of the outmost farms.'],
  ['vine giant','9',3,9,'4d6','N','H',12,'F','—','Moss-maned wanderer whose hair is a living trellis.'],
  ['firbolg kin','6',4,9,'2d8','NG','H',11,'F','—','Grey-furred half-giant storyteller of the cold wood.'],
  ['cinder smith','5',2,9,'1d12+2','LE','M',12,'C','immune:fire|needmagical','Forge-folk of the deep fires; iron glows soft in their grip.'],
  ['wererat','3',7,9,'1d6','CE','M',12,'B','shapechanger|silver|disease|poison:dmg','Sewer-creature wearing a man’s coat; only silver and enchantment bite true.'],
  ['werewolf','4',7,10,'2d4','CN','M',12,'B','shapechanger|silver|disease','Moon-tinged hunter; silver, magic, or nothing harms it.'],
  ['wereboar','5',6,9,'2d6','CE','M',13,'B','shapechanger|silver|disease|charge:2','Tusked wrath that ploughs through shieldwalls.'],
  ['werebear','6',5,9,'2d8','CG','M',13,'B','shapechanger|silver|disease','Gruff guardian of deep forest trails; quick to friendship, slower to anger.'],
  ['weretiger','6',6,12,'2d6+1','CE','M',14,'B','shapechanger|silver|disease|pounce','Jungle stalker that hunts men the way men hunt deer.'],
  ['lycanthrope, dire','8',4,10,'2d8+2','CE','M',15,'B','shapechanger|silver|disease','An elder curse; the beasts themselves flee its shape.'],
  ['changeling','5',8,9,'2d6','N','M',10,'B','shapechanger|truesee:none','A face borrowed from you; count your company again.'],
  ['doppelling','4',7,9,'1d8+1','N','M',9,'C','shapechanger|truesee:none','Shy copy-creature; it only wants what you have.'],
  // ---------------- undead (turning categories per special.undead)
  ['skeleton warrior','1/2',8,9,'1d6','NE','M',5,'N','undead:skeleton|turn:vuln','Dry bones standing to old orders; brittle under a mace.'],
  ['skeleton champion','2',6,9,'1d8+1','NE','M',7,'B','undead:skeleton|turn:less-vuln','A bone knight polished by centuries of war-drill.'],
  ['skeleton archer','1/2',7,9,'bow 1d6','NE','M',5,'B','undead:skeleton|missile:8|turn:vuln','Fingerless markswoman; never tires, never blinks.'],
  ['zombie','2',8,6,'1d8+1','N','M',8,'N','undead:zombie|turn:vuln|resist:slashing','Shambling corpse in a farmer’s clothes; hard to stop, easy to outlast.'],
  ['zombie, plague','3',7,6,'1d8+2','NE','M',8,'N','undead:zombie|poison:dmg|turn:vuln','Bloated and weeping; its touch infects.'],
  ['ghoul','1',8,9,'1d6+1, bite 1d4','CE','M',9,'N','undead:ghoul|paralyze','Grave-feeder whose claw-numbness stiffens flesh.'],
  ['ghoul tyrant','3',6,9,'1d8+2, bite 1d6','CE','M',11,'B','undead:ghoul|paralyze|turn:resists','Bloated lord of a dead feasting-hall; commands the lesser ghouls.'],
  ['ghast','2',6,9,'1d8+1, bite 1d4','CE','M',11,'N','undead:ghast|paralyze|stink|turn:resists','Pallid, loathsome cousin of the ghoul; its stench turns the stomach.'],
  ['wight','3',6,9,'1d8+1','NE','M',10,'N','undead:wight|drain:1|turn:resists','Barrow-stalker whose cold grip drinks years along with blood.'],
  ['wight, elder','5',4,9,'1d10+2','NE','M',12,'B','undead:wight|drain:2|turn:resists','Throne-bound hunger that remembers its own name, and hates you for it.'],
  ['wraith','4',2,12,'1d6','NE','M',12,'N','undead:wraith|drain:2|incorporeal|needmagical|turn:resists','Shadow with a hate for the living; strikes at the spark of life itself.'],
  ['spectre','6',0,12,'1d8+2','LE','M',14,'B','undead:phantom|drain:2|incorporeal|needmagical|turn:resists','A dead man’s oath given terrible hands.'],
  ['mummy','5+2',-2,9,'2d6+2','LE','M',16,'N','undead:mummy|fire:vuln|needmagical|turn:resists|paralyze','Bandaged temple-guard; its touch carries centuries of rot. Fire drives it mad.'],
  ['barrow horror','7',0,9,'2d8+1','NE','M',14,'C','undead:mohrg|drain:1|fear:aura|turn:resists','Crowned thing of barrow-mould that wears a dead king’s grave-clothes.'],
  ['shadow','2+2',6,12,'1d4+chill drain','NE','M',8,'N','undead:shadow|drain:1|incorporeal|needmagical|light:vuln|turn:vuln','Detached silhouette that drinks warmth and years.'],
  ['greater shadow','4+2',4,12,'1d6+drain 1','NE','M',10,'B','undead:shadow|drain:2|incorporeal|needmagical|light:vuln','Shadow grown thick enough to carry off a child.'],
  ['haunt','9',1,9,'1d10+1','NE','M',20,'N','undead:ghost|incorporeal|needmagical|touch:str drain|turn:resists','A place-memory of murder; it cannot leave its room, and it knows it.'],
  ['banshee','6',0,12,'1d6+chill','CE','M',16,'N','undead:spirit|incorporeal|needmagical|howl|turn:resists','Her wailing finds you through walls; the living drop at the sound.'],
  ['burning skull','1+2',4,12,'fire bolt 2d4','NE','T',12,'N','undead:flameskull|fire:immune|needmagical|turn:resists','Floating charred skull wreathed in green fire; no legs, all malice.'],
  ['cairn knight','8',0,9,'1d10+4','LE','M',16,'C','undead:dracolich|drain:1|needmagical|turn:resists|spellResist:15','Dead knight-commander who never took off his armor, never will.'],
  ['vampire spawn','4+1',4,12,'1d8+2','LE','M',14,'B','undead:vampire|drain:hp|bite|needmagical|regen:1|turn:resists|light:vuln|stake','Fledgling leech, bound to its maker’s coffin.'],
  ['vampire','8+4',1,12,'1d10+3','LE','M',20,'B','undead:vampire|drain:hp|bite|needmagical|regen:3|charm|mist|light:vuln|stake|turn:resists|spellResist:20','Old, courteous, starving; invites itself in and never leaves.'],
  ['lich','11+7','-2',9,'1d8+2','NE','M',20,'B','undead:liche|drain:hp|paralyze|cast:mage+11|needmagical|spellResist:40|phylactery|turn:resists','A sorcerer who out-thought death and regretted the view. Its soul waits in a hidden casket.'],
  ['half-lich','13+9','-4',9,'1d8+3','NE','M',20,'A','undead:archliche|drain:hp|paralyze|cast:mage+13|needmagical|spellResist:50|phylactery|turn:resists','The lich’s final, terrible refinement: mostly bone, wholly patient.'],
  ['bone golem','6',-1,6,'2d8+2','NE','H',16,'N','undead:none|construct|needmagical|immune:cold','A cairn that learned to walk; every finger a stolen thigh-bone.'],
  // ---------------- constructs & guardians
  ['clay golem','8',4,6,'2d10+1','N','H',16,'N','construct|needmagical|acid:vuln|immune:electric|spellResist:25','River-clay giant shaped by a mason’s hymn; slow as grief.'],
  ['stone golem','10',0,6,'2d12+2','N','H',16,'N','construct|needmagical:blunt less|spellResist:30','Basalt sentinel that grinds to its appointed step.'],
  ['iron golem','12',-1,8,'2d20+2','N','H',18,'N','construct|needmagical|poison:immune|spellResist:55|gas:immune','Black iron engine of a dead emperor’s spite.'],
  ['mail mausoleum','7',-1,6,'2d6+2','N','M',15,'N','construct|needmagical|spellResist:20|swarm','A heap of empty suits that pours down stairways like liquid.'],
  ['statue soldier','4',2,6,'1d10','N','M',16,'N','construct|needmagical|lightning:vuln','Garden marble that steps off its plinth when trespassers speak.'],
  ['clockwork knight','5',2,9,'1d12+1','N','M',14,'N','construct|needmagical|spellResist:10','Coils and counterweights under a steel shell; winds itself at dusk.'],
  ['helmed horror','2',4,9,'1d8','N','M',12,'N','construct|needmagical|acid:vuln','Suit of armour on no one; obeys the last command it was given.'],
  ['scarecrow','2',6,9,'1d6+1','CE','M',10,'N','construct|fire:vuln|poison:immune|sleep:immune','Stitched and straw-stuffed, and moving when you blink.'],
  ['animated objects','2',7,9,'1d4','N','T',8,'N','construct|fire:vuln','Chairs, cutlery and crockery attacking as a furious household.'],
  ['table, animated','2',7,8,'1d8','N','M',8,'N','construct|fire:vuln','Oak, stubborn, and personally offended by your presence.'],
  ['rope, animated','2',7,9,'1d3','N','T',8,'N','construct|constrict|fire:vuln','A coil with intentions.'],
  ['brazen hound','6',0,12,'2d6+1','LE','M',14,'C','construct|needmagical|immune:fire|sound:pain','Gilded watchdog whose bark is a forge-hammer to the ears.'],
  // ---------------- oozes, molds, jellies & creeping things
  ['cellar slime','2',8,3,'acid grip 1d6','N','M',20,'N','construct:ooze|no-weapons|slashing:spread|acid:immune|cold:vuln|fire:vuln|achg','Grey sheet of hunger sliding across the dungeon floor.'],
  ['splitting pudding','4',8,3,'acid slam 2d4','N','M',20,'N','construct:ooze|no-weapons|split:slashing|acid:immune|fire:vuln','Black, tar-smooth, and halves itself when struck. Sorry.'],
  ['gold jelly','4',8,3,'acid touch 2d4','N','M',20,'N','construct:ooze|no-weapons|electric:spread|acid:immune|cold:vuln|fire:vuln','Amber translucent blob that splits when lightning annoys it.'],
  ['transparent cube','6',8,2,'acid slam 3d4','N','H',20,'N','construct:ooze|no-weapons|invisible|acid:immune|cold:vuln|fire:vuln|digest','A six-foot die of clear jelly; you walk into it before you see it.'],
  ['ash blob','8',6,3,'fire slam 4d4','N','H',20,'N','construct:ooze|no-weapons|fire:immune|cold:vuln','Smouldering heap of camp-ash that hates cold and warm flesh alike.'],
  ['oil ooze','5',7,3,'burning grip 2d4+burn','N','M',20,'N','construct:ooze|no-weapons|fire:immune|cold:vuln|slick','Slick black tide that kindles when struck.'],
  ['dungeon mould','2',0,0,'spores:asleep 1d6','N','T',20,'N','construct:mold|spores|no-weapons|sleep:immune|poison:immune|fire:vuln|achg','Patch of grey-brown fluff on the wall. Do not breathe.'],
  ['spurting mould','2',0,0,'acid spurt 1d6','N','T',20,'N','construct:mold|no-weapons|fire:vuln|achg','Wart of fungus that fires a jet of digestive acid at movement.'],
  ['yellow mould','2',0,0,'cloud:choking','N','T',20,'N','construct:mold|spores|no-weapons|fire:vuln|achg','Brillian powder puff; disturbingly airborne.'],
  ['creeping coil','5',8,5,'strangle 1d4+2','N','M',16,'N','construct:plant|no-weapons|constrict|fire:vuln|cold:vuln','A knot of ropelike green weed that mimics a discarded cable.'],
  ['creeping cohort','6',8,5,'2d4','N','M',16,'N','construct:plant|no-weapons|constrict|swarm|fire:vuln','Six coils working together, which is worse than it sounds.'],
  ['shrieking toadstool','1+1',6,1,'—','N','S',20,'N','construct:fungus|no-weapons|howl|fire:vuln','Pale cap that screams when anything passes near.'],
  ['door gnawer','2',3,1,'piercing jaw 2d4','N','M',20,'N','construct|no-weapons|camouflage|acid:immune|fire:vuln','A wooden panel with a hinge for a mouth; it adores doors.'],
  ['hooked tether','6',4,6,'tendril 2d6','N','L',14,'N','construct:ooze|no-weapons|jet|constrict','Stone-coloured lump on a springy cable that leaps and reels in prey.'],
  ['living lantern','1+1',7,6,'flame lick 1d4','N','T',12,'N','construct|lamp|no-weapons|fire:immune|cold:vuln','Tempting glow that leads wanderers into pits and walls.'],
  ]);
  R([
  // ---------------- beasts and vermin
  ['rat','1-1',9,6,'bite 1d3+1d4 disease','N','T',6,'N','disease|swarm','A bold, filthy whelp with a taste for provisions.'],
  ['giant rat','1-1',7,6,'bite 1d3+1d4 disease','N','T',7,'N','disease','Dog-sized sewer rat; its fleas carry the grey pox.'],
  ['dire rat','2',6,6,'bite 1d4+1','N','S',8,'N','disease','Black-furred and brazen; hunts in squealing tides.'],
  ['sky leech','1d4 hp',7,6,'bite drain 1d4','N','T',8,'N','drain:hp|fly','A needle-wing on silent rotors; gorges until it drops off.'],
  ['offal crawler','4',6,9,'antennae 2d4','CE','L',10,'C','paralysis|drain:hp','Six-legged grub-walker of charnel yards; its feelers numb and then drink.'],
  ['barbed horror','4',2,9,'talons 2d4+1','CE','M',12,'B','sneak|pack','Hairless, eyeless hunter with scythe-hand claws that snap shut.'],
  ['ironmordant','4',6,12,'antennae:rust','N','M',9,'N','dust|nohit:normal','A three-legged tin garden-hose with a taste for armour and blades.'],
  ['flicker spider','3+1',6,9,'fangs 2d4+poison','CE','M',8,'C','poison:dmg|invisible','A trapdoor spider that slips between here and a hand-breadth sideways.'],
  ['huge spider','1+1',7,9,'fangs 1d4+1, poison:slain by save','N','S',6,'N','poison:dmg','A hand-span of legs and patience.'],
  ['giant spider','2+2',6,9,'fangs 1d8+poison','N','M',8,'C','poison:die|web','Knee-high and woven into every second tunnel in the low roads.'],
  ['monstrous spider','4+4',5,9,'fangs 2d6+poison','N','L',9,'C','poison:die|web','A barrel-bodied nightmare that hoards silk-wrapped dead.'],
  ['wolf spider','2',7,9,'fangs 1d6+poison','N','M',7,'N','poison:dmg','Hunts with no web, only legs and venom.'],
  ['banded seeker','3',6,9,'fangs 1d8+poison','N','M',8,'C','poison:slay|web','Candy-striped burrow-trap with a lethal kiss.'],
  ['large scorpion','2',5,9,'claw 1d6, sting 1d4+poison','N','S',8,'N','poison:slay','A shield with pincers; the small change of desert horror.'],
  ['giant scorpion','4',3,9,'claw 2d4 x2, sting 2d4+poison','N','L',9,'C','poison:die|constrict','A horse-eater in mail of chitin; grapples before it stings.'],
  ['monstrous scorpion','8',1,9,'claw 2d8 x2, sting 2d6+poison','N','H',10,'C','poison:die|constrict','The dunes themselves seem to rear up and walk.'],
  ['huge centipede','2+1',5,9,'fangs 1d6+poison','N','S',8,'N','poison:slay','A racing ladder of legs; its bite closes the throat.'],
  ['giant centipede','4+1',4,9,'fangs 2d4+poison','N','M',9,'C','poison:slay','Waist-deep, amber-shelled, fast as a thrown axe.'],
  ['monstrous centipede','6+1',3,9,'fangs 2d6+poison','N','L',10,'C','poison:die','A freight-train of segments that can bore through a door.'],
  ['large tick','1d4 hp',8,1,'bite drain 1d4','N','T',7,'N','drain:hp|parasitize','A walnut of hunger that swells to a fist.'],
  ['giant tick','2d6 hp',7,3,'bite drain 1d6','N','T',8,'N','drain:hp|parasitize','Drops from ceilings with obscene hospitality.'],
  ['monstrous tick','5d6 hp',6,4,'bite drain 2d6','N','S',9,'N','drain:hp|parasitize','A saddle-blanket of parasite; unhitch it with knife or fire.'],
  ['giant wasp','2+1',5,12,'sting 1d4+poison, fly','N','S',10,'C','poison:slay|fly','A blue-steel dart with a grudge.'],
  ['boring wasp','4+1',4,12,'sting 2d4+poison','N','M',11,'C','poison:par|fly|burrow','Bores a nest-hole through leather, mail, or cheek.'],
  ['savage ant','1+1',6,6,'mandibles 1d4','N','T',10,'N','swarm','Palm-long soldiers that strip a carcass, or a man, in minutes.'],
  ['driller ant','2+2',5,6,'mandibles 1d6+acid','N','S',10,'N','acid:immune','Bore-haulers of the deep nests; their acid eats stone.'],
  ['ore termite','2',4,6,'mandibles 1d4','N','T',9,'N','dust','Small, pale, and utterly devoted to your metal goods.'],
  ['needle-fly','1d6 hp',8,9,'proboscis drain 1d4','N','T',7,'N','drain:hp|fly','A migrating cloud of razors; the steppe learns to lie under oiled hides.'],
  ['horse leech','2d6 hp',7,3,'bite drain 1d6','N','T',8,'N','drain:hp|parasitize|water','The fen attaches itself to you, then drinks.'],
  ['killer slug','3',7,1,'acid coat 1d3+digest','N','M',20,'N','construct:ooze|no-weapons|acid:immune|fire:vuln|salt:vuln','A brown tide with a rasping tongue; its trail is the wound.'],
  ['stone slug','5',5,1,'grind 2d6','N','M',20,'N','no-weapons|needmagical|acid:immune','Grinds granite to grit and swallows the grit.'],
  ['mace-shell','8',1,3,'flail tongue 2d8','N','H',12,'C','nohit:normal|shell','A cow-sized snail whose eye-stalks end in jointed iron maces.'],
  ['bombardier beetle','2',6,9,'boiling spray 2d6','N','S',8,'N','fire:immune','Clicks a boiling chemical shot the length of a room.'],
  ['great bombardier','4+1',5,9,'boiling spray 4d6','N','M',9,'C','fire:immune','Knee-high furnace that pops like a struck anvil.'],
  ['stag beetle','4+1',3,9,'horns 2d6+grapple','N','M',9,'C','constrict','Antlered ram of the undergrowth; locks on and pushes.'],
  ['rhinoceros beetle','3+3',2,9,'horn gore 2d4+charge','N','M',9,'C','charge:2','A living battering ram on six short legs.'],
  ['darkling beetle','2+2',4,9,'bite 1d6','N','M',8,'N','—','A smooth black loaf-shield with a wasp inside it.'],
  ['boring beetle','3',3,6,'borer 1d8','N','M',9,'N','burrow|acid:immune|needmagical:none','Its snout drills oak and sandstone like warm tallow.'],
  ['sanguine moth','2+1',6,12,'proboscis drain 1d4','N','S',8,'N','drain:hp|fly|sleep','Dust from its wings is a heavy sleep; the tongue is worse.'],
  ['green worm','1+1',8,6,'bite 1d3','N','T',5,'N','poison:dmg','A finger of venom with jaws.'],
  ['giant worm','4',6,6,'crush 2d4','N','L',7,'N','burrow|blind','A pink piston of muscle that swallows boots, belts, and hands.'],
  ['wolf','1',7,9,'bite 1d6+1','N','M',8,'N','pack|horse:none','Lean, patient, and more numerous than you hoped.'],
  ['dire wolf','3+1',6,10,'bite 2d4+2','N','L',9,'C','pack','Grey as grief and twice as fast over open ground.'],
  ['hoarfrost wolf','5',4,12,'bite 2d6+2, cold','CE','H',10,'C','pack|immune:cold','White-maned devil of the glacier line; its breath is a knife of frost.'],
  ['jackal','1',9,9,'bite 1d4+1','CE','S',6,'N','pack|disease','Yapping grave-robbers in a hundred yellow eyes.'],
  ['watch hound','2',7,9,'bite 1d8','N','M',10,'N','pack','Bred to meet bandits wearing mail.'],
  ['boar','1+1',7,8,'gore 1d6+1','N','M',7,'N','charge:2','Argumentative even at peace.'],
  ['great boar','3+2',5,9,'gore 2d6+2','N','L',9,'C','charge:2','A tusked siege-engine of the deep woods.'],
  ['black bear','2+2',7,9,'claw 1d6+1, bite 1d8','N','M',10,'N','—','Curious, omnivorous, regrettable to interrupt.'],
  ['brown bear','4+4',6,9,'claw 1d8+2, bite 2d4','N','L',11,'C','—','A hill of muscle that has opinions about your picnic.'],
  ['snow bear','6+6',5,9,'claw 2d4+3, bite 2d6','N','H',12,'C','immune:cold','Pale as the slide that follows it.'],
  ['cave bear','8+8',4,9,'claw 2d6+4, bite 3d4','N','H',13,'C','—','Wakes cranky from a hundred-year nap.'],
  ['lion','3',7,9,'claw 1d4+1, bite 1d8','N','M',9,'N','pounce|pack','Golden arithmetic: you minus its speed equals supper.'],
  ['jet tiger','5',6,10,'claw 1d6+2, bite 2d6','N','L',10,'C','pounce|ambush','Stripeless shadow of jungle ruins; comes from silence into teeth.'],
  ['panther','3',6,10,'claw 1d4+1, bite 1d8','N','M',9,'N','pounce|ambush|climb','A rope of black velvet that falls from branches.'],
  ['grey ape','5',6,9,'2fist 1d8+3','N','M',12,'C','missile:rock','Tribal, thieving, and terrifyingly clever with thrown stone.'],
  ['carn ape','4+1',5,9,'maul 2d6+2','CN','M',12,'C','pounce','Cruel mirror of a man; loves towers it can climb.'],
  ['crocodile','3+1',6,6,'bite 2d6+hold','N','L',9,'C','constrict|water|ambush','A log with the correct opinion about your leg.'],
  ['great crocodile','8+1',4,6,'bite 3d6+hold','N','H',10,'C','constrict|water|ambush','Takes boats for the grit of them.'],
  ['emerald constrictor','4+1',5,9,'bite 1d4+constrict','N','L',9,'C','constrict','Coils like knotted rope and squeezes the argument out.'],
  ['venomous snake','1+1',7,5,'bite 1d3+poison','N','S',6,'N','poison:die','Small, triangular, and finished with you.'],
  ['night adder','3+1',6,6,'bite 1d4+poison','N','M',7,'C','poison:slay|ambush','Strikes at warmth in the dark of the dune-sea.'],
  ['great monitor','4',6,9,'bite 1d8+2, tail 1d6','N','L',9,'C','water','A dragon compressed into an elbow and a tongue.'],
  ['bark gecko','2d4 hp',8,9,'bite 1d2+stick','N','T',6,'N','camouflage|climb','A leaf that has decided to eat your sandwich from behind.'],
  ['salt marsh lizard','3+1',6,8,'bite 1d8+spit','N','M',8,'C','missile:spit','Rears up and squirts eye-stinging brine two yards.'],
  ['storm eel','2+2',6,6,'bite 1d4+shock','N','M',8,'N','electric:immune|water','Twelve feet of live wire through the shallows.'],
  ['redfin','1d4 hp',8,5,'bite 1d3','CE','T',12,'N','swarm|water|blood sense','A copper coin with teeth; smells a scratch at sixty paces.'],
  ['giant crab','4',5,9,'claw 2d6 x2 constrict','N','M',10,'C','constrict','A bucket with ambitions; its pincers crack shields.'],
  ['shell crab','7',2,9,'claw 2d8 x2 constrict','N','L',11,'C','constrict','Coconut-cracker by name, helmet-cracker by practice.'],
  ['giant octopus','8',7,9,'8tentacle 1d4+constrict','N','H',12,'C','constrict|water|ink','A hooded knot of malice that drags divers into its garden of bones.'],
  ['sea devil','10',5,9,'2tentacle 1d8+beak 2d6','N','H',12,'C','constrict|water|ink','The kraken’s poor-tempered cousin that capsizes longboats for spite.'],
  ['corpse vulture','2',6,12,'bite 1d4+1','CE','M',7,'N','fly|disease','Wearing its bald head like a professional apology.'],
  ['black carrion crow','1+1',5,12,'peck 1d4+1','NE','S',6,'N','fly','Follows the party the way weather follows.'],
  ['huge bat','1d4 hp',7,12,'bite 1d3+1d4 disease','N','T',6,'N','disease|fly|echolocation','A leather fistful of squeaking hunger.'],
  ['stirge','1d4-3 hp',14,6,'proboscis 1d2 (attaches, 1d2/round after)','N','T',7,'N','drain|fly|swarm','A mosquito the size of a sparrow, with a proboscis and a grudge.'],
  ['giant frog','2+1',7,15,'bite 1d6 + grab','N','L',35,'N','constrict|water','Toad the size of a pony, with a tongue that files reports.'],
  ['dire bat','2+1',6,12,'bite 1d4+1d6 disease','N','S',7,'N','disease|fly|echolocation','Dog-faced and fearless; drains lantern-light with its squeaking.'],
  ['ember bat','1+1',6,12,'flame lick 1d4','N','T',7,'N','fire:immune|fly','A bat-shaped ember that sets thatch — and thatch-roofed villages — alight.'],
  ['war horse','2',7,12,'hoof 1d6+2','N','L',8,'N','horse|trample','Costs more than your father made in a year.'],
  ['wool mammoth','10',3,9,'tusks 3d6+trample','N','H',12,'C','trample','Tusked hill of the northern grass; the steppe peoples count a raid by mammoths lost.'],
  ['kelpie','5',5,12,'bite 2d4+drag','CE','L',10,'C','water|charm','A sleek pony by the loch that offers a ride it never intends to end.'],
  ['yeti','6',6,9,'2slap 1d8+2','CN','L',12,'C','immune:cold|ambush|camouflage','The abominable drift; leaves no tracks behind, only ahead.'],
  ['great horned rhinoceros','9',3,9,'gore 3d8+charge','N','H',12,'C','charge:2','Armoured theology with a horn on the front of it.'],
  ['saurian raptor','2+1',6,12,'talons 1d8+1, bite 1d6','N','M',10,'C','pack|pounce','Sickle-clawed hunter in feathered livery; the pack flanks like soldiers.'],
  ['horned saurian','6',4,8,'tail 2d6+2, gore 1d10','N','L',10,'C','—','Plated, thumbed, slow, and absolutely uninterested in your opinion.'],
  ['thunder saurian','14',3,8,'trample 4d8+stomp','N','G',14,'C','trample','A moving weather-event with a small head and a long patience.'],
  // ---------------- dragon-kind & marvel beasts
  ['wyvern','4+1',4,9,'sting 1d6+poison, claw 1d4','N','L',9,'C','poison:slay|fly','Two-legged winged serpent; its barbed tail is a loaded crossbow.'],
  ['wyvern monarch','6+1',3,12,'sting 2d4+poison, claw 1d6','N','H',11,'C','poison:die|fly','The old matriarch of the crag; collects bones the way courts collect tapestries.'],
  ['lind worm','6',3,9,'bite 2d6+poison','N','H',10,'C','poison:die|constrict|wingless','A serpent with a grudge and no wings to fly away from it.'],
  ['shard wyrm','5+2',3,9,'bite 2d4+1','N','L',9,'C','breath:slashing,6d6,cone','A dragon of faceted crystal; spits a cone of shard-dust.'],
  ['hydra, five-headed','5+1',5,9,'5bite 1d6+constrict','N','H',9,'C','constrict|regen:2|fire:vuln|acid:vuln','Cut off one head, the swamp laughs.'],
  ['hydra, seven-headed','7+1',4,9,'7bite 1d8+constrict','N','H',10,'C','constrict|regen:2|fire:vuln|acid:vuln','A raft that bites back in seven places at once.'],
  ['hydra, ten-headed','10+1',3,9,'10bite 1d10+constrict','N','G',11,'C','constrict|regen:3|fire:vuln|acid:vuln','The fen itself rises up and leans on your tower.'],
  ['hydra, twelve-headed','12+1',2,9,'12bite 2d8+constrict','N','G',12,'C','constrict|regen:3|fire:vuln|acid:vuln','Older than the county that outlawed it.'],
  ['ember hydra','8',2,9,'8breath 3d6 fire','N','H',11,'C','fire:immune|regen:2','Its stumps burn; water only makes it hiss weather.'],
  ['rime hydra','8',2,9,'8breath 3d6 cold','N','H',11,'C','cold:immune|regen:2','Each neck a different flavour of frostbite.'],
  ['tyrant hydra','12+2',0,9,'12bite 2d8+constrict','N','G',14,'C','constrict|regen:4|fear:aura|fire:vuln','Eyes on every stalk, and all of them counting you.'],
  ['manticore','6+1',4,9,'bite 1d6+2, tail spikes 1d8 x3','LE','L',12,'C','missile:10','Man-faced lion with a quill-thrower for a tail; speaks, briefly, cruelly.'],
  ['chimera','8+2',4,9,'bite 2d4+2, horn 2d4, dragonbite 2d6','CN','L',12,'C','breath:fire,2d4,cone','Goat, lion, and drake in one disagreement; the drake breathes fire.'],
  ['cockatrice','4+1',5,9,'peck 1d4+stoneflesh slowly','N','S',10,'C','gaze:petrify slow','Two-legged lizard-chicken; its gaze begins a slow petrification.'],
  ['basilisk','6+1',4,9,'bite 1d8+poison, gaze:stone','N','M',11,'C','gaze:petrify','Eight-legged crest of the desert wastes; meeting its eyes ends meetings.'],
  ['greater basilisk','10+1',2,9,'bite 2d6+poison, gaze:stone','N','L',13,'C','gaze:petrify|needmagical','Old, patient, and nearly all eye.'],
  ['dracolisk','8',0,9,'bite 2d8+poison, gaze:stone','CE','H',12,'C','gaze:petrify|poison:die|fly','Cockatrice crossed with wyrm; everything about it is a bad day.'],
  ['gazer','5+1',4,9,'eye rays','LE','M',14,'C','fly|rays:4','A floating sphere of one huge eye and four stalk-eyes; each stalk radiates a different peril.'],
  ['death orb','6+3',2,9,'eye rays','LE','M',15,'C','fly|rays:5','A gazer’s gaunt grey cousin; its central eye is a mouth.'],
  ['watcher eye','4+2',5,9,'eye rays','N','M',12,'C','rays:4|guardian','A gazer’s appointed sentry; it does not kill, it removes options.'],
  ['flicker panther','5+1',5,9,'2claw 2d4+bite 1d6','N','L',11,'C','mirror|invisible','Six-legged, two-tailed, and never quite where it appears; its false image takes the first blow.'],
  ['talon bear','5+2',5,9,'2claw 2d4+1, peck 2d4','CN','L',12,'C','sneak','Feathered, beaked, bear-bellied; smells of musk and wrong decisions.'],
  ['borer','6',1,9,'bite 2d8+strangle','N','L',12,'C','burrow|tunnel|holdfast','A sand-pale hammerhead with drill-jaw; buries caravans out of appetite.'],
  ['delver','8+2',0,6,'2claw 2d4+shell bash','CN','L',14,'C','burrow|gaze:confuse shell','Shelled plough-beast of the deep sand; its gaze confuses, its claws unmake.'],
  ['gryphon','5+1',5,12,'2claw 1d8+beak 2d4','N','L',11,'C','fly|eggs','Lion haunches, eagle malice; mates for life, resents funerals.'],
  ['hippogriff','4',5,12,'2claw 1d6+beak 1d8','N','L',10,'C','fly','Mare-bodied, eagle-headed, proud of neither; rides well if flattered.'],
  ['pegasus','4+1',5,15,'hoof 1d8','CG','L',10,'C','fly|horse','Only the honest may mount; the dishonest learn this airborne.'],
  ['roc','15',2,9,'2claw 4d6+beak 3d6','CN','G',14,'C','fly|carry off','Lifts cattle — and companies — off the face of the map.'],
  ['giant eagle','6+1',4,15,'2talons 2d4+beak 1d8','CG','L',12,'C','fly|carry off','Aristocrats of the high cirque; keep odd friends out of loyalty.'],
  ['thunderbird','12',0,12,'2talons 3d4+beak 2d8','CN','H',14,'C','fly|electric:immune|storms','Its wingbeats are the far drums of a storm; rides the anvil-top.'],
  ['flicker hound','4',5,12,'bite 2d4+2','NG','M',11,'C','blink','Luminous dog that arrives a breath before it left; excellent tracker, terrible secret.'],
  ['moon dog','6+1',4,12,'2claw 2d4+1','NG','M',12,'C','blink|phosphorescent','Silver-maned partner of the flicker hound; walks on moonbeams like planks.'],
  ['pseudo-dragon','1+1',5,12,'sting 1d3+sleep','CG','T',10,'N','fly|poison:slumber','Dragon of the hearth, cat-sized, cat-tempered; its sting is a night of dreams.'],
  ['thistle drake','1+1',5,12,'sting 1d2+tricks','CG','T',9,'N','fly|invisibility|size shift','Four-winged dragon the size of a wren; its pranks are elaborate and its memory long.'],
  ['unicorn','7',5,18,'horn gore 2d6+charge','CG','L',14,'C','horse|charge:2|heal horn','Only a maiden may touch the horn; the horn mends one thing a day.'],
  ['cerastes','3',6,9,'horns 1d6+constrict','N','S',9,'C','constrict|horned serpent','A serpent whose brows end in grappling hooks; backs into you on purpose.'],
  ['amphisbaena','3',4,9,'2bite 1d4+poison','N','M',10,'C','poison:dmg|two heads','Two-ended serpent; no ambush surprises it, from either side.'],
  ['python','3+1',5,5,'bite 1d4+constrict','N','L',8,'C','constrict','A river of muscle that hugs until hugging is finished.'],
  // ---------------- spirits, fey, aberrant
  ['corpse-candle','2+2',6,9,'burn 1d6+lead astray','NE','T',8,'N','undead:spirit|incorporeal|fire:immune|nohit:normal','A blue marsh-flame that promises a road that is not there.'],
  ['carved lantern','2+1',5,9,'burn 1d4+lead','NE','T',7,'N','construct|lamp|fire:immune|no-weapons','A grinning gourd with a stolen light inside; it wants you closer.'],
  ['brine grip','3+1',5,6,'claws 1d6+drown','N','M',12,'C','water|drown|constrict','Two wet hands rising from a still pool to hold you under politely.'],
  ['thought leech','2+1',5,6,'tentacle drain int','N','S',9,'N','drain:int?','A snail of the sphere between stars; it eats the idea of you first.'],
  ['mind hunter','8',5,9,'4tentacle constrict+braintake','LE','M',15,'C','drain:brain|psychic grasp|psionics','Cephalopod sage of the underground sea; its mind-lock opens a skull like an oyster.'],
  ['elder mind hunter','10+1',4,9,'4tentacle constrict+braintake','LE','L',17,'C','drain:brain|psychic grasp|psionics|spellResist:20','Elder of the spiral cities; remembers your birth-plan.'],
  ['mawblob','8',8,6,'bite 1d8 x3','CN','L',16,'N','no-weapons|acid:immune|slashing:spread|fire:spread|regen:2','A heap of mouths, eyes, and half-formed intentions; everything it ate is still screaming.'],
  ['waylurker','8+2',-1,12,'2slam 2d6+acid','N','L',13,'C','invisible|fly|needmagical|acid:immune','A dome of grey horn on a jet of hot air; only its hatred is visible.'],
  ['star avenger','6+3',2,12,'blade 2d4+2, claws 1d6 x2','LG','M',16,'C','outer:true|astral form','Slayer of things that should have stayed slain; rides the star-road errand-bound.'],
  ['scentless seeker','6+1',2,12,'2foreclaw 2d4+2','CN','M',15,'C','invisible|scentless|astral','A noseless hound of the between-places that hunts what the world cannot smell.'],
  ['smoke mephit','1+1',8,12,'claw 1d3+puff','NE','S',10,'N','outer:mephit|immune:poison|gas','A sulphur puff with an attitude problem.'],
  ['steam mephit','1+1',7,12,'claw 1d3+blast','NE','S',10,'N','outer:mephit','Boils, bursts, and reforms; likes to be hated.'],
  ['salt mephit','1+1',8,12,'claw 1d3+sting','NE','S',10,'N','outer:mephit|salt:immune','Crusted white sprite; its sting is a wedge of pain.'],
  ['ash mephit','1+1',7,9,'claw 1d4+smother','NE','S',10,'N','outer:mephit|smother|fire:immune','A grey squall of clinkers that seeks to bury your face in it.'],
  ['magma mephit','2+1',6,9,'claw 1d4+molten gobs','NE','S',11,'C','outer:mephit|fire:immune|missile:goo','Hurls globs of molten rock and is delighted by each one.'],
  ['stone eater','8+8',2,6,'2claw 2d4+bite 2d8','N','M',14,'C','outer:elemental|burrow|immune:stone','Diamond-toothed pelican of the deep; eats lode, wall, and pick-head.'],
  ['shale eater','9+8',1,6,'2claw 2d6+bite 3d6','N','L',15,'C','outer:elemental|burrow|immune:stone','Elder of the eating races; treats a keep wall as a biscuit tin.'],
  ['lava eater','11+8',0,6,'2claw 3d4+bite 3d8','N','L',16,'C','outer:elemental|burrow|fire:immune','Molten at the seams; leaves a glass scar where it slept.'],
  ['frost toad','2+2',6,6,'tongue steal+chill 1d4','N','S',8,'N','outer:elemental|immune:cold','A toad of the glacier-mere; its tongue is a cold pair of tongs.'],
  ['fire newt','3+1',6,6,'bite 1d4+flame jet','N','S',9,'C','outer:elemental|fire:immune','Salamander of the coal-pits; breathes a foot of flame when stepped on.'],
  ['corpse-chorus','3+1',6,9,'song:charm','NE','M',10,'N','undead:spirit|incorporeal|charm song|needmagical','Four dead throats harmonizing from one hollow; those who listen forget to eat.'],
  ['ash hag','7',0,9,'claw 2d6+1, curse','CE','M',14,'C','outer:hag?|illusion|frost hex|immortal:good','Blistered grandmother of the burn-wastes; her frost makes blisters from the inside.'],
  ['brine hag','8',1,9,'bite 2d4+2, storm call','CE','M',15,'C','outer:hag?|water|illusion|storm servant','Salt-crusted and patient; commands the drowned to rise and answer.'],
  ['mire hag','9',0,9,'claw 2d6+2, pig-touch','CE','M',16,'C','outer:hag?|illusion|polymorph touch|familiar','Green-pocked of the black fen; turns the rude into livestock and keeps them in a pen.'],
  ['brownie','1',7,12,'—','CG','S',10,'N','fey|invisibility','Small hearth-housekeeper; pays in milk, avenges in needle-threads.'],
  ['pixie','1+1',6,12,'bow 1d4+sleep arrow','CG','T',10,'N','fey|fly|invisibility|confusion dance','Mischief with wings; its arrow-sleep is restful, its pranks are not.'],
  ['sprite','1',6,12,'arrow 1d3+sleep','CG','T',9,'N','fey|fly|sleep arrow','A glitter of green coat and tiny bow; guard of the hollow hills.'],
  ['spriggan','2+1',5,12,'dagger 1d2+size shift','NE','T',11,'C','fey|size shift','Tiny thug of the hedgerow; grows to giant-rage mid-swing.'],
  ['nocker','2',5,9,'dagger 1d4+1','CE','T',9,'N','fey|machine sabotage','One-foot engineer who takes your clockwork personally.'],
  ['glaistig','4',5,9,'claw 1d6+1, milk tribute','CG','M',11,'C','fey|horse|goat','Half-woman, half-goat guardian of the shieling; ask permission for your own milk.'],
  ['satyr','3',7,9,'short bow 1d6+pipe sleep','CN','S',10,'N','fey|pipe charm','Goat-legged piper; his tune is a lullaby and an insult simultaneously.'],
  ['centaur','4',5,12,'bow 1d8+1, hoof 1d6','N','L',11,'C','horse|missile:8','Half a man and all the anger of the frontier.'],
  ['nymph','7',7,9,'stare:stun','CG','M',12,'C','fey|stare|healing water','Spirit of a wood or well; look too long and wake an hour later, weeping, empty-handed.'],
  ['dryad','8',7,9,'—','CG','M',13,'C','fey|tree bound|charm','The tree is the dryad, not the other way around; your axe is a declaration.'],
  ['nereid','6',7,12,'—','CG','M',12,'C','fey|water|weather call','Green-haired sea-daughter who calls weather for her favourites.'],
  ['triton','6',6,12,'trident 1d8+2','CG','M',12,'C','fey|water|conch sleep','Herald of the coral courts; his conch sleeps crews in their boats.'],
  ['merman','4',6,15,'spear 1d8','CN','M',10,'C','water|charm song','Salt-green fisher of the reef roads; trades pearls for shiny grief.'],
  ['hippocamp','4',6,18,'bite 1d6','N','L',9,'N','water|horse','Horse before, fish behind; faster than any ship, and unimpressed by all of them.'],
  // ---------------- fiends of the underworld (devils & demons)
  ['brimstone warden','6+3',2,12,'claw 1d6+flame 1d4+1, sting 1d4','LE','M',16,'C','outer:devil|fire:immune|regen:1|barbed hide|fear:gaze','Hooked chain-bearer of the rust legations; its gaze pins oath-breakers.'],
  ['ash wing advocate','5+3',3,9,'sword +2 1d8+4, wing 1d4','LE','M',15,'C','outer:devil|fly|charm|contracts','Winged lawyer of the red courts; wins the argument, then owns the winner.'],
  ['horned legionnaire','8+3',-2,12,'bite 2d4+poison, claw 1d4 x2','LE','L',17,'C','outer:devil|poison:par|teleport|fire:immune','Iron-crown commander of the fourth march; appears in a pillar of horn smoke.'],
  ['ice tormentor','6+3',1,9,'claw 1d4+2, cold blast 5d6','LE','M',16,'C','outer:devil|cold:immune|breath:cold,5d6,cone,2','Hoofed frost-master of the ninth terrace; its breath is a white whisper.'],
  ['spined tormentress','5+3',2,9,'claw 1d4+spines 1d8','LE','M',15,'C','outer:devil|fly|spine storm|poison:die','Feathers are spines; the spines are poisoned; the smile is worse.'],
  ['chainbearer','7+3',-1,12,'flail 2d6+1, claw 1d4 x2','LE','M',17,'C','outer:devil|fire:immune|summon devils','Tallow-faced jailer that summons warden-help with a bell of black brass.'],
  ['ember lord','11+3',-1,12,'two-handed sword +2 4d6+6, whip +1 2d4','CE','H',20,'C','outer:demon|fire:immune|needmagical|spellResist:30|summon demons|death burst','Crowned with black fire; when slain it detonates like a forgeside.'],
  ['vine howler','10+3',0,12,'2claw 3d4+4, bite 2d4','CE','H',16,'C','outer:demon|leap|through walls','A wall-thunder of vine-green muscle; doors are a suggestion.'],
  ['plague bride','8+3',3,9,'caress 1d4+plague','CE','M',16,'C','outer:demon|disease:plague|charm|invisibility','Veiled in mourning silk; her embrace is a funeral for three generations.'],
  ['fly herdsman','5+3',4,12,'sting 2d4+typhus','CE','M',13,'C','outer:demon|fly|poison:dmg|disease','Cowls over clouds of diseased flies like a shepherd over a poisoned flock.'],
  ['ink coiled one','6+3',1,12,'claw 1d8+constrict','CE','M',15,'C','outer:demon|water|constrict|ink screen','Serpent-coiled ink-shaper that drowns rooms in black water and darker ink.'],
  ['mire maggot','1+3',6,9,'bite 1d4+maggot infestation','CE','T',8,'N','outer:demon|parasitize','A flying maggot the size of a glove that intends your liver to be its nursery.'],
  ['musk creeper','5',6,1,'spores:thrall','N','M',20,'N','construct:mold|spores:thrall|no-weapons|fire:vuln|achg','Cyan lichen that convinces its host it is furniture.'],
  ['musk zombie','3',8,6,'slam 1d6+spores','N','M',8,'N','undead:none|spores:thrall|construct','A courteous thrall; it has stopped arguing with everyone, forever.'],
  ['lurking creeper','5',6,1,'tongue 1d4+drain 1d6','N','M',18,'C','spores:stun|no-weapons|pseudopod','A violet slab on false feet that pours over its prey like laundry.'],
  ['thousand eyes','3+1',4,3,'1000eyes spray','N','M',16,'N','spores:stun spray|construct|no-weapons','A furred loaf studded with blinking eyes, each firing a small agony.'],
  ['grave grub','2+2',6,3,'burrow grab 1d4','N','T',7,'N','burrow|parasitize','Larva the size of a dog that waits under the fresh-silled.'],
  ['tongue reaper','6',4,9,'tongue steal 1d8+pull','CN','L',12,'C','pseudopod|tongue grab','Squat brown barrel of a beast with a sticky, hook-barbed tongue.'],
  ['chrome hunter','8+4',-1,9,'2claw 2d4+3','N','H',16,'C','dust|needmagical|immune:nonmag melee','Six-legged chrome cat that hunts shining things and eats the shine.'],
  ['quickling','1+1',7,15,'javelin 1d4+traps','CN','T',8,'N','fey|fastness|speed trap','Small, quick, and personally offended by your slowness; sets speed-hate snares.'],
  ['tupilak','6',6,6,'gore 2d8+2','NE','M',20,'C','construct|bone|revenge spirit','A bone-horse stitched by a murdered man; it finishes the argument.'],
  ['foo hound','8',1,12,'bite 2d8+4','LG','H',18,'C','outer:true|fly|breath:fire,8d6,cone,3','Lion-body, dragon-horns, fish-scale; weeps only for the unjustly dead.'],
  ['sussuran','8+1',1,12,'crush 2d8+2','CN','H',15,'C','half elemental|fly storm','Half-woman, half-waterspout; her upper half is a beautiful threat.'],
  ['iron ravening','7+3',0,9,'2claw 2d4+4','CE','M',16,'C','outer:demon|mirror|paralyze','A babau-hunch of iron fur whose images multiply and whose bite locks the jaw.'],
  // ---------------- sea powers
  ['sea serpent','20+1',0,15,'bite 4d6+swallow','CN','G',16,'C','water|constrict|storms','Coils around a galleon like a fence around a garden.'],
  ['scylla','10+1',0,9,'6heads 2d6 each','CE','H',17,'C','water|six heads|immortal:heads','The strait with teeth; six necks, each with a different opinion of you.'],
  ['charybdis','—','—','—','whirlpool','N','G',20,'N','whirl|invulnerable','A throat in the sea that swallows the tide three times a day.'],
  ['longneck','14',1,9,'neck lash 2d6+constrict','N','G',12,'C','water|constrict','The lake’s old resident; polite, slow, and built like a dock crane.'],
  ['lake drake','12',2,12,'2claw 2d8+tail 3d6','N','H',13,'C','water','Winged serpent of the freshwater lochs; hoards sunken chapel bells.'],
  ['great whale','16',1,12,'tail 3d8+trample','N','G',14,'C','water|trample','Barnacled mountain; its grief-song is the loudest lonely thing in the world.']
  ]);
  /* @@ROWS@@ */

  // ============================================================== variant families (deterministic)
  const getM = k => M[k] || M[String(k).replace(/\s+/g, '_')];
  function variant(baseKey, name, hd, ac, mv, hpBonus, spOverrides, lookExtra) {
    const b = getM(baseKey); if (!b) { console.warn('monster variant base missing:', baseKey); return; }
    const key = name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
    const sp = Object.assign({}, b.special, spOverrides || {});
    const h = hdOf(hd);
    M[key] = Object.assign({}, b, {
      key, name, hd: h.n, hdMod: h.mod, ac, mv: mv || b.mv,
      special: sp, hpAvg: Math.max(1, h.n * 5 + h.mod * (h.n || 1) + (hpBonus || 0)),
      xp: xpOf(hd, b.morale, sp)
    });
  }
  function family(prefix, bases) {
    for (const [bname, sizes] of bases) {
      for (const [sz, hd, ac, mv, sp] of sizes) {
        variant(bname, sz + ' ' + M[bname].name, hd, ac, mv, 0, sp ? parseSpecials(sp) : null);
      }
    }
    void prefix;
  }

  // True dragons of the Emberwild: 9 scales x 3 age categories
  const DRAGONS = [
    ['red', 'Cinderwyrm', 'H', 'fire', 'needmagical', 3, 9, 'fear', 'Slags stone with its glare; hoards gems above all.'],
    ['blue', 'Stormwyrm', 'H', 'electric', '', 2, 8, '', 'Burrows through sand and stone; its breath is a line of lightning.'],
    ['green', 'Bogwyrm', 'H', 'gas', '', 1, 7, '', 'Lives in drowned forests; speaks with false voices.'],
    ['black', 'Mirewyrm', 'H', 'acid', '', 2, 8, '', 'Lurks in poisoned fens; acid runs from its jaws.'],
    ['white', 'Hoarwyrm', 'L', 'cold', '', 1, 9, '', 'Sleek and white as glacier ice; breathes a cone of rime.'],
    ['brass', 'Sunwyrm', 'H', 'fire', '', 2, 8, '', 'Kindly, curious, talkative; haunts warm deserts of the south.'],
    ['bronze', 'Tidewyrm', 'H', 'electric', '', 2, 8, '', 'Lives beneath salt water; delights in riddles.'],
    ['copper', 'Mesa wyrm', 'H', 'acid', '', 1, 8, '', 'Clever trickster of the badlands; loves to be feared.'],
    ['silver', 'Skywyrm', 'H', 'cold', '', 2, 9, '', 'Noble of the high peaks; walks disguised among mortals.']
  ];
  const AGES = [['young', 0, -1], ['adult', 5, 0], ['ancient', 12, -3]];
  for (const [ck, cname, size, btype, spTok, bhd, bac, extra, look] of DRAGONS) {
    for (const [ag, hdAdd, acAdj] of AGES) {
      const hd = bhd + hdAdd;
      const nm = ag + ' ' + cname.toLowerCase();
      const key = nm.replace(/[^a-z0-9]+/g, '_');
      M[key] = {
        key, name: nm, hd, hdMod: 0, ac: bac + acAdj, mv: 9 + (ag === 'ancient' ? 3 : ag === 'adult' ? 1 : 0),
        atks: [{ n: 1, dmg: (size === 'H' ? '4d4' : '3d4') + (hdAdd ? '+' + (hdAdd / 2 | 0) : '') }, { n: 2, dmg: '2d4' }, { n: 1, dmg: 'tail ' + (hd > 10 ? '2d6' : '1d8') }],
        align: ck === 'brass' || ck === 'bronze' || ck === 'copper' || ck === 'silver' ? 'LG' : 'CE',
        size, morale: 9, treasure: (ag === 'ancient' ? 'ABCD' : ag === 'adult' ? 'ABC' : 'AB') + 'H',
        special: Object.assign(parseSpecials('breath:' + btype + ',' + hd + 'd6,' + (btype === 'gas' ? 'cloud' : 'cone') + ',2|' + (spTok || '') + '|' + (extra || '') + '|fear:aura|spellResist:' + (ag === 'ancient' ? 40 : ag === 'adult' ? 25 : 10) + '|truesee'),
          { xpFixed: undefined }),
        hpAvg: hd * 8 + hd * 4, look, xp: xpOf(String(hd), 9, parseSpecials('breath|' + (spTok || '') + '|fear|spellResist'))
      };
      M[key].xp = (hd * hd + hd * 20) * 22 + 250 * hd / 2 | 0;
    }
  }

  // Elementals: four substances x four sizes
  const ELEM_BASE = {
    'lesser elemental of flame': { toks: 'immune:fire|nohit:normal', dmg: '2d4', ac: 2, mv: 9, hd: '2', size: 'S' },
    'lesser elemental of stone': { toks: 'needmagical', dmg: '2d4', ac: 0, mv: 6, hd: '3', size: 'M' },
    'lesser elemental of water': { toks: 'immune:cold|drown', dmg: '2d4', ac: 4, mv: 9, hd: '2', size: 'S' },
    'lesser elemental of air': { toks: 'immune:electric|whirl', dmg: '2d4', ac: 6, mv: 15, hd: '2', size: 'S' }
  };
  for (const [baseName, e] of Object.entries(ELEM_BASE)) {
    const b = ELEM_BASE[baseName];
    const tiers = [['lesser elemental of', 0, 1, 0], ['principal elemental of', 1, 4, -2], ['greater elemental of', 2, 8, -4]];
    const subst = baseName.replace('lesser elemental of ', '');
    for (const [pre, hdAdd, dmgAdd, acAdd] of tiers) {
      const nm = pre + ' ' + subst;
      const key = nm.replace(/[^a-z0-9]+/g, '_');
      const hd = b.hd.split('').join('') , hdN = +b.hd + hdAdd;
      M[key] = {
        key, name: nm, hd: hdN, hdMod: 0, ac: b.ac + acAdd, mv: b.mv,
        atks: [{ n: 1, dmg: (2 + dmgAdd) + 'd4' }], align: 'N', size: hdAdd === 0 ? b.size : hdAdd === 1 ? 'M' : 'L',
        morale: 20, treasure: 'N', special: parseSpecials(b.toks + '|outer:elemental|no-weapons'), hpAvg: hdN * 8,
        xp: 100 + hdN * hdN * 18 + dmgAdd * 80, look: 'A knot of living ' + subst + ', ' + (hdAdd === 2 ? 'towering' : 'waist-high') + '.'
      };
      void hd;
    }
  }

  // Outer creatures: three ranks each of lawful, neutral and chaotic
  const OUTERS = [
    ['celestial sentinel', 'LG', 'cast:cleric+5|immune:cold|regen:3|breath:cold,4d6,cone', 7, 6, 'H', 'A seven-foot warden of burnished bronze, wingless, inevitable.'],
    ['celestial hammerer', 'LG', 'cast:cleric+3|immune:fire', 5, '-1', 'M', 'A red-sainted strongman bearing a smith\'s hammer that never misses twice.'],
    ['celestial hound', 'LG', 'truesee|goodarmour', 4, 4, 'M', 'A tawny, keen-eyed hound of the high halls; hunts evil by scent.'],
    ['avoral judge', 'LG', 'cast:mage+4|spellResist:25', 6, 2, 'M', 'A hooded figure trailing feathers of pale light; weighs hearts in argument.'],
    ['star sentinel', 'NG', 'invisible|nohit:normal', 6, 0, 'M', 'A geometry of soft fire from beyond the spheres.'],
    ['magma minister', 'N', 'immune:fire|regen:1', 8, 0, 'H', 'A vassal of the deep furnace-throne, clad in running basalt.'],
    ['wind whisperer', 'N', 'cast:mage+6|incorporeal', 5, 3, 'M', 'A voice from a shape of turning dust.'],
    ['wave warden', 'N', 'immune:cold|constrict', 6, 2, 'L', 'A cold armoured rider that patrols the drowned roads.'],
    ['night ravener', 'NE', 'paralyze|drain:1|needmagical|undead:none', 7, 1, 'M', 'A faceless slaver from the black between stars; touches the soul.'],
    ['chaos flayer', 'CE', 'cast:mage+5|spellResist:20', 6, 1, 'M', 'Its true shape hurts to look upon; its spells are worse.'],
    ['blood oozefiend', 'CE', 'regen:5|constrict|poison:die', 7, 2, 'L', 'A reeking crimson tide with too many mouths.'],
    ['bone clawfiend', 'CE', 'pounce|pack', 5, 4, 'M', 'A jackal of the rust wastes, running on legs of old ivory.']
  ];
  for (const [n, al, toks, hd, ac, size, look] of OUTERS) {
    const key = n.replace(/[^a-z0-9]+/g, '_');
    M[key] = { key, name: n, hd, hdMod: 0, ac, mv: 12, atks: [{ n: 1, dmg: '2d6' }], align: al, size,
      morale: 12, treasure: 'ABC', special: parseSpecials(toks + '|outer:true'), hpAvg: hd * 8, xp: 400 + hd * hd * 20, look };
  }

  // Giant families and other classic size-ups
  const GIANTS = [
    ['hill giant', 12, 'stone-axe 2d8', 'N', 'H', 9, 'G', 500, 'Shaggy, stinking, dim; hurls boulders like peas.'],
    ['stone giant', 14, 'club 2d10', 'N', 'H', 12, 'G', 700, 'Grey as the cliffs it herds goats along.'],
    ['frost giant', 14, 'axe 2d10', 'CE', 'H', 12, 'G', 950, 'Pale reaver of the glacier coasts; immune to cold.'],
    ['fire giant', 16, 'mace 2d12', 'LE', 'H', 9, 'G', 2000, 'Copper-scaled smith of the mountain heart; immune to fire.'],
    ['cloud giant', 18, 'maul 3d8', 'CG', 'H', 18, 'G', 3000, 'Tangy-skied noble of the aerie citadels; strides on cloud-steps.'],
    ['storm giant', 20, 'war-hammer 4d8', 'CG', 'H', 15, 'G', 6000, 'Golden-maned judge of the thunder towers; hurls lightning.']
  ];
  for (const [n, hd, atk, al, size, mv, mor, xp, look] of GIANTS) {
    const key = n.replace(/[^a-z0-9]+/g, '_');
    M[key] = { key, name: n, hd, hdMod: 0, ac: 0, mv, atks: [{ n: 1, dmg: atk.split(' ')[1], name: atk.split(' ')[0] }],
      align: al, size, morale: mor, treasure: 'F,I', special: parseSpecials('missile:10'), hpAvg: hd * 9, xp, look };
  }
  // troll breeds
  const TROLLS = [['rock', 'immune:petrify'], ['ice', 'regen:2'], ['two-headed', ''], ['deep', 'truesee'], ['desert', 'camouflage'], ['stone', 'needmagical|regen:1']];
  for (const [breed, sp] of TROLLS) variant('troll', breed + ' troll', 6 + (breed === 'two-headed' ? 1 : 0), 3, 9, 0, parseSpecials('regen:3|' + sp));
  // ogre magi etc.
  variant('ogre', 'ogre chieftain', 5, 4, 9, 0, null);
  variant('ogre', 'two-headed ogre', 4, 5, 9, 0, parseSpecials(''));
  variant('troll', 'ogre mage', 5, 2, 12, 0, parseSpecials('shapechanger|cast:mage+6|invisible|regen:1'));
  variant('ettin', 'hill ettin', 10, 0, 9, 0, null);
  // humanoid tribes with chieftains/shamans
  const TRIBES = ['kobold', 'goblin', 'skeleton warrior', 'orc', 'hobgoblin', 'gnoll', 'bugbear', 'ogre', 'troll', 'ettin', 'minotaur', 'medusa', 'harpy', 'siren', 'merekine', 'brackish', 'hollow gnome', 'deep gnome', 'deep dwarf', 'dusk elf', 'oxfolk', 'tide elf', 'shoal-folk', 'cinder smith', 'straw giant', 'vine giant', 'firbolg kin'];
  for (const t of TRIBES) {
    const b = getM(t); if (!b) continue;
    if (!M[t + '_chieftain']) variant(t, t + ' chieftain', b.hd + 1, Math.max(-2, b.ac - 1), b.mv, 3, parseSpecials('morn:10'));
    if (b.hd <= 6 && !M[t + '_shaman']) variant(t, t + ' shaman', b.hd + 1, b.ac, b.mv, 0, parseSpecials('cast:cleric+' + Math.max(1, Math.floor(b.hd / 2))));
  }
  // greater/normal/mini versions of classic beasts
  const SCALES = [
    ['rat', 'giant rat', 'large rat', 'dire rat'],
    ['bat', 'huge bat', 'dire bat', 'giant bat'],
    ['spider', 'huge spider', 'giant spider', 'monstrous spider'],
    ['centipede', 'huge centipede', 'giant centipede', 'monstrous centipede'],
    ['scorpion', 'large scorpion', 'giant scorpion', 'monstrous scorpion'],
    ['snake', 'large venomous snake', 'giant venomous snake', 'huge venomous snake'],
    ['beetle', 'bombardier beetle', 'rhinoceros beetle', 'stag beetle'],
    ['tick', 'large tick', 'giant tick', 'monstrous tick']
  ];
  void SCALES;
  void family; void variant; void OUTERS; void GIANTS; void TROLLS; void AGES; void DRAGONS; void ELEM_BASE; void hdOf;
  // space-separated aliases so data may reference 'giant rat' or 'giant_rat'
  const baseCount = Object.keys(M).length;
  for (const k of Object.keys(M)) {
    if (k.indexOf('_') >= 0 && !M[k.replace(/_/g, ' ')]) M[k.replace(/_/g, ' ')] = M[k];
  }
  EF.Monsters = M;
  EF.mon = k => M[k] || M[String(k).replace(/\s+/g, '_')] || M[String(k).replace(/[^a-z0-9]+/gi, '_').toLowerCase()];
  EF.MONSTER_COUNT = () => baseCount;

  /* @@END@@ */
})();
