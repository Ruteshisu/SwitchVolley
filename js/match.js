// 試合ロジック：選手（Player）と状態機械（Match）
// 打球のたびに「次に誰が・いつ・どこで触るか（plan）」を計算し、
// AI はその通りに動き、人間はタイミング入力で成否が決まる。

SV.Player = class {
  constructor(scene, team, idx, look) {
    this.team = team; this.idx = idx;
    this.s = team === 0 ? 1 : -1;           // 自コート側の z 符号
    this.char = new SV.Character(look);
    scene.add(this.char.root);
    this.pos = new THREE.Vector3();
    this.target = new THREE.Vector3();
    this.jumpVel = new THREE.Vector3();
    this.y = 0; this.vy = 0; this.speed = 0;
    this.human = false; this.manualT = 0; this.lockMove = 0;
    this.look = null;                         // 向く点（null ならボール）
  }
  get airborne() { return this.y > 0.0001 || this.vy > 0; }
  place(x, z) { this.pos.set(x, 0, z); this.target.copy(this.pos); this.y = 0; this.vy = 0; this.jumpVel.set(0, 0, 0); }
  setTarget(x, z) { this.target.set(x, 0, z); }

  jump(v, toward, peakT) {
    if (this.airborne) return false;
    this.vy = v;
    if (toward) {
      // 頂点で toward に着くよう水平速度を与える（上限あり）
      const dx = toward.x - this.pos.x, dz = toward.z - this.pos.z;
      const d = Math.hypot(dx, dz), sp = Math.min(3.2, d / peakT);
      if (d > 0.01) this.jumpVel.set(dx / d * sp, 0, dz / d * sp);
    }
    return true;
  }

  update(dt, manual, ballPos) {
    const P = SV.CONFIG.PLAYER, C = SV.CONFIG.COURT;
    let vx = 0, vz = 0;
    if (this.airborne) {
      this.vy -= 13 * dt; this.y += this.vy * dt;
      this.pos.addScaledVector(this.jumpVel, dt);
      if (this.y <= 0) { this.y = 0; this.vy = 0; this.jumpVel.set(0, 0, 0); this.lockMove = 0.12; }
    } else if (this.lockMove > 0) {
      this.lockMove -= dt;
    } else if (manual && manual.active) {
      vx = manual.x * P.MANUAL_SPEED; vz = manual.z * P.MANUAL_SPEED; this.manualT = 0.45;
    } else if (this.manualT > 0) {
      this.manualT -= dt;
    } else if (!this.human || SV.CONFIG.AUTO_MOVE) {
      const dx = this.target.x - this.pos.x, dz = this.target.z - this.pos.z, d = Math.hypot(dx, dz);
      if (d > 0.04) { const sp = Math.min(P.SPEED, d * 7); vx = dx / d * sp; vz = dz / d * sp; }
    }
    this.pos.x += vx * dt; this.pos.z += vz * dt;
    // 自コート内に制限（ネットは越えない）
    const zMin = 0.32, zMax = C.HALF_L + 3.5;
    const zz = SV.util.clamp(this.pos.z * this.s, zMin, zMax);
    this.pos.z = zz * this.s;
    this.pos.x = SV.util.clamp(this.pos.x, -C.HALF_W - 3, C.HALF_W + 3);
    this.speed = Math.hypot(vx, vz);

    const ch = this.char;
    ch.root.position.set(this.pos.x, this.y, this.pos.z);
    // 向き：ボール（または look）方向、ただしネット方向から ±75° 以内
    const lp = this.look || ballPos;
    const netYaw = this.s > 0 ? Math.PI : 0;
    let yaw = Math.atan2(lp.x - this.pos.x, lp.z - this.pos.z);
    let d = ((yaw - netYaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI;
    d = SV.util.clamp(d, -1.3, 1.3);
    ch.facing = netYaw + d;
    ch.update(dt, this.speed, this.airborne);
  }
};

SV.Match = class {
  constructor(world) {
    this.w = world;
    this.ball = world.ball;
    this.fx = world.effects;
    this.timeScale = 1;
    this.slowReal = 0;
    this.t = 0;
    const T = SV.CONFIG.TEAM_COLORS;
    const looks = [
      { colors: T[0], skin: 0xf1c7a5, hair: 0x2b1a0e, hairStyle: 'short', number: 1 },
      { colors: T[0], skin: 0xe0ac85, hair: 0xe8c15a, hairStyle: 'pony', number: 7 },
      { colors: T[1], skin: 0xc98e62, hair: 0x15151a, hairStyle: 'spiky', number: 3 },
      { colors: T[1], skin: 0xf5d0b0, hair: 0x8a3b1e, hairStyle: 'bob', number: 9 },
    ];
    this.players = looks.map((lk, i) => new SV.Player(world.scene, i < 2 ? 0 : 1, i % 2, lk));
    this.ball.onFloor = (p) => this.onBallFloor(p);
    this.ball.onNet = () => this.onBallNet();
    this.onEnd = null;
  }

  // ---------- 便利関数 ----------
  side(team) { return team === 0 ? 1 : -1; }
  teamPlayers(team) { return this.players.filter((p) => p.team === team); }
  mate(p) { return this.players.find((q) => q.team === p.team && q !== p); }
  get human() { return this.players.find((p) => p.human) || null; }

  start(opts) {
    this.opts = opts;
    this.demo = !!opts.demo;
    this.pointsToWin = opts.points;
    this.score = [0, 0];
    this.servingTeam = 1;
    this.serverIdx = [0, 0];
    this.forceSuper = this.demo;   // デモ最初のスパイクは必ずスーパースパイク（見どころ）
    this.players.forEach((p) => { p.human = false; p.char.marker.visible = false; });
    if (!this.demo) { this.players[0].human = true; this.players[0].char.marker.visible = true; }
    this.fx.clearConfetti();
    this.slowReal = 0; this.timeScale = 1;
    SV.ui.score(0, 0, this.servingTeam);
    SV.ui.matchPoint('');
    this.w.arena.setScore(0, 0);
    this.setupServe();
  }

  // ---------- サーブ ----------
  setupServe() {
    const C = SV.CONFIG.COURT;
    this.phase = 'serveReady'; this.phaseT = 0;
    this.plan = null; this.blockEvent = null; this.oppSpike = null;
    this.lastKind = 'serve';
    this.ball.setTrail(null);
    const st = this.servingTeam, s = this.side(st), rt = 1 - st, rs = this.side(rt);
    const tp = this.teamPlayers(st);
    this.server = tp[this.serverIdx[st]];
    const partner = this.mate(this.server);
    const sx = SV.util.rand(-2, 2);
    this.server.place(sx, s * (C.HALF_L + 0.9));
    partner.place(-sx * 0.5 + (sx > 0 ? -1.2 : 1.2), s * 2.0);
    const rp = this.teamPlayers(rt);
    rp[0].place(-2.2, rs * 6.2); rp[1].place(2.2, rs * 6.2);
    this.players.forEach((p) => { p.char.setPose('ready'); p.look = null; p.char.holdTimer = 0; });
    this.server.char.setPose('idle');
    this.touch = { team: st, count: 3, last: this.server };
    this.lastTouchTeam = st;
    this.ball.hold(this.handPos(this.server));
    this.fx.hideMarker(); this.fx.hideTiming();
    this.w.cam.setMode(this.demo ? 'demo' : 'play');
    this.serveDelay = SV.util.rand(1.0, 1.6);
    SV.input.clearAction();
  }

  handPos(p) { return new THREE.Vector3(p.pos.x + 0.22 * p.s * -1, 1.05, p.pos.z - p.s * 0.38); }

  tossServe() {
    const p = this.server;
    this.ball.p.set(p.pos.x, 1.45, p.pos.z - p.s * 0.45);
    this.ball.throwUp(5.6);
    this.tossT = this.t;
    this.phase = 'serveToss';
    p.char.setPose('serveToss');
    SV.audio.play('toss');
  }

  // q: PERFECT(ジャンプサーブ) / GOOD / OK(ゆるい)
  hitServe(q, aim) {
    const p = this.server, st = p.team, os = -p.s;
    let tgt;
    if (aim) {
      tgt = { x: SV.util.clamp(aim.x * 3.2 + SV.util.rand(-0.6, 0.6), -4.2, 4.2), z: os * (aim.z < -0.3 ? 8.0 : aim.z > 0.3 ? 4.6 : SV.util.rand(5.5, 7.5)) };
    } else tgt = SV.AI.serveTarget(os);
    if (q === 'OK') { tgt.x += SV.util.rand(-1.2, 1.2); tgt.z += os * SV.util.rand(-0.5, 1.4); }
    let T = q === 'PERFECT' ? SV.CONFIG.SHOT.SERVE_STRONG_T : q === 'GOOD' ? SV.CONFIG.SHOT.SERVE_T : SV.CONFIG.SHOT.SERVE_T * 1.15;
    if (q === 'PERFECT') p.jump(4.2, null, 0.3);
    p.char.setPose('serveHit', 0.4, 'ready');
    this.safeLaunch({ x: tgt.x, y: SV.CONFIG.PHYS.BALL_R, z: tgt.z }, T, q === 'PERFECT' ? 0x9fd4ff : null);
    SV.audio.play('serve');
    this.fx.burst(this.ball.p, 0xffffff, 10, 3);
    if (q === 'PERFECT') { SV.ui.sub('JUMP SERVE!'); this.w.cam.shake(0.4); }
    this.judge(p, q);
    this.lastKind = 'serve';
    this.lastTouchTeam = st;
    this.touch = { team: st, count: 3, last: p };
    this.phase = 'rally';
    this.planNext();
  }

  // ネットに掛からないよう滞空時間を伸ばしながら打つ
  safeLaunch(target, T, trail) {
    const b = this.ball, g = b.g, H = SV.CONFIG.COURT.NET_H + 0.22;
    let t = T;
    for (let i = 0; i < 20; i++) {
      const v = SV.util.launchVelocity(b.p, target, t, g);
      if (Math.sign(b.p.z) === Math.sign(target.z) || v.z === 0) break;
      const tn = -b.p.z / v.z;
      const yn = b.p.y + v.y * tn - 0.5 * g * tn * tn;
      if (yn > H) break;
      t += 0.05;
    }
    b.launch(target, t, trail);
  }

  // ---------- 次の接触予定（plan）を作る ----------
  planNext() {
    const SH = SV.CONFIG.SHOT;
    this.plan = null;
    this.letGo = null;
    this.fx.hideMarker();
    if (this.ball.state !== 'flying') return;
    const team = this.touch.team, count = this.touch.count;
    if (count < 3) {
      const mate = this.mate(this.touch.last);
      if (count === 1) {
        let pr = this.ball.predict(SH.CONTACT_SET);
        if (pr && pr.pos.z * this.side(team) > 0.2) return this.makePlan('set', mate, pr);
        pr = this.ball.predict(SH.CONTACT_LOW + 0.1);
        if (pr && pr.pos.z * this.side(team) > 0.2) return this.makePlan('set', mate, pr);
      } else {
        let pr = this.ball.predict(SH.CONTACT_SPIKE);
        if (pr && pr.pos.z * this.side(team) > 0.2) return this.makePlan('spike', mate, pr);
        pr = this.ball.predict(1.0);
        if (pr && pr.pos.z * this.side(team) > 0.2) return this.makePlan('free', mate, pr);
      }
    }
    // 相手コートへ
    const opp = 1 - team;
    const pr = this.ball.predict(SH.CONTACT_LOW);
    if (!pr || pr.pos.z * this.side(opp) <= 0.1) return;
    const land = this.ball.predict(SV.CONFIG.PHYS.BALL_R);
    const cands = this.teamPlayers(opp);
    let best = null, bd = 1e9;
    cands.forEach((p) => {
      const d = Math.hypot(p.pos.x - pr.pos.x, p.pos.z - pr.pos.z) + (p.airborne ? 2.5 : 0);
      if (d < bd) { bd = d; best = p; }
    });
    // AI はアウトになる球を見送る
    if (!best.human && land && SV.AI.isOut(land.pos, 0.3)) {
      this.letGo = best;
      best.char.setPose('ready');
      this.assignDefense(opp, null);
      return;
    }
    this.makePlan('receive', best, pr);
  }

  makePlan(kind, player, pr) {
    const A = SV.CONFIG.AI, P = SV.CONFIG.PLAYER, b = this.ball;
    const vy = b.v.y - b.g * pr.t;
    const speed = Math.hypot(b.v.x, vy, b.v.z);
    const plan = {
      kind, player, team: player.team, tc: this.t + pr.t,
      pos: new THREE.Vector3(pr.pos.x, pr.pos.y, pr.pos.z),
      pressT: null, jumped: false, difficulty: SV.util.clamp((speed - 9) / 14, 0, 1),
    };
    const s = player.s;
    // AI の成否を先に決める（届くか + 確率）
    if (!player.human) {
      const dist = Math.hypot(player.pos.x - plan.pos.x, player.pos.z - plan.pos.z) - P.REACH * 0.8;
      const reachable = dist <= P.SPEED * Math.max(0, pr.t - A.REACTION);
      let ok = reachable;
      if (kind === 'receive') ok = reachable && SV.AI.receiveSuccess(plan.difficulty, this.demo ? -0.05 : 0);
      else if (kind === 'set' || kind === 'free') ok = reachable && Math.random() < A.SET_SUCCESS;
      plan.aiQ = SV.AI.quality(ok);
      if (kind === 'spike') plan.aiQ = reachable ? 'GOOD' : 'MISS';
    }
    // 移動先：ボールが体の前に来るよう少し後ろ
    const back = kind === 'spike' ? 0.45 : 0.3;
    let tx = plan.pos.x, tz = plan.pos.z + s * back;
    if (plan.aiQ === 'MISS') { tx += SV.util.pick([-1, 1]) * SV.util.rand(1.4, 2.0); }
    player.setTarget(tx, tz);
    player.look = null;
    if (kind === 'spike') player.char.setPose('ready');
    else player.char.setPose('ready');
    this.plan = plan;
    this.fx.showMarker(plan.pos, player.team === 0 ? 0x6fb6ff : 0xff7a6b);
    // 他の選手の配置
    const mate = this.mate(player);
    const SH = SV.CONFIG.SHOT;
    if (kind === 'receive') {
      mate.setTarget(SH.SET_POS.x * (player.pos.x > 0 ? -1 : 1), s * (SH.SET_POS.z + 0.3));
      this.assignDefense(1 - player.team, null);
    } else if (kind === 'set') {
      const side = Math.abs(mate.pos.x) > 0.5 ? Math.sign(mate.pos.x) : (plan.pos.x > 0 ? -1 : 1);
      plan.attackSide = side;
      mate.setTarget(side * (SH.ATTACK_POS.x + 0.3), s * 4.2);
      this.assignDefense(1 - player.team, null);
    } else if (kind === 'spike') {
      mate.setTarget(0, s * 4.5);
      this.setupBlock(plan);
    } else {
      mate.setTarget(0, s * 4.5);
      this.assignDefense(1 - player.team, null);
    }
  }

  // 守備側の基本配置（前衛 = ネットに近い方）
  assignDefense(team, attackX) {
    const tp = this.teamPlayers(team), s = this.side(team);
    const front = Math.abs(tp[0].pos.z) < Math.abs(tp[1].pos.z) ? tp[0] : tp[1];
    const back = this.mate(front);
    if (front !== this.letGo) front.setTarget(attackX == null ? SV.util.clamp(this.ball.p.x * 0.4, -2, 2) : attackX, s * (attackX == null ? 1.8 : 0.55));
    if (back !== this.letGo) back.setTarget(attackX == null ? 0 : -attackX * 0.35, s * 6.0);
    return { front, back };
  }

  setupBlock(plan) {
    const def = 1 - plan.team;
    const { front, back } = this.assignDefense(def, plan.pos.x);
    const blk = { player: front, digger: back, jumpAt: null };
    if (!front.human && SV.AI.willBlock()) blk.jumpAt = plan.tc - 0.4 + SV.util.rand(-0.06, 0.08);
    this.oppSpike = { plan, blk };
  }

  // ---------- 接触の解決 ----------
  resolve(plan, q) {
    const p = plan.player, b = this.ball, SH = SV.CONFIG.SHOT, P = SV.CONFIG.PLAYER;
    this.plan = null;
    this.fx.hideMarker();
    const reachR = P.REACH * (plan.kind === 'receive' ? 1.3 : 1);
    const dist = Math.hypot(p.pos.x - b.p.x, p.pos.z - b.p.z);
    const inAir = p.airborne && p.y > 0.2;
    let reached = dist <= reachR;
    if (plan.kind === 'spike' && q !== 'PUSH') reached = reached && (inAir || !p.human);
    if (plan.kind === 'spike' && q === 'PUSH') reached = reached && inAir;
    if (q === 'MISS' || !reached) {
      p.char.setPose(b.p.y < 1.2 ? 'dig' : 'bump', 0.5, 'ready');
      if (p.human) this.judge(p, 'MISS');
      SV.audio.play('swingMiss');
      this.oppSpike = null;
      return;
    }
    const s = p.s, team = p.team;
    this.lastTouchTeam = team;
    if (p.human) this.judge(p, q === 'PUSH' ? 'OK' : q);
    if (q === 'PERFECT' && p.human) SV.audio.play('perfect');

    if (plan.kind === 'receive') {
      const err = q === 'PERFECT' ? 0.2 : q === 'GOOD' ? 0.6 : 1.5;
      const low = b.p.y < 0.7 || plan.difficulty > 0.5;
      p.char.setPose(low ? 'dig' : 'bump', 0.45, 'ready');
      SV.audio.play('bump');
      this.fx.burst(b.p, 0xffffff, 8, 2.5, 0.25);
      const shank = q === 'OK' && plan.difficulty > 0.45 && Math.random() < 0.5;
      const mate = this.mate(p);
      if (shank) {
        b.launch({ x: SV.util.rand(-7, 7), y: 0.1, z: s * SV.util.rand(7, 12) }, 1.1);
      } else {
        const tx = mate.target.x + SV.util.rand(-err, err), tz = s * SH.SET_POS.z + s * SV.util.rand(-err * 0.3, err);
        b.launch({ x: tx, y: SH.CONTACT_SET, z: tz }, SH.RECEIVE_T * (q === 'OK' ? 1.1 : 1));
      }
      this.lastKind = 'receive';
      this.touch = { team, count: 1, last: p };
    } else if (plan.kind === 'set') {
      const low = b.p.y < 1.4;
      p.char.setPose(low ? 'bump' : 'setPush', 0.4, 'ready');
      SV.audio.play(low ? 'bump' : 'set');
      const err = q === 'PERFECT' ? 0.08 : q === 'GOOD' ? 0.3 : 0.9;
      const side = plan.attackSide || 1;
      this.setQ = q;
      b.launch({ x: side * SH.ATTACK_POS.x + SV.util.rand(-err, err), y: SH.CONTACT_SPIKE, z: s * (SH.ATTACK_POS.z + SV.util.rand(-err * 0.3, err * 0.5)) }, SH.SET_T);
      this.lastKind = 'set';
      this.touch = { team, count: 2, last: p };
    } else if (plan.kind === 'free') {
      p.char.setPose('bump', 0.45, 'ready');
      SV.audio.play('bump');
      this.safeLaunch({ x: SV.util.rand(-3, 3), y: 0.1, z: -s * SV.util.rand(3, 7) }, 1.45);
      this.lastKind = 'free';
      this.touch = { team, count: 3, last: p };
    } else if (plan.kind === 'spike') {
      this.doSpike(plan, q);
      return;
    }
    this.planNext();
  }

  doSpike(plan, q) {
    const p = plan.player, b = this.ball, SH = SV.CONFIG.SHOT, s = p.s, os = -s;
    let power; // super | strong | weak | feint
    if (p.human) power = q === 'PERFECT' ? 'super' : q === 'GOOD' ? 'strong' : q === 'OK' ? 'weak' : 'feint';
    else {
      const rate = SV.CONFIG.AI.SPIKE_SUPER_RATE * (this.setQ === 'PERFECT' ? 1.4 : 1);
      power = this.forceSuper || Math.random() < rate ? 'super' : Math.random() < 0.12 ? 'feint' : 'strong';
      this.forceSuper = false;
    }
    let tgt;
    const defenders = this.teamPlayers(1 - p.team);
    if (p.human && this.aim && this.aim.active) {
      tgt = { x: SV.util.clamp(this.aim.x * 3.4, -3.9, 3.9) + SV.util.rand(-0.4, 0.4), z: os * (this.aim.z < -0.3 ? 8.0 : this.aim.z > 0.3 ? 3.4 : 6.0) };
    } else tgt = SV.AI.spikeTarget(os, defenders);
    if (power === 'feint' || power === 'weak') tgt.z = os * SV.util.rand(2.0, 4.5);
    const T = { super: SH.SUPER_SPIKE_T, strong: SH.SPIKE_T, weak: SH.SPIKE_T * 1.45, feint: SH.FEINT_T }[power];
    p.char.setPose('spikeHit', 0.45, 'ready');
    const trail = power === 'super' ? 0xff6a1a : power === 'strong' ? 0xffffff : null;
    this.safeLaunch({ x: tgt.x, y: SV.CONFIG.PHYS.BALL_R, z: tgt.z }, T, trail);
    this.lastKind = power === 'super' ? 'super' : 'spike';
    this.lastTouchTeam = p.team;
    this.touch = { team: p.team, count: 3, last: p };
    if (power === 'super') {
      SV.audio.play('superSpike'); SV.audio.play('slowmo');
      this.slowReal = SV.CONFIG.SLOWMO_TIME;
      this.timeScale = SV.CONFIG.SLOWMO_SCALE;
      this.w.cam.setMode('cine', p.pos, s);
      this.w.cam.shake(1);
      SV.ui.banner('SUPER SPIKE!!', p.team === 0 ? 'blue' : 'red', 1.6);
      this.fx.burst(b.p, 0xff9a2a, 26, 7, 0.32);
      this.fx.burst(b.p, 0xffffff, 10, 5, 0.2);
      this.w.arena.cheer(1);
      SV.audio.play('cheer', 0.8);
    } else if (power === 'feint') {
      SV.audio.play('set');
      if (p.human) SV.ui.sub('フェイント');
    } else {
      SV.audio.play('spike');
      this.fx.burst(b.p, 0xffffff, 16, 4, 0.35);
      this.w.cam.shake(power === 'strong' ? 0.35 : 0.1);
      this.w.arena.cheer(0.5);
    }
    // ブロック判定（ボールがネット面を通過する時点で評価）
    const os2 = this.oppSpike;
    this.oppSpike = null;
    if (os2 && power !== 'feint') {
      const blocker = os2.blk.player;
      const tn = b.v.z !== 0 ? -b.p.z / b.v.z : -1;
      if (tn > 0) {
        const atNet = SV.util.posAt(b.p, b.v, tn, b.g);
        // ブロッカーがその時点で空中にいるか（現在の状態から簡易予測）
        const yAt = blocker.y + blocker.vy * tn - 6.5 * tn * tn;
        const inAir = blocker.airborne && yAt > 0.25;
        const near = Math.abs(blocker.pos.x - atNet.x) < SV.CONFIG.PLAYER.BLOCK_REACH_X;
        const high = atNet.y < SV.CONFIG.COURT.NET_H + 1.05;
        let ok = inAir && near && high;
        if (ok && !blocker.human) ok = SV.AI.blockSucceeds(power === 'super');
        if (ok && blocker.human) ok = Math.random() < (power === 'super' ? 0.4 : 0.75);
        if (ok) {
          this.blockEvent = { t: this.t + tn, pos: new THREE.Vector3(atNet.x, atNet.y, -s * 0.0 + s * 0.25), blocker, attacker: p, kill: yAt > 0.45 && Math.random() < 0.7 };
          return;
        }
      }
    }
    this.planNext();
  }

  doBlock(ev) {
    const b = this.ball, bl = ev.blocker, as = ev.attacker.s;
    this.blockEvent = null;
    b.p.copy(ev.pos);
    this.lastTouchTeam = bl.team;
    SV.audio.play('block');
    this.w.arena.shakeNet(1);
    this.w.cam.shake(0.6);
    this.fx.burst(b.p, 0x9fd4ff, 30, 5, 0.4);
    bl.char.setPose('block', 0.5, 'fist');
    if (ev.kill) {
      this.safeLaunch({ x: SV.util.rand(-3.5, 3.5), y: 0.1, z: as * SV.util.rand(1.0, 4.0) }, 0.5, 0x9fd4ff);
      SV.ui.banner('BLOCK!!', bl.team === 0 ? 'blue' : 'red', 1.4);
      this.lastKind = 'block';
      this.touch = { team: bl.team, count: 3, last: bl };
    } else {
      // ワンタッチ：自陣に高く上がる → 守備側がレシーブから組み立て
      b.launch({ x: SV.util.rand(-2.5, 2.5), y: 0.1, z: -as * SV.util.rand(3.5, 6.5) }, 1.5);
      SV.ui.sub('ワンタッチ！');
      this.lastKind = 'touch';
      this.touch = { team: ev.attacker.team, count: 3, last: ev.attacker };
    }
    this.w.arena.cheer(0.9);
    SV.audio.play('cheer', 0.7);
    this.planNext();
  }

  // ---------- 得点 ----------
  onBallNet() {
    SV.audio.play('net');
    this.w.arena.shakeNet(0.7);
    if (this.plan) { this.plan = null; this.fx.hideMarker(); }
  }

  onBallFloor(pos) {
    SV.audio.play('floor');
    if (this.phase !== 'rally') return;
    this.plan = null; this.blockEvent = null; this.oppSpike = null; this.letGo = null;
    this.fx.hideMarker(); this.fx.hideTiming();
    const sideTeam = pos.z >= 0 ? 0 : 1;
    const inCourt = !SV.AI.isOut(pos, SV.CONFIG.COURT.OUT_MARGIN);
    const winner = inCourt ? 1 - sideTeam : 1 - this.lastTouchTeam;
    this.fx.shockwave(pos, inCourt ? 0xffd27a : 0xff4a4a);
    this.fx.burst(new THREE.Vector3(pos.x, 0.2, pos.z), 0xffe0a0, 14, 3, 0.3);
    let msg;
    if (!inCourt) msg = 'OUT!';
    else if (winner === this.lastTouchTeam && this.lastKind === 'serve') msg = 'SERVICE ACE!';
    else if (winner === this.lastTouchTeam && this.lastKind === 'super') msg = 'KILL!!';
    else if (winner === this.lastTouchTeam && this.lastKind === 'spike') msg = 'NICE SPIKE!';
    else if (winner === this.lastTouchTeam && this.lastKind === 'block') msg = 'BLOCK POINT!';
    else msg = 'POINT!';
    this.awardPoint(winner, msg, pos);
  }

  awardPoint(winner, msg, pos) {
    this.score[winner]++;
    this.phase = 'point'; this.phaseT = 0;
    this.slowReal = 0; this.timeScale = 1;
    SV.audio.play('whistle');
    SV.audio.play('cheer', 1);
    const humanTeam = this.human ? this.human.team : 0;
    SV.audio.play('point', winner === humanTeam);
    this.w.arena.cheer(1);
    SV.ui.banner(msg, winner === 0 ? 'blue' : 'red', 1.8);
    SV.ui.score(this.score[0], this.score[1], winner);
    this.w.arena.setScore(this.score[0], this.score[1], msg);
    const wp = this.teamPlayers(winner);
    wp.forEach((p, i) => { p.char.setPose(i === 0 ? 'cheer' : 'fist'); p.look = this.w.camera.position; p.target.copy(p.pos); });
    this.teamPlayers(1 - winner).forEach((p) => { p.char.setPose('sad'); p.target.copy(p.pos); });
    const c = wp[0].pos.clone().add(wp[1].pos).multiplyScalar(0.5);
    this.w.cam.setMode('point', c, -this.side(winner));
    // サーブ権
    if (winner !== this.servingTeam) { this.servingTeam = winner; this.serverIdx[winner] = 1 - this.serverIdx[winner]; }
    // 終了判定
    const a = this.score[winner], b2 = this.score[1 - winner];
    this.ended = a >= this.pointsToWin && (!SV.CONFIG.MATCH.DEUCE || a - b2 >= 2);
    const mp = [0, 1].find((tm) => this.score[tm] === this.pointsToWin - 1 && this.score[tm] >= this.score[1 - tm]);
    SV.ui.matchPoint(!this.ended && mp !== undefined ? 'MATCH POINT' : '');
  }

  winGame() {
    const winner = this.score[0] > this.score[1] ? 0 : 1;
    this.phase = 'win'; this.phaseT = 0;
    this.winner = winner;
    const wp = this.teamPlayers(winner);
    // 勝者はコート中央付近に集まる
    wp[0].setTarget(-0.7, this.side(winner) * 3); wp[1].setTarget(0.7, this.side(winner) * 3);
    wp.forEach((p) => { p.char.setPose('cheer'); });
    this.teamPlayers(1 - winner).forEach((p) => p.char.setPose('sad'));
    const c = new THREE.Vector3(0, 0, this.side(winner) * 3);
    this.w.cam.setMode('win', c);
    this.fx.confettiBurst(c);
    SV.audio.play('fanfare');
    SV.audio.play('cheer', 1);
    this.w.arena.cheer(1);
    const humanWin = this.human ? winner === this.human.team : null;
    SV.ui.banner(this.demo ? (winner === 0 ? 'BLUE WINS!' : 'RED WINS!') : humanWin ? 'YOU WIN!' : 'YOU LOSE...', winner === 0 ? 'blue' : 'red', 3.5);
    this.w.arena.setScore(this.score[0], this.score[1], (winner === 0 ? 'BLUE' : 'RED') + ' WINS!');
  }

  judge(p, q) {
    if (!p.human) return;
    const col = { PERFECT: '#ffe14a', GOOD: '#6fff8a', OK: '#9fd4ff', MISS: '#ff6b6b' }[q] || '#fff';
    const sp = this.w.project(new THREE.Vector3(p.pos.x, p.y + 2.3, p.pos.z));
    SV.ui.judge(q, col, sp.x, sp.y);
  }

  // ---------- 毎フレーム ----------
  update(dt) {
    if (this.slowReal > 0) {
      this.slowReal -= dt;
      if (this.slowReal <= 0) { this.timeScale = 1; if (this.phase === 'rally') this.w.cam.setMode(this.demo ? 'demo' : 'play'); }
    }
    const sdt = dt * this.timeScale;
    this.t += sdt; this.phaseT += sdt;
    const H = this.human;
    const action = H ? SV.input.consumeAction() : false;
    const dir = H ? SV.input.dir() : { x: 0, z: 0, active: false };
    this.aim = dir;
    let manual = dir;

    if (this.phase === 'serveReady') {
      this.ball.hold(this.handPos(this.server));
      if (this.server.human) {
        manual = null;
        if (action || this.phaseT > 12) this.tossServe();
      } else if (this.phaseT > this.serveDelay) this.tossServe();
    } else if (this.phase === 'serveToss') {
      const tp = this.t - this.tossT, peak = 5.6 / this.ball.g;
      if (this.server.human) {
        manual = null;
        if (action && tp > 0.15) {
          const d = Math.abs(tp - peak);
          const T = SV.CONFIG.TIMING;
          this.hitServe(d < T.PERFECT * 1.6 ? 'PERFECT' : d < T.GOOD * 1.4 ? 'GOOD' : 'OK', dir);
        } else if (this.ball.p.y < 1.25 && this.ball.v.y < 0) this.hitServe('OK', dir);
      } else {
        if (!this.aiServeAt) this.aiServeAt = peak + SV.util.rand(-0.05, 0.05);
        if (tp >= this.aiServeAt) { this.aiServeAt = 0; this.hitServe(Math.random() < (this.demo ? 0.35 : 0.25) ? 'PERFECT' : 'GOOD', null); }
      }
      if (this.phase === 'serveToss' && tp > peak - 0.25) this.server.char.setPose('serveWind');
    } else if (this.phase === 'rally') {
      this.updateRally(action, dir);
      if (H && this.plan && this.plan.player === H && this.plan.kind === 'spike') manual = null;
    } else if (this.phase === 'point') {
      if (this.phaseT > SV.CONFIG.MATCH.POINT_PAUSE) {
        if (this.ended) this.winGame(); else this.setupServe();
      }
      manual = null;
    } else if (this.phase === 'win') {
      manual = null;
      if (this.phaseT > 1.5) this.teamPlayers(this.winner).forEach((p, i) => {
        // 勝利ジャンプ
        if (!p.airborne && Math.random() < dt * 1.5) { p.jump(4.5); p.char.setPose('cheer'); }
      });
      if (this.phaseT > (this.demo ? 7.5 : 4) && !this.endSent) { this.endSent = true; if (this.onEnd) this.onEnd(this.winner); }
    }
    if (this.phase !== 'win') this.endSent = false;

    this.players.forEach((p) => p.update(sdt, p.human ? manual : null, this.ball.p));
    this.ball.update(sdt);
    this.fx.update(sdt);
    this.updateHints();
  }

  updateRally(action, dir) {
    const H = this.human, plan = this.plan, T = SV.CONFIG.TIMING, now = this.t;
    // ブロックの到達
    if (this.blockEvent && now >= this.blockEvent.t) this.doBlock(this.blockEvent);

    // 相手スパイクに対するブロックジャンプ
    const osp = this.oppSpike;
    if (osp && this.plan === osp.plan) {
      const bl = osp.blk.player;
      // ブロッカーはアタッカーの正面へ（人間は手動でも可）
      bl.setTarget(SV.util.clamp(osp.plan.player.pos.x, -4, 4), bl.s * 0.55);
      if (!bl.human && osp.blk.jumpAt && now >= osp.blk.jumpAt && !bl.airborne) { bl.jump(SV.CONFIG.PLAYER.JUMP_V); bl.char.setPose('block', 0.8, 'ready'); osp.blk.jumpAt = null; SV.audio.play('jump'); }
      if (bl.human && action && !bl.airborne && Math.abs(bl.pos.z) < 3) {
        bl.jump(SV.CONFIG.PLAYER.JUMP_V); bl.char.setPose('block', 0.8, 'ready'); SV.audio.play('jump'); action = false;
      }
    }

    if (!plan) return;
    const p = plan.player;
    if (p.human) {
      if (action) {
        if (plan.kind === 'spike' && !plan.jumped) {
          if (!p.airborne) {
            plan.jumped = true;
            const tgt = { x: plan.pos.x, z: plan.pos.z + p.s * 0.35 };
            p.jump(SV.CONFIG.PLAYER.JUMP_V, tgt, 0.4);
            p.char.setPose('spikeWind'); SV.audio.play('jump');
          }
        } else {
          const d = now - plan.tc;
          if (d >= -T.OK && plan.pressT === null) {
            plan.pressT = now;
            if (plan.kind === 'spike') p.char.setPose('spikeHit', 0.45, 'ready');
            else if (plan.kind === 'set') p.char.setPose('set');
            else p.char.setPose('bump', 0.4, 'ready');
          } else if (d < -T.OK) {
            // 早すぎ：空振りモーション（もう一度押せる）
            if (plan.kind === 'spike') p.char.setPose('spikeWind'); else p.char.setPose(plan.kind === 'set' ? 'set' : 'bump', 0.25, 'ready');
          }
        }
      }
      if (now >= plan.tc) {
        if (plan.pressT !== null) {
          const d = Math.abs(plan.pressT - plan.tc);
          const q = d <= T.PERFECT ? 'PERFECT' : d <= T.GOOD ? 'GOOD' : 'OK';
          this.resolve(plan, q);
        } else if (now > plan.tc + T.OK) {
          this.resolve(plan, plan.kind === 'spike' && plan.jumped ? 'PUSH' : 'MISS');
        }
      }
    } else {
      // AI：構え・ジャンプ・接触
      const rem = plan.tc - now;
      if (plan.kind === 'spike') {
        if (rem < 1.0 && !plan.jumped) p.char.setPose('approach');
        if (rem <= 0.4 && !plan.jumped) {
          plan.jumped = true;
          p.jump(SV.CONFIG.PLAYER.JUMP_V, { x: plan.pos.x, z: plan.pos.z + p.s * 0.35 }, 0.4);
          p.char.setPose('spikeWind'); SV.audio.play('jump');
        }
      } else if (rem < 0.35) {
        p.char.setPose(plan.kind === 'set' ? 'set' : 'ready');
      }
      if (rem <= 0) this.resolve(plan, plan.aiQ);
    }
  }

  // 操作ヒントとタイミングリング
  updateHints() {
    const H = this.human;
    if (!H) { SV.ui.hint(''); this.fx.hideTiming(); return; }
    const k = (s) => `<span class="key">${s}</span>`;
    const A = 'Space / A';
    let hint = '', ring = null;
    if (this.phase === 'serveReady' && this.server === H) hint = `${k(A)} でトス`;
    else if (this.phase === 'serveToss' && this.server === H) hint = `一番高い所で ${k(A)}！ 矢印で狙い`;
    else if (this.phase === 'rally') {
      const pl = this.plan;
      if (pl && pl.player === H) {
        if (pl.kind === 'spike') {
          if (!pl.jumped) { hint = `${k(A)} でジャンプ！`; ring = pl.tc - 0.4 - this.t; }
          else { hint = `${k(A)} で打つ！ 矢印で狙い`; ring = pl.tc - this.t; }
        } else {
          hint = `輪が重なったら ${k(A)}（${pl.kind === 'set' ? 'トス' : 'レシーブ'}）`;
          ring = pl.tc - this.t;
        }
      } else if (this.oppSpike && this.oppSpike.blk.player === H && this.plan === this.oppSpike.plan) {
        hint = `${k(A)} でブロック！ ←→で位置`;
        ring = this.oppSpike.plan.tc - 0.4 - this.t;
      }
    }
    SV.ui.hint(hint);
    if (ring !== null && ring > -0.3) this.fx.showTiming(H.pos, ring); else this.fx.hideTiming();
  }
};
