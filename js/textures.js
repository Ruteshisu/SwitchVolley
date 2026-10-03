// Canvas で生成するテクスチャ群（画像ファイルは一切使わない）
SV.textures = (function () {
  function canvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }
  function toTex(c, repeat) {
    const t = new THREE.CanvasTexture(c);
    t.anisotropy = 4;
    if (repeat) { t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(repeat[0], repeat[1]); }
    return t;
  }

  // バレーボール：黄・青・白の3色パネル（正距円筒図法でカーブ帯を描く）
  function ball() {
    const c = canvas(512, 256), g = c.getContext('2d');
    const cols = ['#ffd21f', '#1e5bd8', '#ffffff'];
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 512; x += 2) {
        const u = x / 512 * Math.PI * 2, v = y / 256 * Math.PI;
        // 曲がった帯：経度にうねりを加える
        const k = Math.floor(((u + Math.sin(v * 2) * 0.9) / (Math.PI * 2)) * 6 + 6) % 3;
        g.fillStyle = cols[k];
        g.fillRect(x, y, 2, 1);
      }
    }
    // 縫い目
    g.strokeStyle = 'rgba(0,0,0,.25)'; g.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      g.beginPath();
      for (let y = 0; y <= 256; y += 4) {
        const v = y / 256 * Math.PI;
        const u = (i / 6) * Math.PI * 2 - Math.sin(v * 2) * 0.9;
        const x = ((u / (Math.PI * 2)) * 512 + 512) % 512;
        if (y === 0) g.moveTo(x, y); else g.lineTo(x, y);
      }
      g.stroke();
    }
    return toTex(c);
  }

  // ネット：格子 + 透過
  function net() {
    const c = canvas(256, 64), g = c.getContext('2d');
    g.clearRect(0, 0, 256, 64);
    g.strokeStyle = 'rgba(20,20,20,0.95)'; g.lineWidth = 2;
    for (let x = 0; x <= 256; x += 16) { g.beginPath(); g.moveTo(x, 0); g.lineTo(x, 64); g.stroke(); }
    for (let y = 0; y <= 64; y += 16) { g.beginPath(); g.moveTo(0, y); g.lineTo(256, y); g.stroke(); }
    const t = toTex(c, [8, 2]);
    return t;
  }

  // 木目調の床（コート外）
  function floor() {
    const c = canvas(512, 512), g = c.getContext('2d');
    g.fillStyle = '#c98b4f'; g.fillRect(0, 0, 512, 512);
    for (let i = 0; i < 16; i++) {
      const y = i * 32;
      g.fillStyle = `hsl(28, 45%, ${50 + Math.random() * 10}%)`;
      g.fillRect(0, y, 512, 31);
      g.fillStyle = 'rgba(0,0,0,.15)'; g.fillRect(0, y + 31, 512, 1);
      const off = Math.random() * 512;
      g.fillRect(off, y, 1, 32);
      for (let k = 0; k < 30; k++) {
        g.fillStyle = 'rgba(90,40,10,.06)';
        g.fillRect(Math.random() * 512, y + Math.random() * 30, 40 + Math.random() * 80, 1);
      }
    }
    return toTex(c, [6, 6]);
  }

  // 観客の顔/体の色つきスプライト（シンプルな人型シルエット）
  function crowdAtlas() {
    const c = canvas(512, 128), g = c.getContext('2d');
    const shirts = ['#2f6bff', '#ff3b30', '#ffd21f', '#ffffff', '#34c759', '#ff9500', '#af52de', '#1c1c1e'];
    const skins = ['#f5d0b0', '#e0ac85', '#b9825b', '#8d5a3b'];
    for (let i = 0; i < 8; i++) {
      const x = i * 64;
      g.fillStyle = shirts[i];
      g.beginPath(); g.ellipse(x + 32, 110, 26, 34, 0, 0, Math.PI * 2); g.fill();
      g.fillStyle = skins[i % 4];
      g.beginPath(); g.arc(x + 32, 50, 17, 0, Math.PI * 2); g.fill();
      g.fillStyle = ['#2b1a0e', '#000', '#7a4a1e', '#e8c15a'][i % 4];
      g.beginPath(); g.arc(x + 32, 44, 17, Math.PI, 0); g.fill();
    }
    return toTex(c);
  }

  // 看板・横断幕
  function banner(text, bg, fg) {
    const c = canvas(1024, 128), g = c.getContext('2d');
    const grd = g.createLinearGradient(0, 0, 1024, 0);
    grd.addColorStop(0, bg[0]); grd.addColorStop(1, bg[1]);
    g.fillStyle = grd; g.fillRect(0, 0, 1024, 128);
    g.font = 'italic 900 78px Segoe UI, sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillStyle = fg; g.fillText(text, 512, 68);
    return toTex(c);
  }

  // 大型ビジョン（スコア表示を書き換えるため canvas を返す）
  // teams: [{name, css}, {name, css}]
  function scoreScreen(teams) {
    const c = canvas(512, 256);
    const tex = toTex(c);
    function draw(a, b, msg) {
      const g = c.getContext('2d');
      g.fillStyle = '#05070f'; g.fillRect(0, 0, 512, 256);
      g.fillStyle = teams[0].css; g.fillRect(0, 0, 256, 60);
      g.fillStyle = teams[1].css; g.fillRect(256, 0, 256, 60);
      g.fillStyle = '#fff'; g.font = '900 40px Segoe UI, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(teams[0].name, 128, 32); g.fillText(teams[1].name, 384, 32);
      g.font = '900 130px Segoe UI, sans-serif';
      g.fillStyle = teams[0].css; g.fillText(String(a), 128, 150);
      g.fillStyle = teams[1].css; g.fillText(String(b), 384, 150);
      g.fillStyle = '#ffe14a'; g.font = 'italic 900 34px Segoe UI, sans-serif';
      g.fillText(msg || 'SPIKE STADIUM', 256, 230);
      tex.needsUpdate = true;
    }
    draw(0, 0);
    return { tex, draw };
  }

  // 円形のぼかし影
  function blob() {
    const c = canvas(128, 128), g = c.getContext('2d');
    const grd = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grd.addColorStop(0, 'rgba(0,0,0,0.55)'); grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 128, 128);
    return toTex(c);
  }

  // リング（着地マーカー / タイミング表示）
  function ring() {
    const c = canvas(256, 256), g = c.getContext('2d');
    g.strokeStyle = '#fff'; g.lineWidth = 18;
    g.beginPath(); g.arc(128, 128, 110, 0, Math.PI * 2); g.stroke();
    return toTex(c);
  }

  // 柔らかい光の粒
  function glow() {
    const c = canvas(64, 64), g = c.getContext('2d');
    const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    grd.addColorStop(0, 'rgba(255,255,255,1)'); grd.addColorStop(0.4, 'rgba(255,255,255,.5)'); grd.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
    return toTex(c);
  }

  // 顔（目と口）
  function face(eyeColor) {
    const c = canvas(128, 128), g = c.getContext('2d');
    g.clearRect(0, 0, 128, 128);
    g.fillStyle = '#1b1b1f';
    g.beginPath(); g.ellipse(44, 58, 7, 11, 0, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.ellipse(84, 58, 7, 11, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = eyeColor || '#fff';
    g.beginPath(); g.arc(46, 54, 3, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(86, 54, 3, 0, Math.PI * 2); g.fill();
    g.strokeStyle = '#7a2e2e'; g.lineWidth = 4; g.lineCap = 'round';
    g.beginPath(); g.arc(64, 78, 12, 0.2 * Math.PI, 0.8 * Math.PI); g.stroke();
    g.fillStyle = 'rgba(255,120,120,.35)';
    g.beginPath(); g.arc(30, 76, 8, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(98, 76, 8, 0, Math.PI * 2); g.fill();
    return toTex(c);
  }

  // 背番号入りユニフォーム
  function jersey(main, sub, num, numColor) {
    const c = canvas(256, 256), g = c.getContext('2d');
    g.fillStyle = main; g.fillRect(0, 0, 256, 256);
    g.fillStyle = sub; g.fillRect(0, 30, 256, 14); g.fillRect(0, 212, 256, 10);
    g.font = '900 110px Segoe UI, sans-serif'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineWidth = 8; g.strokeStyle = 'rgba(0,0,0,.35)';
    // 胸と背中（円筒 UV の 1/4 と 3/4 付近）
    for (const x of [64, 192]) { g.strokeText(num, x, 130); g.fillStyle = numColor || sub; g.fillText(num, x, 130); }
    return toTex(c);
  }

  return { ball, net, floor, crowdAtlas, banner, scoreScreen, blob, ring, glow, face, jersey };
})();
