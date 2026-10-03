// カメラワーク：通常（自チーム後方から）、スロー演出、得点、勝利オービット
SV.CameraRig = class {
  constructor(camera) {
    this.cam = camera;
    this.mode = 'play';
    this.pos = new THREE.Vector3(0, 6.5, 16);
    this.look = new THREE.Vector3(0, 1.2, -1);
    this.tPos = this.pos.clone();
    this.tLook = this.look.clone();
    this.shakeAmt = 0;
    this.orbitA = 0;
    this.focus = new THREE.Vector3();
    this.side = 1;
    this.time = 0;
  }

  setMode(mode, focus, side) {
    this.mode = mode;
    if (focus) this.focus.copy(focus);
    if (side !== undefined) this.side = side;
    if (mode === 'win') this.orbitA = 0;
  }

  shake(a) { this.shakeAmt = Math.max(this.shakeAmt, a); }

  update(dt, ball) {
    this.time += dt;
    let k = 3;
    if (this.mode === 'play' || this.mode === 'demo') {
      const bx = ball.p.x, bz = ball.p.z;
      const sway = this.mode === 'demo' ? Math.sin(this.time * 0.25) * 1.5 : 0;
      this.tPos.set(bx * 0.35 + sway, 6.2 + Math.max(0, ball.p.y - 3) * 0.15, 15.8 + Math.max(0, bz) * 0.12);
      this.tLook.set(bx * 0.4, 1.4, -1.5 + bz * 0.18);
      k = 2.5;
    } else if (this.mode === 'cine') {
      // スーパースパイク：アタッカーを横から煽る
      const f = this.focus;
      this.tPos.set(f.x + (f.x >= 0 ? 4.2 : -4.2), 2.2, f.z + this.side * 2.8);
      this.tLook.set(ball.p.x, ball.p.y - 0.3, ball.p.z);
      k = 6;
    } else if (this.mode === 'point') {
      const f = this.focus;
      this.tPos.set(f.x * 0.6, 4.2, f.z + this.side * 7.5);
      this.tLook.set(f.x * 0.8, 1.2, f.z);
      k = 1.8;
    } else if (this.mode === 'win') {
      this.orbitA += dt * 0.35;
      const f = this.focus;
      this.tPos.set(f.x + Math.sin(this.orbitA) * 6.5, 2.6 + Math.sin(this.orbitA * 0.7) * 0.6, f.z + Math.cos(this.orbitA) * 6.5);
      this.tLook.set(f.x, 1.3, f.z);
      k = 2;
    } else if (this.mode === 'serve') {
      const f = this.focus;
      this.tPos.set(f.x * 0.6 + 2.5 * this.side, 3.0, f.z + this.side * 6);
      this.tLook.set(f.x * 0.3, 1.5, 0);
      k = 2.5;
    }
    this.pos.lerp(this.tPos, 1 - Math.exp(-k * dt));
    this.look.lerp(this.tLook, 1 - Math.exp(-k * 1.5 * dt));
    this.cam.position.copy(this.pos);
    if (this.shakeAmt > 0) {
      this.shakeAmt = Math.max(0, this.shakeAmt - dt * 2.5);
      const s = this.shakeAmt * 0.25;
      this.cam.position.x += (Math.random() - 0.5) * s;
      this.cam.position.y += (Math.random() - 0.5) * s;
    }
    this.cam.lookAt(this.look);
  }

  snap() { this.pos.copy(this.tPos); this.look.copy(this.tLook); }
};
