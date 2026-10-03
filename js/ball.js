// ボール：放物線物理、ネット衝突、床バウンド、軌跡エフェクト
SV.Ball = class {
  constructor(scene) {
    const R = SV.CONFIG.PHYS.BALL_R;
    this.scene = scene;
    this.g = SV.CONFIG.PHYS.GRAVITY;
    this.p = new THREE.Vector3(0, 1, 0);
    this.v = new THREE.Vector3();
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(R, 24, 16), new THREE.MeshLambertMaterial({ map: SV.textures.ball() }));
    this.mesh.castShadow = true;
    scene.add(this.mesh);
    // 真下の影（高さが分かりやすいように常時表示）
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.5),
      new THREE.MeshBasicMaterial({ map: SV.Character.blobTex(), transparent: true, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2;
    scene.add(this.shadow);
    // 軌跡
    this.trail = [];
    const tmat = new THREE.SpriteMaterial({ map: SV.textures.glow(), color: 0xffffff, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending });
    for (let i = 0; i < 18; i++) {
      const s = new THREE.Sprite(tmat.clone());
      s.visible = false; scene.add(s);
      this.trail.push(s);
    }
    this.hist = [];
    this.trailColor = null;
    this.spin = new THREE.Vector3();
    this.state = 'held';   // held | flying | dead
    this.bounces = 0;
    this.onFloor = null;   // (pos) => void  最初の接地時
    this.onNet = null;
    this.crossed = false;
  }

  hold(pos) {
    this.state = 'held';
    this.p.copy(pos); this.v.set(0, 0, 0);
    this.setTrail(null);
  }

  // target に time 秒で届くように打つ
  launch(target, time, trailColor) {
    const v = SV.util.launchVelocity(this.p, target, time, this.g);
    this.v.set(v.x, v.y, v.z);
    this.state = 'flying';
    this.bounces = 0;
    this.setTrail(trailColor || null);
    this.spin.set(SV.util.rand(-12, 12), SV.util.rand(-5, 5), SV.util.rand(-12, 12)).multiplyScalar(this.v.length() / 10);
  }

  // 速度を直接指定（トスの打ち上げなど）
  throwUp(vy) {
    this.v.set(0, vy, 0);
    this.state = 'flying';
    this.bounces = 0;
  }

  setTrail(color) {
    this.trailColor = color;
    this.hist.length = 0;
    this.trail.forEach((s) => (s.visible = false));
  }

  // 下降中に高さ h を通る時刻と位置
  predict(h) {
    const t = SV.util.timeToHeightDescending(this.p, this.v, h, this.g);
    if (t < 0) return null;
    return { t, pos: SV.util.posAt(this.p, this.v, t, this.g) };
  }

  update(dt) {
    const C = SV.CONFIG.COURT, R = SV.CONFIG.PHYS.BALL_R;
    if (this.state === 'flying' || this.state === 'dead') {
      const prevZ = this.p.z;
      this.v.y -= this.g * dt;
      this.p.addScaledVector(this.v, dt);
      // ネット衝突（z=0 を跨いだ時、ネットの高さ以下 & 幅内）
      if (Math.sign(prevZ) !== Math.sign(this.p.z) && prevZ !== 0) {
        if (this.p.y < C.NET_H + R * 0.5 && this.p.y > C.NET_H - 1.0 && Math.abs(this.p.x) < C.NET_HALF_W) {
          this.p.z = Math.sign(prevZ) * (R + 0.02);
          this.v.z *= -0.25; this.v.x *= 0.5; this.v.y = Math.min(this.v.y, 0) * 0.3;
          if (this.onNet) this.onNet(this.p.clone());
        }
      }
      // 床
      if (this.p.y < R) {
        this.p.y = R;
        if (this.bounces === 0 && this.onFloor) this.onFloor(this.p.clone());
        this.bounces++;
        this.v.y = Math.abs(this.v.y) * SV.CONFIG.PHYS.BOUNCE;
        this.v.x *= SV.CONFIG.PHYS.FRICTION; this.v.z *= SV.CONFIG.PHYS.FRICTION;
        if (this.v.y < 0.5) this.v.y = 0;
        this.state = 'dead';
      }
      this.mesh.rotation.x += this.spin.x * dt;
      this.mesh.rotation.y += this.spin.y * dt;
      this.mesh.rotation.z += this.spin.z * dt;
    }
    this.mesh.position.copy(this.p);
    // 影
    this.shadow.position.set(this.p.x, 0.025, this.p.z);
    const s = Math.max(0.35, 1.1 - this.p.y * 0.08);
    this.shadow.scale.set(s, s, s);
    this.shadow.material.opacity = Math.max(0.3, 1 - this.p.y * 0.07);
    this.updateTrail();
  }

  updateTrail() {
    if (!this.trailColor || this.state !== 'flying') {
      if (this.hist.length) { this.hist.length = 0; this.trail.forEach((s) => (s.visible = false)); }
      return;
    }
    this.hist.unshift(this.p.clone());
    if (this.hist.length > this.trail.length) this.hist.pop();
    this.trail.forEach((s, i) => {
      const h = this.hist[i];
      if (!h) { s.visible = false; return; }
      s.visible = true;
      s.position.copy(h);
      const k = 1 - i / this.trail.length;
      s.scale.setScalar(0.55 * k + 0.1);
      s.material.color.setHex(this.trailColor);
      s.material.opacity = k * 0.9;
    });
  }
};
