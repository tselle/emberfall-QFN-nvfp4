/* Emberfall — navpad.js
 * The optional on-screen movement pad for touch: forward/back, turn, sidestep,
 * plus search and camp. Shown automatically on touch devices, or toggled from
 * the menu. Works in phone and tablet layouts, both orientations. */
(function () {
  const EF = (globalThis.EF = globalThis.EF || {});
  const N = {};
  EF.NavPad = N;
  N.enabled = null; // auto-detect

  N.isTouch = () => N.enabled != null ? N.enabled : (('ontouchstart' in window) || navigator.maxTouchPoints > 0);

  N.render = function (hud, inField) {
    if (!N.isTouch() || !inField) return;
    const st = EF.Game.state;
    if (!st || (st.mode !== 'dungeon' && st.mode !== 'town' && st.mode !== 'camp-town')) return;
    const pad = document.createElement('div');
    pad.className = 'navpad';
    const b = (glyph, fn, cls) => {
      const x = document.createElement('button');
      x.className = 'navbtn ' + (cls || '');
      x.textContent = glyph;
      x.addEventListener('touchstart', e => { e.preventDefault(); fn(); }, { passive: false });
      x.addEventListener('click', e => { e.preventDefault(); fn(); });
      pad.appendChild(x);
      return x;
    };
    b('↺', () => EF.Game.turn(-1), 'tl');
    b('▲', () => EF.Game.moveFwd(), 'tm');
    b('↻', () => EF.Game.turn(1), 'tr');
    b('◀', () => EF.Game.sidestep(false), 'ml');
    b('▼', () => EF.Game.moveBack(), 'mm');
    b('▶', () => EF.Game.sidestep(true), 'mr');
    b('🔍', () => EF.Game.search(), 'act');
    b('⛺', () => EF.Watch.open(), 'act');
    hud.appendChild(pad);
  };
})();
