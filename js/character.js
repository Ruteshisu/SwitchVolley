// プリミティブで組み立てた人型キャラ + ポーズブレンドの手続きアニメーション
// ローカル座標で +z が正面。関節は Group の rotation で動かす。
SV.Character = class {
  constructor(opt) {
    this.opt = opt;
    this.root = new THREE.Group();
    this.pose = Object.assign({}, SV.Character.POSES.idle);
    this.target = 'idle';
    this.holdTimer = 0;
    this.after = 'idle';
    this.runPhase = Math.random() * 6;
    this.runAmt = 0;
    this.facing = 0;
    this.build();
  }

  build() {
    const o = this.opt;
    const lam = (c) => new THREE.MeshLambertMaterial({ color: c });
    const skin = lam(o.skin), hair = lam(o.hair);
    const teamMain = lam(o.colors.main), teamSub = lam(o.colors.sub), dark = lam(o.colors.accent);
    const shoe = lam(0xffffff);
    const add = (parent, geo, mat, x, y, z) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x || 0, y || 0, z || 0);
      m.castShadow = true;
      parent.add(m);
      return m;
    };
    const capsule = (r, len, mat, parent, yOff) => {
      // r128 には CapsuleGeometry が無いので 円柱+球 で代用
      const g = new THREE.Group();
      add(g, new THREE.CylinderGeometry(r, r * 0.92, len, 10), mat, 0, -len / 2, 0);
      add(g, new THREE.SphereGeometry(r, 10, 8), mat, 0, 0, 0);
      add(g, new THREE.SphereGeometry(r * 0.92, 10, 8), mat, 0, -len, 0);
      g.position.y = yOff || 0;
      parent.add(g);
      return g;
    };

    // 腰（全身の基準点）
    const hips = new THREE.Group(); hips.position.y = 0.92; this.root.add(hips); this.hips = hips;
    // 胴体
    const torso = new THREE.Group(); hips.add(torso); this.torso = torso;
    const jersey = new THREE.MeshLambertMaterial({ map: SV.textures.jersey('#' + o.colors.main.toString(16).padStart(6, '0'), '#' + o.colors.sub.toString(16).padStart(6, '0'), String(o.number)) });
    const body = add(torso, new THREE.CylinderGeometry(0.2, 0.17, 0.52, 14, 1, false, -Math.PI / 2), jersey, 0, 0.28, 0);
    body.scale.z = 0.75;
    const chest = add(torso, new THREE.SphereGeometry(0.2, 14, 10), teamMain, 0, 0.52, 0);
    chest.scale.set(1.05, 0.5, 0.78);
    const shorts = add(hips, new THREE.CylinderGeometry(0.18, 0.2, 0.2, 14), dark, 0, -0.02, 0);
    shorts.scale.z = 0.8;
    // 首と頭
    add(torso, new THREE.CylinderGeometry(0.06, 0.07, 0.12, 8), skin, 0, 0.62, 0);
    const head = new THREE.Group(); head.position.y = 0.8; torso.add(head); this.head = head;
    add(head, new THREE.SphereGeometry(0.18, 18, 14), skin, 0, 0, 0).scale.set(1, 1.05, 1);
    // 目・頬
    const eyeMat = lam(0x1b1b22), white = new THREE.MeshBasicMaterial({ color: 0xffffff }), cheek = new THREE.MeshBasicMaterial({ color: 0xff9a9a, transparent: true, opacity: 0.6 });
    for (const sx of [-1, 1]) {
      const e = add(head, new THREE.SphereGeometry(0.03, 10, 8), eyeMat, sx * 0.065, 0.01, 0.155); e.scale.set(0.8, 1.25, 0.6); e.castShadow = false;
      const hl = add(head, new THREE.SphereGeometry(0.009, 6, 4), white, sx * 0.065 + 0.008, 0.025, 0.172); hl.castShadow = false;
      const ch = add(head, new THREE.SphereGeometry(0.025, 8, 6), cheek, sx * 0.105, -0.045, 0.13); ch.scale.z = 0.3; ch.castShadow = false;
    }
    const mouth = add(head, new THREE.TorusGeometry(0.025, 0.007, 4, 10, Math.PI), lam(0x8a2e2e), 0, -0.06, 0.163);
    mouth.rotation.z = Math.PI; mouth.castShadow = false;
    add(head, new THREE.SphereGeometry(0.035, 8, 6), skin, -0.18, 0, 0).scale.set(0.5, 1, 0.8);
    add(head, new THREE.SphereGeometry(0.035, 8, 6), skin, 0.18, 0, 0).scale.set(0.5, 1, 0.8);
    this.buildHair(head, hair, add);
    // ヘッドバンド（チーム色）
    const band = add(head, new THREE.TorusGeometry(0.178, 0.018, 6, 24), teamSub, 0, 0.07, 0);
    band.rotation.x = Math.PI / 2 - 0.15;

    // 腕（肩 → 肘 → 手）
    this.arms = [];
    for (const sx of [-1, 1]) {
      const sh = new THREE.Group(); sh.position.set(sx * 0.25, 0.52, 0); torso.add(sh);
      add(sh, new THREE.SphereGeometry(0.075, 10, 8), teamMain, 0, 0, 0);
      capsule(0.058, 0.26, skin, sh, -0.04);
      const el = new THREE.Group(); el.position.y = -0.31; sh.add(el);
      capsule(0.052, 0.24, skin, el, 0);
      add(el, new THREE.SphereGeometry(0.065, 10, 8), skin, 0, -0.29, 0).scale.set(0.9, 1, 0.7);
      // リストバンド
      add(el, new THREE.CylinderGeometry(0.058, 0.058, 0.05, 10), teamSub, 0, -0.2, 0);
      this.arms.push({ sh, el, side: sx });
    }
    // 脚（股関節 → 膝 → 靴）
    this.legs = [];
    for (const sx of [-1, 1]) {
      const hp = new THREE.Group(); hp.position.set(sx * 0.1, -0.04, 0); hips.add(hp);
      capsule(0.085, 0.38, skin, hp, 0);
      const kn = new THREE.Group(); kn.position.y = -0.42; hp.add(kn);
      capsule(0.07, 0.36, skin, kn, 0);
      // サポーター・ソックス
      add(kn, new THREE.CylinderGeometry(0.08, 0.08, 0.08, 10), teamSub, 0, -0.02, 0);
      add(kn, new THREE.CylinderGeometry(0.068, 0.068, 0.14, 10), shoe, 0, -0.3, 0);
      const sh = add(kn, new THREE.BoxGeometry(0.13, 0.08, 0.26), shoe, 0, -0.43, 0.05);
      add(sh, new THREE.BoxGeometry(0.135, 0.03, 0.27), teamMain, 0, -0.03, 0);
      this.legs.push({ hp, kn, side: sx });
    }

    // 足元の影（ジャンプ時に地面に残す）
    this.shadow = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9),
      new THREE.MeshBasicMaterial({ map: SV.Character.blobTex(), transparent: true, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2;
    this.shadow.position.y = 0.02;
    // 頭上のマーカー（操作キャラ用）
    this.marker = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.22, 4), new THREE.MeshBasicMaterial({ color: 0xffe14a }));
    this.marker.rotation.x = Math.PI;
    this.marker.position.y = 2.35;
    this.marker.visible = false;
    this.root.add(this.marker);
  }

  buildHair(head, mat, add) {
    const style = this.opt.hairStyle;
    const cap = add(head, new THREE.SphereGeometry(0.192, 18, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), mat, 0, 0.012, -0.01);
    cap.rotation.x = -0.2;
    if (style === 'spiky') {
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        const sp = add(head, new THREE.ConeGeometry(0.06, 0.16, 6), mat, Math.cos(a) * 0.1, 0.17, Math.sin(a) * 0.1 - 0.03);
        sp.rotation.set(Math.sin(a) * 0.7, 0, -Math.cos(a) * 0.7);
      }
    } else if (style === 'pony') {
      const t = add(head, new THREE.SphereGeometry(0.08, 10, 8), mat, 0, 0.02, -0.22); t.scale.set(0.8, 1.6, 0.8);
      add(head, new THREE.SphereGeometry(0.04, 8, 6), this.opt.colors.sub === 0xffffff ? mat : mat, 0, 0.1, -0.19);
      this.pony = t;
    } else if (style === 'bob') {
      const b = add(head, new THREE.SphereGeometry(0.205, 16, 12, 0, Math.PI * 2, Math.PI * 0.3, Math.PI * 0.4), mat, 0, -0.02, -0.015);
      b.scale.set(1.02, 1, 1.02);
      const back = add(head, new THREE.SphereGeometry(0.2, 12, 10), mat, 0, -0.03, -0.05); back.scale.set(1, 0.95, 0.85);
    } else {
      // short: 前髪
      const f = add(head, new THREE.BoxGeometry(0.24, 0.06, 0.06), mat, 0, 0.13, 0.13); f.rotation.x = 0.5;
    }
  }

  static blobTex() {
    if (!SV.Character._blob) SV.Character._blob = SV.textures.blob();
    return SV.Character._blob;
  }

  // ポーズ指定。hold 秒後に after へ戻る（hold=0 なら維持）
  setPose(name, hold, after) {
    this.target = name;
    this.holdTimer = hold || 0;
    this.after = after || 'ready';
  }

  update(dt, moveSpeed, airborne) {
    if (this.holdTimer > 0) {
      this.holdTimer -= dt;
      if (this.holdTimer <= 0) this.target = this.after;
    }
    const T = SV.Character.POSES[this.target] || SV.Character.POSES.idle;
    const k = T.k || 14;
    const P = this.pose;
    for (const key in T) {
      if (key === 'k') continue;
      P[key] = SV.util.damp(P[key], T[key], k, dt);
    }
    // 走りの加算アニメ
    this.runAmt = SV.util.damp(this.runAmt, airborne ? 0 : SV.util.clamp(moveSpeed / 5, 0, 1), 10, dt);
    this.runPhase += dt * (6 + moveSpeed * 1.6);
    const s = Math.sin(this.runPhase) * this.runAmt, c = Math.cos(this.runPhase) * this.runAmt;
    const tuck = airborne ? 1 : 0;

    this.hips.position.y = 0.92 - P.crouch + Math.abs(c) * 0.05;
    this.torso.rotation.x = P.lean + this.runAmt * 0.2;
    this.torso.rotation.y = P.twist;
    this.head.rotation.x = P.head - this.runAmt * 0.1;
    const A = this.arms;
    A[0].sh.rotation.set(P.lArmX + s * 0.8, 0, -P.lArmZ);
    A[1].sh.rotation.set(P.rArmX - s * 0.8, 0, P.rArmZ);
    A[0].el.rotation.x = P.lElb - this.runAmt * 0.6;
    A[1].el.rotation.x = P.rElb - this.runAmt * 0.6;
    const L = this.legs;
    L[0].hp.rotation.x = P.legX - s * 0.9 - tuck * 0.5;
    L[1].hp.rotation.x = P.legX + s * 0.9 - tuck * 0.2;
    L[0].kn.rotation.x = P.knee + Math.max(0, c) * 1.1 + tuck * 0.9;
    L[1].kn.rotation.x = P.knee + Math.max(0, -c) * 1.1 + tuck * 0.5;
    L[0].hp.rotation.z = -P.legSpread; L[1].hp.rotation.z = P.legSpread;
    if (this.pony) this.pony.rotation.x = Math.sin(this.runPhase * 0.5) * 0.2 * this.runAmt + (airborne ? 0.4 : 0);
    this.root.rotation.y = SV.util.dampAngle(this.root.rotation.y, this.facing, 10, dt);
    this.marker.position.y = 2.35 + Math.sin(performance.now() / 200) * 0.06;
  }
};

