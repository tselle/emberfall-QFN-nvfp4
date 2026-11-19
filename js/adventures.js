/* Emberfall — adventures.js
 * Four hand-written adventures (E0–E3) playable solo or as one campaign, plus the
 * deterministic generator for fifty further adventures (five level bands x ten).
 * Grid legend (dungeon): # wall  . floor  + door  L locked door  S secret door
 *   > stairs down  < stairs up  ~ water  : rubble/debris  % rubble wall (climbable)
 * Grid legend (town):   (space) street  # building wall  D door of interest marked by
 *   an object square in front; objects: $ shop  H temple  I inn  R training hall
 *   P patron  E dungeon entry  X exit to wilds  W well  f fountain
 */
(function () {
  const EF = (globalThis.EF = globalThis.EF || {});
  const R = EF.Rules;

  // ------------------------------------------------------------------ utils
  function normGrid(rows, fill) {
    const w = Math.max(...rows.map(r => r.length));
    return rows.map(r => {
      if (Array.isArray(r)) {
        const c = r.slice();
        while (c.length < w) c.push(fill || '#');
        return c;
      }
      return (r.length < w ? r + (fill || '#').repeat(w - r.length) : r).split('');
    });
  }
  function findMarker(grid, ch) {
    for (let y = 0; y < grid.length; y++) for (let x = 0; x < grid[y].length; x++) if (grid[y][x] === ch) return { x, y };
    return null;
  }
  function findAll(grid, ch) {
    const out = [];
    for (let y = 0; y < grid.length; y++) for (let x = 0; x < grid[y].length; x++) if (grid[y][x] === ch) out.push({ x, y });
    return out;
  }

  function makeFloor(o) {
    const grid = normGrid(o.grid, '#');
    const entry = o.entry || findMarker(grid, '<') || findMarker(grid, 'E') || { x: 1, y: 1 };
    return {
      name: o.name, grid, entry,
      monsters: (o.monsters || []).map(m => Object.assign({ sleeping: false, ambush: false }, m)),
      treasure: o.treasure || [], traps: o.traps || [], secrets: o.secrets || [],
      events: o.events || [], exits: o.exits || [], desc: o.desc || ''
    };
  }

  function makeTown(o) {
    // building-door cleanup: a 'D' marks a door in a building face; punch the
    // wall tile beneath it so the interior is actually entered from the street
    if (o.grid && o.grid.length && typeof o.grid[0] === 'string') {
      o.grid = o.grid.map((r, y) => {
        if (y === 0) return r;
        const prev = o.grid[y - 1];
        let out = r.split('');
        for (let x = 0; x < Math.min(prev.length, out.length); x++) if (prev[x] === 'D') out[x] = ' ';
        return out.join('');
      });
    }
    const grid = normGrid(o.grid, ' ');
    return { name: o.name, grid, objects: o.objects || [], desc: o.desc || '' };
  }

  // shop definition helper
  const shop = (x, y, kind, name, extra) => Object.assign({ x, y, kind, name }, extra || {});

  // handFloor: an authored floor built from room rectangles and corridors, so
  // every placed thing sits on ground that exists. Rooms are {x,y,w,h}; links
  // are pairs of room indices joined by an L-corridor; things are placed by
  // {room, dx, dy} (offset from room centre) or absolute {x, y}.
  function handFloor(o) {
    const w = o.w, h = o.h;
    const g = [];
    for (let y = 0; y < h; y++) g.push(new Array(w).fill('#'));
    const rooms = (o.rooms || []).map(r => {
      for (let y = r.y; y < r.y + r.h; y++) for (let x = r.x; x < r.x + r.w; x++) g[y][x] = '.';
      return { x: r.x, y: r.y, w: r.w, h: r.h, cx: r.x + (r.w >> 1), cy: r.y + (r.h >> 1) };
    });
    const centre = c => typeof c === 'number' ? rooms[c] : c;
    for (const [a, b] of o.links || []) {
      let x = centre(a).cx, y = centre(a).cy;
      const t = centre(b);
      const step = () => { if (g[y][x] === '#') g[y][x] = '.'; };
      while (x !== t.cx) { x += Math.sign(t.cx - x); step(); }
      while (y !== t.cy) { y += Math.sign(t.cy - y); step(); }
    }
    const at = p => {
      if (p.room !== undefined) { const r = rooms[p.room]; return { x: r.cx + (p.dx || 0), y: r.cy + (p.dy || 0) }; }
      return { x: p.x, y: p.y };
    };
    const entry = at(o.entry); g[entry.y][entry.x] = '<';
    let down = null;
    if (o.down) { down = at(o.down); g[down.y][down.x] = '>'; }
    for (const d of o.doors || []) { const p = at(d); g[p.y][p.x] = '+'; }
    const secrets = (o.secrets || []).map(sc => {
      const p = at(sc);
      g[p.y][p.x] = 'S';
      return Object.assign({ x: p.x, y: p.y }, sc, { x: p.x, y: p.y });
    });
    for (const wt of o.water || []) for (let y = wt[1]; y < wt[1] + wt[3]; y++) for (let x = wt[0]; x < wt[0] + wt[2]; x++) if (g[y][x] === '.') g[y][x] = '~';
    for (const al of o.alcoves || []) { const p = at(al); if (al.door) g[p.y][p.x] = 'S'; else g[p.y][p.x] = '.'; }
    const map = arr => (arr || []).map(t => {
      const p = at(t);
      return Object.assign({}, t, { x: p.x, y: p.y });
    });
    return makeFloor({
      name: o.name, desc: o.desc, grid: g, entry: o.dir != null ? Object.assign({ dir: o.dir }, entry) : entry,
      monsters: map(o.monsters), treasure: map(o.treasure), traps: map(o.traps),
      secrets, events: map(o.events)
    });
  }

  // ================================================================== E0
  const E0 = {
    id: 'e0', no: 0, title: 'The Cellars of Thornwick', band: 0, levels: [1, 2],
    townName: 'Thornwick',
    intro: 'Three nights ago the cellar-stairs of Thornwick began to echo with more than rats. ' +
      'Reeve Alaine Dun will pay in coin and in thanks for whoever clears the beer-cellars, ' +
      'the old under-cellar, and whatever has started ringing the cistern bell at midnight.',
    patron: { name: 'Reeve Alaine Dun', text: 'Six barrels rolled into the street by themselves, traveller. My stout-folk refuse to go down the stairs. Kill what is down there and the purse is yours.' },
    quests: [
      { id: 'q0_main', name: 'The Cellars of Thornwick', main: true, brief: 'Slay Grumtek Gutterking in the deep cistern.', gold: 600, xp: 2400, tag: 'grumtek_gutterking' },
      { id: 'q0_chalice', name: 'The Hearth-Chalice', brief: 'Recover the temple chalice stolen from Saint Cerena’s house.', gold: 250, xp: 1000, item: 'q0_chalice' },
      { id: 'q0_rats', name: 'A Rater’s Wage', brief: 'Thin the giant rat brood in the beer-cellars (kill 6).', gold: 80, xp: 300, killCount: 6, killTag: 'giant rat' },
      { id: 'q0_skellies', name: 'The Under-Cellar', brief: 'Break the bones that walk in the under-cellar (kill 5 skeletons).', gold: 160, xp: 600, killCount: 5, killTag: 'skeleton warrior' }
    ],
    town: makeTown({
      name: 'Thornwick',
      desc: 'A wool-town of pale stone and wet thatch, gathered around a cobbled square. The reeve’s hall looks new; the cellars beneath it do not.',
      grid: [
        '                     ',
        '  #####    ######     ',
        '  #$$$#    #I   #     ',
        '  #$ #$    #  # #     ',
        '  ##D##    ##D##      ',
        '              W       ',
        '   ####    ####       ',
        '   #H  #   #R #       ',
        '   #  D#   #D#        ',
        '   #####   ####   ### ',
        '            f    #   E',
        '   #####          ### ',
        '   #P  #            # ',
        '   ##D##            X ',
        '                      '
      ],
      objects: [
        shop(4, 12, 'patron', 'Reeve Hall'),
        shop(3, 3, 'shop_general', 'Bennet’s Sundry'),
        shop(10, 4, 'shop_general', 'The Fleece & Flagon (general)'),
        shop(4, 8, 'shop_armour', 'Ode the Armourer'),
        shop(9, 4, 'shop_weapons', 'Ode the Armourer (arms)'),
        shop(5, 8, 'temple', 'House of Saint Cerena'),
        shop(9, 7, 'inn', 'The Fleece & Flagon'),
        shop(10, 7, 'training', 'Moot-yard'),
        { x: 19, y: 10, kind: 'dungeon', name: 'Cellar Stairs', floors: 3 },
        { x: 20, y: 13, kind: 'wildexit', name: 'South Gate' },
        { x: 12, y: 5, kind: 'well', name: 'Village Well' },
        { x: 12, y: 8, kind: 'fountain', name: 'Square Fountain' }
      ]
    }),
    boss: 'grumtek_gutterking',
    floors: [
      handFloor({
        name: 'The Beer-Cellars', w: 28, h: 17, dir: 2,
        desc: 'Barrel-racks and bottle-lofts, gone green with damp. Something has rolled the good stout into a throne.',
        rooms: [
          { x: 23, y: 13, w: 3, h: 3 },  // 0 entry stair
          { x: 15, y: 12, w: 5, h: 4 },  // 1 racking hall
          { x: 8, y: 12, w: 5, h: 4 },   // 2 the muddy casks
          { x: 2, y: 12, w: 4, h: 4 },   // 3 bottle-lofts
          { x: 2, y: 4, w: 5, h: 5 },    // 4 green cellar
          { x: 9, y: 3, w: 7, h: 5 },    // 5 vintners walk
          { x: 19, y: 2, w: 6, h: 5 },   // 6 the rolled stout (throne room)
          { x: 18, y: 9, w: 7, h: 2 }    // 7 the long barrel-run
        ],
        links: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 1], [2, 7]],
        entry: { room: 0 }, down: { room: 5, dx: 2 },
        doors: [{ room: 1, dx: -2, dy: 1 }, { room: 5, dx: -3, dy: 0 }],
        monsters: [
          { m: 'giant rat', room: 2, n: 3 }, { m: 'giant rat', room: 3, dx: 1, n: 2 },
          { m: 'giant rat', room: 7, dx: -2, n: 2, ambush: true },
          { m: 'kobold', room: 4, n: 4 }, { m: 'kobold', room: 7, dx: 2, n: 3 },
          { m: 'goblin', room: 5, dx: -2, n: 3 }, { m: 'goblin', room: 6, dx: 2, n: 2 }
        ],
        treasure: [
          { room: 4, dx: 1, dy: 1, hoard: 'I', name: 'kobold stash' },
          { room: 3, dy: 1, hoard: 'C', name: 'goblin cache' },
          { room: 6, dx: -2, dy: 1, hoard: 'I', name: 'belly-band purse' },
          { room: 4, dx: -3, dy: 0, secret: true, hoard: 'A', name: 'hidden wall-cache' }
        ],
        secrets: [{ room: 4, dx: -3, dy: 0 }],
        traps: [{ room: 5, dx: 2, dy: -1, type: 'pit', depth: 1 }, { room: 7, dx: 0, type: 'darts' }, { room: 2, dx: -1, dy: 1, type: 'gas' }],
        events: [
          { room: 1, dx: 1, id: 'e0_rack', text: 'A rack of dusty bottles. One is sealed with red wax — a fighting-man’s brandy, 25 gp worth. (You pocket it.)', grant: { item: 'p_clw' } },
          { room: 6, dx: -1, dy: -1, id: 'e0_scratch', text: 'Hundreds of tally-scratches on the joists, and a goblin nursery in the corner. Someone has been counting the town’s nights.' }
        ]
      }),
      handFloor({
        name: 'The Under-Cellar', w: 28, h: 18,
        desc: 'Older stone, cut square. The dead of Thornwick’s founding families were once kept here before the chapel-yard was dug.',
        rooms: [
          { x: 2, y: 13, w: 5, h: 3 },   // 0 stair up
          { x: 2, y: 7, w: 5, h: 4 },    // 1 first vault
          { x: 2, y: 2, w: 6, h: 4 },    // 2 the long loculus
          { x: 11, y: 2, w: 6, h: 4 },   // 3 ossuary
          { x: 20, y: 2, w: 5, h: 4 },   // 4 archers’ walk
          { x: 20, y: 9, w: 5, h: 5 },   // 5 the deep vault
          { x: 11, y: 9, w: 6, h: 5 },   // 6 champion’s rest
          { x: 11, y: 15, w: 8, h: 2 },  // 7 stair landing
          { x: 21, y: 15, w: 5, h: 2 }   // 8 cistern approaches
        ],
        links: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 8], [7, 0], [6, 5]],
        entry: { room: 0 }, down: { room: 8, dx: 1 },
        doors: [{ room: 6, dx: -3, dy: 0 }, { room: 3, dx: 0, dy: -2 }],
        monsters: [
          { m: 'skeleton warrior', room: 2, dx: -1, n: 3 }, { m: 'skeleton warrior', room: 3, dx: 1, n: 2 },
          { m: 'skeleton archer', room: 4, n: 2 }, { m: 'skeleton warrior', room: 1, n: 3 },
          { m: 'skeleton champion', room: 6, n: 1 }, { m: 'giant spider', room: 0, dx: 1, dy: -1, n: 2 },
          { m: 'cellar slime', room: 8, n: 1 }, { m: 'ghoul', room: 5, n: 1, ambush: true }
        ],
        treasure: [
          { room: 6, hoard: 'B', name: 'grave-goods' },
          { room: 1, dx: -2, secret: true, hoard: 'A', name: 'mason’s hidden fee' },
          { room: 8, hoard: 'C', name: 'slime digestings (sorted)' },
          { room: 4, dx: 1, dy: 1, secret: true, hoard: 'A', name: 'wall niche' }
        ],
        secrets: [{ room: 1, dx: -2 }, { room: 4, dx: 1, dy: 1 }],
        traps: [{ room: 3, dy: 1, type: 'blade' }, { room: 7, type: 'falling block' }, { room: 5, dx: -1, dy: 1, type: 'pit', depth: 2 }],
        events: [
          { room: 2, dx: 2, id: 'e0_chalice_evt', text: 'A tomb niche, recently robbed: candle-wax, gnawed bread, and the temple’s missing chalice, kicked behind the slab.', grant: { item: 'q0_chalice' } }
        ]
      }),
      handFloor({
        name: 'The Deep Cistern', w: 28, h: 19,
        desc: 'Thornwick’s first water-supply, roofed with a dome of black stone. The bell is ringing.',
        rooms: [
          { x: 2, y: 15, w: 5, h: 3 },    // 0 stair up
          { x: 2, y: 9, w: 5, h: 4 },     // 1 feed-gallery
          { x: 2, y: 2, w: 6, h: 5 },     // 2 leak-court
          { x: 10, y: 2, w: 8, h: 5 },    // 3 the bell gallery
          { x: 20, y: 2, w: 5, h: 5 },    // 4 overflow vault
          { x: 20, y: 9, w: 5, h: 4 },    // 5 kobold warren
          { x: 20, y: 14, w: 5, h: 4 },   // 6 drowned sailor’s alcove
          { x: 10, y: 9, w: 8, h: 8 }     // 7 the cistern dome (water)
        ],
        links: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 0], [3, 7]],
        entry: { room: 0 },
        doors: [{ room: 7, dx: 0, dy: -3 }, { room: 5, dx: -3, dy: 0 }],
        monsters: [
          { m: 'grumtek_gutterking', room: 3, n: 1, quest: 'q0_main', boss: true },
          { m: 'bugbear', room: 2, n: 2 }, { m: 'bugbear', room: 4, n: 2, ambush: true },
          { m: 'kobold', room: 5, n: 5 }, { m: 'horse leech', room: 7, dx: 2, dy: 2, n: 4 },
          { m: 'bugbear chieftain', room: 7, dx: -3, dy: -3, n: 1 }, { m: 'shadow', room: 6, n: 1 }
        ],
        treasure: [
          { room: 3, hoard: 'D', name: 'Gutterking’s tribute chest' },
          { room: 5, dx: 1, dy: -1, secret: true, hoard: 'B', name: 'kobold debt-box' },
          { room: 6, dy: 1, hoard: 'I', name: 'drowned sailor' }
        ],
        secrets: [{ room: 5, dx: 1, dy: -1 }],
        traps: [{ room: 7, dx: 2, type: 'spear' }, { room: 7, dy: 3, type: 'fire' }, { room: 1, dy: 1, type: 'darts' }],
        events: [
          { room: 3, dy: -1, id: 'e0_bell', text: 'The cistern bell, stolen from the chapel, hangs over the water on a rope of braided hair. It swings, though the air is still.' }
        ],
        water: [[11, 11, 4, 4]]
      })
    ]
  };
  // bespoke boss: bugbear king, slightly better than a bugbear
  EF.Monsters['grumtek_gutterking'] = Object.assign({}, EF.Monsters['bugbear'], {
    key: 'grumtek_gutterking', name: 'Grumtek Gutterking', hd: 4, ac: 4, morale: 14, treasure: 'D',
    atks: [{ n: 1, dmg: '2d6+3' }], xp: 900,
    look: 'A bugbear in a crown of bottle-caps and a cloak of stolen coats, waving a stolen reeve-mace.'
  });

  // ================================================================== register
  EF.Adventures['e0'] = E0;
  // ================================================================== E1
  const E1 = {
    id: 'e1', no: 1, title: 'The Hollow Vaults', band: 1, levels: [1, 3],
    townName: 'Mallowbrook',
    intro: 'The order of the Hollow Lantern kept the old vaults under Mallowbrook for four hundred years, ' +
      'and kept them empty for four hundred years, which was the point. Nine days ago the seal-stone in the ' +
      'market cracked open by itself. The lantern still burns down there. Whatever holds it now does not share the order’s hobby of emptiness.',
    patron: { name: 'Bellwright Osne Camoyn', text: 'I keep the town bell and the town’s accounts, and both tell me we are out of time. The vaults took two of my water-carriers last night. Go down. Come back up. That is the whole of the commission.' },
    quests: [
      { id: 'q1_main', name: 'The Hollow Vaults', main: true, brief: 'Destroy the Gilded Wight that has claimed the vault-seal.', gold: 1400, xp: 5200, tag: 'the_gilded_wight' },
      { id: 'q1_lantern', name: 'The Lantern of the Hollow', brief: 'Recover the order’s lantern from the sealed crypt.', gold: 500, xp: 2000, item: 'q1_lantern' },
      { id: 'q1_children', name: 'The Water-Carriers', brief: 'Find the two water-carriers taken from Mallowbrook (free the captives).', gold: 300, xp: 1200, rescue: 2 },
      { id: 'q1_kobolds', name: 'Toll on the Stair', brief: 'End the kobold toll-booth on the first vault stair (kill 6 kobolds).', gold: 180, xp: 700, killCount: 6, killTag: 'kobold' }
    ],
    town: makeTown({
      name: 'Mallowbrook',
      desc: 'A long market-town along a mill-stream, all malt-yellow stone and wet moss. The market cross has a new hole in it, and the hole is the shape of a fist.',
      grid: [
        '                        ',
        '   ######      #####    ',
        '   #I    #    ##   ##   ',
        '   #  I  #    #$ $ #X   ',
        '   ##  D #    ##D##     ',
        '    ####      ##        ',
        '     W        f         ',
        '  #####    ######       ',
        '  #H   #   #P    #      ',
        '  #  D #   #   D #      ',
        '  #######  #######      ',
        '             ##         ',
        '   #####     #E#        ',
        '   #R  #     ###        ',
        '   ##D##                ',
        '                        '
      ],
      objects: [
        shop(4, 8, 'patron', 'Bellwright’s House'),
        shop(6, 3, 'shop_general', 'Tallow’s Provisioner'),
        shop(8, 3, 'shop_weapons', 'Tallow’s Provisioner (arms)'),
        shop(10, 4, 'shop_armour', 'Sixbannock’s Byrnie & Bolt'),
        shop(3, 9, 'temple', 'Chapel of the Quiet Lantern'),
        shop(4, 2, 'inn', 'The Millers’ Rest'),
        shop(2, 13, 'training', 'Belltower Yard'),
        { x: 15, y: 11, kind: 'dungeon', name: 'The Crack in the Market', floors: 3 },
        { x: 22, y: 3, kind: 'wildexit', name: 'East Road' },
        { x: 5, y: 6, kind: 'well', name: 'Mill-Stream Well' },
        { x: 13, y: 6, kind: 'fountain', name: 'Market Fountain' }
      ]
    }),
    boss: 'the_gilded_wight',
    floors: [
      handFloor({
        name: 'The First Vaults', w: 30, h: 21,
        desc: 'Barrel-vaulted ranges of grey stone, the Lantern order’s armoury-halls turned inside out into a kobold town. Bells that nobody rings hang over the stair.',
        rooms: [
          { x: 2, y: 16, w: 5, h: 4 },    // 0 stair hall
          { x: 2, y: 9, w: 7, h: 5 },     // 1 the toll gallery
          { x: 2, y: 2, w: 7, h: 5 },     // 2 kobold barracks
          { x: 11, y: 2, w: 8, h: 5 },    // 3 the bone-midden
          { x: 21, y: 2, w: 7, h: 5 },    // 4 fungus gardens
          { x: 22, y: 9, w: 6, h: 6 },    // 5 the cistern (frogs)
          { x: 12, y: 9, w: 8, h: 6 },    // 6 goblin warren
          { x: 13, y: 17, w: 6, h: 3 }    // 7 descent stair
        ],
        links: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 0], [6, 3]],
        entry: { room: 0 }, down: { room: 7, dx: 1 },
        doors: [{ room: 1, dx: 2, dy: 2 }, { room: 6, dx: -3, dy: 0 }],
        monsters: [
          { m: 'kobold', room: 1, dx: -1, n: 3 }, { m: 'kobold', room: 2, n: 4 },
          { m: 'kobold', room: 3, dx: -2, n: 2 },
          { m: 'goblin', room: 6, dx: -2, n: 3 }, { m: 'goblin', room: 6, dx: 2, dy: 1, n: 3 },
          { m: 'skeleton warrior', room: 3, dx: 2, n: 2 },
          { m: 'giant frog', room: 5, n: 2 },
          { m: 'stirge', room: 4, n: 5, sleeping: true }
        ],
        treasure: [
          { room: 1, dy: 1, hoard: 'C', name: 'kobold treasury (loot-boxes)' },
          { room: 2, dx: -3, secret: true, hoard: 'A', name: 'mason’s alcove' },
          { room: 6, dy: 1, hoard: 'I', name: 'goblin belts' },
          { room: 4, dx: 2, dy: 1, secret: true, hoard: 'B', name: 'sealed wall-pouch' }
        ],
        secrets: [{ room: 2, dx: -3 }, { room: 4, dx: 2, dy: 1 }],
        traps: [
          { room: 7, type: 'pit', depth: 1 }, { room: 1, dx: -2, type: 'darts' }, { room: 6, dx: 1, dy: -1, type: 'gas' }
        ],
        events: [
          { room: 1, dx: 2, id: 'e1_toll', text: 'A toll-booth, properly painted, with a kobold tariff posted in very small hand. Passage is six gp or one shield-arm.' },
          { room: 6, dx: 2, id: 'e1_captive1', text: 'A water-carrier from Mallowbrook, bound and hoarse from shouting. You cut her bonds.', rescue: 1 }
        ]
      }),
      handFloor({
        name: 'The Gallery Orders', w: 30, h: 23,
        desc: 'The order’s gallery of commandments, its wax-tablets gnawed. Something with manners has been collecting things here.',
        rooms: [
          { x: 2, y: 18, w: 6, h: 4 },    // 0 stair up
          { x: 2, y: 11, w: 6, h: 5 },    // 1 commandment gallery
          { x: 2, y: 3, w: 7, h: 6 },     // 2 the small shrine
          { x: 11, y: 3, w: 8, h: 5 },    // 3 reliquary walk
          { x: 21, y: 2, w: 7, h: 7 },    // 4 face-eater’s hall
          { x: 22, y: 12, w: 6, h: 7 },   // 5 pilgrims’ walk
          { x: 12, y: 11, w: 8, h: 6 },   // 6 offering vault
          { x: 12, y: 19, w: 7, h: 3 }    // 7 back stairs
        ],
        links: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 7], [7, 0], [1, 6]],
        entry: { room: 0 }, down: { room: 7, dx: 2 },
        doors: [{ room: 6, dx: -3, dy: -2 }, { room: 3, dx: 0, dy: -2 }],
        monsters: [
          { m: 'wight', room: 1, n: 2 },
          { m: 'skeleton warrior', room: 3, dx: -2, n: 3 },
          { m: 'ghast', room: 4, n: 3, ambush: true },
          { m: 'wight', room: 5, dy: -2, n: 2 },
          { m: 'skeleton champion', room: 2, n: 1 },
          { m: 'ghoul', room: 6, dx: 2, n: 1, ambush: true },
          { m: 'stirge', room: 5, dx: -1, dy: 2, n: 4 }
        ],
        treasure: [
          { room: 6, dx: -2, dy: 1, hoard: 'B', name: 'polluted offerings' },
          { room: 2, dx: -4, secret: true, hoard: 'B', name: 'hidden reliquary shelf' },
          { room: 4, dy: 1, hoard: 'C', name: 'ghast’s collectors’ hoard' },
          { room: 5, dy: -1, hoard: 'I', name: 'fallen pilgrim' }
        ],
        secrets: [{ room: 2, dx: -3 }],
        alcoves: [{ room: 2, dx: -4 }],
        traps: [
          { room: 3, dx: 2, type: 'blade' }, { room: 6, type: 'falling block' }, { room: 5, dx: 2, type: 'spear' }
        ],
        events: [
          { room: 6, dx: -2, dy: -1, id: 'e1_banner', text: 'The banner of the last Lantern-serjeant. The eaters of faces left the lantern worked in gold thread untouched — greed with manners.', grant: { gold: 120 } },
          { room: 7, dx: -2, id: 'e1_captive2', text: 'The second water-carrier, half-starved and furious. You cut him down.', rescue: 2 }
        ]
      }),
      handFloor({
        name: 'The Sealed Crypt', w: 28, h: 22,
        desc: 'The inmost vault: an octagon of black marble, its floor a mosaic of the Lantern’s last vigil. At its centre stands the Gilded Wight, holding the order’s lantern lit with its own hour.',
        rooms: [
          { x: 2, y: 2, w: 5, h: 4 },     // 0 stair up
          { x: 2, y: 9, w: 5, h: 5 },     // 1 north guard-chamber
          { x: 20, y: 2, w: 6, h: 5 },    // 2 east guard-chamber
          { x: 10, y: 8, w: 9, h: 9 },    // 3 the octagon
          { x: 2, y: 17, w: 5, h: 4 },    // 4 west gallery
          { x: 20, y: 10, w: 6, h: 6 },   // 5 crypt rows
          { x: 11, y: 19, w: 8, h: 2 }    // 6 south passage
        ],
        links: [[0, 1], [1, 2], [1, 3], [3, 5], [2, 5], [3, 4], [4, 6], [6, 5]],
        entry: { room: 0 },
        doors: [{ room: 3, dx: 0, dy: -4 }, { room: 3, dx: -5, dy: 0 }],
        monsters: [
          { m: 'the_gilded_wight', room: 3, n: 1, quest: 'q1_main', boss: true },
          { m: 'skeleton champion', room: 1, n: 2 },
          { m: 'wight', room: 2, n: 2 },
          { m: 'spectre', room: 4, n: 1 },
          { m: 'skeleton warrior', room: 5, n: 4 },
          { m: 'burning skull', room: 6, n: 1, ambush: true }
        ],
        treasure: [
          { room: 3, hoard: 'E', name: 'the Gilded Wight’s tribute' },
          { room: 5, dx: 2, dy: -2, secret: true, hoard: 'D', name: 'the order’s last strongbox' },
          { room: 0, dy: 1, hoard: 'I', name: 'Lantern-serjeant’s purse' }
        ],
        secrets: [{ room: 5, dx: 2, dy: -2 }],
        traps: [
          { room: 3, dx: 2, dy: -2, type: 'fire' }, { room: 4, dy: 1, type: 'pit', depth: 2 }, { room: 6, dx: 2, type: 'spear' }
        ],
        events: [
          { room: 3, dy: -2, id: 'e1_lantern_evt', text: 'The Lantern of the Hollow, won back. Its flame leans gently toward the surface, like a dog that wants to go home.', grant: { item: 'q1_lantern' } }
        ]
      })
    ]
  };
  EF.Monsters['the_gilded_wight'] = Object.assign({}, EF.Monsters['wight'], {
    key: 'the_gilded_wight', name: 'the Gilded Wight', hd: 7, ac: 2, morale: 20, treasure: 'E',
    atks: [{ n: 1, dmg: '1d10+4' }], drain: 2, xp: 3000,
    special: Object.assign({}, EF.Monsters['wight'].special, { drain: 2, fear: 'aura' }),
    look: 'A barrow-lord in gold funerary mask, wearing four hundred years like a well-cut coat.'
  });
  EF.Adventures['e1'] = E1;

  // ================================================================== E2
  const E2 = {
    id: 'e2', no: 2, title: 'Barrow of the Iron King', band: 2, levels: [3, 5],
    townName: 'Emberhollow',
    intro: 'Six miles north of Emberhollow the grass humps over the grave of Iron King Vos, who united the ' +
      'hill tribes with a hammer and was buried with his hammer, which is considered unwise. The barrow-door ' +
      'stood open a fortnight. Every night since, the hill-folk drums sound from under the mound.',
    patron: { name: 'Steward Havald Brune', text: 'The diggers refuse the barrow. Fine; pay is fine: bring me the Iron Crown in a sack, and do not put it on. Nobody in this town is that stupid. Everybody in this town is that stupid.' },
    quests: [
      { id: 'q2_main', name: 'The Iron King', main: true, brief: 'Destroy the cairn-king Vos in the inmost barrow.', gold: 3200, xp: 12000, tag: 'iron_king_vos' },
      { id: 'q2_crown', name: 'The Iron Crown', brief: 'Bring the Iron Crown to Steward Brune (and do not put it on).', gold: 1000, xp: 4000, item: 'm_crown_thorn' },
      { id: 'q2_diggers', name: 'The Lost Diggers', brief: 'Find the three missing barrow-diggers.', gold: 450, xp: 1800, rescue: 3 },
      { id: 'q2_bones', name: 'Hill-Haunt', brief: 'Break the barrow-wights’ guard on the causeway (kill 4 wights).', gold: 600, xp: 2400, killCount: 4, killTag: 'wight' }
    ],
    town: makeTown({
      name: 'Emberhollow',
      desc: 'A hill-town of black-timbered halls above a copper-smoke valley. From the moot-hill you can see the barrow-door, a dark rectangle in the grass, and the grass is wearing it well.',
      grid: [
        '                         ',
        '    #####      ######     ',
        '    #I   #    #$    ##    ',
        '    #  I #    # $ D ## X  ',
        '    ###D##    ## ####     ',
        '     ####      ##         ',
        '      W        f          ',
        '   #####      #####       ',
        '   #H  #      #P  #       ',
        '   # DG#      #  D#       ',
        '   #####      #####       ',
        '              ##          ',
        '   #####      #E          ',
        '   #R  #                    ',
        '   ##D##                    ',
        '                         '
      ],
      objects: [
        shop(8, 8, 'patron', 'Steward’s Hall'),
        shop(14, 1, 'shop_general', 'Slack’s Reek & Ledger'),
        shop(15, 3, 'shop_general', 'Slack’s Reek & Ledger (back room)'),
        shop(13, 3, 'shop_weapons', 'Slack’s Reek & Ledger (arms)'),
        shop(13, 4, 'shop_armour', 'Nine fores the Smithy'),
        shop(4, 9, 'shop_armour', 'Nine fores the Smithy (byrnie)'),
        shop(2, 9, 'temple', 'Shrine of the Hearthfather'),
        shop(5, 2, 'inn', 'The Smoked Hem'),
        shop(4, 13, 'training', 'Moot-yard'),
        { x: 13, y: 12, kind: 'dungeon', name: 'The Barrow-Door', floors: 4, locked: 'q2_open' },
        { x: 23, y: 3, kind: 'wildexit', name: 'South Road' },
        { x: 6, y: 6, kind: 'well', name: 'Common Well' },
        { x: 13, y: 6, kind: 'fountain', name: 'Moot Fountain' }
      ]
    }),
    boss: 'iron_king_vos',
    floors: [
      handFloor({
        name: 'The Causeway', w: 27, h: 23, dir: 2,
        desc: 'The processional road of a kingdom that left no kingdom: flat stones, boundary crests, and the small careful air of a house whose owners are home.',
        rooms: [
          { x: 2, y: 18, w: 6, h: 4 },    // 0 entry from the barrow-door
          { x: 2, y: 11, w: 6, h: 5 },    // 1 first crest-stone
          { x: 2, y: 3, w: 7, h: 6 },     // 2 the long cairn face
          { x: 12, y: 3, w: 6, h: 5 },    // 3 the tally wall
          { x: 20, y: 2, w: 5, h: 6 },    // 4 champion’s terrace
          { x: 20, y: 11, w: 5, h: 6 },   // 5 the shadow-pool
          { x: 11, y: 11, w: 7, h: 7 },   // 6 round antechamber
          { x: 2, y: 9, w: 4, h: 2 }      // 7 antler shot (side niche)
        ],
        links: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 0], [6, 3], [1, 7]],
        entry: { room: 0 }, down: { room: 6, dy: 1 },
        doors: [{ room: 6, dx: -3, dy: 0 }],
        monsters: [
          { m: 'wight', room: 1, n: 2 }, { m: 'wight', room: 2, dx: 1, n: 2 },
          { m: 'wight', room: 7, n: 2, ambush: true }, { m: 'wight', room: 5, dx: 1, n: 2 },
          { m: 'skeleton champion', room: 4, n: 2 },
          { m: 'skeleton warrior', room: 6, dy: -2, n: 4 },
          { m: 'hollow gnome', room: 6, dx: -2, n: 3, ambush: true },
          { m: 'shadow', room: 5, n: 2 }
        ],
        treasure: [
          { room: 3, hoard: 'C', name: 'crest-stone offerings' },
          { room: 2, dx: -3, secret: true, hoard: 'C', name: 'grave-good cache' },
          { room: 4, dy: 1, hoard: 'I', name: 'robber’s drop-purse' }
        ],
        secrets: [{ room: 2, dx: -3 }],
        traps: [
          { room: 0, dx: 2, type: 'darts' }, { room: 6, dx: 2, type: 'pit', depth: 2 }, { room: 3, dy: 1, type: 'gas' }
        ],
        events: [
          { room: 2, dy: -2, id: 'e2_cairn', text: 'A low cairn of hill-stones. Count them: one for every clan. The tally has not changed since Vos. The stones are cold in a way that has nothing to do with weather.' }
        ]
      }),
      handFloor({
        name: 'The Barrow Hall', w: 27, h: 24,
        desc: 'A round hall for a round people: hearth-stones, shield-bosses on the walls at the height of the dead who carried them, and one fire that has not gone out, in the sense that nobody has seen it go out.',
        rooms: [
          { x: 2, y: 19, w: 6, h: 4 },    // 0 stair up
          { x: 8, y: 8, w: 10, h: 9 },    // 1 the round hall
          { x: 2, y: 2, w: 5, h: 6 },     // 2 the grub-nests
          { x: 19, y: 2, w: 6, h: 6 },    // 3 buried household
          { x: 19, y: 17, w: 6, h: 6 },   // 4 knight-guard’s cells
          { x: 2, y: 10, w: 4, h: 7 }     // 5 the ghasts’ porch
        ],
        links: [[0, 1], [1, 2], [1, 3], [1, 4], [1, 5], [0, 5]],
        entry: { room: 0 }, down: { room: 1, dx: 3, dy: 3 },
        doors: [{ room: 1, dx: -5, dy: 0 }, { room: 1, dx: 0, dy: -4 }],
        monsters: [
          { m: 'barrow horror', room: 1, dx: -2, n: 1 },
          { m: 'wight, elder', room: 1, dx: 2, dy: -2, n: 1 },
          { m: 'bone golem', room: 1, dy: 2, n: 1 },
          { m: 'ghast', room: 5, n: 2, ambush: true },
          { m: 'cairn knight', room: 4, n: 1 },
          { m: 'skeleton champion', room: 4, dx: -1, dy: 2, n: 3 },
          { m: 'grave grub', room: 2, n: 3, sleeping: true }
        ],
        treasure: [
          { room: 1, dx: -3, dy: -3, hoard: 'D', name: 'the round-hall cauldron' },
          { room: 1, dx: -7, dy: 0, secret: true, hoard: 'C', name: 'wall of shield-bosses' },
          { room: 3, hoard: 'B', name: 'buried household' },
          { room: 1, dx: 5, dy: 1, secret: true, hoard: 'B', name: 'crevice cache' }
        ],
        secrets: [{ room: 1, dx: -6 }, { room: 1, dx: 5, dy: 1 }],
        alcoves: [{ room: 1, dx: -7 }],
        traps: [
          { room: 1, dx: 3, dy: -3, type: 'blade' }, { room: 2, type: 'pit', depth: 1 }, { room: 4, dy: -1, type: 'spear' }
        ],
        events: [
          { room: 1, dy: -1, id: 'e2_diggers1', text: 'A barrow-digger, dead these ten days, has been seated neatly among the household dead, shovel folded, as if invited.', rescue: 0, deadRescue: 'Digger Hob, of Emberhollow' },
          { room: 4, dx: -1, dy: 1, id: 'e2_diggers2', text: 'A second digger, alive, catatonic, seated at the wall with a stone on his head. You carry him out.', rescue: 1 }
        ]
      }),
      handFloor({
        name: 'The Iron Crypt', w: 27, h: 24,
        desc: 'The barrow’s iron age stratum: tools of a king’s household laid in ranks, every blade free of rust. The dead here were buried with their jobs.',
        rooms: [
          { x: 2, y: 2, w: 6, h: 4 },     // 0 stair down from hall
          { x: 19, y: 2, w: 6, h: 6 },    // 1 the gift-chamber
          { x: 2, y: 8, w: 5, h: 6 },     // 2 the armoured rank
          { x: 10, y: 9, w: 8, h: 7 },    // 3 the offering court
          { x: 19, y: 10, w: 6, h: 6 },   // 4 the champions’ rank
          { x: 2, y: 17, w: 6, h: 5 },    // 5 the builders’ crypt
          { x: 11, y: 19, w: 9, h: 4 }    // 6 the hall of works
        ],
        links: [[0, 2], [2, 3], [3, 1], [1, 4], [2, 5], [5, 6], [6, 4]],
        entry: { room: 0 }, down: { room: 6, dx: 3 },
        doors: [{ room: 3, dx: -4, dy: 0 }],
        monsters: [
          { m: 'cairn knight', room: 6, dx: -2, n: 2 },
          { m: 'mummy', room: 1, n: 1 },
          { m: 'haunt', room: 3, n: 1 },
          { m: 'ironmordant', room: 2, n: 2 },
          { m: 'skeleton champion', room: 4, n: 4 },
          { m: 'barrow horror', room: 6, dx: 2, n: 1, ambush: true },
          { m: 'stone slug', room: 6, dy: -1, n: 1 }
        ],
        treasure: [
          { room: 3, hoard: 'D', name: 'iron-crypt offerings' },
          { room: 5, dx: -3, secret: true, hoard: 'C', name: 'hidden builder’s cache' },
          { room: 1, dy: 1, hoard: 'C', name: 'mummy’s gifts' }
        ],
        secrets: [{ room: 5, dx: -3 }],
        traps: [
          { room: 3, dx: 2, type: 'fire' }, { room: 4, dx: -1, type: 'blade' }, { room: 0, dx: 2, type: 'darts' }
        ],
        events: [
          { room: 1, dy: -1, id: 'e2_diggers3', text: 'The third digger. You find only his shovel, folded, and his boots, paired.' }
        ]
      }),
      handFloor({
        name: 'The King’s Chamber', w: 27, h: 23,
        desc: 'Vos on his stone: an iron crown on a crown of salt, a sword across his knees laid as if for a toll. The chamber waits to be told what to do with you.',
        rooms: [
          { x: 2, y: 2, w: 5, h: 4 },     // 0 stair in
          { x: 9, y: 7, w: 9, h: 9 },     // 1 the throne dome
          { x: 2, y: 8, w: 4, h: 7 },     // 2 west porter
          { x: 20, y: 2, w: 4, h: 7 },    // 3 east porter
          { x: 20, y: 11, w: 4, h: 6 },   // 4 the jointure vault
          { x: 2, y: 17, w: 6, h: 4 },    // 5 the guard dead
          { x: 10, y: 19, w: 7, h: 3 }    // 6 back passage
        ],
        links: [[0, 2], [2, 1], [1, 3], [3, 4], [2, 5], [5, 6], [6, 4]],
        entry: { room: 0 },
        doors: [{ room: 1, dx: -4, dy: 0 }, { room: 1, dx: 0, dy: -4 }],
        monsters: [
          { m: 'iron_king_vos', room: 1, n: 1, quest: 'q2_main', boss: true },
          { m: 'cairn knight', room: 2, n: 2 },
          { m: 'cairn knight', room: 3, n: 2 },
          { m: 'wraith', room: 5, n: 1 },
          { m: 'wraith', room: 4, n: 1 },
          { m: 'bone golem', room: 6, n: 1 }
        ],
        treasure: [
          { room: 1, hoard: 'E', name: 'the grave-goods of a king' },
          { room: 1, dx: -6, dy: 0, secret: true, hoard: 'D', name: 'the crown-throne’s hidden lap', grantItem: 'm_crown_thorn' },
          { room: 5, dy: 1, hoard: 'C', name: 'throne-guard cache' }
        ],
        secrets: [{ room: 1, dx: -5 }],
        alcoves: [{ room: 1, dx: -6 }],
        traps: [
          { room: 1, dx: 3, dy: -3, type: 'fire' }, { room: 6, type: 'spear' }, { room: 3, dy: 2, type: 'falling block' }
        ],
        events: [
          { room: 3, dy: -2, id: 'e2_porters', text: 'Two porters in the old salt-and-iron rite, seated with their backs straight. The door was never barred against them; they were the bar.' }
        ]
      })
    ]
  };
  EF.Monsters['iron_king_vos'] = Object.assign({}, EF.Monsters['cairn knight'], {
    key: 'iron_king_vos', name: 'Iron King Vos', hd: 11, ac: -1, morale: 22, treasure: 'E',
    atks: [{ n: 1, dmg: '2d8+6' }], xp: 6500, hpAvg: 90,
    special: Object.assign({}, EF.Monsters['cairn knight'].special, { drain: 1, fear: 'aura', spellResist: 25, summoner: true }),
    look: 'A barrow-king in rusted plate, hammer in one fist, crown in the other, wearing his rust like a title.'
  });
  EF.Adventures['e2'] = E2;
  // ================================================================== E3
  const E3 = {
    id: 'e3', no: 3, title: 'The Witch-Queen of Ravenmoor', band: 3, levels: [5, 7],
    townName: 'Fenmarch',
    intro: 'The fen-town of Fenmarch pays its tithe in missing people. Twice a year the mire takes a family, ' +
      'and twice a year the folk of Fenmarch leave bread and a lock of hair at the root-bridge so the Witch-Queen ' +
      'of Ravenmoor will pass over their houses another season. A company of decent murders is requested at the eaves of the fen.',
    patron: { name: 'Mootwife Hesper Vell', text: 'We have fed the fen for a generation and it is still hungry. Our seers say the Witch-Queen is not one hag but a hundred hags in a hag’s coat, and none of them have ever been asked for rent. Ask her.' },
    quests: [
      { id: 'q3_main', name: 'The Witch-Queen', main: true, brief: 'End the Witch-Queen Sable upon the Thorn Throne.', gold: 7000, xp: 26000, tag: 'the_witch_queen_sable' },
      { id: 'q3_hand', name: 'The Grey Hand', brief: 'Recover the Grey Hand of Saint Cerena from the mirror gallery.', gold: 2200, xp: 9000, item: 'q3_hand' },
      { id: 'q3_titles', name: 'The Tithe-Children', brief: 'Find the tithe-children the fen has kept (free 4 captives).', gold: 1800, xp: 7200, rescue: 4 },
      { id: 'q3_hags', name: 'Brood-Mothers', brief: 'Kill the three brood-hags that tend the fen-lairs.', gold: 2400, xp: 9600, killCount: 3, killTag: 'mire hag' }
    ],
    town: makeTown({
      name: 'Fenmarch',
      desc: 'Stilt-houses and reed-roofs above black water, joined by board-walks. Everything here has a mild, watchful patience, like the fen itself.',
      grid: [
        '                         ',
        '   ######       ######     ',
        '   #I   #      # $  ##    ',
        '   #  I #      #$  D ##   ',
        '   ###D##      ### ###  X ',
        '    ####         ##       ',
        '     f           W        ',
        '  #####       #####       ',
        '  #H  #       #P  #       ',
        '  #  D#       #  D#       ',
        '  #####       #####       ',
        '              ##          ',
        '  #####       #E#         ',
        '  #R  #       ###         ',
        '  ##D##                   ',
        '                         '
      ],
      objects: [
        shop(7, 8, 'patron', 'Mootwife Vell’s Stilt-House'),
        shop(15, 1, 'shop_general', 'Reed & Tallow’s'),
        shop(14, 3, 'shop_general', 'Reed & Tallow’s (arms)'),
        shop(16, 3, 'shop_armour', 'the Cooper’s Byrnie'),
        shop(3, 9, 'temple', 'Chapel-Boat of Saint Cerena'),
        shop(4, 2, 'inn', 'The Drowned Bell'),
        shop(3, 13, 'training', 'Board-yard'),
        { x: 13, y: 12, kind: 'dungeon', name: 'The Root-Bridge', floors: 4 },
        { x: 22, y: 4, kind: 'wildexit', name: 'Bank Gate' },
        { x: 5, y: 6, kind: 'fountain', name: 'Rain-Butt' },
        { x: 16, y: 6, kind: 'well', name: 'Sweetwell' }
      ]
    }),
    boss: 'the_witch_queen_sable',
    floors: [
      handFloor({
        name: 'The Drowned Causeway', w: 28, h: 24,
        desc: 'A road the fen has agreed to keep only halfway: causeway-stones at water-height, alder trunks standing in it like congregations.',
        rooms: [
          { x: 2, y: 19, w: 6, h: 4 },    // 0 root-bridge head
          { x: 2, y: 12, w: 7, h: 5 },    // 1 the half-drowned stones
          { x: 11, y: 13, w: 8, h: 5 },   // 2 the leech-field
          { x: 21, y: 12, w: 5, h: 6 },   // 3 corpse-candle walk
          { x: 20, y: 3, w: 6, h: 6 },    // 4 the tithe-shrine
          { x: 10, y: 3, w: 8, h: 6 },    // 5 the coil-pools
          { x: 2, y: 3, w: 6, h: 6 },     // 6 the merekin-steading
          { x: 12, y: 10, w: 6, h: 2 }    // 7 the crossing
        ],
        links: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 1], [2, 7], [7, 5]],
        entry: { room: 0 }, down: { room: 7, dx: 2 },
        water: [[12, 14, 5, 2], [11, 5, 4, 2], [3, 13, 4, 1]],
        doors: [{ room: 7, dx: -2, dy: 0 }],
        monsters: [
          { m: 'brackish', room: 1, n: 4 }, { m: 'brackish', room: 2, dx: -3, dy: 1, n: 3, ambush: true },
          { m: 'merekine', room: 6, n: 4 },
          { m: 'horse leech', room: 2, dx: 0, dy: 2, n: 5 },
          { m: 'corpse-candle', room: 3, n: 3 },
          { m: 'creeping coil', room: 5, dx: -2, dy: -2, n: 2 },
          { m: 'great crocodile', room: 5, dy: 1, n: 1, ambush: true },
          { m: 'brine hag', room: 4, n: 1, quest: 'q3_hags' }
        ],
        treasure: [
          { room: 6, hoard: 'C', name: 'tithe-goods' },
          { room: 6, dx: -3, secret: true, hoard: 'C', name: 'causeway hoard' },
          { room: 3, dy: 1, hoard: 'I', name: 'drowned pilgrim' }
        ],
        secrets: [{ room: 6, dx: -3 }],
        traps: [
          { room: 1, type: 'spear' }, { room: 7, type: 'pit', depth: 1 }, { room: 3, dx: 1, type: 'gas' }
        ],
        events: [
          { room: 7, dy: -1, id: 'e3_rootbridge', text: 'From the crossing you can see the causeway all the way to its end, and the end is occupied. You decide the fen did not see you decide that.' }
        ]
      }),
      handFloor({
        name: 'The Root Halls', w: 28, h: 24,
        desc: 'Halls grown rather than built: alder walls roped at the shoulders, floors of packed peat, everything faintly breathing with the season.',
        rooms: [
          { x: 2, y: 18, w: 6, h: 5 },    // 0 stair up
          { x: 2, y: 10, w: 6, h: 6 },    // 1 mire hag’s hall
          { x: 11, y: 15, w: 8, h: 6 },   // 2 the quickling warren
          { x: 21, y: 12, w: 5, h: 7 },   // 3 the fen-tithe room
          { x: 20, y: 3, w: 6, h: 6 },    // 4 the ash hag’s garden
          { x: 11, y: 3, w: 7, h: 6 },    // 5 the spriggan walk
          { x: 2, y: 2, w: 6, h: 6 },     // 6 the worm-hollow
          { x: 11, y: 10, w: 7, h: 3 }    // 7 the nymph’s stow-pool
        ],
        links: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 6], [6, 1], [2, 7], [7, 5]],
        entry: { room: 0 }, down: { room: 3, dy: 1 },
        water: [[12, 11, 2, 1]],
        doors: [{ room: 7, dx: -3, dy: 0 }],
        monsters: [
          { m: 'mire hag', room: 1, n: 1, quest: 'q3_hags' },
          { m: 'mire hag', room: 3, n: 1, quest: 'q3_hags' },
          { m: 'mire hag', room: 5, dx: 2, n: 1, quest: 'q3_hags' },
          { m: 'ash hag', room: 4, n: 1, quest: 'q3_hags' },
          { m: 'spriggan', room: 5, n: 4 },
          { m: 'quickling', room: 2, dx: 2, n: 4, ambush: true },
          { m: 'green worm', room: 6, n: 5, sleeping: true },
          { m: 'flicker spider', room: 2, dx: -2, n: 2 },
          { m: 'nymph', room: 7, dx: -3, n: 1 },
          { m: 'thistle drake', room: 3, dx: 1, n: 3 }
        ],
        treasure: [
          { room: 1, hoard: 'D', name: 'hag-hoard (cursed-ish)' },
          { room: 4, hoard: 'D', name: 'ash hag’s frost-box' },
          { room: 6, dx: -3, secret: true, hoard: 'C', name: 'root-bound cache' },
          { room: 3, dy: -1, hoard: 'C', name: 'fen-tithe chest' }
        ],
        secrets: [{ room: 6, dx: -3 }],
        traps: [
          { room: 2, type: 'pit', depth: 1 }, { room: 5, dx: -2, type: 'darts' }, { room: 0, dx: 2, type: 'gas' }
        ],
        events: [
          { room: 2, dy: -1, id: 'e3_c1', text: 'A tithe-child, seven years in the fen-service, now a sharp-featured stranger who asks your name three times before trusting it.', rescue: 1 },
          { room: 6, dy: 1, id: 'e3_c2', text: 'Two tithe-children, older, guard dogs of the hag; you must convince or fight them free.', rescue: 2 },
          { room: 4, dy: -2, id: 'e3_runes', text: 'Growth-runes carved into a living beam. Reading them backwards tells you where the mirror gallery hides its third wall.' }
        ]
      }),
      handFloor({
        name: 'The Mirror Gallery', w: 28, h: 23,
        desc: 'The witch-queen’s glass walk: mirrors of fen-silver on frames of root, each one keeping a slightly different company.',
        rooms: [
          { x: 2, y: 2, w: 6, h: 4 },     // 0 stair up
          { x: 9, y: 6, w: 10, h: 10 },   // 1 the long gallery
          { x: 21, y: 5, w: 5, h: 7 },    // 2 the glass shrine
          { x: 2, y: 8, w: 5, h: 7 },     // 3 the west glasses
          { x: 9, y: 18, w: 10, h: 4 },   // 4 the south walk
          { x: 21, y: 14, w: 5, h: 7 }    // 5 the east passage
        ],
        links: [[0, 1], [1, 2], [1, 3], [3, 4], [4, 5], [5, 2], [0, 3]],
        entry: { room: 0 }, down: { room: 5, dy: 1 },
        doors: [{ room: 1, dx: 0, dy: -4 }],
        monsters: [
          { m: 'doppelling', room: 1, dx: -3, n: 2, ambush: true },
          { m: 'changeling', room: 1, dx: 3, dy: 2, n: 1 },
          { m: 'spectre', room: 2, n: 2 },
          { m: 'shadow', room: 3, dy: -1, n: 3 },
          { m: 'corpse-chorus', room: 4, n: 1, ambush: true }
        ],
        treasure: [
          { room: 2, hoard: 'D', name: 'mirror-shrine offerings' },
          { room: 3, dx: -4, secret: true, hoard: 'D', name: 'behind the false glass' }
        ],
        secrets: [{ room: 3, dx: -3 }],
        alcoves: [{ room: 3, dx: -4 }],
        traps: [
          { room: 1, dx: 4, dy: -3, type: 'blade' }, { room: 4, dx: 3, type: 'spear' }, { room: 1, dx: -4, dy: 3, type: 'fire' }
        ],
        events: [
          { room: 1, dy: -2, id: 'e3_hand', text: 'You break the central mirror outward, which is the only direction it can be broken. The Grey Hand of Saint Cerena comes free with a sound like a held breath ending.', grant: { item: 'q3_hand' } },
          { room: 5, dx: 1, id: 'e3_c3', text: 'A tithe-child turned mirror-polisher, mute by choice, who leads you to the hidden seam and will not say why.', rescue: 3 }
        ]
      }),
      handFloor({
        name: 'The Thorn Throne', w: 28, h: 24,
        desc: 'A dome of living thorn, opened like a cupped hand to the fen-light; and in the middle of it, on a throne grown out of everything that ever got her lost, the Witch-Queen Sable, holding court with the silence.',
        rooms: [
          { x: 2, y: 2, w: 6, h: 4 },     // 0 stair in
          { x: 10, y: 8, w: 10, h: 10 },  // 1 the thorn dome
          { x: 2, y: 8, w: 5, h: 7 },     // 2 the brine court
          { x: 21, y: 3, w: 5, h: 6 },    // 3 the ash court
          { x: 21, y: 12, w: 5, h: 7 },   // 4 the tithe-vault guard
          { x: 2, y: 17, w: 6, h: 5 },    // 5 the elder dead
          { x: 11, y: 20, w: 8, h: 3 }    // 6 the root-guard passage
        ],
        links: [[0, 2], [2, 1], [1, 3], [3, 4], [2, 5], [5, 6], [6, 4]],
        entry: { room: 0 },
        doors: [{ room: 1, dx: -5, dy: 0 }],
        water: [[16, 15, 3, 2]],
        monsters: [
          { m: 'the_witch_queen_sable', room: 1, n: 1, quest: 'q3_main', boss: true },
          { m: 'noble duelist', room: 1, dy: -3, n: 1 },
          { m: 'brine hag', room: 2, n: 1 },
          { m: 'ash hag', room: 3, n: 1 },
          { m: 'thought leech', room: 4, n: 2, ambush: true },
          { m: 'wight, elder', room: 5, n: 2 },
          { m: 'mawblob', room: 6, dx: 3, n: 1 }
        ],
        treasure: [
          { room: 1, hoard: 'F', name: 'the witch-queen’s treasury' },
          { room: 5, dx: -4, secret: true, hoard: 'D', name: 'the tithe-vault' },
          { room: 3, dy: 1, hoard: 'E', name: 'the hags’ jointure' }
        ],
        secrets: [{ room: 5, dx: -4 }],
        traps: [
          { room: 1, dx: -3, dy: 3, type: 'fire' }, { room: 6, type: 'pit', depth: 2 }, { room: 3, dx: 1, type: 'darts' }
        ],
        events: [
          { room: 1, dy: 3, id: 'e3_throne', text: 'With Sable gone, the thorn dome sighs and opens a hand’s-width to the sky; nine generations of fen-light come in at once, embarrassed.', rescue: 4 }
        ]
      })
    ]
  };
  EF.Monsters['the_witch_queen_sable'] = Object.assign({}, EF.Monsters['mire hag'], {
    key: 'the_witch_queen_sable', name: 'the Witch-Queen Sable', hd: 12, ac: 1, morale: 20, treasure: 'F',
    atks: [{ n: 1, dmg: '2d6+4' }], xp: 11000, hpAvg: 66,
    special: Object.assign({}, EF.Monsters['mire hag'].special, {
      cast: 'mage+12', illusion: true, polymorphTouch: true, familiar: true, spellResist: 30, summoner: true
    }),
    look: 'A tall fen-hag in a gown of drowned hair, crown of black thorn, and the patient smile of a woman nine generations deep in rent collection.'
  });
  EF.Adventures['e3'] = E3;

  // ================================================================== generated adventures
  // Deterministic seeded generation. Five bands (1-2? band0 handled by E-bands above:
  // bands: 0: lvl1-2, 1: 3-5, 2: 5-7, 3: 8-11, 4: 12-20). Ten per band:
  // 4 small, 3 medium, 2 large, 1 huge. Streams separated so later features shift nothing.
  const BANDS = [
    { lo: 1, hi: 2, floors: [1, 2], monsterPool: ['giant rat', 'kobold', 'goblin', 'skeleton warrior', 'orc', 'giant bat', 'wolf', 'spider wolf?', 'zombie', 'skeleton archer', 'hobgoblin', 'gnoll', 'giant spider', 'large scorpion', 'dire wolf', 'ogre', 'hobgoblin chieftain'] },
    { lo: 3, hi: 5, floors: [2, 3], monsterPool: ['orc', 'hobgoblin', 'gnoll', 'bugbear', 'skeleton warrior', 'wight', 'ghoul', 'ogre', 'troll', 'shadow', 'ettin', 'boring wasp', 'manticore', 'barbed horror', 'gazer', 'grumtek_gutterking'] },
    { lo: 5, hi: 7, floors: [3, 4], monsterPool: ['bugbear', 'troll', 'ogre mage', 'ettin', 'wight, elder', 'wraith', 'mummy', 'minotaur', 'chimera', 'basilisk', 'wyvern', 'hydra, five-headed', 'carn ape', 'thought leech'] },
    { lo: 8, hi: 11, floors: [4, 5], monsterPool: ['wraith', 'vampire spawn', 'mummy', 'minotaur', 'chimera', 'greater basilisk', 'hydra, seven-headed', 'troll', 'ettin', 'gazer', 'watcher eye', 'bone golem', 'cairn knight', 'ironmordant', 'phase? no: flicker spider', 'ash hag', 'mire hag', 'brine hag', 'manticore'] },
    { lo: 12, hi: 20, floors: [5, 6], monsterPool: ['vampire', 'wraith', 'cairn knight', 'gazer', 'death orb', 'manticore', 'hydra, ten-headed', 'frost giant', 'fire giant', 'cloud giant', 'hill giant', 'storm giant', 'ember lord', 'horned legionnaire', 'mind hunter', 'young stormwyrm', 'young hoarwyrm', 'young mirewyrm', 'adult lind worm'] }
  ];
  BANDS[0].monsterPool = BANDS[0].monsterPool.filter(m => m !== 'spider wolf?');
  BANDS[1].monsterPool = BANDS[1].monsterPool.filter(m => m !== 'grumtek_gutterking');
  BANDS[3].monsterPool = BANDS[3].monsterPool.filter(m => m !== 'phase? no: flicker spider');

  const SMALL_TOWNS = ['Dunmore', 'Barleyhithe', 'Stonnham', 'Pigg’s Rest', 'Owlbat', 'Kettlebridge', 'Wren’s Marsh', 'Hollowmere', 'Ashfen', 'Nettlestead', 'Coldharbour', 'Briarfoot', 'Marrowford', 'Pikeham', 'Sallowford', 'Thistlebank', 'Grim’s Crossing', 'Ratbridge', 'Cobble End', 'Driftmere',
    'Fenwick', 'Longstitch', 'Mudgrave', 'Nettlecote', 'Ostbridge', 'Pennywell', 'Quarry Row', 'Ruskwater', 'Spindlewood', 'Tallowford', 'Upstreet', 'Veck’s End', 'Wheyseat', 'Yarrow Cross', 'Badger Hollow', 'Chaff’s Rest', 'Drover’s Gap', 'Elderwool', 'Flitchbury', 'Gorse End',
    'Hart’s Corner', 'Ivy House Green', 'Kilnfield', 'Lark Rise', 'Mole End', 'Nine Trees', 'Oatlands', 'Patchfield', 'Reedacre', 'Stonecross', 'Thorn End', 'Umpstry', 'Veckwater', 'Withy Bed', 'Yeonands', 'Anvil Row', 'Beech Green', 'Claycross', 'Dunn’s Ford', 'Ember End',
    'Fern Hill', 'Grubb’s Green', 'Hollow Lane', 'Ickham', 'Jugger’s Row', 'Kettle End', 'Limekiln Row', 'Muddy Gate', 'Nether Green', 'Owl Barrow', 'Pig’s Nose', 'Quarry Bend', 'Rook End', 'Slack’s End', 'Tyle’s Cross', 'Underhill', 'Veck’s Hole', 'Wadstead', 'Yew Tree Row', 'Amber Cross',
    'Barley End', 'Cobb’s Field', 'Dog Hollow', 'Evolution Green', 'Fleece Grounds', 'Griddleford', 'Halfway House', 'Ivy Post', 'Kirn Side', 'Ladder Green', 'Mistworsh', 'Nayland Bridge', 'Overs and Over', 'Padlock Green', 'Quill Hollow', 'Ram’s Head Green', 'Sledmere', 'Tallowgate', 'Umber Fields', 'Veck’s Mill',
    'Withy Drift', 'Yoxhill Field', 'Ashdown Row', 'Bog Mill', 'Chiselborough', 'Dusk Water', 'Elm Plantation', 'Fursdown', 'Gault End', 'Hollow Brook', 'Island Green', 'Joiner’s Street', 'Kite Hill', 'Lodge Common', 'Mount Bower', 'Nine Acres', 'Oakholt Street', 'Pound Green', 'Quarry Street', 'Ridge Row'];

  const ADJ = ['Barrow', 'Hollow', 'Drowned', 'Thorn', 'Ash', 'Frozen', 'Sunken', 'Red', 'Grey', 'Black', 'Mire', 'Old', 'Broken', 'Whispering', 'Salt', 'Bone', 'Root', 'Gilded', 'Rust', 'Deep'];
  const SUB = ['halls', 'vaults', 'sets', 'pits', 'gallery', 'stair', 'crypt', 'warrens', 'foundry', 'ossuary', 'cistern', 'spire', 'quarry', 'tunnels', 'cellars', 'shines', 'mound', 'causeway', 'caves', 'well'];
  const BADDERS = ['the Pale Steward', 'Sixfingers Malloch', 'the Wandering Gloom', 'Hob the Hollow', 'the Weeping Centurion', 'Mother Kettle', 'the Antlered Warden', 'Nine-Nail Nikta', 'the Glass Confessor', 'the Rust Abbot', 'Sallow Jim', 'the Fen Diviner', 'the Pale Conductor', 'Three-Salt Yarrow', 'the Hollow Pilgrim', 'Kedge of the Grey Fens', 'the Carr Court', 'Old Bonebright', 'the Slag Sorcerer', 'Lady Winterlin'];

  const SIZE_PLAN = [
    { size: 'small', floors: 1, rooms: 8 }, { size: 'small', floors: 1, rooms: 9 }, { size: 'small', floors: 2, rooms: 8 }, { size: 'small', floors: 2, rooms: 9 },
    { size: 'medium', floors: 2, rooms: 11 }, { size: 'medium', floors: 2, rooms: 12 }, { size: 'medium', floors: 3, rooms: 10 },
    { size: 'large', floors: 3, rooms: 13 }, { size: 'large', floors: 3, rooms: 14 },
    { size: 'huge', floors: 4, rooms: 13 }
  ];

  // room-carving dungeon generator: returns grid + room list (deterministic from seed)
  function genDungeon(seed, roomCount, w, h) {
    const rng = EF.newRng('dungeon', seed);
    const g = [];
    for (let y = 0; y < h; y++) g.push(new Array(w).fill('#'));
    const rooms = [];
    let tries = 0;
    const target = roomCount;
    while (rooms.length < target && tries < 400) {
      tries++;
      const rw = rng.range(3, 6), rh = rng.range(3, 6);
      const x = rng.range(1, w - rw - 2), y = rng.range(1, h - rh - 2);
      const pad = (rr) => !(x + rw + 1 < rr.x || x > rr.x + rr.w + 1 || y + rh + 1 < rr.y || y > rr.y + rr.h + 1);
      if (rooms.some(pad)) continue;
      rooms.push({ x, y, w: rw, h: rh, cx: Math.floor(x + rw / 2), cy: Math.floor(y + rh / 2) });
      for (let yy = y; yy < y + rh; yy++) for (let xx = x; xx < x + rw; xx++) g[yy][xx] = '.';
    }
    // connect rooms in sequence with L-corridors (guarantees connectivity)
    for (let i = 1; i < rooms.length; i++) {
      const a = rooms[i - 1], b = rooms[i];
      let x = a.cx, y = a.cy;
      while (x !== b.cx) { g[y][x] = g[y][x] === '#' ? '+' : g[y][x]; x += x < b.cx ? 1 : -1; g[y][x] = g[y][x] === '#' ? '+' : g[y][x]; }
      while (y !== b.cy) { g[y][x] = g[y][x] === '#' ? '+' : g[y][x]; y += y < b.cy ? 1 : -1; g[y][x] = g[y][x] === '#' ? '+' : g[y][x]; }
    }
    // corridor tiles: '+' carved as door-looking would be wrong; convert corridor pluses back to '.'
    for (let y2 = 0; y2 < h; y2++) for (let x2 = 0; x2 < w; x2++) if (g[y2][x2] === '+') g[y2][x2] = '.';
    // extra loop corridors for interest
    for (let i = 0; i < Math.floor(rooms.length / 3); i++) {
      const a = rng.pick(rooms), b = rng.pick(rooms);
      if (a === b) continue;
      let x = a.cx, y = a.cy;
      while (x !== b.cx) { if (g[y][x] === '#') g[y][x] = '.'; x += x < b.cx ? 1 : -1; if (g[y][x] === '#') g[y][x] = '.'; }
      while (y !== b.cy) { if (g[y][x] === '#') g[y][x] = '.'; y += y < b.cy ? 1 : -1; if (g[y][x] === '#') g[y][x] = '.'; }
    }
    // place doors at room mouths: floor tile with exactly two opposite floor neighbours in line and walls on the other axis
    const mouths = [];
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      if (g[y][x] !== '.') continue;
      const up = g[y - 1][x] !== '#', dn = g[y + 1][x] !== '#', lf = g[y][x - 1] !== '#', rt = g[y][x + 1] !== '#';
      const isMouth = (up && dn && !lf && !rt) || (lf && rt && !up && !dn);
      if (isMouth && rng.chance(34)) g[y][x] = '+';
      if (isMouth) mouths.push({ x, y });
    }
    return { g: g.map(r => r.join('')), rooms, mouths };
  }

  function buildGenerated(band, idx) {
    const B = BANDS[band];
    const plan = SIZE_PLAN[idx];
    const seedNo = band * 10 + idx;
    const seed = 'gadv-' + band + '-' + idx;
    const nameRng = EF.newRng('name', seed);
    const title = 'The ' + nameRng.pick(ADJ) + ' ' + nameRng.pick(SUB) + ' of ' + nameRng.pick(TOWNSFor(seedNo));
    function TOWNSFor(n) { return SMALL_TOWNS; }
    const townName = SMALL_TOWNS[seedNo % SMALL_TOWNS.length];
    const villain = nameRng.pick(BADDERS);
    const killFam = nameRng.pick(B.monsterPool.filter(k => EF.Monsters[k]).map(k => k.split(',')[0].trim()));
    const floors = [];
    const w = plan.floors >= 3 ? 30 : 26, h = plan.floors >= 3 ? 22 : 19;
    for (let f = 0; f < plan.floors; f++) {
      const seedF = seed + '-f' + f;
      const dg = genDungeon(seedF, plan.rooms + (f === 0 ? 0 : 1), w, h);
      const g = dg.g.map(r => r.split(''));
      const rooms = dg.rooms, mouths = dg.mouths;
      const rng = EF.newRng('fill', seedF);
      // entry stairs in first room, down stairs (if more floors) in last room
      const first = rooms[0], last = rooms[rooms.length - 1];
      let entryRoom = first;
      if (f === 0) g[first.cy][first.cx] = '<'; else {
        entryRoom = rng.pick(rooms); g[entryRoom.cy][entryRoom.cx] = '<';
      }
      if (f < plan.floors - 1) {
        let r2 = last;
        if (r2 === entryRoom && rooms.length > 1) r2 = rooms.find(rm => rm !== entryRoom);
        if (r2 !== entryRoom) g[r2.cy][r2.cx] = '>';
        else g[entryRoom.cy][entryRoom.cx + 1] = '>'; // degenerate single-room floor: stub off the entry
      }
      // secret doors: 1-3 hiding wall tile adjacent to a random room floor with treasure alcove
      const secrets = [];
      const nSec = rng.range(1, 3);
      for (let s = 0; s < nSec; s++) {
        let placed = false, guard = 0;
        while (!placed && guard++ < 200) {
          const room = rng.pick(rooms);
          const side = rng.range(0, 3);
          let x = room.cx, y = room.cy;
          if (side === 0) { x = room.x; y = room.y + rng.int(room.h); if (g[y][x - 1] !== '#') continue; x = x - 1; if (x < 1 || g[y][x - 1] !== '#') continue; }
          else if (side === 2) { x = room.x + room.w - 1; y = room.y + rng.int(room.h); if (g[y][x + 1] !== '#') continue; x = x + 1; if (x > w - 2 || g[y][x + 1] !== '#') continue; }
          else if (side === 1) { y = room.y; x = room.x + rng.int(room.w); if (g[y - 1][x] !== '#') continue; y = y - 1; if (y < 1 || g[y - 2] === undefined) continue; if (g[y - 1][x] !== '#') continue; }
          else { y = room.y + room.h - 1; x = room.x + rng.int(room.w); if (g[y + 1][x] !== '#') continue; y = y + 1; if (y > h - 2 || g[y + 2] === undefined) continue; if (g[y + 1][x] !== '#') continue; }
          if (g[y][x] !== '#') continue;
          g[y][x] = 'S';
          secrets.push({ x, y });
          placed = true;
        }
      }
      // traps: 2-3
      const traps = [];
      const nTrap = rng.range(2, 3);
      const TRAPKIND = ['pit', 'darts', 'blade', 'spear', 'falling block', 'fire', 'gas'];
      for (let t = 0; t < nTrap; t++) {
        const room = rng.pick(rooms);
        traps.push({ x: room.x + rng.int(room.w), y: room.y + rng.int(room.h), type: rng.pick(TRAPKIND), depth: band >= 2 ? 2 : 1 });
      }
      // monsters by band, scaled per floor
      const monsters = [];
      const nEnc = Math.max(3, Math.round(rooms.length * (plan.size === 'small' ? 0.6 : plan.size === 'medium' ? 0.8 : plan.size === 'large' ? 1.0 : 1.2)));
      const bandPool = B.monsterPool.filter(k => EF.Monsters[k]);
      for (let e = 0; e < nEnc; e++) {
        const room = rng.pick(rooms.slice(1));
        const key = rng.pick(bandPool);
        const m = EF.Monsters[key];
        monsters.push({
          m: key, x: room.x + rng.int(room.w), y: room.y + rng.int(room.h),
          n: Math.max(1, Math.round(rng.range(1, 3) * (m.hd <= 2 ? 2.2 : 1))),
          sleeping: rng.chance(35), ambush: rng.chance(15)
        });
      }
      // guarantee kill-family encounters for the side quest
      {
        const need = Math.ceil((3 + band) / plan.floors) + 1;
        for (let k = 0; k < need; k++) {
          const cand = bandPool.filter(kk => kk.includes(killFam) || (EF.Monsters[kk].special || '') === killFam || kk === killFam);
          const room = rng.pick(rooms.slice(1));
          const key = cand.length ? rng.pick(cand) : rng.pick(bandPool);
          const m = EF.Monsters[key];
          monsters.push({ m: key, x: room.x + rng.int(room.w), y: room.y + rng.int(room.h), n: Math.max(1, Math.round(rng.range(1, 2) * (m.hd <= 2 ? 2 : 1))), sleeping: rng.chance(25), ambush: false });
        }
      }
      // treasure: per room chance + boss hoard on last floor; secret alcove treasure 1 per secret (small)
      const treasure = [];
      rooms.forEach((room, ri) => {
        if (ri > 0 && rng.chance(plan.size === 'small' ? 40 : 55)) {
          treasure.push({ x: room.cx, y: room.cy, hoard: rng.pick(['I', 'I', 'A', 'B', 'C', 'C', 'D', 'E'].slice(0, band + 4)), name: 'cache' });
        }
      });
      secrets.forEach((s, si) => {
        if (rng.chance(80)) treasure.push({ x: s.x, y: s.y, hoard: rng.pick(band >= 3 ? ['C', 'D', 'E'] : ['A', 'B', 'C']), name: 'hidden alcove', secret: true });
      });
      if (f === plan.floors - 1) {
        const bossRoom = rooms[rooms.length - 1];
        const bossKey = rng.pick(bandPool.filter(k => EF.Monsters[k].hd >= (4 + band * 2) || k.includes('chieftain')) || bandPool);
        const bk = EF.Monsters[bossKey] ? bossKey : rng.pick(bandPool);
        monsters.push({ m: bk, x: bossRoom.cx, y: bossRoom.cy, n: 1, boss: true, quest: seedNo + '_main' });
        treasure.push({ x: bossRoom.cx, y: bossRoom.cy, hoard: ['B', 'C', 'D', 'E', 'F'][Math.min(4, band + 1)], name: villain + '’s hoard' });
      }
      // events flavour
      const events = [];
      if (rng.chance(70)) {
        const room = rng.pick(rooms);
        events.push({ x: room.cx, y: room.cy, id: seedF + '_e1', text: rng.pick([
          'A hoard of beetles has made a nest of someone’s pack. The pack is empty. The beetles are not.',
          'Old carvings: a procession of penitents walking cheerfully into a hole in the world.',
          'A fresh candle, still soft. Someone tends this place by lamplight and does not live here.',
          'A children’s game drawn in chalk across the floor, complete, as if played by very still players.',
          'A wall of nail-holes, counted in tally. The tally stops halfway up the wall.',
          'A rusted signpost, upright indoors, pointing at a wall. The wall rings hollow, which may be the point.',
          'Someone has been collecting the sound of dripping: jars of water, each labelled in a different hand.'
        ]) });
      }
      floors.push(makeFloor({
        name: ['The Threshold', 'The Middle Dark', 'The Deep Hall', 'The Inmost Place', 'The Last Hall', 'Beneath Everything'][f] || ('Level ' + (f + 1)),
        grid: g, monsters, treasure, traps, secrets, events, desc: ''
      }));
    }
    const town = makeTown({
      name: townName,
      desc: 'A ' + (band >= 3 ? 'hard, rich, wary' : 'small') + ' place of ' + townName.toLowerCase() + ' habits, gathered defensively around a green. The trouble is ' + plan.floors + ' floor' + (plan.floors > 1 ? 's' : '') + ' deep under the ' + nameRng.pick(['church', 'market', 'mill', 'well-house', 'old keep', 'bailey']) + '.',
      grid: stockTown().grid, objects: stockTown().objects
    });
    const mainQuest = { id: seedNo + '_main', name: title, main: true, brief: 'End ' + villain + ' in the ' + title.replace('The ', '') + '.', gold: [600, 2200, 6000, 14000, 30000][band], xp: [2400, 9000, 24000, 60000, 130000][band], tag: 'main' };
    const sideQuests = [
      { id: seedNo + '_side1', name: 'The ' + nameRng.pick(['Ransom', 'Reliquary', 'Ledger', 'Heirloom', 'Debt']) + ' of ' + townName, brief: 'Recover what ' + villain + ' took from the town.', gold: Math.round([200, 800, 2200, 5000, 11000][band] / 10) * 10, xp: Math.round([800, 3200, 9000, 22000, 48000][band] / 10) * 10, item: 'gob_' + seedNo + '_relic' },
      { id: seedNo + '_side2', name: 'Furrows in the Dust', brief: 'Deal with the ' + nameRng.pick(['breeding brood', 'outlying watch', 'collateral horrors']) + ' in the upper halls (' + (4 + band * 2) + ' kills).', gold: Math.round([120, 480, 1300, 3000, 6600][band] / 10) * 10, xp: Math.round([500, 2000, 5200, 13000, 28000][band] / 10) * 10, killCount: 3 + band, killTag: killFam }
    ];
    // relic item for side quest (generated deterministically)
    const relicKey = 'gob_' + seedNo + '_relic';
    EF.Items[relicKey] = { key: relicKey, name: nameRng.pick(['Reliquary', 'Coffret', 'Casket', 'Relic-burse', 'Tithe-box']) + ' of ' + townName, cat: 'quest', cost: sideQuests[0].gold, wt: 2, note: 'Returned property of ' + townName + '.' };
    // grant the relic somewhere in the dungeon
    { const lf = floors[floors.length - 1]; lf.treasure.push({ x: lf.entry.x, y: lf.entry.y, hoard: 'I', name: 'the stolen relic', grantItem: relicKey }); }
    const adv = {
      id: 'g' + band + '_' + idx, generated: true, no: 4 + seedNo, band, title,
      levels: [B.lo, B.hi], townName, boss: villain,
      intro: title + ' lies under ' + townName + '. The commission is simple, as they are: go down, come back with the thing that rules down there being no longer able to rule.',
      patron: { name: nameRng.pick(['Reeve', 'Steward', 'Mootwife', 'Bailiff', 'Warden']) + ' ' + nameRng.pick(['Occam', 'Ilse', 'Brannock', 'Vell', 'Marrow', 'Tuck', 'Sabbery', 'Holm', 'Deane', 'Forrow']), text: 'We’ve lost ' + nameRng.pick(['two carters', 'the night watch', 'a whole street’s worth', 'the bell', 'all our nerve']) + ' to this. We’ll pay like people who are paying.' },
      quests: [mainQuest].concat(sideQuests),
      town, floors
    };
    return adv;
  }

  // The stock town: one honest plan for every generated commission — walls,
  // streets, buildings whose doors open onto the square, a gate to the wilds.
  function stockTown() {
    const Wd = 35, H = 25;
    const g = [];
    for (let y = 0; y < H; y++) {
      const row = [];
      for (let x = 0; x < Wd; x++) row.push(x === 0 || y === 0 || x === Wd - 1 || y === H - 1 ? '#' : ' ');
      g.push(row);
    }
    for (const [x, y] of [[15, 13], [16, 13], [15, 14], [26, 6], [27, 6], [6, 21], [7, 21], [28, 20], [28, 21]]) g[y][x] = '#';
    const slots = [
      { kind: 'shop_general', name: 'General Store', x: 4, y: 2, w: 5, h: 3 },
      { kind: 'temple', name: 'Temple of the Dawn', x: 14, y: 2, w: 4, h: 3 },
      { kind: 'shop_weapons', name: 'Forge & File', x: 23, y: 2, w: 5, h: 3 },
      { kind: 'shop_armour', name: 'The Anvil', x: 4, y: 9, w: 5, h: 3 },
      { kind: 'patron', name: 'The Gilded Mantle', x: 14, y: 8, w: 6, h: 4 },
      { kind: 'inn', name: 'The Sleeping Boar', x: 24, y: 9, w: 5, h: 3 },
      { kind: 'training', name: 'The Exercise Yard', x: 9, y: 16, w: 5, h: 3 },
      { kind: 'dungeon', name: 'The doors below', x: 21, y: 16, w: 5, h: 3 }
    ];
    const objects = [];
    for (const slot of slots) {
      for (let y = slot.y; y < slot.y + slot.h; y++) for (let x = slot.x; x < slot.x + slot.w; x++) {
        if (y === slot.y + slot.h - 1 && x === slot.x + Math.floor(slot.w / 2)) { g[y][x] = '+'; continue; }
        g[y][x] = '#';
      }
      objects.push({ x: slot.x + Math.floor(slot.w / 2), y: slot.y + slot.h, kind: slot.kind, name: slot.name });
    }
    objects.push({ x: 3, y: 22, kind: 'well', name: 'Stone Well' });
    objects.push({ x: 31, y: 13, kind: 'fountain', name: 'Old Fountain' });
    const gx = 33, gy = H - 1;
    g[gy][gx] = '+';
    objects.push({ x: gx, y: gy - 1, kind: 'wildexit', name: 'The gate to the wilds' });
    return { grid: g.map(r => r.join('')), objects };
  }

  // shared town plan templates (21-27 wide); objects sit in front of their doors
  const TOWNPLAN = [
    {
      rows: [
        '                     ',
        '  #####    ######    ',
        '  #$$$#    #I   #    ',
        '  #$ D#    #  # #    ',
        '  ##D##    ##D##     ',
        '              W      ',
        '   ####   ####       ',
        '   #H #   #R #       ',
        '   #D #   #D #       ',
        '   ####   ####   ### ',
        '            f  #  E ',
        '   #####       # ## ',
        '   #P  #        X   ',
        '   ##D##            ',
        '                    '
      ],
      objs: [
        { x: 4, y: 12, kind: 'patron' }, { x: 3, y: 3, kind: 'shop_general', name: 'General Sundry' },
        { x: 4, y: 4, kind: 'shop_general', name: 'General Sundry (door)' },
        { x: 10, y: 4, kind: 'inn', name: 'The Common House' },
        { x: 4, y: 8, kind: 'temple', name: 'House of the Hearthfather' },
        { x: 9, y: 8, kind: 'training', name: 'Training Butts' },
        { x: 20, y: 10, kind: 'dungeon', name: 'The Stair', floors: 1 },
        { x: 20, y: 12, kind: 'wildexit', name: 'Town Gate' },
        { x: 14, y: 5, kind: 'well', name: 'Well' }, { x: 14, y: 10, kind: 'fountain', name: 'Fountain' }
      ]
    },
    {
      rows: [
        '                        ',
        '   ######      #####     ',
        '   #I   #     ##   ##    ',
        '   #  I #     #$ $ ##    ',
        '   ###D##     ##D###     ',
        '    ####     ##          ',
        '     W       f           ',
        '  #####     ######       ',
        '  #H  #     #P   #       ',
        '  # D #     #  D #       ',
        '  #####     ######       ',
        '            ##           ',
        '   #####    #E#          ',
        '   #R  #    ###          ',
        '   ##D##                 ',
        '                    X    '
      ],
      objs: [
        { x: 7, y: 8, kind: 'patron' }, { x: 14, y: 3, kind: 'shop_general', name: 'Sundry' },
        { x: 16, y: 3, kind: 'shop_weapons', name: 'Armory' }, { x: 4, y: 2, kind: 'inn', name: 'The Quiet Sheaf' },
        { x: 3, y: 9, kind: 'temple', name: 'Chapel' }, { x: 4, y: 13, kind: 'training', name: 'Yard' },
        { x: 14, y: 12, kind: 'dungeon', name: 'The Downer', floors: 1 },
        { x: 20, y: 15, kind: 'wildexit', name: 'Gate' },
        { x: 5, y: 6, kind: 'well', name: 'Well' }, { x: 13, y: 6, kind: 'fountain', name: 'Fountain' }
      ]
    }
  ];

  for (let band = 0; band < 5; band++) {
    for (let idx = 0; idx < 10; idx++) {
      const adv = buildGenerated(band, idx);
      EF.Adventures[adv.id] = adv;
    }
  }
  /* @@MORE@@ */
  // quest relics handed out by events must exist as items
  Object.assign(EF.Items, {
    q0_chalice: { key: 'q0_chalice', name: 'The Hearth-Chalice', cat: 'quest', cost: 250, wt: 2, note: 'Temple property; stolen, now returned.' },
    q1_lantern: { key: 'q1_lantern', name: 'Lantern of the Hollow', cat: 'quest', cost: 500, wt: 3, note: 'Its flame leans toward the surface.' },
    q3_hand: { key: 'q3_hand', name: 'The Grey Hand of Saint Cerena', cat: 'quest', cost: 2200, wt: 1, note: 'A stone hand, patient as a held breath.' }
  });
  EF.NORMALIZE = { normGrid, findMarker, findAll, makeFloor, makeTown, shop };
})();
