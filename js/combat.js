/* Emberfall — combat.js
 * Turn-based tactical combat on an isometric field: individual initiative,
 * movement, melee and missile attacks (THAC0 vs descending AC), spells with
 * areas and ranges, backstab, turning undead, morale and fleeing, poison,
 * paralysis, level drain, regeneration, breath weapons and weapon resistances,
 * plus an auto-fight option. Experience is split among survivors. */
(function () {
  const EF = (globalThis.EF = globalThis.EF || {});
  const R = EF.Rules;
  const C = {};
  EF.Combat = C;

  const d = () => EF.dice;
  C.active = false;
  let st = null;           // combat state
  let canvas = null, ctx = null;
  const GW = 15, GH = 11;

  // --------------------------------------------------------------- setup
  C.start = function (instances) {
    const gs = EF.Game.state;
    const adv = EF.Adventures[gs.adventureId];
    // surprise check
    const anyAmbush = instances.some(i => i.ambush && !i.sleeping);
    const thief = EF.Game.bestThief('moveSilently');
    let surprised = false, monsterSurprised = false;
    if (anyAmbush) surprised = d().chance(70);
    else if (instances.every(i => i.sleeping)) monsterSurprised = true;
    else if (thief && d().roll('1d100') <= EF.Game.thiefSkill(thief, 'moveSilently')) monsterSurprised = true;

    const units = [];
    let uid = 0;
    const pcx = 2, pcy = Math.floor(GH / 2);
    gs.party.forEach((p, i) => {
      if (!p.alive) return;
      units.push({
        uid: uid++, side: 'party', ch: p, name: p.name,
        x: pcx, y: EF.clamp(pcy + (i - (gs.party.length - 1) / 2) * 2, 0, GH - 1),
        mp: R.combatSquares(R.recalc(Object.assign({}, p), EF.Items) && p), moved: 0,
        ac: p.armorClass, hp: p.hp, maxHp: p.maxHp,
        status: Object.assign({}, p.status), items: p.items, lastMelee: null, backstabDone: false, defend: false
      });
    });
    instances.forEach((inst, i) => {
      const m = EF.mon(inst.key);
      const hp = Math.max(1, inst.hp);
      units.push({
        uid: uid++, side: 'monster', inst, mon: m, key: m.key, name: m.name,
        x: GW - 4 + (i % 3), y: EF.clamp(Math.floor(GH / 2) + (i - (instances.length - 1) / 2) * 2, 0, GH - 1),
        mp: Math.max(1, Math.round(m.mv / 3)), moved: 0, ac: m.ac, hp, maxHp: m.hpAvg,
        asleep: inst.sleeping, turned: 0, breathCd: 0, morale: m.morale, hpStart: hp,
        status: {}
      });
    });
    // clip to grid & simple de-overlap
    for (const u of units) { u.x = EF.clamp(u.x, 0, GW - 1); u.y = EF.clamp(u.y, 0, GH - 1); }
    for (const u of units) {
      let guard = 0;
      while (units.some(o => o !== u && o.x === u.x && o.y === u.y) && guard++ < 30) { u.x = EF.clamp(u.x + (u.side === 'party' ? -1 : 1), 0, GW - 1); u.y = EF.clamp(u.y + (guard % 3) - 1, 0, GH - 1); }
    }
    // obstacles
    const obs = {};
    const rng = EF.newRng('combatfield', (gs.adventureId || '') + gs.pos.x + ',' + gs.pos.y + ',' + gs.dungeonFloor + ',' + instances.map(i => i.id).join('_'));
    for (let i = 0; i < 5; i++) obs[rng.range(3, GW - 4) + ',' + rng.range(1, GH - 2)] = true;
    for (const u of units) delete obs[u.x + ',' + u.y];

    st = {
      units, obs, round: 1, queue: [], qi: 0, over: false, result: null,
      surprised, monsterSurprised, auto: false,
      sel: null, mode: 'move', spellPick: null,
      surpriseRound: surprised || monsterSurprised ? true : false,
      log: [], fleeingParty: false, fleeTries: 0,
      origin: { advId: gs.adventureId, floor: gs.dungeonFloor, x: gs.pos.x, y: gs.pos.y }
    };
    C.active = true;
    st.log.push(surprised ? 'Ambush! The enemy strikes first!' : monsterSurprised ? 'Your opponents are unaware of you. You may move and act before they wake.' : 'Battle!');
    rollInitiative();
    EF.UI.show('combat');
    draw();
    if (surprised) startRound();
    else if (monsterSurprised) { st.log.push('(They do not see you yet — act, or creep away.)'); }
    else startRound();
  };

  function rollInitiative() {
    for (const u of st.units) {
      if (u.side === 'party') {
        const ch = u.ch;
        u.init = d().d6() + R.DEX_ATK(ch.abilities.dex || 10) + (u.status && u.status.lucky ? 1 : 0);
      } else u.init = d().d6();
    }
  }
  function startRound() {
    rollInitiative();
    st.queue = st.units.filter(u => u.hp > 0 && !u.escaped).sort((a, b) => b.init - a.init);
    st.qi = 0;
    beginTurn();
  }
  function beginTurn() {
    if (st.over) return;
    // morale for monster losses at round start
    if (st.qi >= st.queue.length) { st.round++; tickStatuses(); startRound(); return; }
    const u = st.queue[st.qi];
    if (!u || u.hp <= 0 || u.escaped) { st.qi++; beginTurn(); return; }
    u.moved = 0; u.acted = false; u.defend = false;
    st.sel = u.side === 'party' ? u : null;
    st.mode = 'move';
    if (u.side === 'monster') {
      monsterTurn(u);
      tick();
    } else {
      if (u.status && (u.status.held || u.status.paralysed || u.status.stunned)) {
        C.log(u.name + ' is frozen and cannot act.');
        if (u.status.stunned) u.status.stunned = 0;
        tick();
        return;
      }
      if (u.status && u.status.confused) {
        // confused: random
        if (d().chance(50)) { C.log(u.name + ' wanders, confused.'); }
        else { const foe = nearestEnemy(u); if (foe) tryAttack(u, foe); }
        tick();
        return;
      }
      draw();
    }
  }
  function tick() { st.qi++; beginTurn(); }
  C.endTurn = function () { const u = st.sel; if (u) { if (st.mode === 'spell' && !st.spellPick) { /* nothing */ } tick(); } else tick(); };

  function nearestEnemy(u, inclSelfSide) {
    let best = null, bd = 1e9;
    for (const o of st.units) {
      if (o.hp <= 0 || o.escaped) continue;
      if (!inclSelfSide && o.side === u.side) continue;
      const dd = Math.abs(o.x - u.x) + Math.abs(o.y - u.y);
      if (dd < bd) { bd = dd; best = o; }
    }
    return best;
  }

  // --------------------------------------------------------------- statuses
  function tickStatuses() {
    for (const u of st.units) {
      if (u.hp <= 0) continue;
      if (u.side === 'monster' && u.mon.special.regen) {
        if (!u.fireBurned) u.hp = Math.min(u.maxHp, u.hp + u.mon.special.regen);
        u.fireBurned = false;
      }
      const s = u.status || {};
      for (const k of ['haste', 'slow', 'bless', 'curse', 'fear', 'shield', 'aid', 'prayer', 'protevil', 'sanctuary', 'invis', 'web']) {
        if (s[k] && s[k] !== true && s[k] > 0) { s[k]--; if (!s[k]) delete s[k]; }
      }
      if (s.hasteLag) { u.status.slow = 2; delete s.hasteLag; }
      if (u.regenerates) u.hp = Math.min(u.maxHp, u.hp + 1);
    }
  }

  // --------------------------------------------------------------- movement
  C.clickField = function (gx, gy) {
    if (!st || st.over) return;
    const u = st.sel;
    if (!u) return;
    if (st.mode === 'attack' || st.mode === 'spell') {
      const target = st.units.find(o => o.x === gx && o.y === gy && o.hp > 0);
      if (st.mode === 'attack' && target && target.side !== u.side) { tryAttack(u, target); afterAct(u); return; }
      if (st.mode === 'spell' && st.spellPick) { castSpellAt(u, st.spellPick, gx, gy); st.spellPick = null; afterAct(u); return; }
      return;
    }
    // movement: step toward clicked cell
    if (u.side !== 'party') return;
    const cost = 1;
    let x = u.x, y = u.y, guard = 0;
    while ((x !== gx || y !== gy) && guard++ < 40) {
      if (u.moved + cost > u.mp + (u.status && u.status.haste ? 2 : 0)) { C.log('No movement left this round.'); break; }
      const dx = Math.sign(gx - x), dy = Math.sign(gy - y);
      let moved = false;
      const pass = (nx, ny) => nx >= 0 && ny >= 0 && nx < GW && ny < GH && !st.obs[nx + ',' + ny] && !st.units.some(o => o !== u && o.hp > 0 && !o.escaped && o.x === nx && o.y === ny);
      if (dx && pass(x + dx, y)) { x += dx; moved = true; }
      else if (dy && pass(x, y + dy)) { y += dy; moved = true; }
      if (!moved) break;
      u.x = x; u.y = y; u.moved += cost;
      // stepping into a web/spell check omitted for movement
    }
    draw();
  };
  C.setMode = function (m) { st.mode = m; draw(); };
  C.pickSpell = function (slot) {
    st.spellPick = slot;
    st.mode = 'spell';
    draw();
  };
  C.castSelf = function () {
    const u = st.sel;
    if (!u || !st.spellPick) return;
    castSpellAt(u, st.spellPick, u.x, u.y);
    st.spellPick = null;
    afterAct(u);
  };

  // --------------------------------------------------------------- attacks
  function weaponOf(ch) {
    const it = ch.weapon && EF.Items[ch.weapon.itemKey];
    return it || null;
  }
  function charWeaponDice(u) {
    const it = weaponOf(u.ch);
    if (it && it.dmg && it.dmg !== '—') return it;
    return { name: 'Bare hands', dmg: '1d3', key: null };
  }
  function tryAttack(u, target) {
    if (u.side === 'party') return charAttack(u, target);
    return monsterAttack(u, target);
  }
  function charAttack(u, target, opts) {
    const ch = u.ch;
    const it = charWeaponDice(u);
    const missile = !!(it.missile || it.thrown);
    if (!missile && Math.abs(u.x - target.x) + Math.abs(u.y - target.y) > (it.reach ? 2 : 1)) { C.log('Out of reach.'); return; }
    if (missile && (Math.abs(u.x - target.x) + Math.abs(u.y - target.y)) > (it.missile ? it.missile.rng * 2 : 4)) { C.log('Out of range.'); return; }
    const items = EF.Items;
    R.recalc(ch, items);
    const sp = R.specialtyBonus(ch, it.key);
    const toHit = R.STR_TO_HIT(ch.abilities.str) + (it.strBonus ? R.STR_BOW_BONUS(ch.abilities.str) : 0);
    let backstab = false;
    if (R.isThief(ch) && !missile && !u.backstabDone && target.side === 'monster') {
      // backstab if enemy hasn't acted yet this round or was unaware
      const qiMe = st.queue.indexOf(u), qiT = st.queue.indexOf(target);
      const unaware = target.asleep || target.turnPhase || st.surpriseRound || (target.init !== undefined && !target.hasActed);
      if (unaware && target.hp > 0) backstab = true;
      void qiMe; void qiT;
    }
    const tAC = targetAC(target, ch);
    const need = Math.max(2, R.thac0(ch.cls, ch.level) - tAC - toHit - R.DEX_ATK(ch.abilities.dex) - sp.toHit - (ch.status && ch.status.bless ? 1 : 0) + (ch.status && ch.status.curse ? 1 : 0) - (backstab ? 4 : 0) - (target.status && target.status.slow ? 1 : 0));
    const roll = d().d20();
    const hit = roll === 20 || (roll !== 1 && roll >= need);
    C.log(ch.name + ' attacks ' + target.name + (backstab ? ' (BACKSTAB!)' : '') + ' — needs ' + need + ', rolls ' + roll + (hit ? '. Hit!' : '. Miss.'));
    if (hit) {
      let dmg = d().roll(pickDmg(it.dmg, target));
      if (it.size !== 'M' && it.dmg.includes('/')) dmg = d().roll(pickDmg(it.dmg, target));
      dmg += R.strDamage(ch) * (missile && !it.strBonus ? 0 : 1);
      dmg += sp.toDmg;
      if (backstab) dmg *= 2;
      if (roll === 20) dmg *= 2;
      if (u.status && u.status.aid) dmg += 1;
      // weapon need check
      const sp2 = target.mon ? target.mon.special : null;
      if (sp2 && sp2.weaponNeed) {
        const bonus = bonusOf(it);
        const mat = it.holy || it.magic;
        if (bonus < sp2.weaponNeed && !mat) { C.log('The blow passes through ' + target.name + ' like smoke — only finer steel bites.'); dmg = 0; }
      }
      // material weaknesses
      if (target.mon && target.mon.special.vulns && it) {
        const v = target.mon.special.vulns;
        if (v.fire && /fire|flame/.test(it.name || '') ) dmg *= 2;
        if (v.piercing === 'stake' && /dagger|stake|spear|arrow|bolt/.test((it.name || '').toLowerCase())) dmg *= 3;
        if (v.silver && (it.silver || (it.key && /silver/.test(it.key)))) dmg *= 2;
      }
      applyDamage(target, dmg, ch.name);
      if (backstab) u.backstabDone = true;
      if (ch.status && ch.status.sharp) dmgBonusNote();
      // whips/nets/bolas special: net special
      if (it.special === 'net' && target.hp > 0 && target.mon && target.mon.hd <= 4 && !target.mon.special.incorporeal) {
        if (d().chance(50)) { C.log(target.name + ' is entangled in the net!'); target.status.held = true; target.status.web = 4; }
      }
      // extra attack from specialization / ranger / haste
      const extra = R.meleeAttacks(ch) - 1;
      for (let e = 0; e < extra; e++) {
        if (target.hp > 0 && (!missile || (ammoOK(ch, it) && d().chance(70)))) {
          C.log(ch.name + ' strikes again!');
          charAttackQuick(u, target, it);
        }
      }
      // spellstrike (slash of the faithful) etc omitted
      target.turnPhase = target.turnPhase || 'angry';
      target.asleep = false;
    }
    target.asleep = false;
    spendAmmo(ch, it);
    checkMorale(target);
  }
  function charAttackQuick(u, target, it) {
    const ch = u.ch;
    const sp = R.specialtyBonus(ch, it.key);
    const need = Math.max(2, R.thac0(ch.cls, ch.level) - targetAC(target, ch) - R.STR_TO_HIT(ch.abilities.str) - sp.toHit - R.DEX_ATK(ch.abilities.dex) - (ch.status && ch.status.bless ? 1 : 0));
    const roll = d().d20();
    if (roll >= need || roll === 20) {
      let dmg = d().roll(pickDmg(it.dmg, target)) + R.strDamage(ch) + sp.toDmg;
      applyDamage(target, dmg, ch.name);
    }
  }
  function ammoOK(ch, it) {
    if (!it.ammo) return true;
    const bag = ch.items.find(i => i.key === 'g_ammo_arrows' || i.key === 'g_ammo_bolts' || i.key === 'g_ammo_bullets' || i.key === 'quiver_arrows');
    return !!bag && bag.qty > 0;
  }
  function spendAmmo(ch, it) {
    if (!it.ammo) return;
    const bag = ch.items.find(i => i.key === 'g_ammo_arrows' || i.key === 'g_ammo_bolts' || i.key === 'g_ammo_bullets' || i.key === 'quiver_arrows');
    if (bag) { bag.qty--; if (bag.qty <= 0) ch.items = ch.items.filter(i => i !== bag); }
  }
  function pickDmg(dmgStr, target) {
    if (!dmgStr.includes('/')) return dmgStr;
    const [s, l] = dmgStr.split('/');
    const big = target.mon && ['L', 'H', 'G'].indexOf(target.mon.size) >= 0;
    return big ? l : s;
  }
  function targetAC(target, ch) {
    let ac = target.ac;
    if (target.side === 'party') {
      ac = target.ch.armorClass;
      if (target.ch.status && target.ch.status.shield) ac -= 4;
      if (target.defend) ac -= 4;
      const passives = target.ch.passives || {};
      ac -= (passives.ac || 0);
    }
    if (target.mon && target.status) {
      if (target.status.slow) ac += 1;
      if (target.status.fear) ac += 1;
    }
    if (target.status && target.status.invis) ac -= 4;
    return ac;
  }
  function bonusOf(it) {
    if (!it) return 0;
    return it.bonus || (/(\d)/.exec((it.name || '').match(/\+(\d)/) || [])[1] || 0) && +/(\d)/.exec((it.name || '').match(/\+(\d)/) || [])[1] || 0;
  }
  function dmgBonusNote() { }

  function applyDamage(target, dmg, src) {
    if (dmg <= 0) return;
    target.hp -= dmg;
    C.log(target.name + ' takes ' + dmg + ' damage' + (target.hp <= 0 ? ' and falls!' : ''));
    if (target.side === 'monster' && target.mon.special.vulns && target.mon.special.vulns.fire) target.fireBurned = true;
    if (target.hp <= 0) {
      target.hp = 0;
      if (target.side === 'monster') {
        target.inst.alive = false; target.inst.hp = 0;
        EF.Game.noteKill(target.mon, target.inst);
      } else {
        target.ch.alive = false; target.ch.hp = 0;
        C.log(target.name + ' collapses! If tended within this battle, they may live.');
      }
      checkMorale(target, true);
    }
    checkCombatEnd();
  }

  // --------------------------------------------------------------- monster turn
  function monsterTurn(u) {
    const m = u.mon, sp = m.special;
    u.asleep = false;
    if (u.turned > 0) { u.turned--; fleeFrom(u); return; }
    if (u.status.held || u.status.paralysed || u.status.stunned) { C.log(m.name + ' struggles, held fast.'); if (u.status.stunned) u.status.stunned = 0; return; }
    if (u.status.fear && d().chance(60)) { fleeFrom(u); return; }
    const foe = nearestEnemy(u);
    if (!foe) return;
    // breath weapon
    if (sp.breath && u.breathCd <= 0 && dist(u, foe) <= (sp.breath.shape === 'line' ? 8 : 4)) {
      useBreath(u, foe);
      u.breathCd = sp.breath.every || 3;
      return;
    }
    if (u.breathCd > 0) u.breathCd--;
    if (u.status.web && d().chance(70)) { C.log(m.name + ' strains against the web.'); u.status.web--; return; }
    // move toward foe
    while (dist(u, foe) > 1 && u.moved < u.mp) {
      stepToward(u, foe);
      u.moved++;
    }
    if (sp.cast && d().chance(45)) { monsterCast(u, foe); return; }
    if (dist(u, foe) <= 1) {
      const atks = m.atks.length ? m.atks : [{ n: 1, dmg: '1d6' }];
      const hi5 = sp.hi5 ? 5 : R.CLASSES ? 1 : 1;
      const nAtt = Math.max(1, (m.hd >= 7 ? 2 : 1) + (sp.hi5 ? 2 : 0));
      for (let i = 0; i < Math.min(nAtt, atks.length + 1); i++) {
        const a = atks[i % atks.length] || { n: 1, dmg: '1d6' };
        for (let k = 0; k < (a.n || 1); k++) monsterHit(u, foe, a.dmg, m);
        void hi5;
        if (foe.hp <= 0) break;
      }
    }
    void atksUnused;
  }
  const atksUnused = 0;
  function monsterHit(u, foe, diceSpec, m) {
    const ch = foe.ch;
    R.recalc(ch, EF.Items);
    let tAC = targetAC(foe, ch);
    if (foe.status && foe.status.invis) { if (!(m.special.truesee)) tAC -= 4; }
    const fearb = (ch.status && ch.status.fear) ? -2 : 0;
    const prot = (ch.status && ch.status.protevil && (m.special.outer || m.special.undead)) ? 2 : 0;
    const need = Math.max(2, R.thac0('fighter', Math.max(1, Math.round(m.hd))) - tAC - prot - fearb + (ch.status && ch.status.curse ? -1 : 0) + (ch.status && ch.status.prayer ? 1 : 0));
    const roll = d().d20();
    const hit = roll === 20 || (roll !== 1 && roll >= need);
    C.log(m.name + ' attacks ' + ch.name + ' — ' + roll + ' vs ' + need + (hit ? '. Hit!' : '. Miss.'));
    if (!hit) return;
    let dmg = d().roll(String(diceSpec).replace(/^.*?(\d+d\d+[+-]*\d*)$/, '$1') || '1d6');
    // pack bonus damage omitted (pack = to-hit handled in need via +? keep simple)
    applyDamage(foe, dmg, m.name);
    if (foe.hp <= 0) return;
    // specials on hit
    const sp = m.special;
    if (sp.poison) {
      const sv = R.saves(ch.cls, ch.level)[1] - R.CON_SAVE(ch.abilities.con);
      if (d().d20() >= sv) C.log(ch.name + ' shrugs off the venom.');
      else if (sp.poison === 'die') { C.log('The venom is lethal!', 'bad'); applyDamage(foe, 999, 'venom'); }
      else if (sp.poison === 'slay') { C.log('Instant venom!', 'bad'); applyDamage(foe, 999, 'venom'); }
      else if (sp.poison === 'par') { C.log(ch.name + ' is paralysed!', 'bad'); foe.status.paralysed = true; }
      else { applyDamage(foe, d().roll('1d4'), 'venom'); }
    }
    if (sp.paralysis && foe.hp > 0) {
      const sv = R.saves(ch.cls, ch.level)[0];
      if (d().d20() < sv) { C.log(ch.name + ' goes rigid!', 'bad'); foe.status.paralysed = true; }
    }
    if (sp.drain && foe.hp > 0) {
      const sv = R.saves(ch.cls, ch.level)[1] - R.CON_SAVE(ch.abilities.con);
      if (d().d20() < sv) { levelDrain(ch, sp.drain); }
      else C.log(ch.name + ' resists the life-drain.');
    }
    if (sp.disease && foe.hp > 0 && d().chance(50)) { C.log(ch.name + ' contracts a disease (-1 to all while sick).', 'bad'); ch.status.sick = 20; }
    if (sp.constrict && foe.hp > 0) { foe.status.held = true; C.log(m.name + ' coils around ' + ch.name + '!', 'bad'); }
    if (sp.charm && foe.hp > 0) {
      const sv = R.saves(ch.cls, ch.level)[4];
      if (d().d20() < sv) { C.log(ch.name + ' falls under a spell of friendship!', 'bad'); foe.status.charmed = 4; }
    }
    if (sp.song && d().chance(40)) {
      const sv = R.saves(ch.cls, ch.level)[0];
      if (d().d20() < sv) { C.log(ch.name + ' falls to a magically enforced sleep.', 'bad'); foe.status.sleep = 3; }
    }
  }
  function levelDrain(ch, n) {
    C.log(ch.name + ' DRAINED ' + n + ' level' + (n > 1 ? 's' : '') + '!', 'bad');
    ch.xp = R.xpForLevel(ch.cls, Math.max(1, ch.level - n));
    ch.level = R.levelForXp(ch.cls, ch.xp);
    ch.maxHp = Math.max(1, ch.maxHp - n * 2);
    ch.hp = Math.min(ch.hp, ch.maxHp);
    ch.drained = (ch.drained || 0) + n;
  }
  function monsterCast(u, foe) {
    const sp = u.mon.special;
    const spec = sp.cast || 'cleric+1';
    const lvl = +(/(\d+)/.exec(spec) || [0, 1])[1];
    const pool = spec.indexOf('mage') >= 0 ? ['w_magic_missile', 'w_burning_hands', 'w_shock? no: w_lightning_bolt', 'w_hold_person', 'w_fireball', 'w_cloudkill', 'w_disintegrate', 'w_finger_of_death'] : ['c_cure_light_wounds', 'c_command', 'c_bless', 'c_hold_person', 'c_flame_strike', 'c_holy_word'];
    const pickKey = pool[EF.clamp(Math.floor(d().int(pool.length)), 0, pool.length - 1)] || pool[0];
    const sp2 = EF.Spells[pickKey];
    if (!sp2) { monsterHit(u, foe, '1d6', u.mon); return; }
    C.log(u.mon.name + ' chants ' + sp2.name + '!');
    castSpellFX(u, sp2, foe.x, foe.y, lvl);
  }
  function useBreath(u, foe) {
    const b = u.mon.special.breath;
    C.log(u.mon.name + ' breathes ' + b.type + '!', 'bad');
    const cells = areaCells(u, foe, b.shape);
    for (const cell of cells) {
      const t = st.units.find(o => o.x === cell.x && o.y === cell.y && o.hp > 0 && o.side === 'party');
      if (!t) continue;
      let dmg = diceRollScale(b.dice, u.mon.hd);
      const cat = b.type === 'gas' ? 1 : 2;
      const sv = R.saves(t.ch.cls, t.ch.level)[cat] - R.CON_SAVE(t.ch.abilities.con);
      if (d().d20() >= sv) { dmg = Math.ceil(dmg / 2); C.log(t.name + ' dives aside; half damage.'); }
      const resist = t.ch.passives && ((b.type === 'fire' && t.ch.passives.resistFire) || (b.type === 'cold' && t.ch.passives.resistCold));
      if (resist) dmg = Math.ceil(dmg / 2);
      applyDamage(t, dmg, 'breath');
    }
  }
  function diceRollScale(spec, hd) {
    const m = /(\d*)d(\d+)/i.exec(spec);
    if (!m) return d().roll(spec);
    const n = m[1] ? +m[1] : Math.max(1, Math.round(hd));
    let t = 0;
    for (let i = 0; i < n; i++) t += d().d(+m[2]);
    return t;
  }
  function areaCells(from, to, shape) {
    const cells = [];
    if (shape === 'line') {
      const dx = Math.sign(to.x - from.x), dy = Math.sign(to.y - from.y);
      let x = from.x, y = from.y;
      for (let i = 0; i < 8; i++) { cells.push({ x, y }); if (x === to.x && y === to.y) break; if (x !== to.x) x += dx; else if (y !== to.y) y += dy; }
    } else if (shape === 'cloud' || shape === 'cloud?') {
      for (let y = to.y - 2; y <= to.y + 2; y++) for (let x = to.x - 2; x <= to.x + 2; x++) if (Math.abs(x - to.x) + Math.abs(y - to.y) <= 2) cells.push({ x, y });
    } else { // cone
      for (let y = to.y - 1; y <= to.y + 1; y++) for (let x = to.x - 1; x <= to.x + 1; x++) cells.push({ x, y });
    }
    return cells;
  }
  function fleeFrom(u) {
    const foe = nearestEnemy(u);
    if (foe) { for (let i = 0; i < u.mp; i++) stepAway(u, foe); }
    if (u.x === 0 || u.x === GW - 1 || u.y === 0 || u.y === GH - 1) {
      if (u.side === 'monster') { u.escaped = true; C.log(u.name + ' flees the field.'); }
    }
    checkMorale(u);
  }

  // --------------------------------------------------------------- morale
  function checkMorale(u, died) {
    if (u.side !== 'monster') { checkPartyEnd(); return; }
    const m = u.mon;
    if (!m.morale || m.morale >= 20) return;
    const losses = st.units.filter(o => o.side === 'monster' && (o.hp <= 0 || o.escaped)).length;
    const total = st.units.filter(o => o.side === 'monster').length;
    const mod = losses >= Math.ceil(total / 2) ? -3 : losses ? -1 : 0;
    const fearMod = u.status.fear ? -2 : 0;
    if (!R.moraleCheck(d(), m.morale, mod + fearMod)) {
      C.log(m.name + ' breaks and runs!');
      u.escaped = true; // removed from the field, but the creature lives and lingers on the level
      u.inst.hp = Math.max(1, u.hp);
      u.inst.state = 'fled'; u.inst.alerted = false; u.inst.sleeping = false;
      checkCombatEnd();
    }
  }

  // --------------------------------------------------------------- turning
  C.turnAttempt = function () {
    const u = st.sel;
    if (!u) return;
    const undead = st.units.filter(o => o.side === 'monster' && o.hp > 0 && o.mon.special.undead && dist(u, o) <= 6);
    if (!undead.length) { C.log('No undead to turn within sight.'); return; }
    for (const uu of undead) {
      const tl = R.turnLevel(u.ch);
      const res = R.turnResult(tl, uu.mon);
      if (!res) continue;
      const roll = d().d6() + d().d6();
      C.log(u.ch.name + ' raises the holy symbol at ' + uu.name + ' (' + res + ') — ' + roll + '.');
      const needByRes = { U: 2, T: 7, G: 10, S: 13 }[res];
      if (res === 'U' || roll >= needByRes) {
        if (res === 'U') { C.log(uu.name + ' is destroyed!', 'good'); applyDamage(uu, 9999, 'holiness'); }
        else if (res === 'T') { uu.turned = 6; fleeFrom(uu); C.log(uu.name + ' recoils and flees!'); }
        else if (res === 'G') { uu.turned = 3; stepAway(uu, u); C.log(uu.name + ' gives back before the light.'); }
        else { uu.status.stunned = 2; C.log(uu.name + ' cowers!'); }
      }
    }
    afterAct(u);
  };

  // --------------------------------------------------------------- spells (party)
  function afterAct(u) {
    u.acted = true;
    tick();
  }
  C.spellList = function (u) {
    const ch = u.ch;
    const cls = R.CLASSES[ch.cls];
    if (!cls || !cls.startsSpellsAt || ch.level < cls.startsSpellsAt) return [];
    const out = [];
    for (const ms of ch.spellsMem) {
      const sp = EF.Spells[ms.id];
      if (sp) out.push({ id: ms.id, n: ms.n, sp });
    }
    return out;
  };
  function castSpellAt(u, slot, gx, gy) {
    const sp = EF.Spells[slot.id];
    if (!sp) return;
    slot.n--;
    slot.n <= 0 && (u.ch.spellsMem = u.ch.spellsMem.filter(s => s.n > 0));
    C.log(u.ch.name + ' casts ' + sp.name + '!');
    castSpellFX(u, sp, gx, gy, u.ch.level);
  }
  function castSpellFX(caster, sp, gx, gy, effLevel) {
    const fx = sp.fx;
    const partySide = caster.side === 'party';
    const kind = fx.kind;
    const targetsIn = (pred) => st.units.filter(o => o.hp > 0 && !o.escaped && pred(o));
    const foes = side => st.units.filter(o => o.hp > 0 && !o.escaped && o.side !== side);
    const pals = side => st.units.filter(o => o.hp > 0 && !o.escaped && o.side === side);
    const inArea = (o) => Math.abs(o.x - gx) + Math.abs(o.y - gy) <= Math.max(0, sp.area || 0);
    const touch = (o) => Math.abs(o.x - gx) + Math.abs(o.y - gy) <= 1;
    switch (kind) {
      case 'missile': {
        const n = Math.max(1, Math.min(6, 1 + Math.floor((effLevel - 1) / 5))) * (fx.dice || 1);
        const targets = foes(caster.side).slice(0, 4);
        let ti = 0;
        for (let i = 0; i < n; i++) {
          const t = targets[ti++ % targets.length];
          if (!t) break;
          applyDamage(t, d().roll('1d2') + 1, sp.name); // unerring
        }
        break;
      }
      case 'dmg': {
        const n = targetsIn(o => (partySide ? o.side === 'monster' : o.side === 'party') && (sp.area ? inArea(o) : (Math.abs(o.x - gx) + Math.abs(o.y - gy) <= (sp.rng >= 6 ? 3 : 1) || inArea(o))));
        for (const t of n) {
          let diceStr = fx.dyn === 'fireball' ? clampDice(Math.max(1, Math.min(10, effLevel))) + 'd6'
            : fx.dyn === 'spectral' ? clampDice(Math.ceil(effLevel / 2)) + 'd6'
            : fx.dyn === 'wrath' ? clampDice(Math.max(1, Math.min(7, effLevel))) + 'd6'
            : fx.dyn === 'slash' ? clampDice(Math.max(1, Math.min(5, effLevel))) + 'd6+' + 2 * Math.min(5, effLevel)
            : fx.dice;
          let dmg = diceRollScale(diceStr, effLevel);
          if (fx.undead && t.mon && t.mon.special.undead) dmg = Math.round(dmg * fx.undead);
          if (fx.save) {
            const cat = { spell: 4, breath: 2, poison: 1, rod: 3, paralysis: 0 }[fx.save] || 4;
            const sv = (t.ch ? R.saves(t.ch.cls, t.ch.level)[cat] - R.CON_SAVE(t.ch.abilities.con) : (11 - Math.floor(effLevel / 2)));
            const half = fx.save === 'none' ? false : (t.ch ? d().d20() >= sv : d().d6() >= 4);
            if (half && fx.save !== 'none') { dmg = Math.ceil(dmg / 2); C.log(t.name + ' avoids much of it.'); }
          }
          applyDamage(t, dmg, sp.name);
        }
        if (fx.first) { /* acid ongoing: apply burn status to targets */ for (const t of targetsIn(o => o.side !== caster.side && inArea(o))) { t.status.burn = fx.first; } }
        break;
      }
      case 'heal': {
        const cands = targetsIn(o => o.side === caster.side && (sp.area ? inArea(o) : touch(o) || (o === caster)));
        let t = cands.sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];
        if (!t) { C.log('No ally in range.'); break; }
        const heal = d().roll(fx.dice);
        t.hp = Math.min(t.maxHp, t.hp + heal);
        if (t.side === 'party') t.ch.hp = t.hp;
        C.log(t.name + ' is healed ' + heal + '.');
        break;
      }
      case 'sleep': {
        let pool = 0; const hd = fx.dice;
        let remain = hd.includes('d4') ? d().roll(hd) : +hd;
        const cands = foes(caster.side).filter(o => inArea(o) || (sp.area === 0 && touch(o))).sort((a, b) => (a.mon ? a.mon.hd : 99) - (b.mon ? b.mon.hd : 99));
        for (const t of cands) {
          const thd = t.mon ? t.mon.hd : 1;
          if (remain >= thd) { remain -= thd; t.status.sleep = 4; C.log(t.name + ' sinks into slumber.'); }
        }
        void pool;
        break;
      }
      case 'buff': {
        const t = targetsIn(o => o.side === caster.side && (o === caster || inArea(o) || touch(o)))[0] || caster;
        t.status[fx.status] = (fx.dur === 'special' ? 12 : +fx.dur || 6);
        if (fx.status === 'shield') t.status.shield = 10;
        if (fx.amt && (fx.status === 'aid')) t.status.aid = true;
        C.log(t.name + ' is enveloped by ' + fx.status + '.');
        break;
      }
      case 'haste': { const t = targetsIn(o => o.side === caster.side && (inArea(o) || o === caster))[0] || caster; t.status.haste = 5; t.status.hasteLag = true; C.log(t.name + ' blurs with speed!'); break; }
      case 'slow': { const ts = targetsIn(o => o.side !== caster.side && (inArea(o) || touch(o))); for (const t of ts) { const sv = t.mon ? 11 - Math.floor(effLevel / 2) : R.saves(t.ch.cls, t.ch.level)[4]; if (d().d20() < sv) { t.status.slow = 6; C.log(t.name + ' moves sluggishly.'); } } break; }
      case 'hold': {
        const ts = targetsIn(o => o.side !== caster.side && (touch(o) || inArea(o)));
        for (const t of ts) { const sv = t.mon ? 10 - Math.floor(effLevel / 2) : R.saves(t.ch.cls, t.ch.level)[4]; if (d().d20() < sv) { t.status.held = true; C.log(t.name + ' hangs frozen in place.'); } else C.log(t.name + ' shakes off the hold.'); }
        break;
      }
      case 'paralyse': case 'stun': {
        const ts = kind === 'stun' && fx.noSave ? targetsIn(o => o.side !== caster.side && inArea(o)) : targetsIn(o => o.side !== caster.side && touch(o));
        for (const t of ts) {
          if (!fx.noSave && t.mon && d().d6() >= 4) continue;
          if (!fx.noSave && t.ch && d().d20() >= R.saves(t.ch.cls, t.ch.level)[kind === 'stun' ? 4 : 0]) continue;
          t.status.stunned = kind === 'stun' ? 3 : 6; t.status.paralysed = kind !== 'stun';
          C.log(t.name + (kind === 'stun' ? ' is struck senseless.' : ' is rigid as stone.'));
        }
        break;
      }
      case 'confuse': { const ts = targetsIn(o => o.side !== caster.side && touch(o)); for (const t of ts) { if (t.mon && d().d6() <= 4) continue; if (t.ch && d().d20() >= R.saves(t.ch.cls, t.ch.level)[4]) continue; t.status.confused = true; C.log(t.name + ' looks thoroughly turned around.'); } break; }
      case 'fear': case 'smite': {
        const ts = targetsIn(o => o.side !== caster.side && (sp.area ? inArea(o) : touch(o)));
        for (const t of ts) {
          if (t.ch && d().d20() >= R.saves(t.ch.cls, t.ch.level)[fx.status === 'curse' ? 4 : 0] - 1) continue;
          if (fx.status === 'curse') { t.status.curse = fx.dur || 8; C.log(t.name + ' is laid low with a curse.'); }
          else { t.status.fear = fx.dur || 3; C.log(t.name + ' is filled with dread.'); }
        }
        break;
      }
      case 'invis': { caster.status.invis = 12; C.log(caster.name + ' vanishes from sight.'); break; }
      case 'blind': { const t = targetsIn(o => o.side !== caster.side && touch(o))[0]; if (t && !(t.ch && d().d20() >= R.saves(t.ch.cls, t.ch.level)[4])) { t.status.blind = 6; C.log(t.name + ' is blinded.'); } break; }
      case 'web': { for (let y = gy - 1; y <= gy + 1; y++) for (let x = gx - 1; x <= gx + 1; x++) if (Math.abs(x - gx) + Math.abs(y - gy) <= 1) st.obs[x + ',' + y] = 'web';
        const ts = targetsIn(o => Math.abs(o.x - gx) + Math.abs(o.y - gy) <= 1); for (const t of ts) if (!(t.ch && d().d20() >= R.saves(t.ch.cls, t.ch.level)[2])) { t.status.web = 4; t.status.held = true; }
        C.log('A web billows out and snarls.'); break; }
      case 'cloud': {
        const label = { stink: 'Stinking cloud', fog: 'Wall of fog', kill: 'Cloudkill', incendiary: 'Incendiary cloud', insects: 'Insect plague' }[fx.ctype] || 'Cloud';
        C.log(label + ' rolls across the field!');
        st.clouds = st.clouds || [];
        st.clouds.push({ ctype: fx.ctype, x: gx, y: gy, r: 2, rounds: +fx.dur || 4, owner: caster.side });
        break;
      }
      case 'wall': {
        C.log('A wall of ' + (fx.wtype === 'fire' ? 'fire' : 'stone') + ' rises!');
        for (let i = -2; i <= 2; i++) st.obs[(gx + i) + ',' + gy] = fx.wtype === 'fire' ? 'fire' : 'stone';
        break;
      }
      case 'bolt': {
        const cells = areaCells({ x: gx, y: gy }, { x: gx, y: gy }, 'line');
        void cells;
        const dx = Math.sign(gx - caster.x), dy = Math.sign(gy - caster.y);
        let x = caster.x, y = caster.y;
        for (let i = 0; i < 8; i++) {
          x = EF.clamp(x + (dx || (i > 3 ? 0 : 0)), 0, GW - 1); if (dx === 0) y += dy;
          const t = st.units.find(o => o.x === x && o.y === y && o.hp > 0 && o.side !== caster.side);
          if (t) {
            let dmg = diceRollScale(clampDice(Math.max(1, Math.min(10, effLevel))) + 'd6', effLevel);
            if (d().d20() >= (t.ch ? R.saves(t.ch.cls, t.ch.level)[2] - R.CON_SAVE(t.ch.abilities.con) : 9)) dmg = Math.ceil(dmg / 2);
            applyDamage(t, dmg, sp.name);
          }
          if (x === gx && y === gy) break;
        }
        break;
      }
      case 'cone': {
        const ts = targetsIn(o => o.side !== caster.side && Math.abs(o.x - gx) + Math.abs(o.y - gy) <= 2 && inCone(caster, o));
        for (const t of ts) {
          let n = effLevel;
          if (fx.cap) n = Math.min(n, fx.cap === 5 ? 5 : 10);
          let dmg = diceRollScale(clampDice(Math.max(1, n)) + 'd6', effLevel);
          if (fx.save && t.ch && d().d20() >= R.saves(t.ch.cls, t.ch.level)[2] - R.CON_SAVE(t.ch.abilities.con)) dmg = Math.ceil(dmg / 2);
          applyDamage(t, dmg, sp.name);
        }
        break;
      }
      case 'summon': {
        const key = fx.monster === 'wolf' ? 'wolf' : (fx.monster && EF.mon(fx.monster) ? fx.monster : 'giant rat');
        const m = EF.mon(key);
        const side = caster.side;
        for (let i = 0; i < (fx.n || 1); i++) {
          const spots = freeCells(caster);
          if (!spots.length) break;
          const c = spots[d().int(spots.length)];
          st.units.push({
            uid: 1000 + st.units.length, side, summoned: true, mon: m, key: m.key, name: m.name,
            inst: { key: m.key, hp: m.hpAvg, alive: false }, x: c.x, y: c.y, mp: Math.max(1, Math.round(m.mv / 3)), moved: 0,
            ac: m.ac, hp: m.hpAvg, maxHp: m.hpAvg, morale: 20, status: {}, breathCd: 3
          });
          st.queue.push(st.units[st.units.length - 1]);
          C.log(m.name + ' appears in a flicker of summoning!');
        }
        break;
      }
      case 'special': specialSpell(caster, sp, gx, gy, effLevel); break;
      default: C.log(sp.name + ' shivers and does nothing observable.');
    }
    // spell resistance for monsters targeted? (simplified skip)
  }
  function inCone(from, to) { return dist(from, to) <= 3; }
  function clampDice(n) { return EF.clamp(n, 1, 10); }
  function freeCells(u) {
    const out = [];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [-1, -1]]) {
      const x = u.x + dx, y = u.y + dy;
      if (x >= 0 && y >= 0 && x < GW && y < GH && !st.obs[x + ',' + y] && !st.units.some(o => o.hp > 0 && !o.escaped && o.x === x && o.y === y)) out.push({ x, y });
    }
    return out;
  }
  function specialSpell(caster, sp, gx, gy, effLevel) {
    const n = sp.fx.name;
    const foe = st.units.find(o => o.x === gx && o.y === gy && o.hp > 0 && o.side !== caster.side) || nearestEnemy(caster);
    switch (n) {
      case 'fingerOfDeath':
      case 'powerKill': {
        if (!foe) break;
        if (foe.ch && d().d20() >= R.saves(foe.ch.cls, foe.ch.level)[1]) { C.log(foe.name + ' gestures at nothing and lives.'); break; }
        if (n === 'powerKill' && foe.mon && foe.mon.hd + (foe.mon.hdMod || 0) > 19) { C.log(foe.name + ' is too mighty for the word.'); break; }
        C.log('The finger points. ' + foe.name + ' dies.', 'bad');
        applyDamage(foe, 9999, sp.name);
        break;
      }
      case 'petrify': {
        if (!foe) break;
        if (foe.ch && d().d20() >= R.saves(foe.ch.cls, foe.ch.level)[0]) { C.log(foe.name + ' looks away in time.'); break; }
        C.log(foe.name + ' turns to stone.'); foe.escaped = true; foe.hp = 0; foe.inst && (foe.inst.alive = false);
        break;
      }
      case 'disintegrate': {
        if (!foe) break;
        C.log(foe.name + ' comes apart at the seams.');
        applyDamage(foe, 9999, sp.name);
        break;
      }
      case 'charm': {
        if (!foe) break;
        if (foe.ch && d().d20() >= R.saves(foe.ch.cls, foe.ch.level)[4]) break;
        if (foe.mon && d().d6() >= 5) { C.log(foe.name + ' finds the charm cheap.'); break; }
        C.log(foe.name + ' regards your company with sudden warm friendship.');
        foe.turned = 8;
        break;
      }
      case 'light': C.log('A sphere of steady light settles over the party.'); break;
      case 'trueSight': st.trueSight = 4; C.log('You see the field with uncomfortably clear eyes.'); break;
      case 'teleport': {
        const u = caster;
        const spots = [];
        for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) if (!st.obs[x + ',' + y] && !st.units.some(o => o.hp > 0 && !o.escaped && o.x === x && o.y === y)) spots.push({ x, y });
        if (spots.length) { const c = spots[d().int(spots.length)]; u.x = c.x; u.y = c.y; C.log(u.name + ' vanishes and reappears.'); }
        break;
      }
      case 'dispel': {
        for (const o of st.units) { o.status = {}; }
        st.clouds = [];
        C.log('Magical workings unravel all across the field.');
        break;
      }
      case 'raise': case 'resurrect': {
        const dead = st.units.find(o => o.side === 'party' && o.hp <= 0) || EF.Game.state.party.find(p => !p.alive);
        if (!dead) { C.log('No one here needs that miracle yet.'); break; }
        if (dead.ch) { dead.hp = Math.max(1, Math.ceil(dead.maxHp / 4)); dead.ch.alive = true; dead.ch.hp = dead.hp; if (n === 'resurrect') levelDrain(dead.ch, 1); C.log(dead.name + ' sits up, gasping.', 'good'); }
        break;
      }
      case 'prismatic': {
        const rays = ['stunned', 'burn (2d6)', 'paralysed', 'slain', 'confused', 'slept', 'slain'];
        const raysF = [t => t.status.stunned = 3, t => applyDamage(t, d().roll('2d6'), 'ray of burning'), t => t.status.paralysed = true, t => applyDamage(t, 9999, 'ray of death'), t => t.status.confused = true, t => t.status.sleep = 3, t => applyDamage(t, 9999, 'ray of death')];
        for (let i = 0; i < 7; i++) {
          const cands = st.units.filter(o => o.hp > 0 && !o.escaped && o.side !== caster.side);
          if (!cands.length) break;
          const t = cands[d().int(cands.length)];
          C.log('A ' + ['violet','blue','green','orange','red','yellow','indigo'][i] + ' ray strikes ' + t.name + ' — ' + rays[i] + '!');
          raysF[i](t);
        }
        break;
      }
      case 'lesserRestoration': case 'neutralize': {
        const t = st.units.find(o => o.side === caster.side && (o.status.paralysed || o.status.held || o.status.blind));
        if (t) { t.status = {}; C.log(t.name + ' is set straight again.'); }
        break;
      }
      case 'steelShield': caster.status.shield = 12; caster.status.protevil = 4; C.log('Blades whirl about ' + caster.name + '.'); break;
      default: C.log(sp.name + ' does something subtle and unquantifiable.');
    }
  }
  C.specialSpell = specialSpell;
  C.castSpellFX = castSpellFX;

  // --------------------------------------------------------------- items in combat
  C.useItem = function (u, itemRef) {
    const it = EF.Items[itemRef.key];
    if (!it) return;
    const fx = it.fx || it.use;
    if (it.cat === 'potion' || it.cat === 'oil') {
      C.log(u.ch.name + ' drinks ' + it.name + '.');
      applyItemFX(u, it, fx);
      consumeItem(u.ch, itemRef);
      afterAct(u);
    } else if (it.cat === 'wand' || it.cat === 'rod' || it.cat === 'staff') {
      if (it.charges === 0) { C.log('The ' + it.name + ' is spent.'); return; }
      if (it.charges > 0) it.charges--;
      C.log(u.ch.name + ' points ' + it.name + '.');
      castSpellFX(u, { name: it.name, fx: fx || { kind: 'special', name: 'nothing' }, area: (fx && fx.area) || 0, rng: 8 }, st.lastTargetX || u.x + 2, u.y, u.ch.level);
      afterAct(u);
    } else if (it.cat === 'scroll') {
      C.log(u.ch.name + ' reads ' + it.name + '.');
      const sp = EF.Spells[it.spell];
      if (sp) castSpellFX(u, sp, u.x + 1, u.y, u.ch.level);
      consumeItem(u.ch, itemRef);
      afterAct(u);
    } else if (fx && fx.kind === 'heal') { applyItemFX(u, it, fx); consumeItem(u.ch, itemRef); afterAct(u); }
    else C.log('That is not an item for battle.');
  };
  function applyItemFX(u, it, fx) {
    if (!fx) return;
    castSpellFX(u, { name: it.name, fx, area: fx.area || 0, rng: 0, id: it.key }, u.x, u.y, u.ch.level);
  }
  function consumeItem(ch, ref) {
    ch.items = ch.items.filter(i => i !== ref);
  }

  // --------------------------------------------------------------- combat flow
  function checkPartyEnd() {
    if (st.over) return;
    const live = st.units.filter(o => o.side === 'party' && o.hp > 0);
    if (!live.length) {
      const dying = st.units.filter(o => o.side === 'party');
      st.over = true; st.result = 'defeat';
      setTimeout(() => EF.Combat.defeat(), 600);
    }
  }
  function checkCombatEnd() {
    if (st.over) return;
    const foes = st.units.filter(o => o.side === 'monster' && o.hp > 0 && !o.escaped && !o.summoned);
    const foesSummoned = st.units.filter(o => o.summoned && o.side === 'party');
    void foesSummoned;
    if (!foes.length) { st.over = true; st.result = 'win'; setTimeout(C.victory, 500); }
    checkPartyEnd();
  }
  C.defeat = function () {
    C.active = false; st = null;
    EF.Game.log('The company breaks over the stones. Darkness takes the field.', 'bad');
    EF.UI.show('defeat');
  };
  C.victory = function () {
    const gs = EF.Game.state;
    const slain = st.units.filter(o => o.side === 'monster' && (o.inst && !o.inst.alive));
    let xp = 0;
    const overland = EF.Game.state.mode === 'overland';
    for (const o of slain) {
      const m = o.mon;
      xp += m.xp || 20;
      // loot drop: money hoards convert to gp immediately; magic items drop to floor
      const hoard = EF.rollMonsterTreasure(m, EF.Adventures[gs.adventureId].band || 0);
      if (hoard.gp) { const per = Math.round(hoard.gp / Math.max(1, slain.length)); for (const u of st.units) if (u.side === 'party' && u.hp > 0) u.ch.gold += Math.round(per / Math.max(1, st.units.filter(x => x.side === 'party' && x.hp > 0).length)); }
      if (overland) {
        for (const it of hoard.items) EF.Game.giveItem(it.item, it.qty);
        for (const g2 of hoard.gems.concat(hoard.jewels, hoard.art)) EF.Game.giveItem(g2.item, g2.qty || 1);
      } else {
        for (const it of hoard.items) gs.groundLoot.push({ advId: st.origin.advId, floor: st.origin.floor, x: st.origin.x, y: st.origin.y, items: [{ key: it.item, qty: 1 }], taken: false });
        for (const g2 of hoard.gems.concat(hoard.jewels, hoard.art)) gs.groundLoot.push({ advId: st.origin.advId, floor: st.origin.floor, x: st.origin.x, y: st.origin.y, items: [{ key: g2.item, qty: g2.qty || 1 }], taken: false });
      }
    }
    const survivors = gs.party.filter(p => p.alive);
    if (survivors.length) EF.Game.grantXP(Math.round(xp / survivors.length) * 1);
    // write back hp
    for (const u of st.units) if (u.side === 'party') { u.ch.hp = Math.max(0, u.hp); u.ch.alive = u.hp > 0; }
    // revive dying: a character at exactly 0 who was healed during combat handled above; else dead
    EF.Combat.active = false;
    const msg = 'Victory! ' + xp + ' experience shared among the survivors.';
    st = null;
    EF.Game.log(msg, 'good');
    if (overland && C._overlandSite) { C._overlandSite.cleared = true; C._overlandSite = null; }
    EF.Game.autosave();
    if (overland && EF.Overland) EF.Overland.enter(false);
    else EF.UI.show('ui');
    void gs;
  };
  C.startOverland = function (insts, mon, site) {
    C._overlandSite = site || null;
    C.start(insts);
  };
  C.requestFlee = function () {
    if (!st || st.over) return;
    st.fleeTries++;
    const chance = 40 + st.fleeTries * 15;
    if (d().chance(chance)) {
      C.log('You break away and run!');
      for (const u of st.units) if (u.side === 'party') { u.inst = null; }
      // monsters return to post
      const gs = EF.Game.state;
      const f = EF.Game.floorState();
      for (const m of f.mons) { m.alerted = false; m.state = 'idle'; m.hunt = false; }
      st.over = true; st.result = 'fled';
      C.active = false; st = null;
      EF.UI.show('ui');
    } else {
      C.log('You cannot disengage — the enemy cuts you off!');
      // free round for monsters
      for (const u of st.units.filter(o => o.side === 'monster' && o.hp > 0 && !o.escaped)) monsterTurn(u);
      for (const u of st.units.filter(o => o.side === 'party')) { u.moved = 0; }
      checkCombatEnd();
      draw();
    }
  };
  C.autoFight = function () {
    if (!st || st.over) return;
    st.auto = !st.auto;
    if (st.auto) autoStep();
    draw();
  };
  function autoStep() {
    if (!st || st.over || !st.auto) return;
    const u = st.sel;
    try {
      if (u && u.side === 'party') {
        const foe = nearestEnemy(u);
        if (!foe) { tick(); }
        else if (Math.abs(u.x - foe.x) + Math.abs(u.y - foe.y) <= 1) { charAttack(u, foe); afterAct(u); }
        else {
          for (let i = 0; i < u.mp; i++) stepToward(u, foe);
          const foe2 = nearestEnemy(u);
          if (foe2 && Math.abs(u.x - foe2.x) + Math.abs(u.y - foe2.y) <= 1) charAttack(u, foe2);
          afterAct(u);
        }
      }
    } catch (e) {
      console.error('autoStep error', e);
      if (st && !st.over) { st.over = true; C.victory(); } // don't wedge the fight on a test error
      return;
    }
    if (st && !st.over && st.auto) setTimeout(autoStep, 40);
  }

  // --------------------------------------------------------------- helpers
  function dist(a, b) { return Math.max(Math.abs(a.x - b.x), Math.abs(a.y - b.y)); }
  function stepToward(u, foe) {
    const dx = Math.sign(foe.x - u.x), dy = Math.sign(foe.y - u.y);
    const pass = (nx, ny) => nx >= 0 && ny >= 0 && nx < GW && ny < GH && !st.obs[nx + ',' + ny] && !st.units.some(o => o !== u && o.hp > 0 && !o.escaped && o.x === nx && o.y === ny);
    if (dx && pass(u.x + dx, u.y)) u.x += dx;
    else if (dy && pass(u.x, u.y + dy)) u.y += dy;
    else if (dx && dy && pass(u.x, u.y + dy)) u.y += dy;
  }
  function stepAway(u, foe) {
    const dx = -Math.sign(foe.x - u.x), dy = -Math.sign(foe.y - u.y);
    const pass = (nx, ny) => nx >= 0 && ny >= 0 && nx < GW && ny < GH && !st.obs[nx + ',' + ny] && !st.units.some(o => o !== u && o.hp > 0 && !o.escaped && o.x === nx && o.y === ny);
    if (dx && pass(u.x + dx, u.y)) u.x += dx;
    else if (dy && pass(u.x, u.y + dy)) u.y += dy;
  }

  // --------------------------------------------------------------- rendering
  let view = { ox: 0, oy: 0, tw: 46, th: 23 };
  C.draw = draw;
  function draw() {
    if (!canvas) {
      canvas = document.getElementById('combatCanvas');
      if (!canvas) return;
      ctx = canvas.getContext('2d');
    }
    const cw = canvas.width = canvas.clientWidth * devicePixelRatioFor();
    const chh = canvas.height = canvas.clientHeight * devicePixelRatioFor();
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#141416'; ctx.fillRect(0, 0, cw, chh);
    view.tw = Math.floor(Math.min(cw / (GW + 1.5), chh / (GH / 2 + 4.5)));
    view.th = view.tw / 2;
    view.ox = cw / 2;
    view.oy = chh / 2 - ((GW + GH) / 2) * view.th + view.th * 2;
    // clouds first (under cells)
    // cells
    for (let gy = 0; gy < GH; gy++) for (let gx = 0; gx < GW; gx++) {
      const [sx, sy] = iso(gx, gy);
      diamond(sx, sy, gx, gy);
    }
    // walls/obstacles
    for (const k in st.obs) {
      const [gx, gy] = k.split(',').map(Number);
      const [sx, sy] = iso(gx, gy);
      const kind = st.obs[k];
      ctx.fillStyle = kind === 'fire' ? '#d2691e' : kind === 'web' ? 'rgba(230,230,240,0.5)' : kind === 'stone' ? '#7a766e' : '#3f3b36';
      block(sx, sy, kind === 'fire' ? view.th * 0.8 : view.th * 0.55);
    }
    // clouds
    if (st.clouds) for (const c of st.clouds) {
      for (let dy = -c.r; dy <= c.r; dy++) for (let dx = -c.r; dx <= c.r; dx++) {
        if (Math.abs(dx) + Math.abs(dy) > c.r) continue;
        const [sx, sy] = iso(c.x + dx, c.y + dy);
        ctx.fillStyle = { stink: 'rgba(110,150,70,0.35)', fog: 'rgba(220,225,230,0.3)', kill: 'rgba(90,160,90,0.4)', incendiary: 'rgba(230,90,40,0.35)', insects: 'rgba(120,90,60,0.4)' }[c.ctype] || 'rgba(200,200,200,0.3)';
        diamondFill(sx, sy);
      }
    }
    // units (painter order by y then x)
    const order = st.units.filter(u => u.hp > 0 && !u.escaped).sort((a, b) => (a.x + a.y) - (b.x + b.y));
    for (const u of order) {
      const [sx, sy] = iso(u.x, u.y);
      drawUnit(u, sx, sy);
    }
    // selection ring
    if (st.sel && st.sel.hp > 0 && !st.sel.escaped) {
      const [sx, sy] = iso(st.sel.x, st.sel.y);
      ctx.strokeStyle = st.mode === 'attack' ? '#e05545' : st.mode === 'spell' ? '#7f8fe0' : '#e8e4d2';
      ctx.lineWidth = 2;
      diamondStroke(sx, sy);
    }
    // hud
    ctx.fillStyle = '#e8e4d2';
    ctx.font = Math.floor(view.tw * 0.38) + 'px Georgia';
    ctx.fillText('Round ' + st.round + (st.surpriseRound ? ' — surprise!' : '') + (st.auto ? '  [AUTO]' : ''), 12, 22);
    if (st.sel) ctx.fillText(st.sel.name + '  init ' + st.sel.init + '  move ' + st.sel.moved + '/' + st.sel.mp, 12, 44);
    void chh;
  }
  function devicePixelRatioFor() { return Math.min(2, window.devicePixelRatio || 1); }
  function iso(gx, gy) {
    return [view.ox + (gx - gy) * view.tw / 2, view.oy + (gx + gy) * view.th / 2];
  }
  function diamond(sx, sy, gx, gy) {
    const obs = st.obs[gx + ',' + gy];
    const hl = st.sel && st.mode === 'move' && uReachable(gx, gy);
    ctx.fillStyle = obs ? (obs === 'fire' ? '#5a3018' : '#26241f') : (((gx + gy) % 2) ? '#2c2b26' : '#33312b');
    diamondPath(sx, sy);
    ctx.fill();
    if (hl) { ctx.fillStyle = 'rgba(120,160,120,0.18)'; diamondFill(sx, sy); }
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    diamondStroke(sx, sy);
  }
  function uReachable(gx, gy) {
    const u = st.sel;
    if (!u || u.side !== 'party') return false;
    if (st.obs[gx + ',' + gy]) return false;
    if (st.units.some(o => o.hp > 0 && !o.escaped && o.x === gx && o.y === gy)) return false;
    return Math.abs(gx - u.x) + Math.abs(gy - u.y) <= (u.mp - u.moved) + (u.status && u.status.haste ? 2 : 0);
  }
  C.cellFromXY = function (px, py) {
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();
    const s = devicePixelRatioFor();
    const x = (px - rect.left) * s, y = (py - rect.top) * s;
    const rx = (x - view.ox) / (view.tw / 2), ry = (y - view.oy) / (view.th / 2);
    const gx = Math.round((rx + ry) / 2), gy = Math.round((ry - rx) / 2);
    if (gx < 0 || gy < 0 || gx >= GW || gy >= GH) return null;
    return { x: gx, y: gy };
  };
  function diamondPath(sx, sy) {
    ctx.beginPath();
    ctx.moveTo(sx, sy - view.th / 2);
    ctx.lineTo(sx + view.tw / 2, sy);
    ctx.lineTo(sx, sy + view.th / 2);
    ctx.lineTo(sx - view.tw / 2, sy);
    ctx.closePath();
  }
  function diamondFill(sx, sy) { diamondPath(sx, sy); ctx.fill(); }
  function diamondStroke(sx, sy) { diamondPath(sx, sy); ctx.stroke(); }
  function block(sx, sy, h) {
    diamondPath(sx, sy - h);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(sx - view.tw / 2, sy - h); ctx.lineTo(sx - view.tw / 2, sy);
    ctx.lineTo(sx, sy + view.th / 2); ctx.lineTo(sx, sy + view.th / 2 - h);
    ctx.closePath(); ctx.globalAlpha *= 0.8; ctx.fill(); ctx.globalAlpha /= 0.8;
  }
  function drawUnit(u, sx, sy) {
    const s = view.tw * 0.9;
    if (u.side === 'monster') {
      const fig = EF.Figures.monsterFigure(u.mon);
      const fh = s * (u.mon.size === 'G' ? 1.7 : u.mon.size === 'H' ? 1.45 : u.mon.size === 'L' ? 1.2 : 0.95);
      ctx.save();
      if (u.status.invis || u.mon.special.invisible) ctx.globalAlpha = 0.35;
      if (u.status.held || u.status.paralysed) ctx.globalAlpha *= 0.8;
      ctx.drawImage(fig, sx - fh / 2, sy - fh + view.th / 2, fh, fh);
      ctx.restore();
      hpBar(sx, sy - fh, fh * 0.7, u.hp / u.maxHp);
    } else {
      const p = u.ch;
      ctx.save();
      const portrait = EF.Figures.portrait(p, 30);
      const ph = s * 0.8;
      if (u.status.invis) ctx.globalAlpha = 0.35;
      ctx.drawImage(portrait, sx - ph / 2, sy - ph + view.th / 2, ph, ph);
      ctx.restore();
      hpBar(sx, sy - s * 0.8, ph * 0.8, u.hp / u.maxHp);
      if (u.defend) { ctx.strokeStyle = '#8ea3ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(sx, sy, view.tw * 0.4, 0, 7); ctx.stroke(); }
    }
    // status dots
    const sKeys = Object.keys(u.status || {}).filter(k => u.status[k]);
    for (let i = 0; i < Math.min(4, sKeys.length); i++) {
      ctx.fillStyle = '#d8c86a';
      ctx.fillRect(sx - 12 + i * 7, sy + 4, 4, 4);
    }
  }
  function hpBar(sx, sy, w, frac) {
    if (frac >= 0.999) return;
    ctx.fillStyle = 'rgba(10,10,12,0.8)';
    ctx.fillRect(sx - w / 2, sy - 6, w, 4);
    ctx.fillStyle = frac > 0.5 ? '#6fae5c' : frac > 0.25 ? '#d8a04a' : '#c0392b';
    ctx.fillRect(sx - w / 2, sy - 6, w * EF.clamp(frac, 0, 1), 4);
  }
  C.sel = () => st && st.sel;
  C.state = () => st;
  C.log = function (t) {
    if (!st) return;
    st.log.push(t);
    if (st.log.length > 200) st.log.shift();
    EF.Game.log(t);
  };
  // cloud ticking each round
  const _startRound = startRound;
  startRound = function () {
    if (st && st.clouds) {
      const keep = [];
      for (const c of st.clouds) {
        c.rounds--;
        for (const u of st.units) {
          if (u.hp <= 0 || u.escaped || u.side === 'party' && c.owner === 'party') continue;
          if (Math.abs(u.x - c.x) + Math.abs(u.y - c.y) > c.r) continue;
          cloudHurt(u, c);
        }
        if (c.rounds > 0) keep.push(c);
      }
      st.clouds = keep;
    }
    _startRound();
  };
  function cloudHurt(u, c) {
    const ch = u.ch;
    if (!ch) return;
    const cat = c.ctype === 'kill' ? 1 : c.ctype === 'incendiary' ? 1 : 1;
    const sv = R.saves(ch.cls, ch.level)[cat] - R.CON_SAVE(ch.abilities.con);
    if (d().d20() >= sv) { C.log(u.name + ' holds breath through the vapor.'); return; }
    if (c.ctype === 'stink') { C.log(u.name + ' retches, doubled over.', 'bad'); u.status.stunned = 1; }
    else if (c.ctype === 'kill') { C.log('The green vapor takes ' + u.name + '!', 'bad'); applyDamage(u, d().roll('3d6') + 6, 'cloudkill'); }
    else if (c.ctype === 'incendiary') { applyDamage(u, d().roll('2d6'), 'incendiary cloud'); }
    else if (c.ctype === 'insects') { applyDamage(u, d().roll('1d6'), 'insect plague'); }
    else if (c.ctype === 'acid') { applyDamage(u, d().roll('1d4'), 'acid fog'); }
  }
  // ------------------------------------------------- combat screen (registered with ui.js)
  let redrawTimer = null;
  EF.UI.register('combat', wrap => {
    const box = el2('div', 'panel combat-panel');
    box.appendChild(el2('div', 'combat-top', '<b>Battle!</b> <span class="dim">Click green squares to move; choose Attack, then click a foe.</span>'));
    const cv = document.createElement('canvas');
    cv.id = 'combatCanvas';
    cv.className = 'combat-canvas';
    box.appendChild(cv);
    cv.addEventListener('click', e => {
      const cell = C.cellFromXY(e.clientX, e.clientY);
      if (!cell) return;
      const s = st && st.sel;
      st.lastTargetX = cell.x;
      st.lastTargetY = cell.y;
      if (s && s.side === 'party' && st.mode === 'attack') {
        const t = st.units.find(o => o.x === cell.x && o.y === cell.y && o.hp > 0);
        if (t) { charAttack(s, t); afterAct(s); return; }
      }
      C.clickField(cell.x, cell.y);
    });
    const bar = el2('div', 'cmdbar combat-bar');
    const btn = (label, fn, id) => { const b = el2('button', 'cmdbtn', label); b.onclick = fn; if (id) b.id = id; bar.appendChild(b); return b; };
    btn('Move', () => C.setMode('move'));
    btn('Attack', () => C.setMode('attack'));
    btn('Spells', () => spellMenu(box));
    btn('Item', () => itemMenu(box));
    btn('Turn Undead', () => { const s = C.sel(); if (s && R.turnsUndead(s.ch)) C.turnAttempt(); });
    btn('Defend', () => { const s = C.sel(); if (s) { s.defend = true; C.log(s.name + ' raises guard (+4 AC).'); afterAct(s); } });
    btn('End Turn', () => C.endTurn());
    btn('Auto-Fight', () => C.autoFight());
    btn('Flee', () => C.requestFlee());
    box.appendChild(bar);
    const log = el2('div', 'combat-log');
    log.id = 'combatLog';
    box.appendChild(log);
    wrap.appendChild(box);
    draw();
    if (redrawTimer) clearInterval(redrawTimer);
    redrawTimer = setInterval(() => {
      if (EF.UI.open === 'combat') {
        draw();
        const lg = document.getElementById('combatLog');
        if (lg && st) lg.innerHTML = st.log.slice(-6).map(t => '<div>' + String(t).replace(/</g, '&lt;') + '</div>').join('');
      }
    }, 120);
  });
  function el2(tag, cls, html) { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function spellMenu(wrap) {
    const s = C.sel();
    if (!s) return;
    const list = C.spellList(s);
    if (!list.length) { C.log(s.name + ' has nothing memorized.'); return; }
    const menu = el2('div', 'spell-menu');
    for (const slot of list) {
      const b = el2('button', 'bigbtn', EF.Spells[slot.id].name + ' (L' + EF.Spells[slot.id].lvl + ' ×' + slot.n + ')');
      b.onclick = () => {
        menu.remove();
        C.pickSpell(slot);
        const selfb = el2('button', 'cmdbtn', 'Cast on self');
        selfb.onclick = () => { selfb.remove(); C.castSelf(); };
        document.querySelector('.combat-bar').appendChild(selfb);
      };
      menu.appendChild(b);
    }
    const x = el2('button', 'bigbtn', 'Cancel'); x.onclick = () => menu.remove();
    menu.appendChild(x);
    wrap.appendChild(menu);
  }
  function itemMenu(wrap) {
    const s = C.sel();
    if (!s) return;
    const menu = el2('div', 'spell-menu');
    const items = s.ch.items.filter(i => { const it = EF.Items[i.key]; return it && (['potion', 'oil'].indexOf(it.cat) >= 0 || it.fx || it.use); });
    if (!items.length) { C.log('Nothing usable at hand.'); return; }
    for (const i of items) {
      const b = el2('button', 'bigbtn', (EF.Items[i.key] || {}).name);
      b.onclick = () => { menu.remove(); C.useItem(s, i); };
      menu.appendChild(b);
    }
    const x = el2('button', 'bigbtn', 'Cancel'); x.onclick = () => menu.remove();
    menu.appendChild(x);
    wrap.appendChild(menu);
  }
  C.draw = draw;
})();
