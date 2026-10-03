// キャラクター定義（見た目・個性）。キャラの追加・差し替えはこのファイルだけで完結させる。
// 個人で楽しむためのファン制作キャラ（某バレー漫画の4人の雰囲気）。作品名・ロゴは使用しない。
//
// 見た目パラメータ:
//   hairStyle: short | pony | spiky | bob | hinata | kageyama | oikawa | ushijima
//   eye: round | sharp   brow: up | angry | calm | flat   mouth: grin | smile | frown | line
//   height: 全身の倍率  build: 肩幅の倍率  lefty: 左利き（スパイクの腕が逆）
// 個性パラメータ（AI 操作時に使用）:
//   superRate: スーパースパイク率  serveStrong: ジャンプサーブ率
//   setter: トスが常に高精度  quickSet: 相手が quickHitter なら速攻トス
SV.TEAMS = [
  // name は HUD 表示名。css/css2 はスコアボードのグラデーション、mark は着地マーカー色
  { name: 'CROWS', css: '#ff7a1a', css2: '#1b1b20', mark: 0xff9a3c },
  { name: 'RIVALS', css: '#25b8aa', css2: '#6a3fa0', mark: 0x3fd8c8 },
];

SV.UNIFORMS = {
  crows: { main: 0x1b1b20, sub: 0xff7a1a, accent: 0x141418, num: '#ffffff' },     // 黒 × オレンジ
  seijoh: { main: 0xf4f6f8, sub: 0x25b8aa, accent: 0x1d2b4a, num: '#25b8aa' },    // 白 × ターコイズ
  shira: { main: 0xf4f4f6, sub: 0x6a3fa0, accent: 0x3a2366, num: '#6a3fa0' },     // 白 × 紫
};

SV.ROSTER = [
  { // チーム0 - 人間が操作
    name: 'HINATA', number: 10, team: 0, colors: SV.UNIFORMS.crows,
    skin: 0xf7c09a, hair: 0xff7f1f, hairStyle: 'hinata', iris: 0x9a5418, browColor: 0xc85a14,
    eye: 'round', brow: 'up', mouth: 'grin', height: 0.9, build: 0.92,
    superRate: 0.4, quickHitter: true,
  },
  {
    name: 'KAGEYAMA', number: 9, team: 0, colors: SV.UNIFORMS.crows,
    skin: 0xf0bb98, hair: 0x101016, hairStyle: 'kageyama', iris: 0x1d2c66, browColor: 0x101016,
    eye: 'sharp', brow: 'angry', mouth: 'frown', height: 1.03, build: 1.0,
    setter: true, quickSet: true, serveStrong: 0.5, superRate: 0.3,
  },
  { // チーム1
    name: 'OIKAWA', number: 1, team: 1, colors: SV.UNIFORMS.seijoh,
    skin: 0xf3c29f, hair: 0x6e4126, hairStyle: 'oikawa', iris: 0x7a4426, browColor: 0x4a2a18,
    eye: 'round', brow: 'calm', mouth: 'smile', height: 1.04, build: 1.0,
    setter: true, serveStrong: 0.65, superRate: 0.35,
  },
  {
    name: 'USHIJIMA', number: 1, team: 1, colors: SV.UNIFORMS.shira,
    skin: 0xe2ae86, hair: 0x4a3f26, hairStyle: 'ushijima', iris: 0x55502a, browColor: 0x2e2818,
    eye: 'sharp', brow: 'flat', mouth: 'line', height: 1.07, build: 1.14,
    lefty: true, superRate: 0.65, serveStrong: 0.4,
  },
];
