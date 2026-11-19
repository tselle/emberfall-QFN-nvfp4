/* Emberfall — ui.js
 * All screens: menu, character creation, play HUD and message log, character
 * sheets, inventory, shops, temples, inns, training halls, the patron’s
 * commissions, door and object menus, saves, defeat, and the How to Play page.
 * Keyboard (WASD/arrows, Q/E, F, R, M, J, B, 1–6, Esc), icon command bar and
 * touch controls all route through here. */
(function () {
  const EF = (globalThis.EF = globalThis.EF || {});
  const R = EF.Rules;
  const U = {};
  EF.UI = U;

  U.open = null;
  const $ = sel => document.querySelector(sel);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

  U.consumesKeys = function (e) {
    if (EF.Combat.active) return false; // combat handles its own keys
    return !!U.open && U.open !== 'combat';
  };

  const SCREENS = {};
  U.register = (name, render) => { SCREENS[name] = render; };

  U.show = function (name, arg) {
    U.open = name === 'ui' ? null : name;
    const wrap = $('#screen');
    if (!wrap) return;
    if (!name || name === 'ui') { wrap.innerHTML = ''; wrap.classList.add('hidden'); U.refreshHUD(); return; }
    wrap.classList.remove('hidden');
    wrap.innerHTML = '';
    const render = SCREENS[name];
    if (render) render(wrap, arg);
    U.refreshHUD();
  };
  U.close = () => U.show('ui');

  // ---------------------------------------------------------------- HUD
  U.refreshHUD = function () {
    const hud = $('#hud');
    if (!hud) return;
    hud.innerHTML = '';
    const st = EF.Game.state;
    if (!st) return;
    // party strip
    const strip = el('div', 'partybar');
    st.party.forEach((p, i) => {
      const b = el('button', 'pcard' + (p.alive ? '' : ' dead'));
      const pr = EF.Figures.portrait(p, 40);
      const c = pr.cloneNode(); c.getContext && c.getContext('2d').drawImage(pr, 0, 0);
      b.appendChild(c);
      b.appendChild(el('div', 'pname', esc(p.name[0] || '?') + ' ' + EF.romanize(i + 1)));
      b.appendChild(el('div', 'phplines',
        '<span class="hpnum">' + p.hp + '/' + p.maxHp + '</span>' +
        '<span class="hpline"><i style="width:' + Math.round(100 * p.hp / Math.max(1, p.maxHp)) + '%"></i></span>'));
      b.onclick = () => U.sheet(i);
      strip.appendChild(b);
    });
    hud.appendChild(strip);
    // command bar
    const bar = el('div', 'cmdbar');
    const inField = !U.open || U.open === 'ui';
    const cmd = (label, key, fn, dis) => {
      const b = el('button', 'cmdbtn' + (dis ? ' off' : ''), '<b>' + label + '</b><kbd>' + key + '</kbd>');
      b.disabled = !!dis;
      b.onclick = fn;
      bar.appendChild(b);
    };
    cmd('Search', 'F', () => EF.Game.search(), !inField);
    cmd('Camp', 'R', () => EF.Watch.open(), !inField);
    cmd('Map', 'M', () => EF.MapPage.open(), !inField);
    cmd('Journal', 'J', () => EF.Journal.open(), !inField);
    cmd('Bestiary', 'B', () => EF.Bestiary.open(), !inField);
    cmd('Pack', 'I', () => U.show('inventory'), !inField);
    cmd('Menu', 'Esc', () => U.show('menu'));
    hud.appendChild(bar);
    // log
    const log = el('div', 'log');
    const lines = st.log.slice(-7);
    for (const l of lines) {
      const d = el('div', 'logline ' + (l.cls || ''), esc(l.t));
      log.appendChild(d);
    }
    hud.appendChild(log);
    U.logDirty = () => { if (!U.open) U.refreshHUD(); };
    // touch navpad
    if (EF.NavPad) EF.NavPad.render(hud, inField);
  };
  U.logDirty = function () { };

  // small shared builders (used by overland/campaign/etc.)
  U.panel = cls => el('div', 'panel ' + (cls || ''));
  U.h = t => el('h2', '', esc(t));
  U.dim = t => el('p', 'dim', esc(t));
  U.cmdbar = specs => {
    const bar = el('div', 'cmdbar');
    for (const [label, fn] of specs) { const b = el('button', 'cmdbtn', label); b.onclick = fn; bar.appendChild(b); }
    return bar;
  };

  // ---- wilds sites
  U.hamlet = function (s) {
    const box = U.panel('small');
    box.appendChild(el('h3', '', esc(s.name)));
    box.appendChild(el('p', 'dim', 'A hamlet of a dozen roofs. They will trade what they have, and hear what you bring.'));
    const b1 = el('button', 'bigbtn', 'Buy supplies (general stock, +10%)');
    b1.onclick = () => U.show('hamletShop', s);
    const b2 = el('button', 'bigbtn', 'Rest here (camp is safe tonight) — 1 gp each');
    b2.onclick = () => {
      payFrom(EF.Game.state.party.length);
      EF.Game.state.flags.safeCamp = true;
      EF.Game.log('The hamlet gives you the barn. Nothing comes for you tonight.');
      U.close(); EF.Overland.enter(false);
    };
    const b3 = el('button', 'bigbtn', 'Ask after the news');
    b3.onclick = () => { const w = EF.Wilds.gen(EF.Game.state.adventureId); EF.Game.log('They say: “' + EF.dice.pick(w.rumours) + '”'); U.close(); };
    box.appendChild(b1); box.appendChild(b2); box.appendChild(b3);
    doneBtn(box, 'Move on');
    showFloat(box);
  };
  U.register('hamletShop', (wrap, s) => {
    const box = U.panel('wide');
    box.appendChild(el('h3', '', 'Trade at ' + esc(s.name)));
    const goldRow = el('div', 'purse');
    goldRow.textContent = 'Purse: ' + EF.Game.partyGold() + ' gp';
    box.appendChild(goldRow);
    const keys = EF.SHOP_STOCK.mundane.slice(0, 16).concat(EF.SHOP_STOCK.bands[Math.min(4, (EF.Adventures[EF.Game.state.adventureId] || {}).band || 0)].slice(0, 4));
    for (const k of keys) {
      const it = EF.Items[k]; if (!it) continue;
      const price = Math.round(it.cost * 1.1);
      const line = el('div', 'itemline');
      line.appendChild(el('span', 'iname', esc(it.name)));
      line.appendChild(el('span', 'iprice', price + ' gp'));
      const bb = el('button', 'mini', 'Buy');
      bb.onclick = () => {
        if (EF.Game.partyGold() < price) return;
        payFrom(price);
        const p = EF.Game.state.party.find(c => c.alive);
        const own = p.items.find(i => i.key === it.key);
        if (own) own.qty = (own.qty || 1) + 1; else p.items.push({ key: it.key, qty: 1 });
        bb.textContent = 'Bought';
        goldRow.textContent = 'Purse: ' + EF.Game.partyGold() + ' gp';
      };
      line.appendChild(bb);
      box.appendChild(line);
    }
    const b = el('button', 'bigbtn', 'Finish trading');
    b.onclick = () => U.close();
    box.appendChild(b);
    wrap.appendChild(box);
  });
  U.healerSite = function (s) {
    const box = U.panel('small');
    box.appendChild(el('h3', '', esc(s.name)));
    box.appendChild(el('p', 'dim', 'Herbs, bandages, and a long acquaintance with unpleasant things.'));
    const b1 = el('button', 'bigbtn', 'Salve and set bones (2d8 healed each) — 60 gp');
    b1.onclick = () => {
      if (EF.Game.partyGold() < 60) { EF.Game.log('Coin, or prayers; she accepts only coin.'); return; }
      payFrom(60);
      for (const p of EF.Game.state.party) if (p.alive && p.hp < p.maxHp) p.hp = Math.min(p.maxHp, p.hp + EF.dice.roll('2d8'));
      EF.Game.log('The company is slathered, bound, and considerably better.');
      U.close();
    };
    const b2 = el('button', 'bigbtn', 'Cure poison — 80 gp');
    b2.onclick = () => {
      if (EF.Game.partyGold() < 80) return;
      payFrom(80);
      for (const p of EF.Game.state.party) { p.status = p.status || {}; delete p.status.poisoned; delete p.status.sick; }
      EF.Game.log('Bitter black drink; the poison withdraws.', 'good');
      U.close();
    };
    box.appendChild(b1); box.appendChild(b2);
    doneBtn(box, 'Take your leave');
    showFloat(box);
  };
  U.holySite = function (s) {
    const box = U.panel('small');
    box.appendChild(el('h3', '', esc(s.name)));
    box.appendChild(el('p', 'dim', 'Stone older than the town names, set in a kind of silence.'));
    const b1 = el('button', 'bigbtn', 'Kneel and pray (small experience award; the site is spent for a month)');
    b1.onclick = () => {
      if (!s.used) { s.used = true; EF.Game.grantXP(120); EF.Game.log('Something small and certain is added to your accounts.', 'good'); }
      else EF.Game.log('The site asks patience; come again in its own time.');
      U.close();
    };
    const b2 = el('button', 'bigbtn', 'Keep a watch here (safe camp)');
    b2.onclick = () => { EF.Game.state.flags.safeCamp = true; EF.Game.log('You camp in the shadow of the stone. Nothing walks here.'); U.close(); };
    box.appendChild(b1); box.appendChild(b2);
    doneBtn(box, 'Bow and move on');
    showFloat(box);
  };

  // ---------------------------------------------------------------- menu
  U.register('menu', wrap => {
    const box = el('div', 'panel menu-panel');
    box.appendChild(el('h1', 'title', 'EMBERFALL'));
    box.appendChild(el('div', 'subtitle', 'The Emberwild Saga'));
    const b = (label, fn, dis) => {
      const x = el('button', 'bigbtn', label);
      x.disabled = !!dis;
      x.onclick = fn;
      box.appendChild(x);
    };
    b('New Company', () => U.show('adventureSelect'));
    b('Resume Adventure', () => {
      if (EF.loadGame('autosave')) { if (EF.Game.loadFrom('autosave')) U.show('ui'); }
      else U.show('saves');
    }, !EF.loadGame('autosave'));
    b('Save / Load', () => U.show('saves'));
    b('How to Play', () => U.show('howto'));
    const v = el('div', 'tiny'); v.textContent = 'v1.0 · a hand-drawn fantasy, all code, no pictures';
    box.appendChild(v);
    wrap.appendChild(box);
  });

  // ---------------------------------------------------------------- adventure select (campaign screen)
  U.register('adventureSelect', wrap => {
    const box = el('div', 'panel wide');
    box.appendChild(el('h2', '', 'Choose your commission'));
    box.appendChild(el('p', 'dim', 'The four chronicle-adventures can be played alone, or as one campaign in order. The generated adventures may be played at any time a company of the right standing passes through.'));
    const grid = el('div', 'advgrid');
    const advs = Object.values(EF.Adventures).sort((a, b) => a.no - b.no);
    for (const a of advs) {
      const card = el('div', 'advcard' + (a.generated ? ' gen' : ''));
      card.appendChild(el('h3', '', esc((a.no < 4 ? 'E' + a.no + ' ' : '') + a.title)));
      card.appendChild(el('div', 'dim', 'Levels ' + a.levels[0] + '–' + a.levels[1] + ' · ' + a.floors.length + ' floor' + a.floors.length > 1 ? 's' : ''));
      card.appendChild(el('p', 'blurb', esc((a.intro || '').slice(0, 140) + '…')));
      const btn = el('button', '', 'Begin');
      btn.onclick = () => U.show('create', a.id);
      card.appendChild(btn);
      grid.appendChild(card);
    }
    box.appendChild(grid);
    const back = el('button', 'bigbtn', 'Back');
    back.onclick = () => U.show('menu');
    box.appendChild(back);
    wrap.appendChild(box);
  });

  // ---------------------------------------------------------------- character creation
  U.register('create', (wrap, advId) => {
    const adv = EF.Adventures[advId];
    const box = el('div', 'panel wide create');
    box.appendChild(el('h2', '', 'Raise a company for ' + esc(adv.title)));
    box.appendChild(el('p', 'dim', esc(adv.intro)));
    const form = el('div', 'create-body');
    box.appendChild(form);
    const party = [];
    const NAMES = ['Borin Oakenshield? no', 'Alderic Vane', 'Sable Nyx', 'Corvin Ash', 'Merrit Down', 'Tam Brannock', 'Isolde Marrow', 'Pip Wrenfoot', 'Godfri Warmhand', 'Ysolde Fen', 'Hobb Severn', 'Cass Emberlyn'];
    function renderParty() {
      form.querySelector('.partyline') && form.querySelector('.partyline').remove();
      const line = el('div', 'partyline');
      party.forEach((p, i) => line.appendChild(el('span', 'chipline', esc(p.name) + ' — ' + R.RACES[p.race].name + ' ' + R.CLASSES[p.cls].name)));
      form.appendChild(line);
    }
    const editor = el('div', 'editor');
    form.appendChild(editor);
    const draft = { name: '', race: 'human', cls: 'fighter', align: 'N', abilities: null, pct: null, weapon: null, specialty: null, hp: 0, gold: 0, items: [], spellsKnown: [], spellbook: [] };
    function roll() {
      draft.abilities = R.adjustAbilities(draft.race, R.rollAbilities(EF.dice, draft.race));
      const cls = draft.cls;
      if (R.CLASSES[cls].group === 'warrior' && draft.abilities.str === 18) draft.pct = EF.dice.range(1, 100);
      const hd = R.CLASSES[cls].hd;
      draft.hp = hd + R.CON_HP(draft.abilities.con);
      draft.gold = 10 * (3 + R.mod(draft.abilities.cha));
      draft.items = [];
      draft.spellbook = cls === 'mage' ? Object.values(EF.Spells).filter(s => s.sch === 'w' && s.lvl === 1 && ['w_magic_missile', 'w_shield', 'w_sleep', 'w_detect_evil'].includes(s.id)).map(s => s.id)
        : [];
      renderEditor();
    }
    function renderEditor() {
      editor.innerHTML = '';
      const name = el('input', '', ''); name.value = draft.name; name.placeholder = 'Name';
      name.oninput = () => { draft.name = name.value; };
      const race = el('select'); for (const k in R.RACES) race.appendChild(el('option', '', R.RACES[k].name)); race.value = draft.race;
      race.onchange = () => { draft.race = race.value; if (R.classesFor(draft.race).indexOf(draft.cls) < 0) draft.cls = R.classesFor(draft.race)[0]; roll(); };
      const cls = el('select');
      for (const k of R.classesFor(draft.race)) cls.appendChild(el('option', '', R.CLASSES[k].name));
      cls.value = draft.cls;
      cls.onchange = () => { draft.cls = cls.value; roll(); };
      const align = el('select'); for (const a of R.CLASSES[draft.cls].align) align.appendChild(el('option', '', a)); align.value = draft.align;
      align.onchange = () => { draft.align = align.value; };
      const rollBtn = el('button', '', 'Roll abilities'); rollBtn.onclick = roll;
      const row = el('div', 'row');
      row.appendChild(name); row.appendChild(race); row.appendChild(cls); row.appendChild(align); row.appendChild(rollBtn);
      editor.appendChild(row);
      if (!draft.abilities) { editor.appendChild(el('p', 'dim', 'Roll to determine ability scores.')); return; }
      const abl = el('div', 'abilities');
      for (const a of R.ABILITIES) {
        abl.appendChild(el('span', 'abl', R.ABILITY_NAMES[a].slice(0, 3) + '<b>' + draft.abilities[a] + (a === 'str' && draft.pct ? '/' + (draft.pct === 100 ? '00' : draft.pct) : '') + '</b>'));
      }
      editor.appendChild(abl);
      // gear pick
      const gearWrap = el('div', 'gearpick');
      gearWrap.appendChild(el('div', 'dim', 'Choose a weapon (' + draft.gold + ' gp purse):'));
      const wlist = el('div', 'wchoices');
      const pick = (it, label) => {
        const b = el('button', draft.weapon && draft.weapon.itemKey === it.key ? 'on' : '', label || it.name + ' (' + it.cost + ' gp)');
        b.onclick = () => { draft.weapon = { itemKey: it.key }; renderEditor(); };
        wlist.appendChild(b);
      };
      for (const k of ['w_dagger', 'w_mace', 'w_spear', 'w_short_sword', 'w_battle_axe', 'w_long_sword', 'w_bow_short', 'w_quarterstaff', 'w_sling']) {
        const it = EF.Items[k];
        if (it.cost <= draft.gold) pick(it);
      }
      editor.appendChild(wlist);
      editor.appendChild(el('div', 'dim', 'Armour: you begin in ' + (R.CLASSES[draft.cls].group === 'warrior' ? 'studded leather (AC 8)' : draft.cls === 'mage' ? 'a plain robe (AC 10)' : 'padded armour (AC 9)') + '.'));
      if (R.CLASSES[draft.cls].canSpecialize && draft.weapon) {
        editor.appendChild(el('div', 'dim', 'Fighting specialty set to ' + EF.Items[draft.weapon.itemKey].name + '.'));
        draft.specialty = draft.weapon.itemKey; draft.specialtyLevel = 1;
      }
      const add = el('button', 'bigbtn', party.length >= 6 ? 'Party full' : 'Add to company');
      add.disabled = party.length >= 6;
      add.onclick = () => {
        if (!draft.weapon && R.CLASSES[draft.cls].group === 'warrior') { alert('Choose a weapon first.'); return; }
        const ch = R.newCharacter({
          name: draft.name || NAMES[party.length % NAMES.length].replace(/\?.*$/, '').trim(),
          race: draft.race, classes: [draft.cls], align: draft.align,
          abilities: draft.abilities, pct: draft.pct, hp: draft.hp,
          weapon: draft.weapon, specialty: draft.specialty, specialtyLevel: draft.specialtyLevel || 0,
          items: defaultArmour(draft.cls)
        });
        ch.spellbook = draft.spellbook.slice();
        ch.spellsMem = [];
        R.recalc(ch, EF.Items);
        if (R.isCaster(ch)) autoMemorize(ch);
        party.push(ch);
        renderParty();
        draft.abilities = null; draft.weapon = null; draft.specialty = null;
        editor.innerHTML = ''; renderEditor();
      };
      editor.appendChild(add);
    }
    function defaultArmour(cls) {
      if (R.CLASSES[cls].group === 'warrior') return [{ key: 'a_studded', equipped: 'armor' }];
      if (cls === 'mage') return [];
      return [{ key: 'a_padded', equipped: 'armor' }];
    }
    function autoMemorize(ch) {
      const pool = ch.cls === 'mage' ? ch.spellbook.slice() : Object.values(EF.Spells).filter(s => s.sch === 'p' && s.lvl <= 1).map(s => s.id);
      for (let sl = 1; sl <= 9; sl++) {
        const n = R.spellSlots(ch, sl);
        for (let i = 0; i < n; i++) {
          const cand = pool.find(id => EF.Spells[id] && EF.Spells[id].lvl === sl);
          if (cand) ch.spellsMem.push({ id: cand, n: 1 });
        }
      }
    }
    U.autoMemorize = autoMemorize;
    // ready-made company
    const preset = el('button', 'bigbtn', 'Take the ready-made company');
    preset.onclick = () => {
      const mk = (name, race, cls, ab, w, ar) => {
        const ch = R.newCharacter({ name, race, classes: [cls], align: R.CLASSES[cls].align[0], abilities: ab, pct: null, hp: R.CLASSES[cls].hd + R.CON_HP(ab.con), weapon: { itemKey: w }, specialty: R.CLASSES[cls].canSpecialize ? w : null, specialtyLevel: 1, items: [{ key: ar, equipped: 'armor' }] });
        if (ch.cls === 'mage') { ch.spellbook = Object.values(EF.Spells).filter(s => s.sch === 'w' && s.lvl === 1).slice(0, 4).map(s => s.id); }
        R.recalc(ch, EF.Items);
        if (R.isCaster(ch)) autoMemorize(ch);
        return ch;
      };
      const preset4 = [
        mk('Tam Brannock', 'human', 'fighter', { str: 17, int: 10, wis: 11, dex: 13, con: 16, cha: 9 }, 'w_long_sword', 'a_studded'),
        mk('Godfri Warmhand', 'dwarf', 'cleric', { str: 13, int: 10, wis: 16, dex: 9, con: 17, cha: 11 }, 'w_mace', 'a_chain'),
        mk('Pip Wrenfoot', 'halfling', 'thief', { str: 8, int: 11, wis: 10, dex: 17, con: 15, cha: 12 }, 'w_dagger', 'a_leather'),
        mk('Isolde Marrow', 'elf', 'mage', { str: 8, int: 16, wis: 12, dex: 15, con: 11, cha: 13 }, 'w_dagger', 'a_padded')
      ];
      start(preset4);
    };
    const begin = el('button', 'bigbtn', 'Set out (4 recommended)');
    begin.onclick = () => { if (party.length) start(party); };
    const actions = el('div', 'row');
    actions.appendChild(preset); actions.appendChild(begin);
    box.appendChild(actions);
    function start(company) {
      EF.Game.newGame(advId, company);
      U.show('ui');
      EF.Game.autosave();
    }
    renderEditor();
    renderParty();
    wrap.appendChild(box);
  });

  // ---------------------------------------------------------------- door menu
  U.doorMenu = function (x, y, ch, state) {
    const f = EF.Game.floorState();
    const k = x + ',' + y;
    const box = el('div', 'panel small center');
    const isSecret = ch === 'S';
    box.appendChild(el('h3', '', isSecret && f.secretsFound[k] ? 'A concealed door' : ch === 'L' ? 'A locked door' : 'A door'));
    const b = (label, fn) => { const t = el('button', 'bigbtn', label); t.onclick = fn; box.appendChild(t); };
    if (state === 'closed' && ch !== 'L') b('Open it', () => { EF.Game.doorOpen(x, y); U.close(); });
    if (ch === 'L') b('Try to pick the lock', () => { EF.Game.doorOpen(x, y); U.close(); });
    b('Listen at it', () => { EF.Game.listenDoor(x, y); U.close(); });
    b('Break it down', () => { EF.Game.doorBust(x, y); U.close(); });
    b('Close the door', () => { f.doors[k] = 'closed'; U.close(); });
    b('Back away', () => U.close());
    showFloat(box);
  };

  function showFloat(panel) {
    const wrap = $('#screen');
    wrap.classList.remove('hidden');
    wrap.innerHTML = '';
    wrap.appendChild(panel);
    U.open = 'float';
  }

  // ---------------------------------------------------------------- town objects
  U.townObject = function (o) {
    switch (o.kind) {
      case 'patron': patronUI(o); break;
      case 'shop_general': case 'shop_weapons': case 'shop_armour': shopUI(o); break;
      case 'temple': templeUI(o); break;
      case 'inn': innUI(o); break;
      case 'training': trainingUI(o); break;
      case 'dungeon': dungeonEnterUI(o); break;
      case 'wildexit': EF.Overland.enter(); break;
      case 'well': EF.Game.log('You draw cold clean water. Nothing looks back.'); U.close(); break;
      case 'fountain': EF.Game.log('Coins glitter on the bottom of the fountain, arranged too neatly to be chance.'); U.close(); break;
      default: U.close();
    }
  };
  U.register('float', w => { });

  function centerPanel(title, sub) {
    const box = el('div', 'panel');
    box.appendChild(el('h3', '', esc(title)));
    if (sub) box.appendChild(el('p', 'dim', sub));
    return box;
  }
  function doneBtn(box, label) {
    const b = el('button', 'bigbtn', label || 'Leave');
    b.onclick = () => U.close();
    box.appendChild(b);
  }

  // ---- patron / quests
  function patronUI(o) {
    const st = EF.Game.state, adv = EF.Adventures[st.adventureId];
    const box = centerPanel(adv.patron.name, '“' + adv.patron.text + '”');
    box.classList.add('wide');
    for (const q of adv.quests) {
      const qs = st.quests[q.id];
      const card = el('div', 'questcard' + (qs.done && qs.paid ? ' done' : ''));
      card.appendChild(el('h4', '', esc((q.main ? '★ ' : '') + q.name) + ' — ' + q.gold + ' gp'));
      card.appendChild(el('p', 'dim', esc(q.brief)));
      let status = '';
      if (qs.done && qs.paid) status = 'Paid.';
      else if (qs.done) status = 'Ready for payment.';
      else if (q.killTag) status = (qs.kills || 0) + '/' + q.killCount;
      else if (q.rescue) status = (qs.rescued || 0) + '/' + q.rescue + ' found';
      else if (q.item) status = qs.itemFound ? 'Item in hand.' : 'Not yet found.';
      card.appendChild(el('div', 'dim', status));
      if (qs.done && !qs.paid) {
        const b = el('button', 'gold', 'Present it');
        b.onclick = () => { EF.Game.turnInQuest(q); U.show('ui'); patronUI(o); };
        card.appendChild(b);
      }
      box.appendChild(card);
    }
    doneBtn(box, 'Thank the patron');
    showFloat(box);
  }

  // ---- shops
  function shopStock(o) {
    const st = EF.Game.state;
    const adv = EF.Adventures[st.adventureId] || {};
    const band = EF.Adventures[st.adventureId] ? (EF.Adventures[st.adventureId].band || 0) : 0;
    let keys = [];
    if (o.kind === 'shop_general') keys = EF.SHOP_STOCK.mundane.concat(EF.SHOP_STOCK.bands[Math.min(4, band)]).filter(k => ['potion', 'scroll'].indexOf((EF.Items[k] || {}).cat) >= 0 || EF.SHOP_STOCK.mundane.indexOf(k) >= 0);
    if (o.kind === 'shop_weapons') keys = EF.SHOP_STOCK.weapons;
    if (o.kind === 'shop_armour') keys = EF.SHOP_STOCK.armor;
    return keys.map(k => EF.Items[k]).filter(Boolean);
  }
  function shopUI(o) {
    const st = EF.Game.state;
    const box = centerPanel(o.name, 'Buy and sell. Coins are shared in the party purse per-person; selling pays half.');
    box.classList.add('wide');
    const goldRow = el('div', 'purse');
    const render = () => {
      box.querySelectorAll('.shop-body').forEach(n => n.remove());
      goldRow.textContent = 'Purse: ' + EF.Game.partyGold() + ' gp';
      box.appendChild(goldRow);
      const body = el('div', 'shop-body two-col');
      const buyCol = el('div'); buyCol.appendChild(el('h4', '', 'For sale'));
      for (const it of shopStock(o)) {
        const line = el('div', 'itemline');
        const ico = document.createElement('canvas'); ico.width = ico.height = 22;
        ico.getContext('2d').drawImage(EF.Figures.itemIcon(it, 22), 0, 0, 22, 22);
        line.appendChild(ico);
        line.appendChild(el('span', 'iname', esc(it.name)));
        line.appendChild(el('span', 'iprice', it.cost + ' gp'));
        const bb = el('button', 'mini', 'Buy');
        bb.onclick = () => {
          if (EF.Game.partyGold() < it.cost) { flashLine(line, 'Not enough coin.'); return; }
          payFrom(it.cost);
          EF.Game.giveItem(it.key, it.cat === 'scroll' ? 1 : (it.coins ? 0 : 1));
          if (!it.coins) { const p = st.party.find(c => c.alive); if (p) { const own = p.items.find(i => i.key === it.key); if (own) own.qty = (own.qty || 1) + 1; else p.items.push({ key: it.key, qty: 1 }); } }
          flashLine(line, 'Bought.');
          render();
        };
        line.appendChild(bb);
        buyCol.appendChild(line);
      }
      body.appendChild(buyCol);
      const sellCol = el('div'); sellCol.appendChild(el('h4', '', 'Your pack'));
      for (const p of st.party) for (const i of p.items.slice()) {
        if (i.equipped) continue;
        const it = EF.Items[i.key]; if (!it || it.quest) continue;
        const line = el('div', 'itemline');
        line.appendChild(el('span', 'iname', esc((it.name || i.key) + (i.qty > 1 ? ' ×' + i.qty : '')) + ' (' + p.name[0] + ')'));
        line.appendChild(el('span', 'iprice', Math.floor(it.cost / 2) + ' gp'));
        const sb = el('button', 'mini', 'Sell');
        sb.onclick = () => {
          p.gold += Math.floor(it.cost / 2);
          i.qty = (i.qty || 1) - 1;
          if (i.qty <= 0) p.items = p.items.filter(x => x !== i);
          render();
        };
        line.appendChild(sb);
        sellCol.appendChild(line);
      }
      body.appendChild(sellCol);
      box.appendChild(body);
    };
    render();
    doneBtn(box, 'Close the ledger');
    showFloat(box);
  }
  function payFrom(amount) {
    const st = EF.Game.state;
    let left = amount;
    for (const p of st.party) { const take = Math.min(p.gold, left); p.gold -= take; left -= take; if (!left) break; }
  }
  function flashLine(line, msg) {
    const s = el('span', 'flash', msg); line.appendChild(s);
    setTimeout(() => s.remove(), 900);
  }

  // ---- temple
  function templeUI(o) {
    const st = EF.Game.state;
    const box = centerPanel(o.name, 'The temple offers healing, raising, and the quiet holiness of the place.');
    const svc = (label, cost, fn) => {
      const b = el('button', 'bigbtn', label + (cost ? ' — ' + cost + ' gp' : ''));
      b.onclick = () => {
        if (cost && EF.Game.partyGold() < cost) { EF.Game.log('The temple does not extend credit.'); return; }
        if (cost) payFrom(cost);
        fn();
      };
      box.appendChild(b);
    };
    svc('Heal the wounded (1d8+1 each, per casting)', 50, () => {
      for (const p of st.party) if (p.alive && p.hp < p.maxHp) {
        const h = Math.min(1 + EF.dice.d8(), p.maxHp - p.hp);
        p.hp += h;
        EF.Game.log(p.name + ' is eased by ' + h + ' points.');
      }
      U.show('ui'); templeUI(o);
    });
    svc('Remove curses and disease', 150, () => {
      for (const p of st.party) { p.status = p.status || {}; delete p.status.curse; delete p.status.sick; }
      EF.Game.log('The temple prayers go out over the company.', 'good');
      U.show('ui');
    });
    svc('Raise one dead (loses a level)', 1000, () => {
      const dead = st.party.find(p => !p.alive);
      if (!dead) { EF.Game.log('No one here is dead yet.'); return; }
      dead.alive = true; dead.hp = 1;
      dead.xp = R.xpForLevel(dead.cls, Math.max(1, dead.level - 1));
      dead.level = R.levelForXp(dead.cls, dead.xp);
      EF.Game.log(dead.name + ' is returned to the living, diminished but breathing.', 'good');
      U.show('ui');
    });
    // holy site small xp
    const hs = el('div', 'dim', 'Devote an hour in prayer (free): a small experience award, separate from any commission.');
    box.appendChild(hs);
    const pb = el('button', 'bigbtn', 'Pray (small XP, all)');
    pb.onclick = () => { EF.Game.grantXP(25); EF.Game.advanceTime(1); EF.Game.log('The company prays; something small and certain is added to your accounts.', 'good'); U.close(); };
    box.appendChild(pb);
    doneBtn(box, 'Depart in peace');
    showFloat(box);
  }

  // ---- inn
  function innUI(o) {
    const box = centerPanel(o.name, 'Beds, bread, and a roof that nothing is currently scratching at.');
    const b = el('button', 'bigbtn', 'Stay the night — 2 gp each person (full overnight recovery, until morning)');
    b.onclick = () => {
      const st = EF.Game.state;
      const cost = 2 * st.party.length;
      if (EF.Game.partyGold() < cost) { EF.Game.log('The innkeeper becomes very interested in the ceiling.'); return; }
      payFrom(cost);
      EF.Game.advanceTime(24 - EF.Game.state.hour + 8);
      for (const p of st.party) if (p.alive) { p.hp = p.maxHp; }
      EF.Watch.reMemorizeAll();
      EF.Game.log('You sleep deeply and wake whole.', 'good');
      U.close();
    };
    box.appendChild(b);
    doneBtn(box, 'Withdraw');
    showFloat(box);
  }

  // ---- training
  function trainingUI(o) {
    const st = EF.Game.state;
    const box = centerPanel(o.name, '100 gp per level, spent on drills, bruises and better bruises. Train only when your experience warrants the next level.');
    for (const p of st.party) {
      const need = R.xpForLevel(p.cls, p.level + 1);
      const can = p.xp >= need && p.level < 20;
      const line = el('div', 'itemline');
      line.appendChild(el('span', 'iname', esc(p.name) + ' — level ' + p.level + ' (' + p.xp + '/' + (p.level >= 20 ? 'MAX' : need) + ' xp)'));
      const b = el('button', 'mini', 'Train');
      b.disabled = !can || p.gold < 100;
      b.onclick = () => { p.gold -= 100; EF.Game.advanceLevel(p, p.level + 1); if (R.isCaster(p)) U.autoMemorize(p); U.show('ui'); trainingUI(o); };
      line.appendChild(b);
      box.appendChild(line);
    }
    doneBtn(box, 'Enough drilling');
    showFloat(box);
  }

  // ---- dungeon entrance
  function dungeonEnterUI(o) {
    const box = centerPanel(o.name, 'The stair goes down. How far do you intend to go?');
    const adv = EF.Adventures[EF.Game.state.adventureId];
    for (let i = 0; i < adv.floors.length; i++) {
      const b = el('button', 'bigbtn', 'Descend to: ' + adv.floors[i].name + ' (level ' + (i + 1) + ')');
      b.onclick = () => { U.close(); EF.Game.enterDungeon(i); };
      box.appendChild(b);
    }
    doneBtn(box, 'Not today');
    showFloat(box);
  }

  // ---------------------------------------------------------------- character sheet
  U.sheet = function (i) { U.show('sheet', i); };
  U.register('sheet', (wrap, i) => {
    const st = EF.Game.state;
    const p = st.party[i];
    if (!p) return;
    R.recalc(p, EF.Items);
    const box = el('div', 'panel sheet');
    const head = el('div', 'row');
    const portrait = EF.Figures.portrait(p, 96);
    head.appendChild(portrait);
    const titles = el('div');
    titles.appendChild(el('h2', '', esc(p.name)));
    titles.appendChild(el('div', 'dim', R.RACES[p.race].name + ' ' + R.CLASSES[p.cls].name +
      (p.specialty ? ' — specializes in ' + (EF.Items[p.specialty] || { name: p.specialty }).name : '') +
      ' · Level ' + p.level + ' · ' + p.align));
    titles.appendChild(el('div', 'dim', 'XP ' + p.xp + '  (next: ' + R.xpForLevel(p.cls, p.level + 1) + ')  ·  xp bonus ' + R.xpBonus(p) + '%'));
    head.appendChild(titles);
    box.appendChild(head);
    const grid = el('div', 'sheetgrid');
    // abilities
    const abl = el('div', 'card');
    abl.appendChild(el('h4', '', 'Ability scores'));
    for (const a of R.ABILITIES) {
      const v = p.abilities[a];
      const extra = a === 'str' && p.pct ? ('/' + (p.pct === 100 ? '00' : p.pct)) : '';
      const m = R.mod(v);
      abl.appendChild(el('div', 'ablrow', R.ABILITY_NAMES[a] + ' <b>' + v + extra + '</b> <span class="dim">(' + (m >= 0 ? '+' : '') + m + ')</span>' + (a === 'con' ? ' <span class="dim">surv ' + p.surv + (p.conLoss ? '/' + p.conLoss : '') + '</span>' : '')));
    }
    grid.appendChild(abl);
    // combat
    const cb = el('div', 'card');
    cb.appendChild(el('h4', '', 'Combat'));
    cb.appendChild(el('div', '', 'AC <b>' + p.armorClass + '</b> · HP <b>' + p.hp + '/' + p.maxHp + '</b>'));
    cb.appendChild(el('div', '', 'THAC0 <b>' + R.thac0(p.cls, p.level) + '</b> · attacks ' + R.meleeAttacks(p) + '/rnd'));
    const sp = p.specialty && R.specialtyBonus(p, p.specialty);
    if (sp) cb.appendChild(el('div', '', 'Specialization: +' + sp.toHit + ' to hit, +' + sp.toDmg + ' dmg' + (sp.extra ? ', extra attack' : '')));
    cb.appendChild(el('div', '', 'Saves: par <b>' + R.saves(p.cls, p.level)[0] + '</b> poi <b>' + R.saves(p.cls, p.level)[1] + '</b> bre <b>' + R.saves(p.cls, p.level)[2] + '</b> rod <b>' + R.saves(p.cls, p.level)[3] + '</b> spr <b>' + R.saves(p.cls, p.level)[4] + '</b>'));
    if (R.turnsUndead(p)) cb.appendChild(el('div', '', 'Turns undead at effective level ' + R.turnLevel(p) + (p.cls === 'paladin' ? ' (paladin: cleric −2)' : '')));
    if (R.layOnHands(p)) cb.appendChild(el('div', '', 'Lay on hands: ' + R.layOnHands(p) + ' hp/day'));
    cb.appendChild(el('div', '', 'Move ' + R.movementSquares(p) + ' (' + R.combatSquares(p) + ' combat squares)'));
    if (p.weapon) {
      const w = EF.Items[p.weapon.itemKey];
      cb.appendChild(el('div', '', 'Wielding: ' + esc((w || {}).name || '?') + ' (' + (w || {}).dmg + ')'));
    }
    if (R.isThief(p)) {
      const sk = R.thiefSkills(p);
      cb.appendChild(el('h4', '', 'Thief skills'));
      for (const k in sk) cb.appendChild(el('div', '', k + ': <b>' + G_thief(p, k, sk[k]) + '%</b>'));
      cb.appendChild(el('div', 'dim', 'Backstab: +4 to hit, double damage.'));
    }
    grid.appendChild(cb);
    // spells
    const cls = R.CLASSES[p.cls];
    if (cls.startsSpellsAt && p.level >= cls.startsSpellsAt) {
      const sps = el('div', 'card');
      sps.appendChild(el('h4', '', 'Spells'));
      for (let sl = 1; sl <= (p.cls === 'mage' ? 9 : 7); sl++) {
        const slots = R.spellSlots(p, sl);
        if (!slots) continue;
        const mem = p.spellsMem.filter(m => EF.Spells[m.id] && EF.Spells[m.id].lvl === sl);
        const used = mem.reduce((s, m) => s + m.n, 0);
        sps.appendChild(el('div', 'slotline', 'L' + sl + ': ' + used + '/' + slots + ' memorized'));
        for (const m of mem) sps.appendChild(el('div', 'dim', '  ‣ ' + EF.Spells[m.id].name + ' ×' + m.n));
      }
      if (p.cls === 'mage') {
        sps.appendChild(el('h4', '', 'Spellbook (' + p.spellbook.length + ')'));
        const all = Object.values(EF.Spells).filter(s => s.sch === 'w');
        for (const s of all) {
          if (s.lvl > Math.max(1, ...p.spellbook.map(id => (EF.Spells[id] || { lvl: 1 }).lvl), 0) && !p.spellbook.includes(s.id) && s.lvl > p.level) continue;
          const known = p.spellbook.includes(s.id);
          if (!known && s.lvl > R.INT_MAX_SPELL(p.abilities.int)) continue;
          sps.appendChild(el('div', known ? '' : 'dim', (known ? '● ' : '○ ') + s.name + ' (L' + s.lvl + ')'));
        }
      }
      grid.appendChild(sps);
    }
    // items
    const itc = el('div', 'card');
    itc.appendChild(el('h4', '', 'Purse & pack'));
    itc.appendChild(el('div', '', p.gold + ' gp'));
    for (const it of p.items) {
      const item = EF.Items[it.key]; if (!item) continue;
      const line = el('div', 'itemline');
      line.appendChild(el('span', 'iname', esc(item.name) + (it.qty > 1 ? ' ×' + it.qty : '') + (it.equipped ? ' (worn)' : '')));
      const eq = el('button', 'mini', it.equipped ? 'Remove' : 'Wield/Wear');
      eq.onclick = () => { toggleEquip(p, it); U.show('sheet', i); };
      if (['weapon', 'armor'].indexOf(item.cat) >= 0) line.appendChild(eq);
      const dr = el('button', 'mini', 'Drop');
      dr.onclick = () => { p.items = p.items.filter(x => x !== it); EF.Game.dropAt([{ key: it.key, qty: it.qty || 1 }]); U.show('sheet', i); };
      line.appendChild(dr);
      itc.appendChild(line);
    }
    // learn scroll button (mages)
    if (p.cls === 'mage') {
      const scrolls = p.items.filter(x => (EF.Items[x.key] || {}).cat === 'scroll' && !EF.Items[x.key].priest);
      if (scrolls.length) itc.appendChild(el('h4', '', 'Read scrolls'));
      for (const sc of scrolls) {
        const item = EF.Items[sc.key];
        const sp = EF.Spells[item.spell];
        const line = el('div', 'itemline');
        line.appendChild(el('span', 'iname', esc(item.name)));
        const lb = el('button', 'mini' + (p.spellbook.includes(item.spell) ? ' off' : ''), 'Learn');
        lb.disabled = p.spellbook.includes(item.spell);
        if (p.spellbook.includes(item.spell)) lb.title = 'Already in your spellbook';
        lb.onclick = () => {
          if (p.spellbook.includes(item.spell)) return;
          p.spellbook.push(item.spell);
          sc.qty = (sc.qty || 1) - 1;
          if (sc.qty <= 0) p.items = p.items.filter(x => x !== sc);
          EF.Game.log(p.name + ' copies ' + sp.name + ' into the spellbook. The scroll goes blank.', 'good');
          U.show('sheet', i);
        };
        line.appendChild(lb);
        itc.appendChild(line);
      }
    }
    grid.appendChild(itc);
    box.appendChild(grid);
    const row = el('div', 'row');
    const useItem = el('button', 'bigbtn', 'Use/throw an item');
    useItem.onclick = () => U.show('useitem', i);
    row.appendChild(useItem);
    const close = el('button', 'bigbtn', 'Close');
    close.onclick = () => U.close();
    row.appendChild(close);
    box.appendChild(row);
    if (p.status && Object.keys(p.status).length) box.appendChild(el('div', 'dim', 'Conditions: ' + Object.keys(p.status).map(k => k + (p.status[k] === true ? '' : ' (' + p.status[k] + ')')).join(', ')));
    wrap.appendChild(box);
  });
  function G_thief(p, k, base) {
    const pass = p.passives && p.passives.thief && p.passives.thief[k] || 0;
    return Math.min(95, base + pass);
  }
  function toggleEquip(p, ref) {
    const item = EF.Items[ref.key];
    if (ref.equipped) { ref.equipped = null; }
    else {
      if (item.cat === 'weapon') { p.items.forEach(i => { if (i !== ref && i.equipped === 'weapon') i.equipped = null; }); ref.equipped = 'weapon'; p.weapon = { itemKey: ref.key }; }
      if (item.cat === 'armor') { p.items.forEach(i => { if (i !== ref && i.equipped === 'armor') i.equipped = null; }); ref.equipped = 'armor'; p.armorItem = ref.key; }
    }
    if (!p.items.find(i => i.equipped === 'weapon')) p.weapon = null;
    if (!p.items.find(i => i.equipped === 'armor')) p.armorItem = null;
    R.recalc(p, EF.Items);
  }
  U.toggleEquip = toggleEquip;

  // ---------------------------------------------------------------- pack / inventory
  U.register('inventory', wrap => {
    const box = el('div', 'panel wide');
    box.appendChild(el('h2', '', 'The company pack'));
    for (const p of EF.Game.state.party) {
      const card = el('div', 'card');
      card.appendChild(el('h4', '', esc(p.name) + ' — ' + p.gold + ' gp'));
      for (const it of p.items) {
        const item = EF.Items[it.key];
        card.appendChild(el('div', 'dim', '• ' + esc((item || {}).name || it.key) + (it.qty > 1 ? ' ×' + it.qty : '') + (it.equipped ? ' (equipped)' : '')));
      }
      box.appendChild(card);
    }
    const b = el('button', 'bigbtn', 'Close');
    b.onclick = () => U.close();
    box.appendChild(b);
    wrap.appendChild(box);
  });

  // ---------------------------------------------------------------- use item out of combat
  U.register('useitem', (wrap, i) => {
    const st = EF.Game.state, p = st.party[i];
    const box = el('div', 'panel');
    box.appendChild(el('h3', '', p.name + ' — use an item'));
    for (const it of p.items.slice()) {
      const item = EF.Items[it.key];
      if (!item) continue;
      const usable = ['potion', 'oil'].indexOf(item.cat) >= 0 || item.fx || item.use;
      if (!usable) continue;
      const b = el('button', 'bigbtn', esc(item.name));
      b.onclick = () => {
        const fx = item.fx || item.use;
        if (fx && fx.kind === 'heal') {
          const h = Math.min(EF.dice.roll(fx.dice), p.maxHp - p.hp);
          p.hp += h;
          EF.Game.log(p.name + ' drinks ' + item.name + ' and recovers ' + h + ' points.', 'good');
        } else if (fx) {
          EF.Game.log(p.name + ' uses ' + item.name + ' — nothing dramatic happens out of harm’s way.');
        }
        it.qty = (it.qty || 1) - 1;
        if (it.qty <= 0) p.items = p.items.filter(x => x !== it);
        U.close();
      };
      box.appendChild(b);
    }
    const b = el('button', 'bigbtn', 'Never mind');
    b.onclick = () => U.close();
    box.appendChild(b);
    wrap.appendChild(box);
  });

  // ---------------------------------------------------------------- saves
  U.register('saves', wrap => {
    const box = el('div', 'panel wide');
    box.appendChild(el('h2', '', 'Saves'));
    for (const slot of EF.SLOTS) {
      const info = EF.slotInfo(slot);
      const line = el('div', 'itemline');
      line.appendChild(el('span', 'iname', EF.slotLabel[slot] + ' — ' + (info ? info.adventure + ' · ' + info.party : 'empty')));
      const sv = el('button', 'mini', 'Save');
      sv.disabled = !EF.Game.state;
      sv.onclick = () => { EF.Game.saveTo(slot); U.show('saves'); };
      const ld = el('button', 'mini', 'Load');
      ld.disabled = !info;
      ld.onclick = () => { if (EF.Game.loadFrom(slot)) U.close(); };
      const dl = el('button', 'mini danger', 'Erase');
      dl.disabled = !info;
      dl.onclick = () => { EF.deleteSlot(slot); U.show('saves'); };
      line.appendChild(sv); line.appendChild(ld); line.appendChild(dl);
      box.appendChild(line);
    }
    const b = el('button', 'bigbtn', 'Back');
    b.onclick = () => U.show('menu');
    box.appendChild(b);
    wrap.appendChild(box);
  });

  // ---------------------------------------------------------------- defeat
  U.register('defeat', wrap => {
    const box = el('div', 'panel center');
    box.appendChild(el('h2', '', 'The company falls'));
    box.appendChild(el('p', 'dim', 'The Emberwild keeps what it takes. Somewhere a chronicle stops mid-sentence.'));
    const b1 = el('button', 'bigbtn', 'Load last save');
    b1.onclick = () => { if (EF.Game.loadFrom('autosave')) U.close(); else U.show('saves'); };
    const b2 = el('button', 'bigbtn', 'Main menu');
    b2.onclick = () => U.show('menu');
    box.appendChild(b1); box.appendChild(b2);
    wrap.appendChild(box);
  });

  // ---------------------------------------------------------------- how to play
  U.register('howto', wrap => {
    const box = el('div', 'panel wide');
    box.appendChild(el('h2', '', 'How to play Emberfall'));
    box.innerHTML += `
<div class="cols">
<div>
<h4>Moving</h4>
<p><b>W / ↑</b> forward · <b>S / ↓</b> back · <b>A ← / D →</b> turn · <b>Q / E</b> sidestep left/right. On touch screens use the on-screen pad.</p>
<h4>Keys</h4>
<p><b>F</b> search (secret doors & traps) · <b>R</b> make camp · <b>M</b> full map · <b>J</b> journal · <b>B</b> bestiary · <b>I</b> pack · <b>1–6</b> character sheets · <b>Esc</b> menu.</p>
<h4>Doors & walls</h4>
<p>Walk into a door to get a menu: open, pick, listen, break. Secret doors look exactly like wall — <b>search</b> beside blank-looking walls; dwarves, gnomes and thieves are good at it. Searching also turns up nearby traps, which then appear on your map; only a thief should touch them.</p>
<h4>Combat</h4>
<p>Turn-based: each round, everyone acts in initiative order. Click a green square to move, red-mode + click a foe to attack. Use the buttons for spells, items, turning undead, defend or auto-fight. THAC0: roll d20 and beat (THAC0 − target AC − your bonuses). Rolling a 20 always hits and doubles damage; a 1 always misses.</p>
</div>
<div>
<h4>Advancing</h4>
<p>Experience is shared among survivors; quests pay <b>a quarter</b> of their listed XP. At the training yard in town, pay 100 gp to take a level when your XP earns it. Temples heal, cure and raise; inns restore you fully; shrines and temples give a small separate XP award for an hour’s prayer.</p>
<h4>Camping</h4>
<p><b>R</b> anywhere in the wilds or dungeons: rest (watchers on watch), “rest until healed” (healers cast until everyone is whole and spellcasters re-memorize), and eat your rations or go hungry.</p>
<h4>Spellbooks</h4>
<p>Mages learn spells from wizard scrolls (the Learn button dims if the spell is already in the book). Priests may read any prayer-leaf directly.</p>
<h4>The world</h4>
<p>Every adventure has a wilderness map: leave by the town gate. Hamlets, healers, holy sites, monster lairs and safe camps are marked where you have news of them. Lairs cleared stay cleared.</p>
<h4>Saves</h4>
<p>Five slots plus autosave, kept in this browser.</p>
</div>`;
    const b = el('button', 'bigbtn', 'Close');
    b.onclick = () => U.close();
    box.appendChild(b);
    wrap.appendChild(box);
  });
})();
