// 入力の統一層：キーボードと仮想パッドを「方向(dx,dz) + アクション」にまとめる
// ゲーム側は SV.input.dir / SV.input.consumeAction() だけを見ればよい。
SV.input = (function () {
  const keys = {};
  const vdir = { up: false, down: false, left: false, right: false };
  let actionQueued = false, actionHeld = false;
  const listeners = { any: [], start: [], pause: [], mute: [] };
  const on = (ev, fn) => listeners[ev].push(fn);
  const emit = (ev) => listeners[ev].forEach((f) => f());

  const ACTION_KEYS = ['Space', 'KeyJ', 'KeyZ', 'KeyK'];
  window.addEventListener('keydown', (e) => {
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    const first = !keys[e.code];
    keys[e.code] = true;
    emit('any');
    if (!first) return;
    if (ACTION_KEYS.includes(e.code)) { actionQueued = true; actionHeld = true; }
    if (e.code === 'Enter') emit('start');
    if (e.code === 'KeyP' || e.code === 'Escape') emit('pause');
    if (e.code === 'KeyM') emit('mute');
  });
  window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
    if (ACTION_KEYS.includes(e.code)) actionHeld = false;
  });
  window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });
  document.getElementById('stage').addEventListener('pointerdown', () => emit('any'));

  // ---- 仮想パッド ----
  function setupVirtualPad() {
    const pad = document.getElementById('vpad');
    const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0 || matchMedia('(pointer: coarse)').matches;
    if (isTouch || /[?&]pad=1/.test(location.search)) pad.classList.remove('hidden');

    // 十字キー：指の位置から方向を判定（斜め・スライド対応）
    const dpad = document.getElementById('dpad');
    const btns = dpad.querySelectorAll('.dbtn');
    const updateFromPoint = (pts) => {
      vdir.up = vdir.down = vdir.left = vdir.right = false;
      const r = dpad.getBoundingClientRect();
      pts.forEach((p) => {
        const dx = (p.x - (r.left + r.width / 2)) / (r.width / 2);
        const dy = (p.y - (r.top + r.height / 2)) / (r.height / 2);
        if (Math.hypot(dx, dy) < 0.2) return;
        if (dx < -0.35) vdir.left = true;
        if (dx > 0.35) vdir.right = true;
        if (dy < -0.35) vdir.up = true;
        if (dy > 0.35) vdir.down = true;
      });
      btns.forEach((b) => b.classList.toggle('on', vdir[b.dataset.dir]));
    };
    const active = new Map();
    const dpadPts = () => [...active.values()];
    dpad.addEventListener('pointerdown', (e) => { e.preventDefault(); dpad.setPointerCapture(e.pointerId); active.set(e.pointerId, { x: e.clientX, y: e.clientY }); updateFromPoint(dpadPts()); emit('any'); });
    dpad.addEventListener('pointermove', (e) => { if (active.has(e.pointerId)) { active.set(e.pointerId, { x: e.clientX, y: e.clientY }); updateFromPoint(dpadPts()); } });
    const up = (e) => { active.delete(e.pointerId); updateFromPoint(dpadPts()); };
    dpad.addEventListener('pointerup', up); dpad.addEventListener('pointercancel', up);

    const a = document.getElementById('abtn');
    a.addEventListener('pointerdown', (e) => { e.preventDefault(); actionQueued = true; actionHeld = true; a.classList.add('on'); emit('any'); emit('start'); });
    const aup = () => { actionHeld = false; a.classList.remove('on'); };
    a.addEventListener('pointerup', aup); a.addEventListener('pointercancel', aup); a.addEventListener('pointerleave', aup);
    document.getElementById('vPause').addEventListener('pointerdown', (e) => { e.preventDefault(); emit('pause'); });
    document.getElementById('vMute').addEventListener('pointerdown', (e) => { e.preventDefault(); emit('any'); emit('mute'); });
  }

  // カメラ視点基準の方向（右 = +x、上 = 奥 = -z）
  function dir() {
    let x = 0, z = 0;
    if (keys.ArrowLeft || keys.KeyA || vdir.left) x -= 1;
    if (keys.ArrowRight || keys.KeyD || vdir.right) x += 1;
    if (keys.ArrowUp || keys.KeyW || vdir.up) z -= 1;
    if (keys.ArrowDown || keys.KeyS || vdir.down) z += 1;
    const l = Math.hypot(x, z) || 1;
    return { x: x / l, z: z / l, active: x !== 0 || z !== 0 };
  }

  function consumeAction() { const a = actionQueued; actionQueued = false; return a; }
  function clearAction() { actionQueued = false; }

  return { on, dir, consumeAction, clearAction, setupVirtualPad, get held() { return actionHeld; } };
})();
