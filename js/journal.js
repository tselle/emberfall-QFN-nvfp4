/* Emberfall — journal.js
 * The quest journal: commissions with live progress, plus dated notes from the
 * chronicle of the company. */
(function () {
  const EF = (globalThis.EF = globalThis.EF || {});
  const J = {};
  EF.Journal = J;
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

  J.open = function () { EF.UI.show('journal'); };

  EF.UI.register('journal', wrap => {
    const st = EF.Game.state;
    const adv = EF.Adventures[st.adventureId];
    const box = EF.UI.panel('wide journal');
    box.appendChild(EF.UI.h('Journal — ' + adv.title));
    const cols = document.createElement('div'); cols.className = 'cols';
    const left = document.createElement('div');
    left.appendChild(Object.assign(document.createElement('h4'), { textContent: 'Commissions' }));
    for (const q of adv.quests) {
      const qs = st.quests[q.id] || {};
      const card = document.createElement('div');
      card.className = 'questcard' + (qs.paid ? ' done' : qs.done ? ' ready' : '');
      let status = 'Outstanding';
      if (qs.paid) status = 'Fulfilled and paid';
      else if (qs.done) status = 'Complete — report to the commission giver';
      else if (q.killTag) status = (qs.kills || 0) + ' / ' + q.killCount + ' slain';
      else if (q.rescue) status = (qs.rescued || 0) + ' / ' + q.rescue + ' found';
      else if (q.item) status = qs.itemFound ? 'Item recovered' : 'Unrecovered';
      card.innerHTML = '<h5>' + (q.main ? '★ ' : '') + esc(q.name) + '</h5><p class="dim">' + esc(q.brief) + '</p><div>' + status + ' — ' + q.gold + ' gp, ' + q.xp + ' xp (quarter paid)</div>';
      left.appendChild(card);
    }
    const done = Object.keys(EF.Adventures).filter(k => st.flags['adv_complete_' + k]);
    if (done.length) {
      left.appendChild(Object.assign(document.createElement('h4'), { textContent: 'Finished chronicles' }));
      for (const k of done) left.appendChild(Object.assign(document.createElement('div'), { className: 'dim', textContent: '✓ ' + EF.Adventures[k].title }));
    }
    cols.appendChild(left);
    const right = document.createElement('div');
    right.appendChild(Object.assign(document.createElement('h4'), { textContent: 'Dated notes' }));
    const logBox = document.createElement('div'); logBox.className = 'jnotes';
    const notes = st.log.filter(l => /good|bad|treasure|event/.test(l.cls) || /Quest|find|descend|return|Victory/.test(l.t)).slice(-60).reverse();
    for (const l of notes) {
      const d = document.createElement('div');
      d.className = 'logline ' + (l.cls || '');
      d.innerHTML = '<span class="dim">[' + esc(l.at) + ']</span> ' + esc(l.t);
      logBox.appendChild(d);
    }
    right.appendChild(logBox);
    cols.appendChild(right);
    box.appendChild(cols);
    const b = document.createElement('button'); b.className = 'bigbtn'; b.textContent = 'Close the journal';
    b.onclick = () => EF.UI.close();
    box.appendChild(b);
    wrap.appendChild(box);
  });
})();
