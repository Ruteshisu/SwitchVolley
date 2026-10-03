// 起動・メインループ・モード管理（demo / play / pause / result）
(function () {
  const CFG = SV.CONFIG;
  const stage = document.getElementById('stage');

  // ---- 画面フィット（内部は常に 1280x720） ----
  function fit() {
    const s = Math.min(window.innerWidth / CFG.WIDTH, window.innerHeight / CFG.HEIGHT);
    stage.style.transform = `scale(${s})`;
    stage.style.left = (window.innerWidth - CFG.WIDTH * s) / 2 + 'px';
    stage.style.top = (window.innerHeight - CFG.HEIGHT * s) / 2 + 'px';
  }
  // resize イベントが来ない環境（埋め込み・エミュレーション）もあるので毎フレームもサイズ監視
  let lastW = 0, lastH = 0;
  function fitIfChanged() {
    if (window.innerWidth !== lastW || window.innerHeight !== lastH) { lastW = window.innerWidth; lastH = window.innerHeight; fit(); }
  }
  window.addEventListener('resize', fit);
  fitIfChanged();

  if (typeof THREE === 'undefined') {
    document.getElementById('gl').innerHTML = '<div style="color:#fff;padding:40px;font-size:24px">three.js を読み込めませんでした（ネット接続を確認してください）</div>';
    return;
  }

  // ---- three.js 初期化 ----
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
  renderer.setSize(CFG.WIDTH, CFG.HEIGHT, false);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputEncoding = THREE.sRGBEncoding;
  document.getElementById('gl').appendChild(renderer.domElement);
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, CFG.WIDTH / CFG.HEIGHT, 0.1, 200);

  const world = { scene, camera };
  world.arena = new SV.Arena(scene);
  world.ball = new SV.Ball(scene);
  world.effects = new SV.Effects(scene);
  world.cam = new SV.CameraRig(camera);
  const _v = new THREE.Vector3();
  world.project = (p) => {
    _v.copy(p).project(camera);
    return { x: (_v.x + 1) / 2 * CFG.WIDTH, y: (1 - _v.y) / 2 * CFG.HEIGHT };
  };
  const match = new SV.Match(world);
  SV.match = match; SV.world = world; // デバッグ用

  // ---- モード管理 ----
  let mode = 'demo', paused = false, demoT = 0, guard = 0;

  function startDemo() {
    mode = 'demo'; paused = false; demoT = 0;
    match.start({ demo: true, points: CFG.MATCH.DEMO_POINTS });
    SV.ui.title(true, false); SV.ui.demoTag(true); SV.ui.result(false); SV.ui.pause(false);
    world.cam.update(0.016, world.ball); world.cam.snap();
  }
  function startGame() {
    mode = 'play'; paused = false; guard = 0.4;
    SV.input.clearAction();
    match.start({ demo: false, points: CFG.MATCH.POINTS });
    SV.ui.title(false); SV.ui.demoTag(false); SV.ui.result(false); SV.ui.pause(false);
    SV.audio.play('whistle');
  }
  function toTitle() { SV.audio.play('ui'); startDemo(); }
  function setPause(v) {
    if (mode !== 'play') return;
    paused = v; SV.ui.pause(v);
  }
  match.onEnd = (winner) => {
    if (mode === 'demo') { startDemo(); return; }
    if (SV.debug.autoPlay) { startGame(); return; }
    mode = 'result';
    const win = winner === 0;
    SV.ui.result(true, win ? 'YOU WIN!' : 'YOU LOSE...', `${match.score[0]} - ${match.score[1]}`);
  };

  // ---- 入力イベント ----
  SV.input.setupVirtualPad();
  SV.input.on('any', () => {
    SV.audio.unlock();
    SV.ui.soundNote(false);
    if (mode === 'demo' && demoT > 0.3) startGame();
  });
  SV.input.on('start', () => { if (mode === 'result') { SV.audio.play('ui'); startGame(); } });
  SV.input.on('pause', () => {
    if (mode === 'play') setPause(!paused);
    else if (mode === 'result') toTitle();
  });
  SV.input.on('mute', () => { const m = SV.audio.toggleMute(); document.getElementById('vMute').textContent = m ? '×' : '♪'; });
  document.querySelectorAll('.menu button').forEach((b) => b.addEventListener('click', (e) => {
    e.stopPropagation();
    SV.audio.unlock();
    const a = b.dataset.act;
    if (a === 'resume') setPause(false);
    if (a === 'retry') startGame();
    if (a === 'title') toTitle();
  }));
  document.querySelectorAll('.menu button').forEach((b) => b.addEventListener('pointerdown', (e) => e.stopPropagation()));

  // ---- ループ ----
  SV.debug.install(match);
  if (SV.debug.autoPlay) startGame(); else startDemo();
  let last = performance.now();
  function loop(now) {
    requestAnimationFrame(loop);
    fitIfChanged();
    let dt = (now - last) / 1000; last = now;
    if (dt > 0.05) dt = 0.05; // タブ復帰時などの大ジャンプを抑制
    if (mode === 'demo') {
      demoT += dt;
      if (demoT > 4 && demoT - dt <= 4) SV.ui.title(true, true); // ロゴを畳んでデモを見せる
    }
    if (guard > 0) { guard -= dt; SV.input.clearAction(); }
    if (!paused) {
      match.update(dt);
      world.arena.update(dt);
      world.cam.update(dt * (match.timeScale < 1 ? 0.6 : 1), world.ball);
    }
    renderer.render(scene, camera);
  }
  requestAnimationFrame(loop);
})();
