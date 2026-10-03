// 演出：パーティクル、紙吹雪、着地マーカー、タイミングリング、衝撃波
SV.Effects = class {
  constructor(scene) {
    this.scene = scene;
    this.parts = [];
    this.glowTex = SV.textures.glow();
    this.ringTex = SV.textures.ring();
    // パーティクルのプール
    this.pool = [];
    for (let i = 0; i < 260; i++) {
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: this.glowTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
      s.visible = false; scene.add(s); this.pool.push(s);
    }
    // 紙吹雪（板ポリ）
    this.confetti = [];
    const cg = new THREE.PlaneGeometry(0.12, 0.07);
    const cols = [0xffe14a, 0x2f7bff, 0xff4a3d, 0xffffff, 0x34c759, 0xff9500];
    for (let i = 0; i < 260; i++) {
      const m = new THREE.Mesh(cg, new THREE.MeshBasicMaterial({ color: SV.util.pick(cols), side: THREE.DoubleSide }));
      m.visible = false; scene.add(m);
      this.confetti.push({ m, v: new THREE.Vector3(), r: new THREE.Vector3(), life: 0 });
    }
    // 着地マーカー（ボールの接触予定地点）
    this.marker = this.mkRing(0xffe14a, 1.0);
    this.markerInner = this.mkRing(0xffffff, 0.35);
    // タイミングリング（操作キャラの足元で縮む）
    this.timing = this.mkRing(0x6fff8a, 1);
    this.timingTarget = this.mkRing(0xffffff, 0.55);
    // 衝撃波
    this.shock = this.mkRing(0xffd27a, 1);
  }

  mkRing(color, size) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(size, size),
      new THREE.MeshBasicMaterial({ map: this.ringTex, color, transparent: true, depthWrite: false }));
    m.rotation.x = -Math.PI / 2; m.visible = false; m.renderOrder = 2;
    this.scene.add(m);
    return m;
  }

  burst(pos, color, count, speed, size) {
    for (let i = 0; i < count; i++) {
      const s = this.pool.find((p) => !p.visible);
      if (!s) return;
      s.visible = true; s.position.copy(pos);
      s.material.color.setHex(color);
      const v = new THREE.Vector3(SV.util.rand(-1, 1), SV.util.rand(-0.5, 1.2), SV.util.rand(-1, 1)).normalize().multiplyScalar(speed * SV.util.rand(0.4, 1));
      this.parts.push({ s, v, life: SV.util.rand(0.3, 0.7), max: 0.7, size: size || 0.35 });
    }
  }

  shockwave(pos, color) {
    this.shock.visible = true;
    this.shock.position.set(pos.x, 0.04, pos.z);
    this.shock.material.color.setHex(color || 0xffd27a);
    this.shockT = 0;
  }

  confettiBurst(center) {
    this.confetti.forEach((c, i) => {
      c.m.visible = true;
      c.m.position.set(center.x + SV.util.rand(-6, 6), SV.util.rand(9, 14), center.z + SV.util.rand(-6, 6));
      c.v.set(SV.util.rand(-1, 1), SV.util.rand(-1, 0), SV.util.rand(-1, 1));
      c.r.set(SV.util.rand(-6, 6), SV.util.rand(-6, 6), SV.util.rand(-6, 6));
      c.life = SV.util.rand(4, 7);
    });
  }

  clearConfetti() { this.confetti.forEach((c) => { c.m.visible = false; c.life = 0; }); }

  showMarker(pos, color) {
    this.marker.visible = this.markerInner.visible = true;
    this.marker.position.set(pos.x, 0.03, pos.z);
    this.markerInner.position.set(pos.x, 0.031, pos.z);
    this.marker.material.color.setHex(color || 0xffe14a);
  }
  hideMarker() { this.marker.visible = this.markerInner.visible = false; }

  // remain: 接触までの残り秒（0 で輪がぴったり重なる）
  showTiming(pos, remain) {
    const k = SV.util.clamp(remain / 1.0, 0, 1);
    const s = 0.55 + k * 2.2;
    this.timing.visible = this.timingTarget.visible = true;
    this.timing.position.set(pos.x, 0.035, pos.z);
    this.timing.scale.set(s / 1, s / 1, 1);
    this.timingTarget.position.set(pos.x, 0.034, pos.z);
    const near = Math.abs(remain) < SV.CONFIG.TIMING.GOOD;
    this.timing.material.color.setHex(near ? 0xffe14a : 0x6fff8a);
    this.timing.material.opacity = remain < -0.1 ? 0.3 : 0.95;
  }
  hideTiming() { this.timing.visible = this.timingTarget.visible = false; }

  update(dt) {
    for (let i = this.parts.length - 1; i >= 0; i--) {
      const p = this.parts[i];
      p.life -= dt;
      if (p.life <= 0) { p.s.visible = false; this.parts.splice(i, 1); continue; }
      p.v.y -= 6 * dt;
      p.s.position.addScaledVector(p.v, dt);
      const k = p.life / p.max;
      p.s.material.opacity = k;
      p.s.scale.setScalar(p.size * (0.4 + k));
    }
    this.confetti.forEach((c) => {
      if (c.life <= 0) return;
      c.life -= dt;
      c.v.y = Math.max(c.v.y - 2 * dt, -1.6);
      c.m.position.addScaledVector(c.v, dt);
      c.m.position.x += Math.sin(c.life * 3 + c.r.x) * dt * 0.6;
      c.m.rotation.x += c.r.x * dt; c.m.rotation.y += c.r.y * dt;
      if (c.m.position.y < 0.05) { c.m.position.y = 0.05; c.v.set(0, 0, 0); c.r.set(0, 0, 0); }
      if (c.life <= 0) c.m.visible = false;
    });
    if (this.shock.visible) {
      this.shockT += dt;
      const s = 0.5 + this.shockT * 9;
      this.shock.scale.set(s, s, 1);
      this.shock.material.opacity = Math.max(0, 1 - this.shockT * 2.2);
      if (this.shockT > 0.5) this.shock.visible = false;
    }
    if (this.marker.visible) {
      const t = performance.now() / 1000;
      const s = 1 + Math.sin(t * 10) * 0.08;
      this.marker.scale.set(s, s, 1);
    }
  }
};
