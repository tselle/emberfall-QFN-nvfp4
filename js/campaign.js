/* Emberfall — campaign.js
 * The campaign screen: carry one company between adventures. Choose a
 * commission; the company, its gear, gold, levels, spells and journal travel
 * with you. Completed chronicles stay completed. */
(function () {
  const EF = (globalThis.EF = globalThis.EF || {});
  const CP = {};
  EF.Campaign = CP;

  CP.switchTo = function (advId) {
    const st = EF.Game.state;
    if (!st) return;
    if (st.adventureId === advId) { EF.UI.close(); return; }
    // send the old company home, bring it out again elsewhere
    st.adventureId = advId;
    st.mode = 'town';
    st.dungeonFloor = 0;
    st.overlandPos = null;
    st.overlandVisited = {};
    st.flags.safeCamp = false;
    st.flags.overlandHours = 0;
    for (const q of EF.Adventures[advId].quests) st.quests[q.id] = st.quests[q.id] || { done: false, kills: 0, rescued: 0 };
    for (const p of st.party) { p.alive = p.alive || p.hp > 0; if (p.alive) p.hp = p.maxHp; }
    EF.Game.enterTown();
    EF.Game.log('The company travels to ' + EF.Adventures[advId].townName + '. New work: ' + EF.Adventures[advId].title + '.', 'good');
    EF.UI.close();
    EF.Game.autosave();
  };

  CP.enterTownOfCurrent = function () {
    const st = EF.Game.state;
    st.mode = 'town';
    EF.Game.enterTown();
    EF.UI.close();
  };

  CP.open = function () { EF.UI.show('campaign'); };

  EF.UI.register('campaign', wrap => {
    const st = EF.Game.state;
    if (!st) { EF.UI.show('menu'); return; }
    const box = EF.UI.panel('wide');
    box.appendChild(EF.UI.h('The company: ' + st.activeCompany.join(', ')));
    const strip = document.createElement('div');
    strip.className = 'camp-party';
    for (const p of st.party) {
      const card = document.createElement('div'); card.className = 'camp-member' + (p.alive ? '' : ' dead');
      const pr = EF.Figures.portrait(p, 56);
      const c = document.createElement('canvas'); c.width = 56; c.height = 56;
      c.getContext('2d').drawImage(pr, 0, 0);
      card.appendChild(c);
      card.appendChild(Object.assign(document.createElement('div'), { innerHTML: '<b>' + p.name + '</b><br>' + EF.Rules.CLASSES[p.cls].name + ' L' + p.level + (p.alive ? '' : ' (dead)') }));
      strip.appendChild(card);
    }
    box.appendChild(strip);
    box.appendChild(EF.UI.dim('Purse total: ' + EF.Game.partyGold() + ' gp. Completed: ' +
      Object.keys(EF.Adventures).filter(k => st.flags['adv_complete_' + k]).map(k => EF.Adventures[k].title).join(', ') || 'nothing yet.'));
    const grid = document.createElement('div'); grid.className = 'advgrid';
    const advs = Object.values(EF.Adventures).sort((a, b) => a.no - b.no);
    for (const a of advs) {
      const card = document.createElement('div');
      card.className = 'advcard' + (a.generated ? ' gen' : '') + (a.id === st.adventureId ? ' current' : '');
      const done = st.flags['adv_complete_' + a.id];
      card.innerHTML = '<h5>' + (a.no < 4 ? 'E' + a.no + ' ' : '') + a.title + (done ? ' ✓' : '') + '</h5><div class="dim">Levels ' + a.levels[0] + '–' + a.levels[1] + ' · ' + a.townName + '</div>';
      const btn = document.createElement('button');
      btn.textContent = a.id === st.adventureId ? 'Here now' : 'Travel & take the commission';
      btn.disabled = a.id === st.adventureId;
      btn.onclick = () => CP.switchTo(a.id);
      card.appendChild(btn);
      grid.appendChild(card);
    }
    box.appendChild(grid);
    const b = document.createElement('button'); b.className = 'bigbtn'; b.textContent = 'Back to the field';
    b.onclick = () => EF.UI.close();
    box.appendChild(b);
    wrap.appendChild(box);
  });

  // expose campaign in HUD command bar via wrapper on menu screen
  const _origShow = EF.UI.show;
  EF.UI.show = function (name, arg) {
    _origShow.call(EF.UI, name, arg);
    if (name === 'menu') {
      const wrap = document.getElementById('screen');
      const btn = [...wrap.querySelectorAll('button')].find(x => /^Save \/ Load/.test(x.textContent || ''));
      if (btn) {
        const camp = document.createElement('button');
        camp.className = 'bigbtn';
        camp.innerHTML = 'Company &amp; Campaign <kbd>c</kbd>';
        camp.onclick = () => CP.open();
        EF.UI.hot('c', () => CP.open());
        btn.parentNode.insertBefore(camp, btn);
      }
    }
  };
})();
