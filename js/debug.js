// 開発用：URL パラメータで有効化
//   ?bot=1   … 人間操作を完璧なタイミングで自動入力（人間側コードパスの検証用）
//   ?play=1  … デモを飛ばして即試合開始
//   ?log=1   … 接触・得点イベントを SV.debug.log に記録し console に出す
SV.debug = (function () {
  const q = new URLSearchParams(location.search);
  const log = [];
  const press = (code) => {
    window.dispatchEvent(new KeyboardEvent('keydown', { code: code || 'Space' }));
    setTimeout(() => window.dispatchEvent(new KeyboardEvent('keyup', { code: code || 'Space' })), 30);
  };
  function install(match) {
    if (q.get('log') === '1' || q.get('bot') === '1') {
      const wrap = (name, fmt) => {
        const f = match[name].bind(match);
        match[name] = (...a) => { const e = [match.t.toFixed(2), name, ...fmt(...a)]; log.push(e); console.log(e.join(' ')); return f(...a); };
      };
      wrap('resolve', (p, qq) => [p.kind, 'T' + p.team + 'P' + p.player.idx, qq]);
      wrap('awardPoint', (w, msg) => ['team' + w, msg]);
      wrap('doBlock', (e) => [e.kill ? 'kill' : 'touch']);
      wrap('hitServe', (qq) => [qq]);
    }
    if (q.get('bot') === '1') {
      let last = null;
      const key = (k) => { if (last !== k) { last = k; press(); } };
      (function bot() {
        requestAnimationFrame(bot);
        const m = match, H = m.human;
        if (!H) return;
        const now = m.t;
        if (m.phase === 'serveReady' && m.server === H && m.phaseT > 0.6) key('toss' + m.score);
        if (m.phase === 'serveToss' && m.server === H && now - m.tossT >= SV.CONFIG.SHOT.SERVE_TOSS_V / m.ball.g - 0.02) key('serve' + m.tossT);
        const p = m.plan;
        if (m.phase === 'rally' && p && p.player === H) {
          if (p.kind === 'spike') {
            if (!p.jumped && p.tc - now <= SV.Match.JUMP_PEAK + 0.02) key('jump' + p.tc);
            if (p.jumped && p.tc - now <= 0.02) key('hit' + p.tc);
          } else if (p.tc - now <= 0.02) key('t' + p.tc);
        }
        const o = m.oppSpike;
        if (m.phase === 'rally' && o && o.blk.player === H && m.plan === o.plan && o.plan.tc - now <= SV.Match.JUMP_PEAK + 0.02) key('blk' + o.plan.tc);
      })();
    }
  }
  return { install, log, press, autoPlay: q.get('play') === '1' || q.get('bot') === '1' };
})();
