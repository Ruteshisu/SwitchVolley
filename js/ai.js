// AI の判断ロジック（純粋な関数群。試合状態は引数でもらう）
SV.AI = (function () {
  const A = () => SV.CONFIG.AI;
  const C = () => SV.CONFIG.COURT;
  const U = SV.util;

  // 難しさ 0〜1 → 成功するか
  function receiveSuccess(difficulty, bonus) {
    const p = U.lerp(A().RECEIVE_EASY, A().RECEIVE_HARD, U.clamp(difficulty, 0, 1)) + (bonus || 0);
    return Math.random() < p;
  }

  // 成功時の質（PERFECT か GOOD）
  function quality(success) {
    if (!success) return 'MISS';
    return Math.random() < 0.3 ? 'PERFECT' : 'GOOD';
  }

  // 相手コート（side = 相手側の z 符号）で、守備者から遠い所を狙う
  function spikeTarget(side, defenders) {
    const cands = [];
    for (const x of [-3.6, -2.0, 0, 2.0, 3.6]) for (const d of [4.5, 6.5, 8.2]) cands.push({ x, z: side * d });
    let best = null, bestScore = -1e9;
    cands.forEach((c) => {
      let score = 0;
      defenders.forEach((p) => { score += Math.min(4, Math.hypot(p.pos.x - c.x, p.pos.z - c.z)); });
      score += Math.random() * 2.5;
      if (score > bestScore) { bestScore = score; best = c; }
    });
    return best;
  }

  function serveTarget(side) {
    return { x: U.rand(-3.6, 3.6), z: side * U.rand(4.5, 8.3) };
  }

  // 見送り判定：アウトになる球には触らない
  function isOut(pos, margin) {
    const m = margin || 0;
    return Math.abs(pos.x) > C().HALF_W + m || Math.abs(pos.z) > C().HALF_L + m;
  }

  function willBlock() { return Math.random() < A().BLOCK_RATE; }
  function blockSucceeds(isSuper) { return Math.random() < A().BLOCK_SUCCESS * (isSuper ? 0.45 : 1); }

  return { receiveSuccess, quality, spikeTarget, serveTarget, isOut, willBlock, blockSucceeds };
})();
