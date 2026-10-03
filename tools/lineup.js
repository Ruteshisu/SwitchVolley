// 開発用：キャラ4人を正面から並べて見た目を確認する（ブラウザのコンソールに貼り付けて実行）
// 使い方: http://localhost:8765/?play=1 を開き、このファイルの中身をコンソールで実行
(function () {
  const m = SV.match, w = SV.world;
  m.update = function () {};
  w.cam.update = function () {};
  w.camera.position.set(0, 1.75, 1.2);
  w.camera.lookAt(0, 1.35, 6);
  document.getElementById('hud').style.display = 'none';
  const xs = [-1.65, -0.55, 0.55, 1.65];
  m.players.forEach((p, i) => {
    p.char.root.position.set(xs[i], 0, 4.6);
    p.char.setPose('idle');
    for (let k = 0; k < 60; k++) p.char.update(0.05, 0, false);
    p.char.root.rotation.y = Math.PI;
  });
  w.ball.mesh.visible = false;
})();
