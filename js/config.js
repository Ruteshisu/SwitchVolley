// ゲーム全体の定数。バランス調整はこのファイルだけで完結させる。
window.SV = window.SV || {};

SV.CONFIG = {
  WIDTH: 1280,
  HEIGHT: 720,

  // コート（m）。ネットは z=0。手前 z>0 がチーム0(青)、奥 z<0 がチーム1(赤)
  COURT: {
    HALF_W: 4.5,          // x: -4.5〜4.5
    HALF_L: 9.0,          // z: -9〜9
    ATTACK_LINE: 3.0,
    NET_H: 2.43,
    NET_HALF_W: 5.2,
    OUT_MARGIN: 0.05,     // ライン上はイン
  },

  PHYS: {
    GRAVITY: 9.8,         // ボールの重力（見やすさのため実際より少し小さめでも可）
    BALL_R: 0.11,
    BOUNCE: 0.55,
    FRICTION: 0.75,
  },

  // 打球の滞空時間（秒）と高さ
  SHOT: {
    SERVE_T: 1.55, SERVE_STRONG_T: 1.05,
    RECEIVE_T: 1.25,      // レシーブ → セッター
    SET_T: 1.05,          // トス → アタッカー
    QUICK_SET_T: 0.72,    // 速攻トス（低く速い）
    SPIKE_T: 0.62, SUPER_SPIKE_T: 0.42, FEINT_T: 1.1,
    SERVE_TOSS_V: 5.6,    // サーブトスの打ち上げ速度
    CONTACT_LOW: 0.85,    // レシーブ接触高さ
    CONTACT_SET: 2.1,     // トス接触高さ
    CONTACT_SPIKE: 2.95,  // スパイク打点
    SET_POS: { x: 0.4, z: 1.0 },   // セッター位置（自コート側の符号は自動）
    ATTACK_POS: { x: 2.4, z: 1.3 },
  },

  // 人間の入力タイミング窓（秒）: 接触時刻との差
  TIMING: {
    PERFECT: 0.075,
    GOOD: 0.17,
    OK: 0.3,
    SERVE_PERFECT: 0.12,    // サーブはトス頂点との差で判定
    SERVE_GOOD: 0.24,
  },

  PLAYER: {
    SPEED: 6.2,           // 自動移動速度 m/s
    MANUAL_SPEED: 5.0,
    REACH: 1.15,          // 接触可能な水平距離
    JUMP_V: 5.2,          // ジャンプ初速
    JUMP_G: 13,           // キャラの重力 → 頂点 約1.04m / 0.4秒後
    BLOCK_REACH_X: 0.85,
  },

  AI: {
    // 成功率（難しさ 0〜1 に対して線形補間）
    RECEIVE_EASY: 0.97, RECEIVE_HARD: 0.42,
    SET_SUCCESS: 0.97,
    SPIKE_SUPER_RATE: 0.45,   // AI がスーパースパイクを打つ割合
    BLOCK_RATE: 0.55,         // ブロックに跳ぶ割合
    BLOCK_SUCCESS: 0.45,      // 位置が合った時の成功率
    REACTION: 0.18,
  },

  MATCH: {
    POINTS: 7,
    DEMO_POINTS: 3,
    DEUCE: false,
    POINT_PAUSE: 2.4,         // 得点後の間（秒）
  },

  AUTO_MOVE: true,
  SLOWMO_SCALE: 0.22,
  SLOWMO_TIME: 1.1,           // 実時間秒
  // チーム名・色・キャラは js/roster.js
};
