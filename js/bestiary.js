/* Emberfall — bestiary.js
 * The bestiary fills in as creatures are met and fought: stats, specials and
 * the field-notes that say what they are in the Emberwild. */
(function () {
  const EF = (globalThis.EF = globalThis.EF || {});
  const B = {};
  EF.Bestiary = B;
  const esc = s => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;');

  B.open = function () { EF.UI.show('bestiary'); };

  EF.UI.register('bestiary', wrap => {
    const st = EF.Game.state;
    const box = EF.UI.panel('wide bestiary');
    box.appendChild(EF.UI.h('Bestiary of the Emberwild'));
    const keys = Object.keys(st.bestiary || {}).sort();
    if (!keys.length) box.appendChild(EF.UI.dim('You have met nothing yet worth writing down.'));
    const grid = document.createElement('div'); grid.className = 'best-grid';
    for (const k of keys) {
      const m = EF.mon(k);
      if (!m) continue;
      const rec = st.bestiary[k];
      const card = document.createElement('div'); card.className = 'best-card';
      const fig = EF.Figures.monsterFigure(m);
      const c = document.createElement('canvas');
      c.width = 56; c.height = 68;
      c.getContext('2d').drawImage(fig, 0, 0);
      card.appendChild(c);
      const body = document.createElement('div');
      body.innerHTML = '<h5>' + esc(m.name) + '</h5>' +
        '<div class="dim">HD ' + m.hd + (m.hdMod ? (m.hdMod > 0 ? '+' : '') + m.hdMod : '') + ' · AC ' + m.ac + ' · mv ' + m.mv + ' · XP ' + m.xp + '</div>' +
        '<div class="dim">met ' + rec.met + ' · slain ' + (rec.slain || 0) + '</div>' +
        (rec.slain ? '<p>' + esc(lookText(m)) + '</p>' + specialsText(m) : '<p class="dim">Slain creatures reveal their habits here.</p>');
      card.appendChild(body);
      grid.appendChild(card);
    }
    box.appendChild(grid);
    const b = document.createElement('button'); b.className = 'bigbtn'; b.textContent = 'Close the book';
    b.onclick = () => EF.UI.close();
    box.appendChild(b);
    wrap.appendChild(box);
  });

  function lookText(m) {
    return m.look || 'A ' + m.name.toLowerCase() + ' of the Emberwild, ' + m.size + '-sized, hostile.';
  }
  function specialsText(m) {
    const sp = m.special || {};
    const bits = [];
    if (sp.undead) bits.push('Undead (' + sp.undead + '); turnable.');
    if (sp.construct) bits.push('Construct: mindless, immune to poison, sleep and charm.');
    if (sp.outer) bits.push('Extraterrestrial (outer creature).');
    if (sp.weaponNeed) bits.push('Hit only by +' + (sp.weaponNeed >= 9 ? ' magical' : sp.weaponNeed) + ' weapons.');
    if (sp.poison) bits.push('Poison (' + sp.poison + ').');
    if (sp.paralysis) bits.push('Paralysis touch.');
    if (sp.drain) bits.push('Level drain x' + sp.drain + '.');
    if (sp.regen) bits.push('Regenerates ' + sp.regen + '/round (fire and acid stop it).');
    if (sp.breath) bits.push('Breath: ' + sp.breath.type + ' ' + sp.breath.dice + ' every ' + sp.breath.every + ' rounds.');
    if (sp.invisible) bits.push('Invisible.');
    if (sp.incorporeal) bits.push('Incorporeal.');
    if (sp.petrify || sp.gaze) bits.push('Petrifying gaze.');
    if (sp.web) bits.push('Webs.');
    if (sp.constrict) bits.push('Constricts.');
    if (sp.spores) bits.push('Spores.');
    if (sp.fear) bits.push('Causes fear.');
    if (sp.pack) bits.push('Pack tactics.');
    if (sp.caster) bits.push('Casts spells.');
    if (sp.rays) bits.push('Eye rays.');
    if (sp.vulns) for (const k in sp.vulns) bits.push('Vulnerable: ' + k + '.');
    if (sp.swarm) bits.push('Swarms.');
    if (sp.truesee) bits.push('True-seeing.');
    return bits.length ? '<p class="specs">' + esc(bits.join(' ')) + '</p>' : '';
  }
})();
