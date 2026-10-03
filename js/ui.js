// HUD / オーバーレイの表示制御（DOM 操作はここに集約）
SV.ui = (function () {
  const $ = (id) => document.getElementById(id);
  let bannerTimer = 0, subTimer = 0;

  function banner(text, cls, dur) {
    const b = $('banner');
    b.className = '';
    b.textContent = text;
    void b.offsetWidth; // アニメ再始動
    b.className = 'show ' + (cls || '');
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(() => b.classList.remove('show'), (dur || 1.4) * 1000);
  }
  function sub(text, dur) {
    const s = $('subBanner');
    s.textContent = text; s.classList.add('show');
    clearTimeout(subTimer);
    subTimer = setTimeout(() => s.classList.remove('show'), (dur || 1.6) * 1000);
  }
  function hint(html) {
    const h = $('hint');
    if (!html) { h.classList.remove('show'); return; }
    if (h._html !== html) { h.innerHTML = html; h._html = html; }
    h.classList.add('show');
  }
  // 判定文字（PERFECT など）を画面座標に出す
  function judge(text, color, x, y) {
    const j = $('judge');
    j.classList.remove('show');
    j.textContent = text; j.style.color = color || '#fff';
    j.style.left = x + 'px'; j.style.top = y + 'px';
    void j.offsetWidth;
    j.classList.add('show');
  }
  function score(a, b, serving) {
    const sa = $('scoreA'), sb = $('scoreB');
    if (sa.textContent !== String(a)) { sa.textContent = a; sa.classList.remove('bump'); void sa.offsetWidth; sa.classList.add('bump'); }
    if (sb.textContent !== String(b)) { sb.textContent = b; sb.classList.remove('bump'); void sb.offsetWidth; sb.classList.add('bump'); }
    $('serveInfo').textContent = serving === 0 ? '◀ SERVE' : 'SERVE ▶';
  }
  function matchPoint(text) { $('matchPoint').textContent = text || ''; }
  function title(show, compact) {
    const t = $('title');
    t.classList.toggle('hidden', !show);
    t.querySelector('.logo').style.display = compact ? 'none' : '';
    t.querySelector('.tag').style.display = compact ? 'none' : '';
    t.querySelector('.howto').style.display = compact ? 'none' : '';
    t.style.justifyContent = compact ? 'flex-end' : 'center';
    t.style.paddingBottom = compact ? '70px' : '0';
  }
  function demoTag(on) { $('demoTag').classList.toggle('on', on); }
  function pause(show) { $('pause').classList.toggle('hidden', !show); }
  function result(show, text, sc) {
    $('result').classList.toggle('hidden', !show);
    if (text) $('resultText').textContent = text;
    if (sc) $('resultScore').textContent = sc;
  }
  function soundNote(show) { $('soundNote').classList.toggle('hidden', !show); }
  function scoreboard(show) { $('scoreboard').style.display = show ? '' : 'none'; }

  return { banner, sub, hint, judge, score, matchPoint, title, demoTag, pause, result, soundNote, scoreboard };
})();