// ポーズ定義（ラジアン）。腕X: 負で前/上へ。肘: 負で前に曲げる。膝: 正で曲げる。
(function () {
  const base = { crouch: 0, lean: 0.05, twist: 0, head: 0, lArmX: 0.05, lArmZ: 0.12, rArmX: 0.05, rArmZ: 0.12, lElb: -0.25, rElb: -0.25, legX: 0, knee: 0.08, legSpread: 0.04, k: 12 };
  const P = (o) => Object.assign({}, base, o);
  SV.Character.POSES = {
    idle: P({}),
    ready: P({ crouch: 0.16, lean: 0.35, head: -0.25, lArmX: -0.55, rArmX: -0.55, lArmZ: 0.2, rArmZ: 0.2, lElb: -0.9, rElb: -0.9, legX: -0.45, knee: 0.75, legSpread: 0.12 }),
    bump: P({ crouch: 0.2, lean: 0.45, head: -0.3, lArmX: -1.0, rArmX: -1.0, lArmZ: -0.22, rArmZ: -0.22, lElb: 0, rElb: 0, legX: -0.55, knee: 0.9, legSpread: 0.15, k: 30 }),
    set: P({ crouch: 0.05, lean: -0.12, head: -0.45, lArmX: -2.75, rArmX: -2.75, lArmZ: 0.3, rArmZ: 0.3, lElb: -0.75, rElb: -0.75, legX: -0.15, knee: 0.3, k: 26 }),
    setPush: P({ crouch: 0, lean: -0.2, head: -0.5, lArmX: -3.0, rArmX: -3.0, lArmZ: 0.15, rArmZ: 0.15, lElb: -0.05, rElb: -0.05, legX: -0.05, knee: 0.05, k: 30 }),
    approach: P({ crouch: 0.28, lean: 0.55, head: -0.35, lArmX: 0.9, rArmX: 0.9, lArmZ: 0.2, rArmZ: 0.2, lElb: -0.1, rElb: -0.1, legX: -0.6, knee: 1.0, k: 16 }),
    spikeWind: P({ lean: -0.3, twist: 0.35, head: -0.5, lArmX: -2.5, lArmZ: 0.25, rArmX: -2.7, rArmZ: 0.5, lElb: -0.2, rElb: -1.7, legX: -0.3, knee: 0.9, k: 22 }),
    spikeHit: P({ lean: 0.5, twist: -0.3, head: -0.1, lArmX: 0.4, lArmZ: 0.3, rArmX: -0.7, rArmZ: 0.1, lElb: -0.6, rElb: -0.05, legX: -0.5, knee: 0.7, k: 40 }),
    block: P({ lean: -0.05, head: -0.2, lArmX: -3.05, rArmX: -3.05, lArmZ: 0.08, rArmZ: 0.08, lElb: 0, rElb: 0, legX: -0.1, knee: 0.4, k: 22 }),
    serveToss: P({ lean: 0.05, twist: 0.25, head: -0.6, lArmX: -2.6, lArmZ: 0.1, rArmX: 0.5, rArmZ: 0.3, lElb: -0.1, rElb: -0.6, legX: -0.1, knee: 0.2, k: 14 }),
    serveWind: P({ lean: -0.25, twist: 0.4, head: -0.5, lArmX: -2.0, lArmZ: 0.2, rArmX: -2.8, rArmZ: 0.5, lElb: -0.2, rElb: -1.6, legX: -0.2, knee: 0.4, k: 20 }),
    serveHit: P({ lean: 0.35, twist: -0.25, head: -0.2, lArmX: 0.3, lArmZ: 0.2, rArmX: -1.2, rArmZ: 0.1, lElb: -0.4, rElb: -0.05, legX: -0.25, knee: 0.3, k: 40 }),
    dig: P({ crouch: 0.4, lean: 0.65, head: -0.5, lArmX: -1.25, rArmX: -1.25, lArmZ: -0.24, rArmZ: -0.24, lElb: 0, rElb: 0, legX: -0.9, knee: 1.5, legSpread: 0.3, k: 34 }),
    cheer: P({ head: -0.35, lArmX: -2.9, rArmX: -2.9, lArmZ: 0.55, rArmZ: 0.55, lElb: -0.2, rElb: -0.2, knee: 0.1, k: 12 }),
    fist: P({ lean: 0.1, head: -0.2, lArmX: -1.4, lArmZ: 0.2, rArmX: -2.9, rArmZ: 0.3, lElb: -1.6, rElb: -0.4, knee: 0.15, k: 14 }),
    sad: P({ crouch: 0.05, lean: 0.4, head: 0.55, lArmX: 0.1, rArmX: 0.1, lArmZ: 0.05, rArmZ: 0.05, lElb: -0.1, rElb: -0.1, knee: 0.15, k: 6 }),
  };
})();
