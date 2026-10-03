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
    const toon = (c) => new THREE.MeshToonMaterial({ color: c, gradientMap: SV.Character.gradient() });
    const skin = toon(o.skin), hair = toon(o.hair);
    const teamMain = toon(o.colors.main), teamSub = toon(o.colors.sub), dark = toon(o.colors.accent);
    const shoe = toon(0xffffff);
    const add = (parent, geo, mat, x, y, z) => {
      const m = new THREE.Mesh(geo, mat);
      m.position.set(x || 0, y || 0, z || 0);
      m.castShadow = true;
      parent.add(m);
      return m;
    };
    // 顔パーツなど輪郭線・影が不要なもの
    const flat = (m) => { m.castShadow = false; m.userData.noOutline = true; return m; };
    const capsule = (r, len, mat, parent, yOff) => {
      // r128 には CapsuleGeometry が無いので 円柱+球 で代用
      const g = new THREE.Group();
      add(g, new THREE.CylinderGeometry(r, r * 0.92, len, 10, 1, true), mat, 0, -len / 2, 0);
      add(g, new THREE.SphereGeometry(r, 10, 8), mat, 0, 0, 0);
      add(g, new THREE.SphereGeometry(r * 0.92, 10, 8), mat, 0, -len, 0);
      g.position.y = yOff || 0;
      parent.add(g);
      return g;
    };
    const bw = o.build || 1;

    // 腰（全身の基準点）
    const hips = new THREE.Group(); hips.position.y = 0.92; this.root.add(hips); this.hips = hips;
    // 胴体
    const torso = new THREE.Group(); hips.add(torso); this.torso = torso;
    const hex = (c) => '#' + c.toString(16).padStart(6, '0');
    const jersey = new THREE.MeshToonMaterial({ gradientMap: SV.Character.gradient(), map: SV.textures.jersey(hex(o.colors.main), hex(o.colors.sub), String(o.number), o.colors.num) });
    const body = add(torso, new THREE.CylinderGeometry(0.2, 0.17, 0.52, 14, 1, true, -Math.PI / 2), jersey, 0, 0.28, 0);
    body.scale.set(bw, 1, 0.75);
    const chest = add(torso, new THREE.SphereGeometry(0.2, 14, 10), teamMain, 0, 0.52, 0);
    chest.scale.set(1.05 * bw, 0.5, 0.78);
    const shorts = add(hips, new THREE.CylinderGeometry(0.18, 0.2, 0.2, 14), dark, 0, -0.02, 0);
    shorts.scale.set(bw, 1, 0.8);
    // 首と頭
    add(torso, new THREE.CylinderGeometry(0.06, 0.07, 0.12, 8, 1, true), skin, 0, 0.62, 0);
    const head = new THREE.Group(); head.position.y = 0.8; torso.add(head); this.head = head;
    add(head, new THREE.SphereGeometry(0.18, 20, 16), skin, 0, 0, 0).scale.set(1, 1.05, 1);
    add(head, new THREE.SphereGeometry(0.035, 8, 6), skin, -0.18, 0, 0).scale.set(0.5, 1, 0.8);
    add(head, new THREE.SphereGeometry(0.035, 8, 6), skin, 0.18, 0, 0).scale.set(0.5, 1, 0.8);
    this.buildFace(head, add, flat);
    this.buildHair(head, hair, add);
    if (o.headband) {
      const band = add(head, new THREE.TorusGeometry(0.178, 0.018, 6, 24), teamSub, 0, 0.07, 0);
      band.rotation.x = Math.PI / 2 - 0.15;
    }

    // 腕（肩 → 肘 → 手）
    this.arms = [];
    for (const sx of [-1, 1]) {
      const sh = new THREE.Group(); sh.position.set(sx * 0.25 * bw, 0.52, 0); torso.add(sh);
      add(sh, new THREE.SphereGeometry(0.075, 10, 8), teamMain, 0, 0, 0);
      capsule(0.058, 0.26, skin, sh, -0.04);
      const el = new THREE.Group(); el.position.y = -0.31; sh.add(el);
      capsule(0.052, 0.24, skin, el, 0);
      add(el, new THREE.SphereGeometry(0.065, 10, 8), skin, 0, -0.29, 0).scale.set(0.9, 1, 0.7);
      this.arms.push({ sh, el, side: sx });
    }
    // 脚（股関節 → 膝 → 靴）
    this.legs = [];
    for (const sx of [-1, 1]) {
      const hp = new THREE.Group(); hp.position.set(sx * 0.1 * bw, -0.04, 0); hips.add(hp);
      capsule(0.085, 0.38, skin, hp, 0);
      const kn = new THREE.Group(); kn.position.y = -0.42; hp.add(kn);
      capsule(0.07, 0.36, skin, kn, 0);
      // サポーター・ソックス
      add(kn, new THREE.CylinderGeometry(0.082, 0.082, 0.09, 10), dark, 0, -0.02, 0);
      add(kn, new THREE.CylinderGeometry(0.068, 0.068, 0.14, 10), shoe, 0, -0.3, 0);
      const sh = add(kn, new THREE.BoxGeometry(0.13, 0.08, 0.26), shoe, 0, -0.43, 0.05);
      add(sh, new THREE.BoxGeometry(0.135, 0.03, 0.27), teamSub, 0, -0.03, 0);
      this.legs.push({ hp, kn, side: sx });
    }
    this.root.scale.setScalar(o.height || 1);
    SV.Character.addOutlines(this.root);

    // 頭上のマーカー（操作キャラ用）
    this.marker = new THREE.Mesh(new THREE.ConeGeometry(0.2, 0.36, 4), new THREE.MeshBasicMaterial({ color: 0xffe14a }));
    this.marker.rotation.x = Math.PI;
    this.marker.position.y = 2.45;
    this.marker.visible = false;
    this.root.add(this.marker);
  }

  // アニメ風の顔：白目 + 虹彩 + 瞳 + ハイライト、まぶた、眉、口
  buildFace(head, add, flat) {
    const o = this.opt;
    const basic = (c) => new THREE.MeshBasicMaterial({ color: c });
    const sharp = o.eye === 'sharp';
    for (const sx of [-1, 1]) {
      const g = new THREE.Group(); g.position.set(sx * 0.068, 0.0, 0.158); head.add(g);
      g.rotation.y = sx * 0.38;
      if (sharp) g.rotation.z = sx * 0.12;   // 目尻を上げる
      const white = flat(add(g, new THREE.SphereGeometry(0.036, 12, 10), basic(0xffffff), 0, 0, 0));
      white.scale.set(1.05, sharp ? 0.72 : 1.3, 0.35);
      const iris = flat(add(g, new THREE.SphereGeometry(0.026, 12, 10), basic(o.iris || 0x333333), sx * -0.003, sharp ? -0.002 : -0.004, 0.009));
      iris.scale.set(0.9, sharp ? 0.95 : 1.3, 0.3);
      const pupil = flat(add(g, new THREE.SphereGeometry(0.013, 8, 6), basic(0x0c0c10), sx * -0.003, -0.004, 0.015));
      pupil.scale.set(1, sharp ? 1 : 1.3, 0.3);
      flat(add(g, new THREE.SphereGeometry(0.008, 6, 4), basic(0xffffff), 0.008, 0.01, 0.019));
      const lid = flat(add(g, new THREE.BoxGeometry(0.08, 0.009, 0.01), basic(0x1a1012), 0, sharp ? 0.027 : 0.045, 0.006));
      lid.rotation.z = sx * (sharp ? -0.15 : 0.1);
      // 眉
      const browRot = { angry: sx * 0.38, up: -sx * 0.22, calm: -sx * 0.08, flat: sx * 0.05 }[o.brow] || 0;
      const brow = flat(add(head, new THREE.BoxGeometry(0.075, 0.014, 0.012), basic(o.browColor || 0x241812), sx * 0.07, sharp ? 0.072 : 0.085, 0.163));
      brow.rotation.set(0, sx * 0.38, browRot);
    }
    const mouthMat = basic(0x7a2424);
    if (o.mouth === 'grin') {
      // 大きく開いた口（下半円）+ 歯
      const m = flat(add(head, new THREE.CircleGeometry(0.04, 16, Math.PI, Math.PI), mouthMat, 0, -0.056, 0.172));
      m.rotation.x = -0.25;
      const t = flat(add(head, new THREE.PlaneGeometry(0.07, 0.01), basic(0xffffff), 0, -0.061, 0.1735)); t.rotation.x = -0.25;
    } else if (o.mouth === 'line') {
      flat(add(head, new THREE.BoxGeometry(0.045, 0.008, 0.01), mouthMat, 0, -0.07, 0.168));
    } else {
      const m = flat(add(head, new THREE.TorusGeometry(0.022, 0.006, 4, 10, Math.PI), mouthMat, 0, o.mouth === 'frown' ? -0.08 : -0.062, 0.166));
      m.rotation.z = o.mouth === 'frown' ? 0 : Math.PI;
    }
  }

  buildHair(head, mat, add) {
    const style = this.opt.hairStyle;
    const cap = (r, cover, y) => {
      const c = add(head, new THREE.SphereGeometry(r, 20, 14, 0, Math.PI * 2, 0, Math.PI * cover), mat, 0, y || 0.012, -0.01);
      c.rotation.x = -0.2;
      return c;
    };
    const cone = (r, h, x, y, z, rx, rz) => {
      const c = add(head, new THREE.ConeGeometry(r, h, 6), mat, x, y, z);
      c.rotation.set(rx, 0, rz);
      return c;
    };
    if (style === 'hinata') {
      // ふわっと跳ねたオレンジのツンツン頭
      cap(0.212, 0.58);
      let seed = 3;
      const rnd = () => { seed = (seed * 9301 + 49297) % 233280; return seed / 233280; };
      for (let i = 0; i < 18; i++) {
        const a = (i / 18) * Math.PI * 2 + rnd() * 0.3;
        const up = 0.35 + rnd() * 0.6;       // 0=横 1=真上
        const dx = Math.cos(a), dz = Math.sin(a) * 0.9 - 0.15;
        cone(0.07 + rnd() * 0.03, 0.2 + rnd() * 0.09, dx * 0.14, 0.1 + up * 0.09, dz * 0.14,
          dz * (1.6 - up * 1.2), -dx * (1.6 - up * 1.2));
      }
      for (const x of [-0.08, 0, 0.08]) cone(0.04, 0.12, x, 0.12, 0.15, 2.4, x * 3);  // 前髪
    } else if (style === 'kageyama') {
      // 黒髪のサラッとしたマッシュ：前髪は眉の上で一直線
      const c = cap(0.202, 0.52, 0.016); c.rotation.x = -0.45;   // 前は上がり、後ろは襟足まで
      // 前髪：下向きの細い房を並べてギザギザの毛先にする
      for (let i = 0; i < 10; i++) {
        const x = -0.135 + i * 0.03;
        const len = 0.1 + (i % 3) * 0.018;
        const b = add(head, new THREE.ConeGeometry(0.026, len, 5), mat, x, 0.15 - len * 0.4, 0.15 - Math.abs(x) * 0.3);
        b.rotation.set(Math.PI - 0.4, x * 1.6, 0);
      }
      for (const sx of [-1, 1]) {  // もみあげ（耳にかかる）
        const s = add(head, new THREE.BoxGeometry(0.04, 0.14, 0.12), mat, sx * 0.175, 0.02, 0.0);
        s.rotation.z = sx * 0.1;
      }
      const back = add(head, new THREE.SphereGeometry(0.19, 14, 10), mat, 0, -0.02, -0.06); back.scale.set(1.04, 0.92, 0.82);
    } else if (style === 'oikawa') {
      // 茶色のふんわりウェーブ、横に流した前髪
      cap(0.2, 0.55);
      for (let i = 0; i < 9; i++) {
        const a = (i / 9) * Math.PI * 2;
        const s = add(head, new THREE.SphereGeometry(0.075, 10, 8), mat, Math.cos(a) * 0.13, 0.13 + Math.sin(i * 2.1) * 0.02, Math.sin(a) * 0.12 - 0.03);
        s.scale.set(1, 0.8, 1);
      }
      const top = add(head, new THREE.SphereGeometry(0.1, 12, 8), mat, 0, 0.19, -0.02); top.scale.set(1.1, 0.6, 1);
      for (const [x, y, rz] of [[-0.09, 0.1, -0.9], [-0.02, 0.11, -0.7], [0.06, 0.1, -0.5]]) {  // 前髪の房（右に流れる）
        const f = add(head, new THREE.SphereGeometry(0.06, 10, 8), mat, x, y, 0.15);
        f.scale.set(1.5, 0.55, 0.5); f.rotation.z = rz;
      }
      const back = add(head, new THREE.SphereGeometry(0.19, 14, 10), mat, 0, -0.03, -0.06); back.scale.set(1.05, 0.85, 0.85);
    } else if (style === 'ushijima') {
      // 短く刈った髪、片側に少し流した前髪
      cap(0.192, 0.5, 0.02);
      const f = add(head, new THREE.SphereGeometry(0.06, 10, 8), mat, 0.05, 0.13, 0.135);
      f.scale.set(1.6, 0.45, 0.6); f.rotation.z = 0.35;
      const f2 = add(head, new THREE.SphereGeometry(0.05, 10, 8), mat, -0.06, 0.135, 0.13);
      f2.scale.set(1.3, 0.4, 0.6); f2.rotation.z = -0.2;
    } else if (style === 'spiky') {
      cap(0.192, 0.55);
      for (let i = 0; i < 7; i++) {
        const a = (i / 7) * Math.PI * 2;
        cone(0.06, 0.16, Math.cos(a) * 0.1, 0.17, Math.sin(a) * 0.1 - 0.03, Math.sin(a) * 0.7, -Math.cos(a) * 0.7);
      }
    } else if (style === 'pony') {
      cap(0.192, 0.55);
      const t = add(head, new THREE.SphereGeometry(0.08, 10, 8), mat, 0, 0.02, -0.22); t.scale.set(0.8, 1.6, 0.8);
      this.pony = t;
    } else if (style === 'bob') {
      cap(0.192, 0.55);
      const back = add(head, new THREE.SphereGeometry(0.2, 12, 10), mat, 0, -0.03, -0.05); back.scale.set(1, 0.95, 0.85);
    } else {
      cap(0.192, 0.55);
      const f = add(head, new THREE.BoxGeometry(0.24, 0.06, 0.06), mat, 0, 0.13, 0.13); f.rotation.x = 0.5;
    }
  }

  // トゥーン用の3段階グラデーション（全キャラで共有）
  static gradient() {
    if (!SV.Character._grad) {
      const d = new Uint8Array([95, 95, 95, 160, 160, 160, 205, 205, 205]);
      const t = new THREE.DataTexture(d, 3, 1, THREE.RGBFormat);
      t.minFilter = t.magFilter = THREE.NearestFilter;
      t.generateMipmaps = false;
      t.needsUpdate = true;
      SV.Character._grad = t;
    }
    return SV.Character._grad;
  }

  // 輪郭線：法線方向に膨らませた裏面だけを暗色で描く（背面法）
  static outlineMaterial() {
    if (!SV.Character._outline) {
      SV.Character._outline = new THREE.ShaderMaterial({
        uniforms: { thick: { value: 0.011 }, color: { value: new THREE.Color(0x1a1418) } },
        vertexShader: 'uniform float thick; void main(){ vec3 p = position + normal * thick; gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }',
        fragmentShader: 'uniform vec3 color; void main(){ gl_FragColor = vec4(color, 1.0); }',
        side: THREE.BackSide,
      });
    }
    return SV.Character._outline;
  }

  static addOutlines(root) {
    const list = [];
    root.traverse((m) => { if (m.isMesh && !m.userData.noOutline && !m.userData.isOutline) list.push(m); });
    list.forEach((m) => {
      const o = new THREE.Mesh(m.geometry, SV.Character.outlineMaterial());
      o.userData.isOutline = true;
      m.add(o);
    });
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
    // 左利きは左右の腕のポーズを入れ替える（スパイクが左腕になる）
    const lefty = !!this.opt.lefty;
    const LA = this.arms[lefty ? 1 : 0], RA = this.arms[lefty ? 0 : 1];
    if (lefty) this.torso.rotation.y = -P.twist;
    LA.sh.rotation.set(P.lArmX + s * 0.8, 0, LA.side * P.lArmZ);
    RA.sh.rotation.set(P.rArmX - s * 0.8, 0, RA.side * P.rArmZ);
    LA.el.rotation.x = P.lElb - this.runAmt * 0.6;
    RA.el.rotation.x = P.rElb - this.runAmt * 0.6;
    const L = this.legs;
    L[0].hp.rotation.x = P.legX - s * 0.9 - tuck * 0.5;
    L[1].hp.rotation.x = P.legX + s * 0.9 - tuck * 0.2;
    L[0].kn.rotation.x = P.knee + Math.max(0, c) * 1.1 + tuck * 0.9;
    L[1].kn.rotation.x = P.knee + Math.max(0, -c) * 1.1 + tuck * 0.5;
    L[0].hp.rotation.z = -P.legSpread; L[1].hp.rotation.z = P.legSpread;
    if (this.pony) this.pony.rotation.x = Math.sin(this.runPhase * 0.5) * 0.2 * this.runAmt + (airborne ? 0.4 : 0);
    this.root.rotation.y = SV.util.dampAngle(this.root.rotation.y, this.facing, 10, dt);
    this.marker.position.y = 2.45 + Math.sin(performance.now() / 200) * 0.06;
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
