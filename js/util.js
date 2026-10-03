// 汎用ヘルパ（three.js 非依存のものと、弾道計算）
SV.util = (function () {
  const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  const lerp = (a, b, t) => a + (b - a) * t;
  const rand = (a, b) => a + Math.random() * (b - a);
  const randi = (a, b) => Math.floor(rand(a, b + 1));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const sign = (v) => (v < 0 ? -1 : 1);
  const smooth = (t) => t * t * (3 - 2 * t);
  // フレームレート非依存の指数減衰補間
  const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
  const dampAngle = (a, b, k, dt) => {
    let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
    if (d < -Math.PI) d += Math.PI * 2;
    return a + d * (1 - Math.exp(-k * dt));
  };

  // start から time 秒後に target に届く初速（重力 g、空気抵抗なし）
  function launchVelocity(start, target, time, g) {
    return {
      x: (target.x - start.x) / time,
      y: (target.y - start.y + 0.5 * g * time * time) / time,
      z: (target.z - start.z) / time,
    };
  }

  // 位置 p 速度 v のボールが「下降中に高さ h」を通過する時刻（無ければ -1）
  function timeToHeightDescending(p, v, h, g) {
    // p.y + v.y t - 0.5 g t^2 = h
    const a = -0.5 * g, b = v.y, c = p.y - h;
    const disc = b * b - 4 * a * c;
    if (disc < 0) return -1;
    const s = Math.sqrt(disc);
    const t1 = (-b + s) / (2 * a), t2 = (-b - s) / (2 * a);
    const t = Math.max(t1, t2);
    return t > 0 ? t : -1;
  }

  function posAt(p, v, t, g) {
    return { x: p.x + v.x * t, y: p.y + v.y * t - 0.5 * g * t * t, z: p.z + v.z * t };
  }

  return { clamp, lerp, rand, randi, pick, sign, smooth, damp, dampAngle, launchVelocity, timeToHeightDescending, posAt };
})();
