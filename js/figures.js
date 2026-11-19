/* Emberfall — figures.js
 * Every picture in the game is drawn by code at start-up: portraits, monster
 * figures, item glyphs and map tokens. No image files anywhere. */
(function () {
  const EF = (globalThis.EF = globalThis.EF || {});
  const F = {};
  EF.Figures = F;

  function hash(s) { let h = 2166136261 >>> 0; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return () => { h ^= h << 13; h >>>= 0; h ^= h >> 17; h ^= h << 5; h >>>= 0; return h / 4294967296; }; }
  function canvas(w, h) { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; }

  // ---------------------------------------------------------------- portraits
  const SKIN = ['#e8c39e', '#d9a97f', '#b97f56', '#8a5a3a', '#5f3d27', '#e3b48f', '#c98d63'];
  const HAIR = ['#2b2118', '#4b3320', '#7a5226', '#9b9b9b', '#c8c8c8', '#6e2f1c', '#1d1d1f'];
  const CLOTH = { fighter: '#66707d', paladin: '#b9b48e', ranger: '#4e6b40', mage: '#43406e', cleric: '#6d6157', thief: '#4a4a44' };
  const portraitCache = {};
  F.portrait = function (ch, size) {
    size = size || 64;
    const key = ch.name + ch.race + ch.cls + size + (ch.sex || '');
    if (portraitCache[key]) return portraitCache[key];
    const r = hash(key);
    const c = canvas(size, size), g = c.getContext('2d');
    const skin = SKIN[Math.floor(r() * SKIN.length)];
    const hair = HAIR[Math.floor(r() * HAIR.length)];
    // backdrop
    g.fillStyle = '#2a2723'; g.fillRect(0, 0, size, size);
    const cx = size / 2;
    // shoulders / class livery
    g.fillStyle = CLOTH[ch.cls] || '#555';
    g.beginPath(); g.moveTo(cx - size * 0.48, size); g.quadraticCurveTo(cx, size * (0.62 - r() * 0.05), cx + size * 0.48, size); g.fill();
    // neck + head
    g.fillStyle = skin;
    g.fillRect(cx - size * 0.1, size * 0.55, size * 0.2, size * 0.2);
    const hw = size * (0.24 + r() * 0.04), hh = size * (0.3 + r() * 0.05);
    g.beginPath(); g.ellipse(cx, size * 0.4, hw, hh, 0, 0, 7); g.fill();
    // race ears
    if (ch.race === 'elf' || ch.race === 'halfelf') {
      g.beginPath(); g.moveTo(cx + hw * 0.85, size * 0.38); g.lineTo(cx + hw * 1.5, size * 0.26); g.lineTo(cx + hw * 0.85, size * 0.46); g.fill();
      g.beginPath(); g.moveTo(cx - hw * 0.85, size * 0.38); g.lineTo(cx - hw * 1.5, size * 0.26); g.lineTo(cx - hw * 0.85, size * 0.46); g.fill();
    }
    if (ch.race === 'dwarf' || ch.race === 'gnome') {
      // beard
      g.fillStyle = hair;
      g.beginPath(); g.ellipse(cx, size * (0.52 + r() * 0.03), hw * 0.9, hh * (0.62 + r() * 0.2), 0, 0.2, Math.PI - 0.2); g.fill();
    }
    // hair
    g.fillStyle = hair;
    if (r() > 0.25 || ch.cls === 'mage') {
      g.beginPath(); g.ellipse(cx, size * (0.27 + r() * 0.03), hw * 1.05, hh * 0.62, 0, Math.PI, 0); g.fill();
      if (r() > 0.5) g.fillRect(cx - hw * 1.05, size * 0.27, hw * 2.1, size * 0.1);
    }
    // eyes / brows
    g.fillStyle = '#20180f';
    g.fillRect(cx - hw * 0.45, size * 0.38, size * 0.045, size * 0.035);
    g.fillRect(cx + hw * 0.25, size * 0.38, size * 0.045, size * 0.035);
    // class props
    g.strokeStyle = '#dcd6c8'; g.lineWidth = Math.max(1, size * 0.02);
    if (ch.cls === 'paladin') { g.beginPath(); g.moveTo(cx - hw * 1.2, size); g.lineTo(cx - hw * 1.2, size * 0.55); g.stroke(); }
    if (ch.cls === 'mage') { g.fillStyle = '#8ea3ff'; g.beginPath(); g.arc(cx + hw * 1.1, size * 0.72, size * 0.05, 0, 7); g.fill(); }
    if (ch.cls === 'cleric') { g.beginPath(); g.arc(cx - hw * 1.1, size * 0.75, size * 0.06, 0, 7); g.stroke(); }
    if (ch.cls === 'thief') { g.fillStyle = '#888'; g.fillRect(cx + hw * 1.0, size * 0.68, size * 0.03, size * 0.14); }
    if (ch.cls === 'ranger') { g.strokeStyle = '#9c7a4d'; g.beginPath(); g.arc(cx - hw * 1.3, size * 0.8, size * 0.12, -1.2, 1.2); g.stroke(); }
    // halfling/gnome scale: shorter face
    if (ch.race === 'halfling') {
      g.fillStyle = 'rgba(0,0,0,0)';
    }
    portraitCache[key] = c;
    return c;
  };

  // ---------------------------------------------------------------- monster figures
  const figCache = {};
  const FIG_W = 56, FIG_H = 68;
  const SIZE_SCALE = { T: 0.45, S: 0.65, M: 1, L: 1.35, H: 1.6, G: 1.9 };
  F.monsterFigure = function (m) {
    if (figCache[m.key]) return figCache[m.key];
    const r = hash(m.key);
    const c = canvas(FIG_W, FIG_H), g = c.getContext('2d');
    const bodyHue = Math.floor(r() * 360);
    const body = `hsl(${bodyHue},${25 + Math.floor(r() * 30)}%,${30 + Math.floor(r() * 22)}%)`;
    const dark = 'rgba(0,0,0,0.55)';
    const sc = SIZE_SCALE[m.size] || 1;
    g.save();
    g.translate(FIG_W / 2, FIG_H);
    g.scale(sc * FIG_W / 56, sc * FIG_H / 68);
    const sp = m.special || {};
    // shadow
    g.fillStyle = dark; g.beginPath(); g.ellipse(0, -2, 16, 4, 0, 0, 7); g.fill();
    // stance by archetype
    const humanoid = !sp.ooze && !sp.swarm && !sp.construct_ooze && !sp.fly && (m.size !== 'T' || !sp.fly);
    const quadruped = /wolf|dog|hound|bear|lion|tiger|panther|cat|boar|rat|fox|jackal|horse|centaur|ox|stag|deer|leopard|hyena|griffon|gryphon|pegasus|roc|fox/.test(m.key);
    const serp = /snake|worm|serpent|wyrm|hydra|naga|eelerie|eel|slug|amphisbaena|kelpie/.test(m.key);
    const bug = /spider|scorpion|beetle|tick|centipede|ant|wasp|fly|moth|termite|leech|stinger|boring wasp|crawler|mawblob/.test(m.key);
    const flyer = sp.fly;
    g.fillStyle = body;
    if (serp) {
      g.beginPath();
      g.moveTo(-14, -4);
      for (let i = 0; i <= 6; i++) { const x = -14 + i * 5, y = -4 - Math.abs(Math.sin(i * 1.2)) * (10 + i * 3); g.lineTo(x, y - (i === 6 ? 10 : 0)); }
      g.lineTo(16, -34); g.lineTo(20, -28); g.lineTo(8, -18);
      for (let i = 6; i >= 0; i--) { const x = -14 + i * 5, y = -2 - Math.abs(Math.sin(i * 1.2)) * (8 + i * 3); g.lineTo(x, y); }
      g.closePath(); g.fill();
      g.fillStyle = '#ffd75e'; g.fillRect(14, -36, 3, 2);
    } else if (bug) {
      g.beginPath(); g.ellipse(0, -12, 13, 8, 0, 0, 7); g.fill();
      g.beginPath(); g.ellipse(10, -14, 6, 5, 0, 0, 7); g.fill();
      g.strokeStyle = body; g.lineWidth = 2;
      for (const s of [-1, 1]) for (let i = 0; i < 4; i++) {
        g.beginPath(); g.moveTo(s * 8, -12); g.lineTo(s * (16 + i * 2), -4 - i * 3); g.stroke();
      }
      g.fillStyle = '#ff5e5e'; g.fillRect(12, -16, 2, 2); g.fillRect(8, -17, 2, 2);
    } else if (quadruped) {
      g.beginPath(); g.ellipse(-2, -14, 15, 8, 0, 0, 7); g.fill();
      g.beginPath(); g.ellipse(13, -20, 6, 5, 0.3, 0, 7); g.fill();
      g.fillRect(-12, -10, 4, 10); g.fillRect(6, -10, 4, 10);
      g.fillStyle = dark; g.beginPath(); g.moveTo(-16, -16); g.lineTo(-22, -24); g.lineTo(-13, -19); g.fill();
      g.fillStyle = '#ffd75e'; g.fillRect(15, -22, 2, 2);
    } else {
      // humanoid / robed / armoured
      g.beginPath();
      g.moveTo(-10, -2); g.lineTo(-7, -26); g.quadraticCurveTo(0, -34, 7, -26); g.lineTo(10, -2); g.closePath(); g.fill();
      g.beginPath(); g.arc(0, -32, 6.5, 0, 7); g.fill();
      if (sp.undead === 'skeleton') { g.fillStyle = '#e8e4d2'; g.beginPath(); g.arc(0, -32, 6, 0, 7); g.fill(); g.fillStyle = '#222'; g.fillRect(-3, -34, 2, 2); g.fillRect(1, -34, 2, 2); }
      else if (sp.undead) { g.fillStyle = 'rgba(160,220,190,0.9)'; g.beginPath(); g.arc(0, -32, 6, 0, 7); g.fill(); }
      if (/caster|cast/.test(JSON.stringify(sp))) {
        g.strokeStyle = body; g.lineWidth = 2; g.beginPath(); g.moveTo(11, -26); g.lineTo(13, -44); g.stroke();
        g.fillStyle = '#8ea3ff'; g.beginPath(); g.arc(13, -46, 2.5, 0, 7); g.fill();
      }
      // weapon glint
      g.strokeStyle = '#cfd3d8'; g.lineWidth = 1.6; g.beginPath(); g.moveTo(-11, -22); g.lineTo(-17, -40); g.stroke();
    }
    if (flyer) {
      g.fillStyle = 'rgba(220,220,230,0.5)';
      g.beginPath(); g.moveTo(-6, -26); g.quadraticCurveTo(-26, -44, -30, -26); g.quadraticCurveTo(-16, -26, -6, -22); g.fill();
      g.beginPath(); g.moveTo(6, -26); g.quadraticCurveTo(26, -44, 30, -26); g.quadraticCurveTo(16, -26, 6, -22); g.fill();
    }
    if (/gazer|eye/.test(m.key)) {
      g.fillStyle = '#ddd'; g.beginPath(); g.arc(0, -24, 10, 0, 7); g.fill();
      g.fillStyle = '#3a6ea5'; g.beginPath(); g.arc(0, -24, 5, 0, 7); g.fill();
      g.fillStyle = '#000'; g.beginPath(); g.arc(0, -24, 2, 0, 7); g.fill();
    }
    g.restore();
    figCache[m.key] = c;
    return c;
  };

  // ---------------------------------------------------------------- item icon
  const iconCache = {};
  F.itemIcon = function (it, size) {
    size = size || 28;
    const key = it.key + size;
    if (iconCache[key]) return iconCache[key];
    const r = hash(it.key);
    const c = canvas(size, size), g = c.getContext('2d');
    g.clearRect(0, 0, size, size);
    const cat = it.cat;
    g.lineCap = 'round';
    const s = size;
    if (cat === 'weapon') {
      const two = it.hand === 2;
      g.strokeStyle = it.size === 'B' ? '#a3763f' : '#c9ccd2';
      g.lineWidth = Math.max(2, s * 0.11);
      g.beginPath(); g.moveTo(s * 0.25, s * 0.8); g.lineTo(s * (it.missile ? 0.7 : 0.75), s * (it.missile ? 0.3 : 0.2)); g.stroke();
      if (it.missile) { g.strokeStyle = '#8f6f42'; g.beginPath(); g.arc(s * 0.42, s * 0.52, s * 0.28, -1.2, 1.2); g.stroke(); }
      g.fillStyle = '#8b8f96';
      if (!it.missile) { g.beginPath(); g.moveTo(s * 0.62, s * 0.3); g.lineTo(s * 0.78, s * 0.16); g.lineTo(s * 0.84, s * 0.3); g.closePath(); g.fill(); }
      void two;
    } else if (cat === 'armor') {
      g.fillStyle = it.shield ? '#8a6b3e' : '#7f8894';
      g.beginPath(); g.moveTo(s * 0.2, s * 0.2); g.lineTo(s * 0.8, s * 0.2); g.lineTo(s * 0.8, s * 0.55); g.quadraticCurveTo(s * 0.5, s * 0.92, s * 0.2, s * 0.55); g.closePath(); g.fill();
      g.strokeStyle = 'rgba(255,255,255,0.35)'; g.beginPath(); g.moveTo(s * 0.5, s * 0.22); g.lineTo(s * 0.5, s * 0.8); g.stroke();
    } else if (cat === 'potion' || cat === 'oil') {
      g.fillStyle = `hsl(${Math.floor(r() * 360)},70%,55%)`;
      g.beginPath(); g.moveTo(s * 0.42, s * 0.18); g.lineTo(s * 0.58, s * 0.18); g.lineTo(s * 0.56, s * 0.4); g.quadraticCurveTo(s * 0.78, s * 0.6, s * 0.62, s * 0.82); g.lineTo(s * 0.38, s * 0.82); g.quadraticCurveTo(s * 0.22, s * 0.6, s * 0.44, s * 0.4); g.closePath(); g.fill();
      g.fillStyle = '#c9b27a'; g.fillRect(s * 0.42, s * 0.1, s * 0.16, s * 0.1);
    } else if (cat === 'scroll') {
      g.fillStyle = '#e3d9b8'; g.fillRect(s * 0.24, s * 0.16, s * 0.52, s * 0.68);
      g.strokeStyle = '#7a6d4d'; g.lineWidth = 1;
      for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(s * 0.3, s * (0.3 + i * 0.13)); g.lineTo(s * 0.7, s * (0.3 + i * 0.13)); g.stroke(); }
    } else if (cat === 'wand' || cat === 'rod' || cat === 'staff') {
      g.strokeStyle = cat === 'staff' ? '#8f6f42' : '#4c3a24'; g.lineWidth = Math.max(2, s * 0.08);
      g.beginPath(); g.moveTo(s * 0.3, s * 0.85); g.lineTo(s * 0.72, s * 0.2); g.stroke();
      g.fillStyle = '#b48fff'; g.beginPath(); g.arc(s * 0.74, s * 0.17, s * 0.1, 0, 7); g.fill();
    } else if (cat === 'ring') {
      g.strokeStyle = '#e6c14f'; g.lineWidth = Math.max(2, s * 0.1); g.beginPath(); g.arc(s * 0.5, s * 0.58, s * 0.24, 0, 7); g.stroke();
      g.fillStyle = `hsl(${Math.floor(r() * 360)},80%,60%)`; g.beginPath(); g.arc(s * 0.5, s * 0.3, s * 0.11, 0, 7); g.fill();
    } else if (cat === 'gem') {
      g.fillStyle = `hsl(${Math.floor(r() * 360)},75%,55%)`;
      g.beginPath(); g.moveTo(s * 0.5, s * 0.15); g.lineTo(s * 0.8, s * 0.45); g.lineTo(s * 0.5, s * 0.85); g.lineTo(s * 0.2, s * 0.45); g.closePath(); g.fill();
    } else if (cat === 'jewel' || cat === 'art') {
      g.fillStyle = '#e6c14f'; g.beginPath(); g.arc(s * 0.5, s * 0.55, s * 0.26, 0, 7); g.fill();
      g.fillStyle = '#9d3b2e'; g.beginPath(); g.arc(s * 0.5, s * 0.55, s * 0.1, 0, 7); g.fill();
    } else if (cat === 'coins') {
      g.fillStyle = '#e6c14f';
      g.beginPath(); g.arc(s * 0.38, s * 0.6, s * 0.18, 0, 7); g.fill();
      g.beginPath(); g.arc(s * 0.6, s * 0.52, s * 0.18, 0, 7); g.fill();
      g.beginPath(); g.arc(s * 0.5, s * 0.36, s * 0.18, 0, 7); g.fill();
    } else if (cat === 'spell') {
      g.fillStyle = '#9fd8ff'; g.beginPath(); g.arc(s * 0.5, s * 0.5, s * 0.3, 0, 7); g.fill();
    } else {
      g.fillStyle = '#9a8f77'; g.fillRect(s * 0.26, s * 0.3, s * 0.48, s * 0.44);
      g.strokeStyle = '#6b6350'; g.strokeRect(s * 0.26, s * 0.3, s * 0.48, s * 0.44);
    }
    iconCache[key] = c;
    return c;
  };

  // town building facades (drawn per building kind by view3d textures)
  F.FACADE = {
    shop_general: { wall: '#b7a98a', door: '#6b4a2b', sign: '#4c7a3d', label: 'SHOP' },
    shop_weapons: { wall: '#a89a86', door: '#5c4126', sign: '#7a3d3d', label: 'ARMS' },
    shop_armour: { wall: '#9fa5a3', door: '#4f3a24', sign: '#3d5a7a', label: 'ARMS' },
    temple: { wall: '#cfc9b2', door: '#6b5a2b', sign: '#b9a13f', label: 'TEMPLE' },
    inn: { wall: '#b29a7a', door: '#61431f', sign: '#7a5f3d', label: 'INN' },
    training: { wall: '#9b9384', door: '#57422a', sign: '#5f7a3d', label: 'YARD' },
    patron: { wall: '#b59f9f', door: '#5a3838', sign: '#8a5f3d', label: 'HOUSE' },
    dungeon: { wall: '#5f5c57', door: '#241f1a', sign: '#333', label: 'DOWN' },
    default: { wall: '#b0a58c', door: '#61431f', sign: '#5f5c57', label: '' }
  };
})();
