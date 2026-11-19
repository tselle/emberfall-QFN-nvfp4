/* Emberfall — view3d.js
 * First-person textured raycast view of towns and dungeons on a square grid.
 * All textures generated at start-up on offscreen canvases. Renders to a small
 * internal buffer and scales up — cheap enough for a 7th-gen iPad.
 * Movement/turning interpolate smoothly; logical moves are instant in game.js. */
(function () {
  const EF = (globalThis.EF = globalThis.EF || {});

  const TEX = 64;
  function mkTex(fn) {
    const c = document.createElement('canvas'); c.width = TEX; c.height = TEX;
    const g = c.getContext('2d');
    fn(g);
    return c;
  }
  function noise(g, n, color, seedShift) {
    let h = 1 + (seedShift | 0);
    const rnd = () => { h ^= h << 13; h >>>= 0; h ^= h >> 17; h ^= h << 5; h >>>= 0; return h / 4294967296; };
    g.fillStyle = color;
    for (let i = 0; i < n; i++) g.fillRect(Math.floor(rnd() * TEX), Math.floor(rnd() * TEX), 1, 1);
  }
  const Textures = {};
  function buildTextures() {
    if (Textures.stone) return;
    const stoneBase = (g, base, brick) => {
      g.fillStyle = base; g.fillRect(0, 0, TEX, TEX);
      g.strokeStyle = 'rgba(0,0,0,0.35)'; g.lineWidth = 2;
      if (brick) {
        for (let y = 0; y < 4; y++) {
          g.beginPath(); g.moveTo(0, y * 16); g.lineTo(TEX, y * 16); g.stroke();
          const off = (y % 2) * 16;
          for (let x = off; x <= TEX; x += 32) { g.beginPath(); g.moveTo(x, y * 16); g.lineTo(x, y * 16 + 16); g.stroke(); }
        }
      } else {
        for (let y = 0; y < 8; y++) { g.beginPath(); g.moveTo(0, y * 8); g.lineTo(TEX, y * 8); g.stroke(); }
      }
      noise(g, 300, 'rgba(0,0,0,0.18)', 7);
      noise(g, 300, 'rgba(255,255,255,0.08)', 13);
    };
    Textures.stone = mkTex(g => stoneBase(g, '#6e6a63', true));
    Textures.stone2 = mkTex(g => { stoneBase(g, '#66625c', true); g.fillStyle = 'rgba(70,90,60,0.35)'; g.fillRect(0, TEX * 0.6, TEX, TEX * 0.4); });
    Textures.cave = mkTex(g => { stoneBase(g, '#57534e', false); noise(g, 500, 'rgba(30,25,20,0.3)', 21); });
    Textures.plaster = mkTex(g => { g.fillStyle = '#b3a68a'; g.fillRect(0, 0, TEX, TEX); noise(g, 400, 'rgba(120,100,70,0.25)', 5); g.fillStyle = 'rgba(80,60,40,0.3)'; for (let i = 0; i < 5; i++) g.fillRect(0, i * 13 + 4, TEX, 1); });
    Textures.wood = mkTex(g => { g.fillStyle = '#6e4f2d'; g.fillRect(0, 0, TEX, TEX); g.strokeStyle = 'rgba(40,25,10,0.5)'; for (let i = 0; i < 6; i++) { g.beginPath(); g.moveTo(i * 11, 0); g.bezierCurveTo(i * 11 + 6, 20, i * 11 - 6, 44, i * 11, 64); g.stroke(); } });
    Textures.door = mkTex(g => {
      g.fillStyle = '#4c3a28'; g.fillRect(0, 0, TEX, TEX);
      g.strokeStyle = '#2c2117'; g.lineWidth = 3; g.strokeRect(4, 2, TEX - 8, TEX - 2);
      g.fillStyle = '#5d4630'; for (let i = 0; i < 4; i++) g.fillRect(8, 6 + i * 15, TEX - 16, 11);
      g.fillStyle = '#c9b26b'; g.beginPath(); g.arc(TEX - 14, TEX / 2, 3, 0, 7); g.fill();
    });
    Textures.doorLocked = mkTex(g => {
      g.drawImage(Textures.door, 0, 0);
      g.fillStyle = '#7d8189'; g.fillRect(0, TEX * 0.42, TEX, 8); g.fillRect(0, TEX * 0.68, TEX, 5);
      g.fillStyle = '#a7abB2'.toLowerCase(); g.fillRect(TEX / 2 - 5, TEX * 0.42, 10, 8);
    });
    Textures.doorSecret = mkTex(g => {
      stoneBase(g, '#6a6660', true);
      g.strokeStyle = 'rgba(0,0,0,0.28)'; g.lineWidth = 1; g.strokeRect(3, 3, TEX - 6, TEX - 3);
    });
    Textures.facadeTemple = mkTex(g => {
      g.fillStyle = '#cfc9b2'; g.fillRect(0, 0, TEX, TEX);
      g.strokeStyle = '#a39b7f'; g.lineWidth = 2;
      for (let i = 0; i < 4; i++) { g.beginPath(); g.moveTo(8 + i * 16, 12); g.lineTo(8 + i * 16, TEX); g.stroke(); }
      g.fillStyle = '#b9a13f'; g.beginPath(); g.moveTo(0, 0); g.lineTo(TEX, 0); g.lineTo(TEX, 10); g.lineTo(0, 10); g.fill();
      g.fillStyle = '#8a7a4a'; g.fillRect(TEX / 2 - 2, 0, 4, 10); g.fillRect(TEX / 2 - 7, 3, 14, 3);
    });
    Textures.facadeInn = mkTex(g => {
      g.fillStyle = '#a89070'.slice(0, 7); g.fillRect(0, 0, TEX, TEX);
      g.strokeStyle = '#5a4327'; g.lineWidth = 4;
      g.strokeRect(0, 0, TEX, TEX); g.beginPath(); g.moveTo(0, 20); g.lineTo(TEX, 20); g.moveTo(0, 44); g.lineTo(TEX, 44); g.stroke();
      g.fillStyle = '#7a5f3d'; g.fillRect(TEX / 2 - 12, 24, 24, 14);
    });
    Textures.facadeShop = mkTex(g => {
      g.fillStyle = '#b7a98a'; g.fillRect(0, 0, TEX, TEX);
      g.fillStyle = '#4c7a3d'; g.fillRect(0, 6, TEX, 10);
      g.fillStyle = '#6b4a2b'; g.fillRect(10, 26, TEX - 20, TEX - 26);
      noise(g, 200, 'rgba(0,0,0,0.12)', 3);
    });
    Textures.facadeArms = mkTex(g => {
      g.fillStyle = '#9fa5a3'; g.fillRect(0, 0, TEX, TEX);
      g.fillStyle = '#7a3d3d'; g.fillRect(0, 6, TEX, 10);
      g.strokeStyle = '#45494d'; g.lineWidth = 3;
      g.beginPath(); g.moveTo(20, 26); g.lineTo(44, 56); g.moveTo(44, 26); g.lineTo(20, 56); g.stroke();
      g.fillStyle = '#5c4126'; g.fillRect(12, 30, TEX - 24, TEX - 30);
    });
    Textures.facadeHall = mkTex(g => {
      g.fillStyle = '#b59f9f'; g.fillRect(0, 0, TEX, TEX);
      g.fillStyle = '#5a3838'; g.fillRect(0, 6, TEX, 10);
      g.fillStyle = '#8a5f3d'; g.beginPath(); g.moveTo(0, 0); g.lineTo(TEX, 0); g.lineTo(TEX, 8); g.lineTo(0, 8); g.fill();
      noise(g, 200, 'rgba(0,0,0,0.1)', 4);
    });
    Textures.dungeonIn = mkTex(g => {
      g.fillStyle = '#37332e'; g.fillRect(0, 0, TEX, TEX);
      g.fillStyle = '#15120f'; g.beginPath(); g.moveTo(TEX / 2, 8); g.lineTo(TEX * 0.82, TEX * 0.55); g.lineTo(TEX * 0.82, TEX); g.lineTo(TEX * 0.18, TEX); g.lineTo(TEX * 0.18, TEX * 0.55); g.closePath(); g.fill();
      g.fillStyle = '#4a453e'; g.fillRect(0, 0, TEX, 8);
    });
    Textures.water = mkTex(g => {
      g.fillStyle = '#3a6285'; g.fillRect(0, 0, TEX, TEX);
      g.strokeStyle = 'rgba(200,225,240,0.25)';
      for (let i = 0; i < 5; i++) { g.beginPath(); g.moveTo(0, 8 + i * 13); g.bezierCurveTo(20, 4 + i * 13, 44, 12 + i * 13, 64, 8 + i * 13); g.stroke(); }
    });
    Textures.rubble = mkTex(g => {
      g.fillStyle = '#6b675f'; g.fillRect(0, 0, TEX, TEX);
      g.fillStyle = '#57534c';
      for (let i = 0; i < 12; i++) g.fillRect((i * 23) % TEX, (i * 41) % TEX, 9 + (i % 4) * 3, 7 + (i % 3) * 3);
      noise(g, 300, 'rgba(0,0,0,0.2)', 9);
    });
    Textures.grassEdge = mkTex(g => { g.fillStyle = '#5c7243'; g.fillRect(0, 0, TEX, TEX); noise(g, 500, 'rgba(40,70,30,0.4)', 6); });
  }
  EF.buildTextures = buildTextures;

  const TILE_TEX = {
    '#': ['stone', 'stone2', 'cave'], '+': ['door'], 'L': ['doorLocked'], 'S': ['doorSecret'],
    '~': ['water'], '%': ['rubble'], ':': ['rubble']
  };
  const FACADE_TEX = {
    temple: 'facadeTemple', inn: 'facadeInn', shop_general: 'facadeShop', shop_weapons: 'facadeArms',
    shop_armour: 'facadeArms', training: 'facadeHall', patron: 'facadeHall', dungeon: 'dungeonIn'
  };

  class View3D {
    constructor(canvas) {
      buildTextures();
      this.canvas = canvas;
      this.ctx = canvas.getContext('2d');
      this.buf = document.createElement('canvas');
      this.bw = 400; this.bh = 240;
      this.buf.width = this.bw; this.buf.height = this.bh;
      this.bg = this.buf.getContext('2d');
      this.zbuf = new Float32Array(this.bw);
      this.map = null;          // {W,H,cell(x,y)->{solid,texKey}}, built by game.js
      this.sprites = [];        // {x,y,fig,w,h,badge}
      this.cam = { x: 2.5, y: 2.5, a: 0 };
      this.tgt = { x: 2.5, y: 2.5, a: 0 };
      this.light = 1;          // 0..1 torch multiplier
      this.quality = 1;        // 1 = full, 0.7 = narrow buffer
      this.minimap = true;
      this.shake = 0;
    }
    setCamera(x, y, a) { this.cam.x = this.tgt.x = x; this.cam.y = this.tgt.y = y; this.cam.a = this.tgt.a = a; }
    face(x, y, a) {
      this.tgt.x = x + 0.5; this.tgt.y = y + 0.5;
      // choose the equivalent angle nearest the camera's current heading so
      // the pan takes the short way around (no 360° snaps)
      this.tgt.a = this.cam.a + Math.atan2(Math.sin(a - this.cam.a), Math.cos(a - this.cam.a));
    }
    turnBy(d) { this.tgt.a += d * Math.PI / 2; }
    snap() { this.cam.x = this.tgt.x; this.cam.y = this.tgt.y; this.cam.a = this.tgt.a; }
    update(dt) {
      const k = Math.min(1, dt * 14);
      this.cam.x += (this.tgt.x - this.cam.x) * k;
      this.cam.y += (this.tgt.y - this.cam.y) * k;
      this.cam.a += (this.tgt.a - this.cam.a) * Math.min(1, dt * 16);
      if (this.shake > 0) this.shake -= dt * 4;
    }
    cellAt(x, y) {
      const m = this.map;
      if (!m || x < 0 || y < 0 || x >= m.W || y >= m.H) return { solid: true, tex: 'stone' };
      return m.cell(x, y);
    }
    render() {
      const g = this.bg, W = this.bw, H = this.bh;
      const cam = this.cam;
      const shk = this.shake > 0 ? Math.sin(performance.now() / 30) * 2 : 0;
      // ceiling & ground gradients
      let gr = g.createLinearGradient(0, 0, 0, H / 2);
      gr.addColorStop(0, '#0c0d10'); gr.addColorStop(1, '#3a3a40');
      g.fillStyle = gr; g.fillRect(0, 0, W, H / 2 + shk);
      gr = g.createLinearGradient(0, H / 2, 0, H);
      gr.addColorStop(0, '#2e2b26'); gr.addColorStop(1, '#57503f');
      g.fillStyle = gr; g.fillRect(0, H / 2 + shk, W, H / 2);
      if (!this.map) { this.blit(); return; }
      const dirA = cam.a;
      const fov = Math.PI / 3;
      const posX = cam.x, posY = cam.y;
      const maxD = 22;
      const light = this.light;
      for (let col = 0; col < W; col++) {
        const rayA = dirA - fov / 2 + fov * col / W;
        const rd = Math.cos(rayA), rn = Math.sin(rayA);
        // DDA
        let mapX = Math.floor(posX), mapY = Math.floor(posY);
        const dDX = Math.abs(1 / (rd || 1e-9)), dDY = Math.abs(1 / (rn || 1e-9));
        let stepX, stepY, sdX, sdY;
        if (rd < 0) { stepX = -1; sdX = (posX - mapX) * dDX; } else { stepX = 1; sdX = (mapX + 1 - posX) * dDX; }
        if (rn < 0) { stepY = -1; sdY = (posY - mapY) * dDY; } else { stepY = 1; sdY = (mapY + 1 - posY) * dDY; }
        let side = 0, hit = false, guard = 0;
        while (guard++ < 60) {
          if (sdX < sdY) { sdX += dDX; mapX += stepX; side = 0; } else { sdY += dDY; mapY += stepY; side = 1; }
          const c = this.cellAt(mapX, mapY);
          if (c.solid) { hit = true; break; }
        }
        let dist = side === 0 ? sdX - dDX : sdY - dDY;
        dist = Math.max(0.05, dist * Math.cos(rayA - dirA)); // fisheye fix
        this.zbuf[col] = dist;
        if (!hit) continue;
        const lineH = Math.min(H * 6, H / dist);
        const y0 = (H - lineH) / 2 + shk;
        // wall texture selection
        const c = this.cellAt(mapX, mapY);
        let texName = c.tex;
        const tt = TILE_TEX[c.ch];
        if (!texName) {
          if (Array.isArray(tt)) texName = tt[(mapX * 7 + mapY * 13) % tt.length];
          else if (typeof tt === 'string') texName = tt;
          else texName = 'stone';
        }
        const tex = Textures[texName] || Textures.stone;
        let wallX = side === 0 ? posY + dist * rn : posX + dist * rd;
        wallX -= Math.floor(wallX);
        let texX = Math.floor(wallX * TEX);
        if ((side === 0 && rd > 0) || (side === 1 && rn < 0)) texX = TEX - texX - 1;
        g.drawImage(tex, texX, 0, 1, TEX, col, y0, 1, lineH);
        // shading
        const shade = Math.max(0, 1 - dist / (7 * light));
        if (shade < 0.92) {
          g.fillStyle = `rgba(8,9,12,${(1 - Math.max(0, shade)).toFixed(3)})`;
          g.fillRect(col, y0 - 2, 1, lineH + 4);
        }
        if (side === 1) { g.fillStyle = 'rgba(0,0,0,0.14)'; g.fillRect(col, y0 - 2, 1, lineH + 4); }
      }
      // sprites
      const sp = this.sprites.slice().sort((a, b) =>
        ((b.x - posX) ** 2 + (b.y - posY) ** 2) - ((a.x - posX) ** 2 + (a.y - posY) ** 2));
      const invDet = 1 / (Math.cos(dirA) * Math.sin(dirA + Math.PI / 2) - Math.sin(dirA) * Math.cos(dirA + Math.PI / 2));
      for (const s of sp) {
        const sx = s.x - posX, sy = s.y - posY;
        const d = Math.sqrt(sx * sx + sy * sy);
        if (d > 18 || d < 0.25) continue;
        let rel = Math.atan2(sy, sx) - dirA;
        while (rel > Math.PI) rel -= 2 * Math.PI; while (rel < -Math.PI) rel += 2 * Math.PI;
        if (Math.abs(rel) > fov * 0.75) continue;
        const dist = d * Math.cos(rel);
        const screenX = (rel / fov + 0.5) * W;
        const size = Math.min(H * 4, (H / dist) * (s.h || 0.9));
        const sw = size * (s.w || (s.fig ? s.fig.width / s.fig.height : 0.8));
        const x0 = screenX - sw / 2, y1 = (H / 2) + size / 2 + shk;
        const c0 = Math.max(0, Math.floor(x0)), c1 = Math.min(W - 1, Math.floor(x0 + sw));
        let any = false;
        for (let cc = c0; cc <= c1; cc++) if (this.zbuf[cc] > dist) { any = true; break; }
        if (!any) continue;
        if (s.fig) {
          g.save();
          g.beginPath(); g.rect(c0, 0, c1 - c0 + 1, H); g.clip();
          g.drawImage(s.fig, x0, y1 - size, sw, size);
          g.restore();
        } else if (s.color) {
          g.fillStyle = s.color;
          const r2 = size * 0.16;
          g.beginPath(); g.arc(screenX, y1 - size * 0.25, r2, 0, 7); g.fill();
        }
        if (s.badge && d < 8) {
          g.fillStyle = 'rgba(10,10,12,0.75)';
          const bw = g.measureText(s.badge).width;
          void bw;
        }
      }
      void invDet;
      this.blit();
    }
    blit() {
      const c = this.canvas, ctx = this.ctx;
      const w = c.width, h = c.height;
      ctx.imageSmoothingEnabled = false;
      ctx.drawImage(this.buf, 0, 0, this.bw, this.bh, 0, 0, w, h);
      if (this.minimap && this.map) this.drawMinimap(ctx, w, h);
    }
    setMinimap(fn, data) { this.mmFn = fn; this.mmData = data; }
    drawMinimap(ctx, w, h) {
      if (!this.mmFn) return;
      const N = 13, cell = Math.max(6, Math.floor(Math.min(w, h) * 0.028));
      const mw = N * cell, mh = N * cell;
      const ox = w - mw - 8, oy = h - mh - 8;
      ctx.fillStyle = 'rgba(8,10,12,0.78)';
      ctx.fillRect(ox - 3, oy - 3, mw + 6, mh + 6);
      this.mmFn(ctx, ox, oy, cell, N, this.cam, this.mmData);
    }
  }
  EF.View3D = View3D;
})();
