// 会場：コート、ネット、スタンド、観客、照明、大型ビジョン
SV.Arena = class {
  constructor(scene) {
    this.scene = scene;
    this.C = SV.CONFIG.COURT;
    this.excite = 0;      // 観客の盛り上がり 0〜1
    this.time = 0;
    this.buildLights();
    this.buildFloor();
    this.buildNet();
    this.buildStands();
    this.buildCeiling();
  }

  buildLights() {
    const s = this.scene;
    s.background = new THREE.Color(0x0b1122);
    s.fog = new THREE.Fog(0x0b1122, 40, 90);
    s.add(new THREE.HemisphereLight(0xcfe0ff, 0x5a3a20, 0.75));
    const sun = new THREE.DirectionalLight(0xffffff, 0.85);
    sun.position.set(6, 22, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    const sc = sun.shadow.camera;
    sc.left = -14; sc.right = 14; sc.top = 16; sc.bottom = -16; sc.near = 1; sc.far = 60;
    sun.shadow.bias = -0.0008;
    s.add(sun);
    this.sun = sun;
    const fill = new THREE.DirectionalLight(0xffe2c0, 0.35);
    fill.position.set(-8, 10, -12);
    s.add(fill);
  }

  buildFloor() {
    const C = this.C, s = this.scene;
    // 体育館の床
    const floorMat = new THREE.MeshLambertMaterial({ map: SV.textures.floor() });
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(44, 56), floorMat);
    floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true;
    s.add(floor);
    // フリーゾーン（青）とコート（オレンジ）
    const fz = new THREE.Mesh(new THREE.PlaneGeometry(C.HALF_W * 2 + 7, C.HALF_L * 2 + 9),
      new THREE.MeshLambertMaterial({ color: 0x1f5fb8 }));
    fz.rotation.x = -Math.PI / 2; fz.position.y = 0.005; fz.receiveShadow = true; s.add(fz);
    const court = new THREE.Mesh(new THREE.PlaneGeometry(C.HALF_W * 2, C.HALF_L * 2),
      new THREE.MeshLambertMaterial({ color: 0xf08a3c }));
    court.rotation.x = -Math.PI / 2; court.position.y = 0.01; court.receiveShadow = true; s.add(court);
    // ライン
    const lineMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const line = (w, l, x, z) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, l), lineMat);
      m.rotation.x = -Math.PI / 2; m.position.set(x, 0.015, z); s.add(m);
    };
    const lw = 0.07;
    line(C.HALF_W * 2 + lw, lw, 0, C.HALF_L); line(C.HALF_W * 2 + lw, lw, 0, -C.HALF_L);
    line(lw, C.HALF_L * 2, C.HALF_W, 0); line(lw, C.HALF_L * 2, -C.HALF_W, 0);
    line(C.HALF_W * 2, lw, 0, 0);
    line(C.HALF_W * 2, lw, 0, C.ATTACK_LINE); line(C.HALF_W * 2, lw, 0, -C.ATTACK_LINE);
    // センターのロゴ風の円
    const logo = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.35, 48),
      new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.25 }));
    logo.rotation.x = -Math.PI / 2; logo.position.set(0, 0.016, C.HALF_L / 2 + 1.5); s.add(logo);
    const logo2 = logo.clone(); logo2.position.z = -logo.position.z; s.add(logo2);
  }

  buildNet() {
    const C = this.C, s = this.scene, H = C.NET_H;
    const g = new THREE.Group();
    const postMat = new THREE.MeshLambertMaterial({ color: 0xdddddd });
    const padMat = new THREE.MeshLambertMaterial({ color: 0x1747c9 });
    for (const x of [-C.NET_HALF_W - 0.3, C.NET_HALF_W + 0.3]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, H + 0.3, 12), postMat);
      post.position.set(x, (H + 0.3) / 2, 0); post.castShadow = true; g.add(post);
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.8, 16), padMat);
      pad.position.set(x, 0.9, 0); g.add(pad);
    }
    const netH = 1.0;
    const net = new THREE.Mesh(new THREE.PlaneGeometry(C.NET_HALF_W * 2 + 0.6, netH),
      new THREE.MeshBasicMaterial({ map: SV.textures.net(), transparent: true, side: THREE.DoubleSide, depthWrite: false }));
    net.position.set(0, H - netH / 2, 0);
    g.add(net);
    const band = new THREE.Mesh(new THREE.BoxGeometry(C.NET_HALF_W * 2 + 0.6, 0.07, 0.02),
      new THREE.MeshLambertMaterial({ color: 0xffffff }));
    band.position.set(0, H - 0.035, 0); g.add(band);
    const band2 = band.clone(); band2.position.y = H - netH; band2.scale.y = 0.5; g.add(band2);
    // アンテナ
    for (const x of [-C.HALF_W, C.HALF_W]) {
      const ant = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 1.8, 6),
        new THREE.MeshBasicMaterial({ color: 0xff2020 }));
      ant.position.set(x, H + 0.4, 0); g.add(ant);
    }
    s.add(g);
    this.net = net;
    this.netShake = 0;
  }

  // スタンドと観客（InstancedMesh で数百人を軽量に）
  buildStands() {
    const s = this.scene;
    const standMat = new THREE.MeshLambertMaterial({ color: 0x2a3550 });
    const seats = [];
    const addBlock = (cx, cz, w, d, rotY, rows) => {
      const grp = new THREE.Group();
      grp.position.set(cx, 0, cz); grp.rotation.y = rotY;
      for (let r = 0; r < rows; r++) {
        const step = new THREE.Mesh(new THREE.BoxGeometry(w, 0.6 + r * 0.6, 1.1), standMat);
        step.position.set(0, (0.6 + r * 0.6) / 2, r * 1.1);
        grp.add(step);
        for (let i = 0; i < Math.floor(w / 0.75); i++) {
          if (Math.random() < 0.12) continue;
          seats.push({ grp, local: new THREE.Vector3(-w / 2 + 0.4 + i * 0.75 + SV.util.rand(-0.08, 0.08), 0.6 + r * 0.6, r * 1.1 + 0.1) });
        }
      }
      // 前面の看板
      s.add(grp);
      return grp;
    };
    // 左右の長辺
    const L = addBlock(-12, 0, 26, 8, -Math.PI / 2, 7);
    const R = addBlock(12, 0, 26, 8, Math.PI / 2, 7);
    const F = addBlock(0, -15.5, 24, 8, Math.PI, 7); // 奥（ネット越しに見える）
    this.addBoards();
    // 観客
    const n = seats.length;
    const bodyGeo = new THREE.BoxGeometry(0.46, 0.6, 0.3);
    const headGeo = new THREE.SphereGeometry(0.16, 8, 6);
    const bodyMat = new THREE.MeshLambertMaterial();
    const headMat = new THREE.MeshLambertMaterial();
    this.crowdBody = new THREE.InstancedMesh(bodyGeo, bodyMat, n);
    this.crowdHead = new THREE.InstancedMesh(headGeo, headMat, n);
    const shirts = [0x2f6bff, 0xff3b30, 0xffd21f, 0xffffff, 0x34c759, 0xff9500, 0xaf52de, 0x2b2b30, 0x6fb6ff, 0xff7a6b];
    const skins = [0xf5d0b0, 0xe0ac85, 0xb9825b, 0x8d5a3b];
    const col = new THREE.Color();
    this.crowd = [];
    seats.forEach((st, i) => {
      st.grp.updateMatrixWorld(true);
      const wp = st.local.clone().applyMatrix4(st.grp.matrixWorld);
      // 応援しているチーム：手前寄りなら青多め
      col.setHex(SV.util.pick(shirts)); this.crowdBody.setColorAt(i, col);
      col.setHex(SV.util.pick(skins)); this.crowdHead.setColorAt(i, col);
      this.crowd.push({ p: wp, phase: Math.random() * 10, amp: SV.util.rand(0.6, 1.2), rot: st.grp.rotation.y });
    });
    this.crowdBody.instanceColor.needsUpdate = true;
    this.crowdHead.instanceColor.needsUpdate = true;
    s.add(this.crowdBody, this.crowdHead);
    this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion(); this._v = new THREE.Vector3(); this._sc = new THREE.Vector3(1, 1, 1);
    this.updateCrowd(0);
  }

  addBoards() {
    const s = this.scene;
    const mk = (text, bg, fg, x, z, rotY, w) => {
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, 0.9),
        new THREE.MeshBasicMaterial({ map: SV.textures.banner(text, bg, fg) }));
      m.position.set(x, 0.45, z); m.rotation.y = rotY; s.add(m);
    };
    // コート周りの広告ボード
    mk('SPIKE STADIUM', ['#0c2a8a', '#2f6bff'], '#ffe14a', -9.2, -4, Math.PI / 2, 9);
    mk('VOLLEY CUP', ['#8a120c', '#ff4a3d'], '#ffffff', -9.2, 6, Math.PI / 2, 9);
    mk('JUMP! SPIKE!', ['#ffd21f', '#ff9500'], '#1a1a1a', 9.2, -4, -Math.PI / 2, 9);
    mk('2 vs 2', ['#1c1c1e', '#3a3a3c'], '#6fb6ff', 9.2, 6, -Math.PI / 2, 9);
    mk('SPIKE STADIUM  ★  VOLLEY CUP', ['#0c2a8a', '#8a120c'], '#ffffff', 0, -13.6, 0, 18);
  }

  buildCeiling() {
    const s = this.scene;
    // 大型ビジョン
    this.screen = SV.textures.scoreScreen();
    const frame = new THREE.Mesh(new THREE.BoxGeometry(10.6, 5.6, 0.4), new THREE.MeshLambertMaterial({ color: 0x111111 }));
    frame.position.set(0, 13.5, -24.2); s.add(frame);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(10, 5), new THREE.MeshBasicMaterial({ map: this.screen.tex }));
    scr.position.set(0, 13.5, -23.95); s.add(scr);
    // 奥の壁
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(60, 30), new THREE.MeshLambertMaterial({ color: 0x18223a }));
    wall.position.set(0, 12, -24.5); s.add(wall);
    // 天井の照明リグ（発光スプライト）
    const glowMat = new THREE.SpriteMaterial({ map: SV.textures.glow(), color: 0xfff4d0, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    const trussMat = new THREE.MeshLambertMaterial({ color: 0x333a4a });
    for (const z of [-10, 0, 10]) {
      const truss = new THREE.Mesh(new THREE.BoxGeometry(30, 0.3, 0.3), trussMat);
      truss.position.set(0, 17, z); s.add(truss);
      for (let x = -12; x <= 12; x += 4) {
        const sp = new THREE.Sprite(glowMat); sp.position.set(x, 16.6, z); sp.scale.set(2.6, 2.6, 1); s.add(sp);
      }
    }
    // 舞う光の粒（会場の空気感）
    const pg = new THREE.BufferGeometry();
    const pts = [];
    for (let i = 0; i < 300; i++) pts.push(SV.util.rand(-20, 20), SV.util.rand(2, 16), SV.util.rand(-22, 20));
    pg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.dust = new THREE.Points(pg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.06, transparent: true, opacity: 0.35 }));
    s.add(this.dust);
  }

  setScore(a, b, msg) { this.screen.draw(a, b, msg); }
  cheer(amount) { this.excite = Math.min(1, Math.max(this.excite, amount)); }
  shakeNet(v) { this.netShake = Math.max(this.netShake, v); }

  updateCrowd(dt) {
    const m = this._m, q = this._q, v = this._v;
    const t = this.time;
    const ex = this.excite;
    this.crowd.forEach((c, i) => {
      const bob = Math.max(0, Math.sin(t * (4 + ex * 6) + c.phase)) * (0.04 + ex * 0.35 * c.amp);
      q.setFromAxisAngle(SV.Arena.UP, c.rot);
      v.set(c.p.x, c.p.y + 0.3 + bob, c.p.z); m.compose(v, q, this._sc);
      this.crowdBody.setMatrixAt(i, m);
      v.y += 0.47; m.compose(v, q, this._sc);
      this.crowdHead.setMatrixAt(i, m);
    });
    this.crowdBody.instanceMatrix.needsUpdate = true;
    this.crowdHead.instanceMatrix.needsUpdate = true;
  }

  update(dt) {
    this.time += dt;
    this.excite = Math.max(0.08, this.excite - dt * 0.25);
    this.updateCrowd(dt);
    if (this.netShake > 0) {
      this.netShake = Math.max(0, this.netShake - dt * 2);
      this.net.position.z = Math.sin(this.time * 50) * 0.05 * this.netShake;
    }
    this.dust.rotation.y += dt * 0.01;
  }
};
SV.Arena.UP = new THREE.Vector3(0, 1, 0);
