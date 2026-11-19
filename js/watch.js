/* Emberfall — watch.js
 * Camping: watches kept, rests, and “rest until healed” — healers spend their
 * healing magic and everyone re-memorizes spells between rests. Rations are
 * eaten; dungeons are not safe and wandering things may come. */
(function () {
  const EF = (globalThis.EF = globalThis.EF || {});
  const W = {};
  EF.Watch = W;
  const d = () => EF.dice;
  const R = EF.Rules;

  W.open = function () {
    const st = EF.Game.state;
    if (!st || st.mode === 'combat') return;
    EF.UI.show('camp');
  };

  EF.UI.register('camp', wrap => {
    const st = EF.Game.state;
    const box = EF.UI.panel('camp');
    box.appendChild(EF.UI.h('Making camp'));
    box.appendChild(EF.UI.dim('Day ' + st.day + ', ' + st.hour + ':00. ' +
      (st.mode === 'dungeon' ? 'The dark leans in. Watches will be needed.' :
        st.mode === 'overland' ? (st.flags.safeCamp ? 'This place is walled and watched and safe.' : 'The wilds breathe around the fire.') : 'You are in town; inns are warmer.')));
    const rationCount = countRations();
    box.appendChild(EF.UI.dim('Rations in the pack: ' + rationCount));

    const btn = (label, fn, sub) => {
      const b = document.createElement('button'); b.className = 'bigbtn'; b.innerHTML = label + (sub ? '<span class="dim">' + sub + '</span>' : '');
      b.onclick = fn; box.appendChild(b); return b;
    };

    btn('Rest 4 hours', () => { doRest(4); }, 'wakes watchers; casters re-memorize');
    btn('Rest until morning', () => { doRest(Math.max(1, 24 - st.hour + (st.hour > 6 ? 8 : 16))); }, 'full night');
    btn('Rest until HEALED', () => { restUntilHealed(); }, 'healers cast; eat rations; re-memorize');
    btn('Stand a harder watch (better surprise, -1 hour)', () => {
      st.flags.hardWatch = true;
      EF.Game.advanceTime(1);
      EF.Game.log('The watchers sit forward on their benches, eyes on the dark.');
      EF.UI.close();
    });
    if (st.mode === 'dungeon' || st.mode === 'overland') {
      btn('Break camp and return to town', () => {
        EF.UI.close();
        if (st.mode === 'dungeon') EF.Game.leaveDungeon();
        else EF.Campaign.enterTownOfCurrent();
      });
    }
    const x = document.createElement('button'); x.className = 'bigbtn'; x.textContent = 'Bank the fire';
    x.onclick = () => EF.UI.close();
    box.appendChild(x);
    wrap.appendChild(box);
  });

  function countRations() {
    let n = 0;
    for (const p of EF.Game.state.party) for (const it of p.items) if (it.key === 'g_rations') n += (it.qty || 1);
    return n;
  }
  function eatRations(n) {
    let need = n;
    for (const p of EF.Game.state.party) {
      for (const it of p.items.slice()) {
        if (it.key !== 'g_rations' || need <= 0) continue;
        const take = Math.min(it.qty || 1, need);
        it.qty -= take; need -= take;
        if (it.qty <= 0) p.items = p.items.filter(x => x !== it);
      }
    }
    return need === 0;
  }

  W.reMemorizeAll = function () {
    for (const p of EF.Game.state.party) {
      if (!p.alive) continue;
      if (R.isCaster(p) && EF.UI.autoMemorize) EF.UI.autoMemorize(p);
      p.layOnHandsLeft = R.layOnHands(p);
      p.turnTurned = false;
    }
  };

  function doRest(hours) {
    const st = EF.Game.state;
    if (!eatRations(st.party.filter(p => p.alive).length)) {
      EF.Game.log('You are out of rations. The company sleeps hungry and wakes little rested.');
      hours = Math.ceil(hours / 2);
    }
    const wasDungeon = st.mode === 'dungeon';
    const safe = st.flags.safeCamp || st.mode === 'town';
    let interrupted = false;
    if (wasDungeon && !safe) {
      // wandering monster checks every 2 hours
      for (let h = 0; h < hours && !interrupted; h += 2) {
        if (d().chance(st.flags.hardWatch ? 15 : 25)) interrupted = wanderIn();
      }
    }
    EF.Game.advanceTime(Math.max(0, hours - (interrupted ? 1 : 0)));
    if (!interrupted) {
      for (const p of st.party) if (p.alive && p.hp > 0) p.hp = Math.min(p.maxHp, p.hp + 2);
      W.reMemorizeAll();
      EF.Game.log('The company rests. Spells are re-learned by firelight; the watchers take turns.', 'good');
    }
    st.flags.overlandHours = 0; st.flags.fatiguedSaid = false;
    st.flags.hardWatch = false;
    EF.UI.close();
    if (interrupted) EF.UI.show('ui');
    EF.Game.autosave();
  }

  function wanderIn() {
    const st = EF.Game.state;
    const adv = EF.Adventures[st.adventureId];
    const band = adv.band || 0;
    const sites = EF.Sites[st.adventureId];
    const pool = (sites && sites.encTable.length) ? sites.encTable : ['goblin', 'skeleton warrior', 'giant rat'];
    const key = d().pick(pool);
    const m = EF.mon(key);
    EF.Game.log('Something comes to the campfire: ' + m.name + '!', 'bad');
    const n = Math.max(1, Math.round(d().range(1, 2) * (m.hd <= 2 ? 2 : 1)));
    const insts = [];
    for (let i = 0; i < n; i++) insts.push({ key: m.key, x: 0, y: 0, hp: Math.max(1, m.hpAvg), alive: true, id: 970 + i, virtual: true });
    const surprised = !st.flags.hardWatch && d().chance(50);
    if (surprised) EF.Game.log('It has the advantage of you!', 'bad');
    EF.Combat.start(insts);
    return true;
  }

  function restUntilHealed() {
    const st = EF.Game.state;
    let rounds = 0;
    let rations = 0;
    while (rounds++ < 30) {
      const hurt = st.party.filter(p => p.alive && p.hp < p.maxHp);
      if (!hurt.length) break;
      // lay on hands
      const healers = st.party.filter(p => p.alive && R.layOnHands(p) > 0 && (p.layOnHandsLeft = p.layOnHandsLeft == null ? R.layOnHands(p) : p.layOnHandsLeft) > 0);
      const paladin = healers[0];
      const target = hurt.sort((a, b) => (a.hp / a.maxHp) - (b.hp / b.maxHp))[0];
      let healed = false;
      if (paladin) {
        const h = Math.min(target.maxHp - target.hp, paladin.layOnHandsLeft);
        target.hp += h; paladin.layOnHandsLeft -= h;
        healed = h > 0;
        if (healed) EF.Game.log(paladin.name + ' lays hands on ' + target.name + ' (' + h + ' hp).');
      }
      if (!healed) {
        // cleric heals from memorized slots
        const cleric = st.party.find(p => p.alive && p.spellsMem.some(m => EF.Spells[m.id] && EF.Spells[m.id].fx && EF.Spells[m.id].fx.kind === 'heal' && m.n > 0));
        if (cleric) {
          const slot = cleric.spellsMem.find(m => EF.Spells[m.id] && EF.Spells[m.id].fx && EF.Spells[m.id].fx.kind === 'heal' && m.n > 0);
          const sp = EF.Spells[slot.id];
          const h = Math.min(target.maxHp - target.hp, d().roll(sp.fx.dice));
          target.hp += h; slot.n--;
          cleric.spellsMem = cleric.spellsMem.filter(m => m.n > 0);
          EF.Game.log(cleric.name + ' prays ' + sp.name + ' over ' + target.name + ' (' + h + ' hp).');
        }
      }
      if (!healed) {
        // check if any healing capacity remains
        const capacity = st.party.some(p => p.alive && ((p.layOnHandsLeft || 0) > 0) || p.spellsMem.some(m => EF.Spells[m.id] && EF.Spells[m.id].fx && EF.Spells[m.id].fx.kind === 'heal'));
        if (!capacity) { EF.Game.log('The company has spent every means of healing it carries. Rest continues for the sake of memory.'); break; }
      }
      if (rounds % 4 === 0) {
        if (!eatRations(1)) { EF.Game.log('Rations have run out mid-rest.'); break; }
        rations++;
      }
    }
    // overnight-ish: time passes at least 4 hours
    EF.Game.advanceTime(4);
    if (!eatRations(st.party.filter(p => p.alive).length)) { /* hungry */ }
    // re-memorize between rests
    W.reMemorizeAll();
    for (const p of st.party) if (p.alive && p.hp > 0) p.hp = Math.min(p.maxHp, p.hp + 1);
    EF.Game.log('The company is as whole as its magic can make it, and the spells are re-learned.', 'good');
    st.flags.overlandHours = 0; st.flags.fatiguedSaid = false;
    EF.UI.close();
    EF.Game.autosave();
    void rations;
  }
})();
