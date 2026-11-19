# Emberfall: The Emberwild Saga

A party-based fantasy RPG that runs entirely in the browser — no framework, no
bundler, no build step, no image or sound files. Every texture, sprite,
portrait, monster figure and map is drawn by code at start-up. It is meant to
feel like a late-1980s "gold box" computer RPG: first-person exploration of a
grid dungeon, an overland map of the whole wilds, and turn-based tactical
combat on an isometric field, all on second-edition-style tabletop rules
(THAC0, descending armour class, saving-throw categories, race and class
limits, spell memorization, thief skills, training to level 20).

## Play

Open `index.html` in a browser (or serve the folder anywhere over HTTP,
including from a subdirectory) and click **New Company**. That is the whole
installation. Saves live in `localStorage` (five named slots plus an autosave
after every meaningful event).

### Controls

| Key | Action |
| --- | --- |
| W / ↑ | move forward |
| S / ↓ | move back |
| A / ← , D / → | turn |
| Q , E | sidestep |
| F | search (secret doors, traps) |
| R | make camp |
| M | full map |
| J | journal |
| B | bestiary |
| I | pack / inventory |
| 1–6 | open that character's sheet |
| Esc | menu |

Touch devices get an on-screen movement pad (turn, sidestep, forward, back,
search, camp) automatically; the layout adapts to phone and tablet, portrait
and landscape. The 3D view renders at a capped internal resolution so older
tablets (7th-gen iPad / Safari 16) keep a smooth frame.

## The world

- **54 adventures**: four hand-written (E0 *The Cellars of Thornwick*, E1
  *The Hollow Vaults*, E2 *Barrow of the Iron King*, E3 *The Witch-Queen of
  Ravenmoor*) and fifty generated ones — five level bands × ten sizes (4
  small, 3 medium, 2 large, 1 huge per band). Generated content comes from
  deterministic seeded RNG streams, so every player sees the same dungeons,
  and adding features later uses *new* streams so old content never shifts.
- Every adventure has a home town with a patron, shops stocked by level band,
  a temple, an inn, a training hall — and a wilderness map of grass, road,
  bridge, forest, hills, fen, mountain and river, with hamlets, healers, holy
  sites, monster lairs and safe camps.
- Every dungeon level carries 1–3 secret doors (usually hiding a treasure
  alcove) and 2–3 traps. Two Node validators check all of it (see below).
- ~460 items, ~143 spells (wizard 1–9, priest 1–7), ~400 monsters with
  poisons, paralysis, level drain, regeneration, breath weapons, undead
  turning categories and weapon resistances, and full treasure types
  (coins, gems, jewellery, art, magic items by level band).

## Playing style

- Monsters stand on their own squares, notice you by line of sight, guard
  their treasure, listen at doors themselves, and sometimes lie in ambush.
  Thieves may slip past; the party can listen at doors and pick locks.
- Unfound traps spring underfoot; searching finds them, thieves disarm them,
  and found traps appear on the map.
- Dropped or slain loot stays on the dungeon floor until collected.
- Camp with "rest until healed": healers spend their healing magic, everyone
  re-memorizes spells between rests, and rations are eaten. Fatigue, night,
  and terrain slow the overland march and invite encounters.
- Quests pay gold and experience — but quest XP is a quarter of the posted
  figure. Holy sites give a small separate award. Training costs 100 gp per
  level at the Exercise Yard.
- The campaign screen carries one company between all 54 adventures;
  completed chronicles stay completed.

## Files

```
index.html          loads everything, in order
css/style.css       one stylesheet
js/rules.js         ability scores, races, classes, THAC0, saves, XP, training
js/data.js          items, spell lists, shop stock
js/modules.js       seeded RNG streams, dice, save slots, registries
js/monsters.js      the monster catalogue and their specials
js/wilds.js         wilderness map generation and encounter tables
js/treasure.js      treasure types, gems/jewellery/art, magic-item rolls
js/adventures.js    the four hand-written adventures + the generator
js/figures.js       procedural portraits, monster figures, icons
js/view3d.js        the textured raycast view + minimap
js/ui.js            screens: creation, sheets, shops, temple, inns, menus
js/combat.js        isometric tactical combat
js/overland.js      the wilds screen and travel
js/campaign.js      carrying a company between adventures
js/journal.js       quest journal
js/map.js           full-page maps (dungeon, town, wilds)
js/bestiary.js      the bestiary that fills in as you fight
js/navpad.js        optional on-screen touch pad
js/watch.js         camping and rest-until-healed
js/game.js          state machine, movement, arrival, main loop, selftest
```

## Checking the build

```
scripts/run_validators.sh    # Node content checks (~14,700 assertions)
scripts/run_selftest.sh      # headless-Chrome scripted playthrough of E0
scripts/run_screenshots.sh   # renders docs/screens/*.png from real play scenes
```

`validators/validate_data.js` confirms every referenced monster, item, spell
and treasure type exists and every quest's target is actually placed.
`validators/validate_maps.js` proves every floor is rectangular, every entry
lands on a walkable square, stairs chain, all monsters, treasure, events and
town objects are reachable from the floor entry, each dungeon level has 1–3
secret doors and 2–3 traps, and every wilds site is walkable from the home
town.

`index.html?selftest=1` runs a scripted playthrough in any browser: it raises
a company, marches into Thornwick's cellars, fights its way down three floors,
kills Grumtek Gutterking, carries the treasure out, saves, loads, visits every
screen, and rides the overland — printing a PASS/FAIL report.

## Licence

MIT — see `LICENSE`.
