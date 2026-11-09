/* ============================================================
   琵琶曲：一腚定音  PIPA PANIC
   A cartoon shooting-gallery roguelite prototype.
   Runs both as a WeChat Mini Game (game.js entry) and in a browser.
   All art is drawn procedurally on Canvas 2D. No external images.
   ============================================================ */
(function () {
  'use strict';

  var HAS_WX = typeof wx !== 'undefined' && typeof wx.createCanvas === 'function';
  var TAU = Math.PI * 2;
  var DESIGN_W = 390;
  var DESIGN_H = 844;
  var SAVE_KEY = 'pipa-panic-save-v1';
  var RUN_TIME = 75;

  function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }
  function lerp(a, b, t) { return a + (b - a) * t; }
  function rand(a, b) { return a + Math.random() * (b - a); }
  function randi(a, b) { return Math.floor(rand(a, b + 1)); }
  function choice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
  function dist(x1, y1, x2, y2) { var dx = x2 - x1, dy = y2 - y1; return Math.sqrt(dx * dx + dy * dy); }
  function fmt(n) { return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function pad2(n) { return n < 10 ? '0' + n : String(n); }
  function easeOutCubic(t) { t = clamp(t, 0, 1); return 1 - Math.pow(1 - t, 3); }
  function easeOutBack(t) { t = clamp(t, 0, 1); var c = 1.70158; return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2); }
  function rgba(hex, a) {
    var h = hex.replace('#', '');
    if (h.length === 3) h = h[0] + h[0] + h[1] + h[1] + h[2] + h[2];
    var n = parseInt(h, 16);
    return 'rgba(' + ((n >> 16) & 255) + ',' + ((n >> 8) & 255) + ',' + (n & 255) + ',' + a + ')';
  }
  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ------------------------------------------------------------
     Data
     ------------------------------------------------------------ */
  var SKINS = [
    {
      id: 'suit', name: '西装暴徒', short: '西装', cost: 0,
      role: '经典接弹人', desc: '黑西装、红领带，屁股练过。',
      perkText: '均衡体质 · 无加成', perk: {},
      head: 'suit', body: 'suit', butt: 'suit',
      skin: '#e4ad86', skinDark: '#b9795f', hair: '#171018',
      suit: '#17141c', suitLight: '#302935', accent: '#cf3f35',
      buttColor: '#17131b', buttLight: '#45313a', trim: '#f0c36a'
    },
    {
      id: 'niulai', name: '牛来', short: '牛来', cost: 600,
      role: '橘色牛魔王', desc: '皮糙肉厚，牛气冲天。',
      perkText: '牛气冲天 · 得分 +12%', perk: { score: 0.12 },
      head: 'cow', body: 'suit', butt: 'suit',
      skin: '#ef9f3d', skinDark: '#c86e22', hair: '#2c1510',
      suit: '#19141b', suitLight: '#342b30', accent: '#f0c15a',
      buttColor: '#17131b', buttLight: '#45343a', trim: '#f4cd78'
    },
    {
      id: 'feidudu', name: '肥嘟嘟', short: '肥嘟嘟', cost: 1400,
      role: '黄色袋鼠', desc: '圆肚皮、大鼻子，胆子真的很肥。',
      perkText: '财迷体质 · 金币 +12%', perk: { coin: 0.12 },
      head: 'roo', body: 'fur', butt: 'fur',
      skin: '#f1c33d', skinDark: '#c88f1b', hair: '#3b2810',
      suit: '#17131b', suitLight: '#302735', accent: '#ef5b3c',
      buttColor: '#f1c33d', buttLight: '#ffe278', trim: '#ffd868'
    },
    {
      id: 'doubao', name: '豆包', short: '豆包', cost: 2400,
      role: '豆形机器人', desc: '算力很高，防御很低，屁股是白的。',
      perkText: '冷静算力 · 暴击 +6%', perk: { crit: 0.06 },
      head: 'bot', body: 'bot', butt: 'armor',
      skin: '#f2f3ef', skinDark: '#bcc9c9', hair: '#3a4c50',
      suit: '#e8eeec', suitLight: '#ffffff', accent: '#4bd2d6',
      buttColor: '#eef3f1', buttLight: '#ffffff', trim: '#6de1e2'
    }
  ];

  var UPGRADES = [
    { key: 'damage', name: '枪管抛光', desc: '伤害 +22%', max: 6, cost: 90, color: '#ff7358' },
    { key: 'rate', name: '快手扳机', desc: '射速 +12%', max: 6, cost: 90, color: '#ffc558' },
    { key: 'buttRadar', name: '臀部雷达', desc: '打臀判定 +14%', max: 4, cost: 110, color: '#ff91b8' },
    { key: 'buttMult', name: '双倍快乐', desc: '打臀倍率 +0.5×', max: 3, cost: 150, color: '#ffb15e' },
    { key: 'gold', name: '金币嗅觉', desc: '金币收益 +25%', max: 5, cost: 100, color: '#ffd66e' },
    { key: 'crit', name: '暴击火药', desc: '暴击率 +7%', max: 5, cost: 120, color: '#ff5d7e' },
    { key: 'mag', name: '扩容弹巢', desc: '弹匣 +2 发', max: 4, cost: 80, color: '#9edbd7' },
    { key: 'echo', name: '余音绕梁', desc: '15% 不消耗子弹', max: 3, cost: 100, color: '#8ed0ff' },
    { key: 'double', name: '双管齐下', desc: '12% 追加一颗子弹', max: 3, cost: 140, color: '#ffb6e6' }
  ];

  var QUOTES = {
    butt: ['嗷！', '正中靶心！', '这也能接？', '屁股不同意！', '再来！'],
    head: ['别打脸！', '说好了打屁股！', '不讲武德！', '发型乱了！'],
    body: ['没感觉。', '就这？', '没吃饭？', '往下面打！'],
    miss: ['歪了。', '你在瞄哪？', '子弹不要钱？'],
    start: ['就这？', '快点，赶时间。', '今天状态不错。']
  };

  /* ------------------------------------------------------------
     Save
     ------------------------------------------------------------ */
  var DEFAULT_SAVE = {
    coins: 0, best: 0, gunLevel: 1, unlocked: ['suit'], skin: 'suit',
    muted: false, plays: 0, bestCombo: 0, bestButtRate: 0
  };

  function loadSave() {
    var raw = null;
    try {
      if (HAS_WX && wx.getStorageSync) raw = wx.getStorageSync(SAVE_KEY);
      else if (typeof localStorage !== 'undefined') raw = localStorage.getItem(SAVE_KEY);
    } catch (e) { raw = null; }
    var s = {};
    for (var k in DEFAULT_SAVE) if (Object.prototype.hasOwnProperty.call(DEFAULT_SAVE, k)) s[k] = DEFAULT_SAVE[k];
    s.unlocked = ['suit'];
    if (raw) {
      try {
        var parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
        if (parsed && typeof parsed === 'object') {
          for (var k2 in s) if (Object.prototype.hasOwnProperty.call(parsed, k2)) s[k2] = parsed[k2];
        }
      } catch (e2) {}
    }
    if (!Array.isArray(s.unlocked)) s.unlocked = ['suit'];
    if (s.unlocked.indexOf('suit') < 0) s.unlocked.unshift('suit');
    s.coins = Math.max(0, Number(s.coins) || 0);
    s.best = Math.max(0, Number(s.best) || 0);
    s.gunLevel = clamp(Math.floor(Number(s.gunLevel) || 1), 1, 12);
    s.muted = !!s.muted;
    s.plays = Math.max(0, Number(s.plays) || 0);
    s.bestCombo = Math.max(0, Number(s.bestCombo) || 0);
    s.bestButtRate = clamp(Number(s.bestButtRate) || 0, 0, 1);
    if (SKINS.every(function (x) { return x.id !== s.skin; })) s.skin = 'suit';
    if (s.unlocked.indexOf(s.skin) < 0) s.skin = 'suit';
    return s;
  }

  function persist() {
    if (game.demo) return;
    try {
      var raw = JSON.stringify(game.save);
      if (HAS_WX && wx.setStorageSync) wx.setStorageSync(SAVE_KEY, raw);
      else if (typeof localStorage !== 'undefined') localStorage.setItem(SAVE_KEY, raw);
    } catch (e) {}
  }

  function detectDemo() {
    try {
      if (HAS_WX && wx.getLaunchOptionsSync) {
        var q = wx.getLaunchOptionsSync().query || {};
        if (q.demo === '1') return true;
      }
      if (!HAS_WX && typeof location !== 'undefined') {
        return /(?:[?&])demo=1(?:&|$)/.test(location.search);
      }
    } catch (e) {}
    return false;
  }

  /* ------------------------------------------------------------
     Canvas + stage
     ------------------------------------------------------------ */
  var canvas = HAS_WX ? wx.createCanvas() : document.getElementById('game');
  var ctx = canvas.getContext('2d');
  var dpr = 1;
  var viewW = DESIGN_W;
  var viewH = DESIGN_H;
  var stage = { x: 0, y: 0, scale: 1, w: DESIGN_W, h: DESIGN_H };
  var bgSurface = null;
  var noisePoints = [];

  function createSurface(w, h) {
    var c = null;
    try {
      if (HAS_WX && wx.createOffscreenCanvas) {
        c = wx.createOffscreenCanvas({ type: '2d', width: w, height: h });
      } else if (!HAS_WX && typeof document !== 'undefined') {
        c = document.createElement('canvas');
        c.width = w; c.height = h;
      }
    } catch (e) { c = null; }
    if (c && !c.width) c.width = w;
    if (c && !c.height) c.height = h;
    return c;
  }

  function resize() {
    var info = { windowWidth: DESIGN_W, windowHeight: DESIGN_H, pixelRatio: 1 };
    if (HAS_WX) {
      try { info = wx.getSystemInfoSync(); } catch (e) {}
    } else {
      info.windowWidth = window.innerWidth;
      info.windowHeight = window.innerHeight;
      info.pixelRatio = window.devicePixelRatio || 1;
    }
    viewW = Math.max(280, info.windowWidth || DESIGN_W);
    viewH = Math.max(480, info.windowHeight || DESIGN_H);
    if (!HAS_WX) {
      var cw = canvas.clientWidth || window.innerWidth;
      var ch = canvas.clientHeight || window.innerHeight;
      viewW = Math.max(280, cw);
      viewH = Math.max(480, ch);
    }
    dpr = clamp(info.pixelRatio || 1, 1, 3);
    canvas.width = Math.round(viewW * dpr);
    canvas.height = Math.round(viewH * dpr);
    // Respect the notch / home indicator so the HUD is never under system UI.
    var safeTop = 0, safeBottom = 0;
    if (info.safeArea && typeof info.safeArea.top === 'number' && typeof info.safeArea.bottom === 'number') {
      safeTop = clamp(info.safeArea.top, 0, viewH * 0.14);
      safeBottom = clamp(viewH - info.safeArea.bottom, 0, viewH * 0.10);
    }
    var availH = viewH - safeTop - safeBottom;
    if (availH < 440) { safeTop = 0; safeBottom = 0; availH = viewH; }
    stage.scale = Math.min(viewW / DESIGN_W, availH / DESIGN_H);
    stage.w = DESIGN_W * stage.scale;
    stage.h = DESIGN_H * stage.scale;
    stage.x = (viewW - stage.w) / 2;
    stage.y = safeTop + (availH - stage.h) / 2;
    if (!HAS_WX && typeof document !== 'undefined' && /(?:[?&])debug=1(?:&|$)/.test(location.search)) {
      document.title = 'PP w' + viewW + ' h' + viewH + ' cw' + canvas.clientWidth + ' ch' + canvas.clientHeight + ' iw' + window.innerWidth + ' ih' + window.innerHeight + ' s' + stage.scale.toFixed(3) + ' x' + stage.x.toFixed(1) + ' y' + stage.y.toFixed(1);
    }
    ctx.imageSmoothingEnabled = true;
    if (typeof ctx.imageSmoothingQuality !== 'undefined') ctx.imageSmoothingQuality = 'high';
  }

  function toStage(clientX, clientY) {
    var ox = 0, oy = 0;
    if (!HAS_WX) {
      var r = canvas.getBoundingClientRect();
      ox = r.left; oy = r.top;
    }
    return {
      x: (clientX - ox - stage.x) / stage.scale,
      y: (clientY - oy - stage.y) / stage.scale
    };
  }

  /* ------------------------------------------------------------
     Audio
     ------------------------------------------------------------ */
  var AudioSys = (function () {
    var bgm = null;
    var ac = null;
    var master = null;
    var started = false;
    var musicWanted = false;
    var noiseBuf = null;
    var loseAudio = null;

    function ensureBgm() {
      if (bgm) return bgm;
      try {
        if (HAS_WX && wx.createInnerAudioContext) {
          if (wx.setInnerAudioOption) {
            try { wx.setInnerAudioOption({ obeyMuteSwitch: false, mixWithOther: true }); } catch (e) {}
          }
          bgm = wx.createInnerAudioContext();
        } else if (typeof Audio !== 'undefined') {
          bgm = new Audio('assets/audio/pipa-theme.mp3');
        }
        if (!bgm) return null;
        bgm.src = 'assets/audio/pipa-theme.mp3';
        bgm.loop = true;
        bgm.volume = 0.44;
        if (bgm.onError) bgm.onError(function () {});
        if (bgm.onCanPlay) {
          bgm.onCanPlay(function () {
            if (musicWanted && !game.save.muted) {
              try { bgm.play(); } catch (e) {}
            }
          });
        }
      } catch (e) { bgm = null; }
      return bgm;
    }

    function ensureAC() {
      if (ac) return ac;
      try {
        if (HAS_WX && wx.createWebAudioContext) ac = wx.createWebAudioContext();
        else if (typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext)) {
          ac = new (window.AudioContext || window.webkitAudioContext)();
        }
      } catch (e) { ac = null; }
      if (ac) {
        try {
          master = ac.createGain();
          master.gain.value = 0.7;
          master.connect(ac.destination);
          var len = Math.floor(ac.sampleRate * 0.16);
          noiseBuf = ac.createBuffer(1, len, ac.sampleRate);
          var d = noiseBuf.getChannelData(0);
          for (var i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
        } catch (e2) { noiseBuf = null; }
      }
      return ac;
    }

    function tone(type, f0, f1, dur, vol, delay) {
      if (!ac || !master || game.save.muted) return;
      try {
        var t = ac.currentTime + (delay || 0);
        var o = ac.createOscillator();
        var g = ac.createGain();
        o.type = type;
        o.frequency.setValueAtTime(f0, t);
        if (f1 !== f0) o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(Math.max(0.001, vol), t + 0.008);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        o.connect(g); g.connect(master);
        o.start(t); o.stop(t + dur + 0.02);
      } catch (e) {}
    }

    function noise(dur, vol, cutoff, delay) {
      if (!ac || !master || !noiseBuf || game.save.muted) return;
      try {
        var t = ac.currentTime + (delay || 0);
        var s = ac.createBufferSource();
        s.buffer = noiseBuf;
        var f = ac.createBiquadFilter();
        f.type = 'lowpass'; f.frequency.value = cutoff || 1600;
        var g = ac.createGain();
        g.gain.setValueAtTime(vol, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        s.connect(f); f.connect(g); g.connect(master);
        s.start(t); s.stop(t + dur + 0.02);
      } catch (e) {}
    }

    return {
      unlock: function () {
        ensureBgm();
        ensureAC();
        try { if (ac && ac.state === 'suspended') ac.resume(); } catch (e) {}
      },
      music: function (on) {
        ensureBgm();
        musicWanted = !!on;
        if (!bgm) return;
        try {
          if (on) {
            bgm.volume = 0.44;
            if (!game.save.muted) { bgm.play(); started = true; }
          } else {
            bgm.pause();
          }
        } catch (e) {}
      },
      duck: function (on) {
        if (!bgm) return;
        try { bgm.volume = on ? 0.18 : 0.44; } catch (e) {}
      },
      mute: function (muted) {
        if (!bgm) ensureBgm();
        try {
          if (muted) { if (bgm) bgm.pause(); }
          else if (musicWanted && bgm) { bgm.volume = 0.44; bgm.play(); }
        } catch (e) {}
      },
      playLose: function () {
        if (game.save.muted) return;
        try {
          if (loseAudio) {
            if (loseAudio.stop) loseAudio.stop();
            else { loseAudio.pause(); loseAudio.currentTime = 0; }
            loseAudio = null;
          }
          if (HAS_WX && wx.createInnerAudioContext) {
            loseAudio = wx.createInnerAudioContext();
            loseAudio.src = 'assets/cutscene/lose-sting.mp3';
            loseAudio.volume = 0.85;
            loseAudio.play();
          } else if (typeof Audio !== 'undefined') {
            loseAudio = new Audio('assets/cutscene/lose-sting.mp3');
            loseAudio.volume = 0.85;
            var lp = loseAudio.play();
            if (lp && lp.catch) lp.catch(function () {});
          }
        } catch (e) {}
      },
      stopLose: function () {
        try {
          if (loseAudio) {
            if (loseAudio.stop) loseAudio.stop();
            else { loseAudio.pause(); loseAudio.currentTime = 0; }
            loseAudio = null;
          }
        } catch (e) {}
      },
      sfx: function (name) {
        if (game.save.muted) return;
        ensureAC();
        if (!ac) return;
        try { if (ac.state === 'suspended') ac.resume(); } catch (e) {}
        if (name === 'shot') {
          noise(0.11, 0.32, 2400, 0);
          tone('triangle', 150, 45, 0.12, 0.26, 0);
          tone('square', 90, 50, 0.09, 0.10, 0);
        } else if (name === 'hit') {
          tone('sine', 130, 50, 0.12, 0.30, 0);
          noise(0.06, 0.12, 700, 0);
        } else if (name === 'butt') {
          tone('sine', 220, 70, 0.16, 0.34, 0);
          tone('triangle', 620, 240, 0.10, 0.12, 0.015);
          noise(0.05, 0.16, 950, 0);
        } else if (name === 'coin') {
          tone('sine', 940, 940, 0.07, 0.10, 0);
          tone('sine', 1420, 1420, 0.10, 0.08, 0.055);
        } else if (name === 'reload') {
          tone('square', 680, 420, 0.035, 0.07, 0);
          tone('square', 980, 720, 0.045, 0.06, 0.14);
        } else if (name === 'click') {
          tone('sine', 680, 500, 0.045, 0.08, 0);
        } else if (name === 'buy') {
          tone('sine', 520, 780, 0.09, 0.10, 0);
          tone('sine', 1040, 1040, 0.13, 0.08, 0.08);
        } else if (name === 'crit') {
          tone('triangle', 320, 840, 0.13, 0.20, 0);
          tone('sine', 1200, 1600, 0.15, 0.08, 0.04);
        } else if (name === 'ko') {
          tone('sine', 150, 55, 0.65, 0.30, 0);
          tone('triangle', 320, 160, 0.55, 0.14, 0.02);
          noise(0.25, 0.10, 500, 0);
        } else if (name === 'gold') {
          tone('sine', 740, 740, 0.11, 0.12, 0);
          tone('sine', 1110, 1110, 0.16, 0.10, 0.09);
          tone('sine', 1480, 1480, 0.22, 0.08, 0.18);
        }
      }
    };
  })();

  /* ------------------------------------------------------------
     Game state
     ------------------------------------------------------------ */
  var game = {
    demo: detectDemo(),
    save: loadSave(),
    scene: 'menu',
    clock: 0,
    menuT: 0,
    pointer: { x: 195, y: 470, down: false, firing: false, inside: true, type: 'mouse' },
    buttons: [],
    pressedButton: null,
    modal: null,
    toast: null,
    run: null,
    result: null,
    shopT: 0,
    koT: 0,
    transition: 0,
    aimZone: null,
    mutedPulse: 0,
    lastHudCoin: 0,
    coinPop: 0,
    debugAutoAim: false,
    lose: null,
    assets: { bg: null, cutscene: null }
  };
  if (game.demo) {
    game.save.coins = 99999;
    game.save.unlocked = SKINS.map(function (s) { return s.id; });
  }

  function loadImageAsset(src, key) {
    var img = null;
    try {
      if (HAS_WX && wx.createImage) img = wx.createImage();
      else if (!HAS_WX && typeof Image !== 'undefined') img = new Image();
    } catch (e) { img = null; }
    if (!img) return null;
    img.onload = function () { game.assets[key] = img; };
    img.onerror = function () { game.assets[key] = null; };
    img.src = src;
    return img;
  }

  function preloadAssets() {
    loadImageAsset('assets/images/bg-video-main.jpg', 'bg');
    loadImageAsset('assets/cutscene/lose-sheet.jpg', 'cutscene');
  }

  function skinById(id) {
    for (var i = 0; i < SKINS.length; i++) if (SKINS[i].id === id) return SKINS[i];
    return SKINS[0];
  }
  function selectedSkin() { return skinById(game.save.skin); }
  function isUnlocked(id) { return game.demo || game.save.unlocked.indexOf(id) >= 0; }
  function gunDamage() { return 22 + game.save.gunLevel * 4; }
  function gunUpgradeCost() { return game.save.gunLevel >= 12 ? 0 : 160 + (game.save.gunLevel - 1) * 140; }
  function totalUnlocked() { return game.demo ? SKINS.length : game.save.unlocked.length; }

  function showToast(text, tone) {
    game.toast = { text: text, t: 2.2, tone: tone || 'normal' };
  }

  function saveSoon() { persist(); }

  /* ------------------------------------------------------------
     Drawing primitives
     ------------------------------------------------------------ */
  function rrPath(c, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
  }
  function fillRR(c, x, y, w, h, r, fill) {
    rrPath(c, x, y, w, h, r);
    c.fillStyle = fill;
    c.fill();
  }
  function strokeRR(c, x, y, w, h, r, stroke, lw) {
    rrPath(c, x, y, w, h, r);
    c.strokeStyle = stroke;
    c.lineWidth = lw || 1;
    c.stroke();
  }
  function ellipsePath(c, x, y, rx, ry, rot) {
    c.beginPath();
    if (typeof c.ellipse === 'function') {
      c.ellipse(x, y, Math.max(0.01, rx), Math.max(0.01, ry), rot || 0, 0, TAU);
    } else {
      c.save();
      c.translate(x, y);
      if (rot) c.rotate(rot);
      c.scale(rx, ry);
      c.arc(0, 0, 1, 0, TAU);
      c.restore();
    }
  }
  function fillEllipse(c, x, y, rx, ry, rot, fill) {
    ellipsePath(c, x, y, rx, ry, rot);
    c.fillStyle = fill;
    c.fill();
  }
  function text(c, str, x, y, size, color, opts) {
    opts = opts || {};
    c.save();
    c.font = (opts.weight || '') + ' ' + size + 'px ' + (opts.font || '"PingFang SC","Microsoft YaHei","Noto Sans CJK SC",sans-serif');
    c.textAlign = opts.align || 'left';
    c.textBaseline = opts.baseline || 'alphabetic';
    if (opts.alpha !== undefined) c.globalAlpha = opts.alpha;
    if (opts.shadow) {
      c.shadowColor = opts.shadow;
      c.shadowBlur = opts.shadowBlur || 8;
      if (opts.shadowY !== undefined) c.shadowOffsetY = opts.shadowY;
    }
    if (opts.stroke) {
      c.strokeStyle = opts.stroke;
      c.lineWidth = opts.strokeWidth || 2;
      c.lineJoin = 'round';
      c.strokeText(str, x, y);
    }
    c.fillStyle = color;
    c.fillText(str, x, y);
    c.restore();
  }
  function displayFont(size, weight) {
    return (weight || 'bold') + ' ' + size + 'px "STKaiti","KaiTi","Songti SC","Noto Serif CJK SC",serif';
  }
  function drawDisplay(str, x, y, size, fill, opts) {
    opts = opts || {};
    ctx.save();
    ctx.font = displayFont(size, opts.weight || 'bold');
    ctx.textAlign = opts.align || 'center';
    ctx.textBaseline = opts.baseline || 'middle';
    if (opts.alpha !== undefined) ctx.globalAlpha = opts.alpha;
    if (opts.shadow) { ctx.shadowColor = opts.shadow; ctx.shadowBlur = opts.shadowBlur || 18; }
    if (opts.stroke) {
      ctx.strokeStyle = opts.stroke;
      ctx.lineWidth = opts.strokeWidth || 4;
      ctx.lineJoin = 'round';
      ctx.strokeText(str, x, y);
    }
    ctx.fillStyle = fill;
    ctx.fillText(str, x, y);
    ctx.restore();
  }
  function drawGradientDisplay(str, x, y, size, c1, c2, opts) {
    opts = opts || {};
    ctx.save();
    ctx.font = displayFont(size, opts.weight || 'bold');
    ctx.textAlign = opts.align || 'center';
    ctx.textBaseline = opts.baseline || 'middle';
    var g = ctx.createLinearGradient(0, y - size * 0.7, 0, y + size * 0.55);
    g.addColorStop(0, c1); g.addColorStop(0.58, c2); g.addColorStop(1, c1);
    if (opts.shadow) { ctx.shadowColor = opts.shadow; ctx.shadowBlur = opts.shadowBlur || 18; }
    if (opts.stroke) {
      ctx.strokeStyle = opts.stroke;
      ctx.lineWidth = opts.strokeWidth || 5;
      ctx.lineJoin = 'round';
      ctx.strokeText(str, x, y);
    }
    ctx.fillStyle = g;
    ctx.fillText(str, x, y);
    ctx.restore();
  }

  function addButton(id, x, y, w, h, action, opts) {
    opts = opts || {};
    game.buttons.push({
      id: id, x: x, y: y, w: w, h: h, action: action,
      layer: opts.layer || 'base', disabled: !!opts.disabled
    });
  }

  function findButton(p) {
    var modalLayer = game.modal ? 'modal' : null;
    for (var i = game.buttons.length - 1; i >= 0; i--) {
      var b = game.buttons[i];
      if (modalLayer && b.layer !== 'modal') continue;
      if (!modalLayer && b.layer === 'modal') continue;
      if (p.x >= b.x && p.x <= b.x + b.w && p.y >= b.y && p.y <= b.y + b.h) return b;
    }
    return null;
  }

  function drawButtonBase(b, active) {
    var hot = active || (game.pointer.inside && game.pointer.x >= b.x && game.pointer.x <= b.x + b.w && game.pointer.y >= b.y && game.pointer.y <= b.y + b.h);
    return hot;
  }

  /* ------------------------------------------------------------
     Static background (cached once)
     ------------------------------------------------------------ */
  function buildBackground() {
    var surface = createSurface(DESIGN_W, DESIGN_H);
    if (!surface || !surface.getContext) return null;
    var c = surface.getContext('2d');
    if (!c) return null;
    var rnd = mulberry32(91307);

    // base wall
    var wg = c.createLinearGradient(0, 0, 0, 650);
    wg.addColorStop(0, '#2a0b12');
    wg.addColorStop(0.48, '#210a10');
    wg.addColorStop(1, '#13080b');
    c.fillStyle = wg;
    c.fillRect(0, 0, DESIGN_W, DESIGN_H);

    // wallpaper stripes
    c.save();
    c.globalAlpha = 0.26;
    for (var sx = -20; sx < DESIGN_W + 20; sx += 29) {
      c.fillStyle = sx % 58 === 0 ? '#4b1720' : '#1a090d';
      c.fillRect(sx, 0, 10, 620);
    }
    c.restore();

    // mottled age / stains
    for (var i = 0; i < 22; i++) {
      var bx = rnd() * DESIGN_W;
      var by = 70 + rnd() * 510;
      var br = 20 + rnd() * 85;
      var rg = c.createRadialGradient(bx, by, 0, bx, by, br);
      rg.addColorStop(0, 'rgba(8,3,5,' + (0.10 + rnd() * 0.18) + ')');
      rg.addColorStop(1, 'rgba(8,3,5,0)');
      c.fillStyle = rg;
      c.fillRect(bx - br, by - br, br * 2, br * 2);
    }

    // back wall panel
    c.fillStyle = 'rgba(10,4,7,0.28)';
    c.fillRect(48, 102, 294, 492);
    c.strokeStyle = 'rgba(189,125,73,0.14)';
    c.lineWidth = 2;
    c.strokeRect(48, 102, 294, 492);
    c.strokeStyle = 'rgba(230,190,125,0.06)';
    c.strokeRect(54, 108, 282, 480);

    // cracked plaster lines
    c.save();
    c.globalAlpha = 0.22;
    c.strokeStyle = '#080305';
    c.lineWidth = 1.2;
    for (var k = 0; k < 9; k++) {
      var px = 30 + rnd() * 330, py = 80 + rnd() * 480;
      c.beginPath(); c.moveTo(px, py);
      for (var j = 0; j < 4; j++) {
        px += (rnd() - 0.5) * 46; py += 14 + rnd() * 32;
        c.lineTo(px, py);
      }
      c.stroke();
    }
    c.restore();

    // poster on left wall
    c.save();
    c.translate(42, 302);
    c.rotate(-0.055);
    c.fillStyle = '#d6b77f';
    c.fillRect(-27, -42, 54, 84);
    c.fillStyle = '#b89963';
    c.fillRect(-24, -39, 48, 78);
    c.fillStyle = '#f2dfb0';
    c.fillRect(-21, -36, 42, 72);
    c.strokeStyle = 'rgba(70,35,23,0.45)';
    c.lineWidth = 1;
    c.strokeRect(-21, -36, 42, 72);
    c.fillStyle = '#7d201c';
    c.font = 'bold 26px "STKaiti","KaiTi",serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText('臀', 0, -8);
    c.fillStyle = '#4b2a20';
    c.font = '7px "PingFang SC","Microsoft YaHei",sans-serif';
    c.fillText('禁止走火', 0, 18);
    c.fillStyle = 'rgba(70,35,23,0.5)';
    c.font = '5px monospace';
    c.fillText('PIPA / 07', 0, 28);
    c.restore();

    // wall lamp
    c.save();
    c.strokeStyle = 'rgba(207,161,92,0.42)';
    c.lineWidth = 2;
    c.beginPath(); c.moveTo(195, 0); c.lineTo(195, 34); c.stroke();
    c.fillStyle = '#2c2119';
    fillRR(c, 176, 31, 38, 12, 5, '#2c2119');
    var lampGlow = c.createRadialGradient(195, 45, 2, 195, 45, 90);
    lampGlow.addColorStop(0, 'rgba(255,206,125,0.42)');
    lampGlow.addColorStop(1, 'rgba(255,188,92,0)');
    c.fillStyle = lampGlow;
    c.fillRect(105, 0, 180, 140);
    c.fillStyle = '#ffd794';
    fillEllipse(c, 195, 43, 8, 5, 0, '#ffd794');
    c.restore();

    // side curtains
    function curtain(side) {
      c.save();
      var x0 = side === 0 ? 0 : DESIGN_W - 58;
      var cw = 58;
      var cg = c.createLinearGradient(x0, 0, x0 + cw, 0);
      if (side === 0) {
        cg.addColorStop(0, '#16070c'); cg.addColorStop(0.45, '#4b111b'); cg.addColorStop(1, '#24080f');
      } else {
        cg.addColorStop(0, '#24080f'); cg.addColorStop(0.55, '#4b111b'); cg.addColorStop(1, '#16070c');
      }
      c.fillStyle = cg;
      c.beginPath();
      c.moveTo(x0, 0);
      c.lineTo(x0 + cw, 0);
      for (var yy = 0; yy <= 844; yy += 34) {
        var wave = Math.sin(yy * 0.045 + side) * 4;
        c.lineTo(x0 + cw + (side === 0 ? wave : -wave), yy);
      }
      c.lineTo(x0, 844);
      c.closePath();
      c.fill();
      c.globalAlpha = 0.22;
      c.strokeStyle = '#0e0407';
      c.lineWidth = 2;
      for (var f = 0; f < 5; f++) {
        var fx = x0 + 7 + f * 10;
        c.beginPath(); c.moveTo(fx, 0);
        for (var y2 = 0; y2 <= 844; y2 += 40) c.lineTo(fx + Math.sin(y2 * 0.04 + f) * 3, y2);
        c.stroke();
      }
      c.restore();
      // tieback
      c.save();
      c.strokeStyle = 'rgba(225,175,91,0.55)';
      c.lineWidth = 5;
      c.beginPath();
      c.moveTo(side === 0 ? 42 : DESIGN_W - 42, 0);
      c.quadraticCurveTo(side === 0 ? 32 : DESIGN_W - 32, 220, side === 0 ? 12 : DESIGN_W - 12, 400);
      c.stroke();
      c.restore();
    }
    curtain(0); curtain(1);

    // floor
    var fg = c.createLinearGradient(0, 604, 0, 844);
    fg.addColorStop(0, '#2a1310');
    fg.addColorStop(0.4, '#1b0d0c');
    fg.addColorStop(1, '#0c0607');
    c.fillStyle = fg;
    c.fillRect(0, 604, DESIGN_W, 240);

    // stage light pool
    var pool = c.createRadialGradient(195, 666, 10, 195, 666, 205);
    pool.addColorStop(0, 'rgba(255,174,88,0.19)');
    pool.addColorStop(0.55, 'rgba(201,83,46,0.08)');
    pool.addColorStop(1, 'rgba(60,15,12,0)');
    c.fillStyle = pool;
    c.fillRect(0, 510, DESIGN_W, 334);

    // floor planks / perspective
    c.save();
    c.strokeStyle = 'rgba(213,160,96,0.10)';
    c.lineWidth = 1;
    for (var lane = -8; lane <= 8; lane++) {
      var bottomX = 195 + lane * 48;
      c.beginPath(); c.moveTo(195 + lane * 8, 604); c.lineTo(bottomX, 844); c.stroke();
    }
    var ys = [604, 626, 654, 688, 728, 776, 844];
    for (var yi = 0; yi < ys.length; yi++) {
      c.strokeStyle = 'rgba(225,170,100,' + (0.08 + yi * 0.012) + ')';
      c.beginPath(); c.moveTo(0, ys[yi]); c.lineTo(DESIGN_W, ys[yi]); c.stroke();
    }
    c.restore();

    // floor debris
    c.save();
    c.globalAlpha = 0.5;
    for (var d = 0; d < 12; d++) {
      var dx = 30 + rnd() * 330, dy = 640 + rnd() * 170;
      c.fillStyle = rnd() > 0.5 ? '#4b2b1b' : '#2d1a14';
      c.save(); c.translate(dx, dy); c.rotate(rnd() * TAU);
      c.fillRect(-4, -1.5, 8, 3);
      c.restore();
    }
    c.restore();

    // volumetric spotlight cone
    c.save();
    c.globalCompositeOperation = 'lighter';
    var cone = c.createLinearGradient(0, 20, 0, 680);
    cone.addColorStop(0, 'rgba(255,214,150,0.10)');
    cone.addColorStop(0.65, 'rgba(255,180,100,0.045)');
    cone.addColorStop(1, 'rgba(255,150,80,0)');
    c.fillStyle = cone;
    c.beginPath();
    c.moveTo(184, 20); c.lineTo(206, 20); c.lineTo(340, 690); c.lineTo(50, 690); c.closePath();
    c.fill();
    c.restore();

    return surface;
  }

  function drawBackground() {
    if (bgSurface) {
      ctx.drawImage(bgSurface, 0, 0, DESIGN_W, DESIGN_H);
    } else {
      // Fallback for devices without offscreen canvas support.
      var g = ctx.createLinearGradient(0, 0, 0, DESIGN_H);
      g.addColorStop(0, '#2a0b12'); g.addColorStop(0.52, '#1b090e'); g.addColorStop(1, '#0c0607');
      ctx.fillStyle = g; ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);
      for (var side = 0; side < 2; side++) {
        var cg = ctx.createLinearGradient(side ? 342 : 0, 0, side ? 390 : 48, 0);
        cg.addColorStop(0, '#16070c'); cg.addColorStop(0.55, '#4b111b'); cg.addColorStop(1, '#22080f');
        ctx.fillStyle = cg;
        ctx.fillRect(side ? 342 : 0, 0, 48, DESIGN_H);
      }
      var fg = ctx.createLinearGradient(0, 604, 0, 844);
      fg.addColorStop(0, '#2a1310'); fg.addColorStop(1, '#0c0607');
      ctx.fillStyle = fg; ctx.fillRect(0, 604, DESIGN_W, 240);
      ctx.strokeStyle = 'rgba(215,165,100,0.12)';
      for (var i = -8; i <= 8; i++) {
        ctx.beginPath(); ctx.moveTo(195 + i * 8, 604); ctx.lineTo(195 + i * 48, 844); ctx.stroke();
      }
      var sp = ctx.createRadialGradient(195, 600, 20, 195, 600, 350);
      sp.addColorStop(0, 'rgba(255,184,96,0.22)');
      sp.addColorStop(0.6, 'rgba(196,77,42,0.08)');
      sp.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = sp; ctx.fillRect(0, 200, DESIGN_W, 644);
      ctx.save();
      ctx.translate(42, 302); ctx.rotate(-0.055);
      ctx.fillStyle = '#d6b77f'; ctx.fillRect(-27, -42, 54, 84);
      ctx.fillStyle = '#f2dfb0'; ctx.fillRect(-21, -36, 42, 72);
      ctx.fillStyle = '#7d201c'; ctx.font = 'bold 26px "STKaiti","KaiTi",serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText('臀', 0, -8);
      ctx.restore();
    }

    // Real 3D room plate extracted from the reference video, used as a
    // defocused depth layer. It is deliberately soft and dark so the new
    // 3D-shaded characters stay readable.
    if (game.assets.bg) {
      var zoom = 1.075 + Math.sin(game.clock * 0.16) * 0.008;
      var w = DESIGN_W * zoom;
      var h = DESIGN_H * zoom;
      var px = (game.pointer.x - 195) * -0.012;
      var py = (game.pointer.y - 430) * -0.006;
      ctx.save();
      ctx.globalAlpha = 0.66;
      ctx.drawImage(game.assets.bg, (DESIGN_W - w) / 2 + px, (DESIGN_H - h) / 2 - 8 + py, w, h);
      ctx.restore();
      // unify the photo plate with the game's red/black grade
      ctx.save();
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = 'rgba(120,25,28,0.20)';
      ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);
      ctx.restore();
      var vg2 = ctx.createRadialGradient(195, 420, 210, 195, 430, 470);
      vg2.addColorStop(0, 'rgba(0,0,0,0)');
      vg2.addColorStop(0.65, 'rgba(4,1,3,0.10)');
      vg2.addColorStop(1, 'rgba(3,1,2,0.55)');
      ctx.fillStyle = vg2;
      ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);

      // The source plate contains the original performer in the middle.
      // A practical stage curtain + a foreground floor cover that area while
      // keeping the video's room edges, lamp and red wall visible.
      ctx.save();
      ctx.globalAlpha = 0.94;
      var cg = ctx.createLinearGradient(90, 0, 300, 0);
      cg.addColorStop(0, '#28070d');
      cg.addColorStop(0.15, '#5b1219');
      cg.addColorStop(0.35, '#26060b');
      cg.addColorStop(0.52, '#66161c');
      cg.addColorStop(0.72, '#24050a');
      cg.addColorStop(0.88, '#4e1017');
      cg.addColorStop(1, '#1c0509');
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.moveTo(90, 0);
      ctx.lineTo(300, 0);
      ctx.lineTo(298, 592);
      for (var ci = 0; ci <= 9; ci++) {
        var cxp = 298 - ci * (208 / 9);
        var cyp = 600 + Math.sin(ci * 1.7) * 13;
        ctx.lineTo(cxp, cyp);
      }
      ctx.lineTo(90, 592);
      ctx.closePath();
      ctx.fill();
      // folds
      ctx.globalAlpha = 0.55;
      for (var f = 0; f < 8; f++) {
        var fx = 102 + f * 24;
        ctx.strokeStyle = f % 2 ? 'rgba(255,156,139,0.10)' : 'rgba(9,1,4,0.7)';
        ctx.lineWidth = f % 2 ? 2 : 6;
        ctx.beginPath();
        ctx.moveTo(fx, 8);
        ctx.quadraticCurveTo(fx + Math.sin(f * 1.3) * 6, 300, fx + Math.sin(f * 1.7) * 10, 596);
        ctx.stroke();
      }
      // valance and gold trim
      ctx.globalAlpha = 0.95;
      ctx.fillStyle = '#21050a';
      ctx.fillRect(86, 0, 218, 42);
      ctx.strokeStyle = 'rgba(236,180,100,0.55)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(90, 592);
      for (var ci2 = 0; ci2 <= 9; ci2++) {
        var cx2 = 298 - ci2 * (208 / 9);
        var cy2 = 600 + Math.sin(ci2 * 1.7) * 13;
        ctx.lineTo(cx2, cy2);
      }
      ctx.stroke();
      for (var v = 0; v < 8; v++) {
        ctx.beginPath();
        ctx.arc(96 + v * 24, 32, 16, 0.05, Math.PI - 0.05);
        ctx.stroke();
      }
      ctx.restore();

      // foreground floor: hides the original performer's feet and grounds the 3D target
      ctx.save();
      ctx.globalAlpha = 0.92;
      var fgrad = ctx.createLinearGradient(0, 584, 0, 844);
      fgrad.addColorStop(0, 'rgba(54,23,17,0.98)');
      fgrad.addColorStop(0.45, '#1b0c0b');
      fgrad.addColorStop(1, '#090507');
      ctx.fillStyle = fgrad;
      ctx.fillRect(0, 584, DESIGN_W, 260);
      ctx.strokeStyle = 'rgba(236,178,102,0.15)';
      ctx.lineWidth = 1;
      for (var fl = -8; fl <= 8; fl++) {
        ctx.beginPath();
        ctx.moveTo(195 + fl * 8, 584);
        ctx.lineTo(195 + fl * 48, 844);
        ctx.stroke();
      }
      for (var fy = 610; fy < 844; fy += 38) {
        ctx.strokeStyle = 'rgba(232,174,100,' + (0.05 + (fy - 600) / 6000) + ')';
        ctx.beginPath(); ctx.moveTo(0, fy); ctx.lineTo(DESIGN_W, fy); ctx.stroke();
      }
      ctx.restore();
    }
  }

  /* ------------------------------------------------------------
     Character art
     ------------------------------------------------------------ */
  function drawLegs(c, s, opts) {
    var pants = s.body === 'fur' ? s.skin : (s.body === 'bot' ? '#dfe8e6' : s.suit);
    var pantsDark = s.body === 'fur' ? s.skinDark : (s.body === 'bot' ? '#b9c8c7' : '#08060a');
    var shoe = s.body === 'bot' ? '#4d6568' : '#09070a';

    function leg(hx, hx2, fx, side) {
      c.lineCap = 'round'; c.lineJoin = 'round';
      c.strokeStyle = pantsDark;
      c.lineWidth = 48;
      c.beginPath(); c.moveTo(hx, -190); c.quadraticCurveTo(hx2, -105, fx, -18); c.stroke();
      c.strokeStyle = pants;
      c.lineWidth = 40;
      c.beginPath(); c.moveTo(hx, -190); c.quadraticCurveTo(hx2, -105, fx, -18); c.stroke();
      // cylindrical inner shadow and outer sheen
      c.globalAlpha = 0.38;
      c.strokeStyle = 'rgba(0,0,0,0.72)';
      c.lineWidth = 10;
      c.beginPath(); c.moveTo(hx - side * 8, -188); c.quadraticCurveTo(hx2 - side * 9, -105, fx - side * 7, -24); c.stroke();
      c.globalAlpha = 0.26;
      c.strokeStyle = s.body === 'bot' ? 'rgba(190,255,255,0.8)' : 'rgba(255,210,180,0.6)';
      c.lineWidth = 3;
      c.beginPath(); c.moveTo(hx + side * 12, -186); c.quadraticCurveTo(hx2 + side * 12, -105, fx + side * 8, -28); c.stroke();
      // trouser crease
      c.globalAlpha = 0.42;
      c.strokeStyle = pantsDark;
      c.lineWidth = 2;
      c.beginPath(); c.moveTo(hx + side * 2, -180); c.quadraticCurveTo(hx2 + side * 5, -100, fx + side * 3, -32); c.stroke();
      c.globalAlpha = 1;
      // knee ring for robot
      if (s.body === 'bot') {
        c.strokeStyle = s.accent;
        c.lineWidth = 4;
        c.beginPath(); c.moveTo(hx2 - 20, -96); c.quadraticCurveTo(hx2, -88, hx2 + 20, -96); c.stroke();
      }
      // shoe
      c.save();
      c.translate(fx, -11);
      c.rotate(side * 0.05);
      fillEllipse(c, 0, 0, 31, 13, 0, shoe);
      fillEllipse(c, -side * 5, -3, 18, 6, 0, 'rgba(255,255,255,0.10)');
      c.fillStyle = '#22181a';
      fillRR(c, -25, 7, 50, 5, 2.5, '#22181a');
      c.restore();
    }
    leg(-28, -56, -72, -1);
    leg(28, 57, 72, 1);
  }

  function drawArms(c, s, opts) {
    var sleeve = s.body === 'fur' ? s.skin : (s.body === 'bot' ? '#e7efed' : s.suit);
    var sleeveDark = s.body === 'fur' ? s.skinDark : (s.body === 'bot' ? '#b6c5c4' : '#08060a');
    var hand = s.body === 'bot' ? s.skin : s.skin;

    function arm(sx, sy, ex, ey, hx, hy, side) {
      var hd = opts.hitDir || 0;
      var hf = opts.hitFlash || 0;
      hx += hd * 10 * hf;
      hy -= hf * 4;
      ex += hd * 6 * hf;
      c.lineCap = 'round'; c.lineJoin = 'round';
      c.strokeStyle = sleeveDark;
      c.lineWidth = 37;
      c.beginPath(); c.moveTo(sx, sy); c.quadraticCurveTo(ex, ey, hx, hy); c.stroke();
      c.strokeStyle = sleeve;
      c.lineWidth = 30;
      c.beginPath(); c.moveTo(sx, sy); c.quadraticCurveTo(ex, ey, hx, hy); c.stroke();
      c.globalAlpha = 0.32;
      c.strokeStyle = 'rgba(0,0,0,0.7)';
      c.lineWidth = 7;
      c.beginPath(); c.moveTo(sx - side * 6, sy + 5); c.quadraticCurveTo(ex - side * 7, ey + 2, hx - side * 5, hy + 4); c.stroke();
      c.globalAlpha = 0.35;
      c.strokeStyle = s.body === 'bot' ? 'rgba(180,255,255,0.9)' : '#ffffff';
      c.lineWidth = 3;
      c.beginPath(); c.moveTo(sx + 3, sy + 5); c.quadraticCurveTo(ex + 4, ey + 2, hx + 3, hy + 4); c.stroke();
      c.globalAlpha = 1;
      if (s.body === 'suit') {
        c.strokeStyle = '#f0e9db';
        c.lineWidth = 6;
        c.beginPath(); c.arc(hx, hy, 12, Math.PI * 0.95, Math.PI * 1.72); c.stroke();
      }
      // hand
      c.save();
      c.translate(hx, hy);
      c.rotate(side * 0.12);
      fillEllipse(c, 0, 0, 13, 16, 0, hand);
      c.strokeStyle = s.skinDark || '#9c6854';
      c.lineWidth = 1.2;
      c.stroke();
      c.strokeStyle = s.body === 'bot' ? s.accent : 'rgba(73,40,32,0.5)';
      c.lineWidth = 1;
      c.beginPath(); c.moveTo(-4, 3); c.lineTo(4, 4); c.moveTo(-5, 7); c.lineTo(4, 9); c.stroke();
      c.restore();
    }
    arm(-42, -325, -92, -245, -68, -172, -1);
    arm(32, -324, 82, -252, 61, -180, 1);
  }

  function drawTail(c, s, opts) {
    if (s.head === 'cow') {
      c.save();
      c.strokeStyle = '#2b1711';
      c.lineWidth = 7;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(42, -226);
      c.bezierCurveTo(89, -214, 96, -155, 74, -114);
      c.stroke();
      c.strokeStyle = '#3d2318';
      c.lineWidth = 3;
      c.beginPath(); c.moveTo(42, -228); c.bezierCurveTo(87, -210, 92, -158, 73, -117); c.stroke();
      fillEllipse(c, 72, -108, 11, 16, 0.2, '#2b1711');
      c.restore();
    } else if (s.head === 'roo') {
      c.save();
      c.fillStyle = s.skinDark;
      c.beginPath();
      c.moveTo(20, -150);
      c.bezierCurveTo(98, -130, 126, -58, 91, -13);
      c.bezierCurveTo(76, 5, 59, 3, 56, -10);
      c.bezierCurveTo(86, -48, 73, -91, 22, -111);
      c.closePath();
      c.fill();
      c.strokeStyle = 'rgba(96,59,10,0.45)';
      c.lineWidth = 2;
      c.stroke();
      c.fillStyle = s.skin;
      c.beginPath();
      c.moveTo(26, -157);
      c.bezierCurveTo(91, -136, 110, -70, 82, -27);
      c.bezierCurveTo(69, -9, 61, -10, 60, -20);
      c.bezierCurveTo(81, -54, 69, -94, 27, -116);
      c.closePath();
      c.fill();
      c.restore();
    }
  }

  function drawButt(c, s, opts) {
    var jig = opts.buttJiggle || 0;
    var j1 = Math.sin(jig * 26) * jig * 4.5;
    var j2 = Math.sin(jig * 26 + 1.6) * jig * 4.5;
    var lx = -31 - jig * 2.5, rx = 31 + jig * 2;
    var ly = -221 + j1, ry = -223 + j2;

    if (opts.golden) {
      c.save();
      var gg = c.createRadialGradient(0, -222, 8, 0, -222, 105 + Math.sin(game.clock * 6) * 8);
      gg.addColorStop(0, 'rgba(255,217,112,0.48)');
      gg.addColorStop(0.55, 'rgba(255,168,50,0.18)');
      gg.addColorStop(1, 'rgba(255,130,30,0)');
      c.fillStyle = gg;
      c.fillRect(-150, -330, 300, 250);
      c.restore();
    }

    drawTail(c, s, opts);

    if (s.butt === 'armor') {
      // white bean-shaped armor
      c.save();
      c.strokeStyle = 'rgba(53,93,96,0.55)';
      c.lineWidth = 2.5;
      var ag = c.createLinearGradient(-60, -280, 65, -160);
      ag.addColorStop(0, '#ffffff'); ag.addColorStop(0.55, '#eef5f3'); ag.addColorStop(1, '#c8d8d6');
      fillEllipse(c, lx, ly, 49, 50, -0.12, ag);
      fillEllipse(c, rx, ry, 49, 50, 0.12, ag);
      c.stroke();
      // center seam
      c.strokeStyle = s.accent;
      c.lineWidth = 3;
      c.beginPath(); c.moveTo(0, -266); c.quadraticCurveTo(-2, -222, 0, -178); c.stroke();
      // panel lines
      c.strokeStyle = 'rgba(91,139,141,0.45)';
      c.lineWidth = 1.5;
      c.beginPath(); c.arc(lx, ly, 32, Math.PI * 0.55, Math.PI * 1.45); c.stroke();
      c.beginPath(); c.arc(rx, ry, 32, Math.PI * 1.55, Math.PI * 0.45); c.stroke();
      // glowing hip dots
      c.fillStyle = s.accent;
      fillEllipse(c, -52, -244, 4, 4, 0, s.accent);
      fillEllipse(c, 52, -244, 4, 4, 0, s.accent);
      c.restore();
      return;
    }

    // pants / fur lobes
    var b1 = c.createLinearGradient(-75, -285, -5, -160);
    b1.addColorStop(0, s.buttLight);
    b1.addColorStop(0.55, s.buttColor);
    b1.addColorStop(1, s.body === 'suit' ? '#09060a' : s.skinDark);
    var b2 = c.createLinearGradient(5, -285, 75, -160);
    b2.addColorStop(0, s.buttLight);
    b2.addColorStop(0.55, s.buttColor);
    b2.addColorStop(1, s.body === 'suit' ? '#09060a' : s.skinDark);

    c.save();
    c.strokeStyle = s.body === 'suit' ? 'rgba(0,0,0,0.6)' : 'rgba(111,67,11,0.5)';
    c.lineWidth = 2.5;
    fillEllipse(c, lx, ly, 49, 50, -0.13, b1);
    c.stroke();
    fillEllipse(c, rx, ry, 49, 50, 0.13, b2);
    c.stroke();

    // glossy highlights
    c.strokeStyle = s.body === 'suit' ? 'rgba(255,185,185,0.20)' : 'rgba(255,247,193,0.44)';
    c.lineWidth = 5;
    c.lineCap = 'round';
    c.beginPath(); c.arc(lx - 7, ly - 8, 30, Math.PI * 0.76, Math.PI * 1.28); c.stroke();
    c.beginPath(); c.arc(rx + 3, ry - 6, 30, Math.PI * 1.72, Math.PI * 2.22); c.stroke();
    c.strokeStyle = 'rgba(255,255,255,0.22)';
    c.lineWidth = 2;
    c.beginPath(); c.arc(lx - 10, ly - 12, 37, Math.PI * 0.8, Math.PI * 1.15); c.stroke();

    // center seam
    c.strokeStyle = s.body === 'suit' ? 'rgba(0,0,0,0.62)' : 'rgba(117,73,13,0.46)';
    c.lineWidth = 2;
    c.beginPath(); c.moveTo(0, -264); c.quadraticCurveTo(-4 - jig * 2, -222, 2, -177); c.stroke();

    // little impact wrinkles
    c.strokeStyle = s.body === 'suit' ? 'rgba(255,255,255,0.13)' : 'rgba(255,255,255,0.25)';
    c.lineWidth = 1.4;
    c.beginPath(); c.moveTo(-48, -198); c.quadraticCurveTo(-34, -190, -20, -192); c.stroke();
    c.beginPath(); c.moveTo(46, -194); c.quadraticCurveTo(32, -187, 19, -190); c.stroke();

    // subtle fabric pinstripes
    if (s.body === 'suit') {
      c.strokeStyle = 'rgba(183,139,124,0.12)';
      c.lineWidth = 1;
      for (var ps = -1; ps <= 1; ps += 2) {
        for (var pn = 0; pn < 2; pn++) {
          c.beginPath();
          c.moveTo(ps * (16 + pn * 13), -264);
          c.quadraticCurveTo(ps * (18 + pn * 14), -222, ps * (13 + pn * 16), -179);
          c.stroke();
        }
      }
    }

    // shorts / belt
    if (s.butt === 'fur') {
      c.fillStyle = '#17131b';
      c.beginPath();
      c.moveTo(-68, -261);
      c.quadraticCurveTo(0, -278, 68, -261);
      c.lineTo(62, -238);
      c.quadraticCurveTo(0, -252, -62, -238);
      c.closePath();
      c.fill();
      c.strokeStyle = s.accent;
      c.lineWidth = 3;
      c.beginPath(); c.moveTo(-50, -246); c.quadraticCurveTo(0, -256, 50, -246); c.stroke();
      c.fillStyle = '#2a2029';
      fillRR(c, -11, -258, 22, 16, 4, '#2a2029');
      c.fillStyle = s.accent;
      fillRR(c, -5, -254, 10, 8, 2, s.accent);
    } else {
      // belt
      c.fillStyle = '#0a070b';
      fillRR(c, -68, -270, 136, 16, 7, '#0a070b');
      c.strokeStyle = 'rgba(212,167,91,0.35)';
      c.lineWidth = 1;
      c.strokeRect(-63, -266, 126, 2);
      c.fillStyle = s.trim;
      fillRR(c, -11, -271, 22, 19, 4, s.trim);
      c.fillStyle = '#3a2512';
      fillRR(c, -5, -266, 10, 9, 2, '#3a2512');
    }
    c.restore();
  }

  function drawJacketTails(c, s, opts) {
    if (s.body !== 'suit') return;
    c.save();
    c.fillStyle = '#0b080e';
    c.strokeStyle = 'rgba(191,148,90,0.18)';
    c.lineWidth = 1;
    // left tail
    c.beginPath();
    c.moveTo(-55, -252);
    c.quadraticCurveTo(-94, -218, -88, -149);
    c.quadraticCurveTo(-80, -126, -66, -134);
    c.lineTo(-55, -171);
    c.quadraticCurveTo(-62, -212, -39, -240);
    c.closePath();
    c.fill(); c.stroke();
    // right tail
    c.beginPath();
    c.moveTo(55, -252);
    c.quadraticCurveTo(94, -218, 88, -149);
    c.quadraticCurveTo(80, -126, 66, -134);
    c.lineTo(55, -171);
    c.quadraticCurveTo(62, -212, 39, -240);
    c.closePath();
    c.fill(); c.stroke();
    // red lining
    c.strokeStyle = 'rgba(143,39,34,0.55)';
    c.lineWidth = 2.2;
    c.beginPath(); c.moveTo(-66, -139); c.quadraticCurveTo(-73, -179, -55, -224); c.stroke();
    c.beginPath(); c.moveTo(66, -139); c.quadraticCurveTo(73, -179, 55, -224); c.stroke();
    // gold trim
    c.strokeStyle = 'rgba(225,177,101,0.28)';
    c.lineWidth = 1.2;
    c.beginPath(); c.moveTo(-83, -155); c.quadraticCurveTo(-75, -204, -58, -238); c.stroke();
    c.beginPath(); c.moveTo(83, -155); c.quadraticCurveTo(75, -204, 58, -238); c.stroke();
    c.restore();
  }

  function drawTorso(c, s, opts) {
    if (s.body === 'suit') {
      // tailcoat side panels
      c.fillStyle = '#0b080d';
      c.beginPath();
      c.moveTo(-54, -238); c.quadraticCurveTo(-87, -190, -72, -119);
      c.lineTo(-42, -138); c.quadraticCurveTo(-49, -192, -21, -227); c.closePath(); c.fill();
      c.beginPath();
      c.moveTo(54, -238); c.quadraticCurveTo(87, -190, 72, -119);
      c.lineTo(42, -138); c.quadraticCurveTo(49, -192, 21, -227); c.closePath(); c.fill();

      var tg = c.createLinearGradient(-60, -345, 55, -210);
      tg.addColorStop(0, s.suitLight);
      tg.addColorStop(0.42, s.suit);
      tg.addColorStop(1, '#08060a');
      c.fillStyle = tg;
      c.beginPath();
      c.moveTo(-58, -220);
      c.bezierCurveTo(-64, -276, -55, -327, -34, -345);
      c.quadraticCurveTo(0, -361, 32, -341);
      c.bezierCurveTo(55, -322, 62, -270, 54, -217);
      c.quadraticCurveTo(0, -243, -58, -220);
      c.closePath();
      c.fill();
      c.strokeStyle = 'rgba(0,0,0,0.48)';
      c.lineWidth = 2;
      c.stroke();

      // back seam and shoulder highlights
      c.strokeStyle = 'rgba(255,255,255,0.11)';
      c.lineWidth = 2;
      c.beginPath(); c.moveTo(-9, -338); c.quadraticCurveTo(-2, -280, -2, -235); c.stroke();
      c.beginPath(); c.moveTo(-39, -331); c.quadraticCurveTo(-45, -288, -39, -245); c.stroke();
      c.strokeStyle = 'rgba(205,165,100,0.18)';
      c.beginPath(); c.moveTo(31, -338); c.quadraticCurveTo(39, -290, 29, -243); c.stroke();

      // white shirt + collar at the turn of the head
      c.fillStyle = '#e8dfcf';
      c.beginPath();
      c.moveTo(-28, -333); c.quadraticCurveTo(-4, -349, 23, -336);
      c.lineTo(18, -307); c.quadraticCurveTo(-2, -299, -22, -309); c.closePath(); c.fill();
      c.fillStyle = '#b9aa93';
      c.beginPath(); c.moveTo(0, -335); c.lineTo(4, -312); c.lineTo(-7, -316); c.closePath(); c.fill();
      // tie
      c.fillStyle = s.accent;
      c.beginPath();
      c.moveTo(5, -329); c.lineTo(17, -323); c.lineTo(9, -301); c.lineTo(1, -307); c.closePath();
      c.fill();
      c.fillStyle = 'rgba(255,255,255,0.25)';
      c.beginPath(); c.moveTo(8, -326); c.lineTo(12, -324); c.lineTo(7, -308); c.closePath(); c.fill();
      // collar edge
      c.strokeStyle = '#f4ecdc';
      c.lineWidth = 2;
      c.beginPath(); c.moveTo(-28, -333); c.lineTo(-19, -309); c.stroke();
      c.beginPath(); c.moveTo(23, -336); c.lineTo(16, -311); c.stroke();
    } else if (s.body === 'fur') {
      var fg = c.createLinearGradient(-60, -345, 55, -210);
      fg.addColorStop(0, s.skin); fg.addColorStop(0.5, s.skin); fg.addColorStop(1, s.skinDark);
      c.fillStyle = fg;
      c.beginPath();
      c.moveTo(-64, -220);
      c.bezierCurveTo(-70, -276, -59, -327, -36, -345);
      c.quadraticCurveTo(0, -365, 34, -343);
      c.bezierCurveTo(58, -322, 65, -270, 56, -217);
      c.quadraticCurveTo(0, -243, -64, -220);
      c.closePath(); c.fill();
      c.strokeStyle = 'rgba(112,67,10,0.42)';
      c.lineWidth = 2; c.stroke();
      // lighter belly-side rim
      c.strokeStyle = 'rgba(255,248,185,0.42)';
      c.lineWidth = 5;
      c.beginPath(); c.moveTo(-46, -327); c.quadraticCurveTo(-57, -274, -48, -230); c.stroke();
      c.strokeStyle = 'rgba(125,79,14,0.28)';
      c.lineWidth = 2;
      c.beginPath(); c.moveTo(35, -335); c.quadraticCurveTo(47, -288, 38, -238); c.stroke();
      // little red scarf/collar
      c.fillStyle = s.accent;
      c.beginPath();
      c.moveTo(-29, -334); c.quadraticCurveTo(-5, -349, 23, -336);
      c.lineTo(19, -318); c.quadraticCurveTo(-4, -328, -25, -319); c.closePath(); c.fill();
      c.fillStyle = '#9e2b1c';
      c.beginPath(); c.moveTo(-12, -323); c.lineTo(1, -318); c.lineTo(-7, -300); c.closePath(); c.fill();
    } else {
      // robot shell
      var bg2 = c.createLinearGradient(-62, -345, 58, -210);
      bg2.addColorStop(0, '#ffffff'); bg2.addColorStop(0.4, s.suit); bg2.addColorStop(1, '#b9cac9');
      c.fillStyle = bg2;
      c.beginPath();
      c.moveTo(-62, -220);
      c.bezierCurveTo(-68, -278, -58, -329, -34, -346);
      c.quadraticCurveTo(0, -364, 34, -344);
      c.bezierCurveTo(57, -322, 64, -270, 56, -216);
      c.quadraticCurveTo(0, -243, -62, -220);
      c.closePath(); c.fill();
      c.strokeStyle = 'rgba(69,111,114,0.5)';
      c.lineWidth = 2.2; c.stroke();
      // spine line
      c.strokeStyle = s.accent;
      c.lineWidth = 3;
      c.beginPath(); c.moveTo(0, -339); c.quadraticCurveTo(-6, -280, 0, -235); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.8)';
      c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(-2, -337); c.quadraticCurveTo(-8, -280, -2, -237); c.stroke();
      // shoulder screws
      c.fillStyle = '#7a9698';
      fillEllipse(c, -43, -326, 5, 5, 0, '#7a9698');
      fillEllipse(c, 43, -326, 5, 5, 0, '#7a9698');
      // teal neck ring
      c.fillStyle = s.accent;
      fillRR(c, -18, -352, 36, 9, 4, s.accent);
    }
  }

  function drawSuitHead(c, s, opts) {
    var expr = opts.expression || 'idle';
    var hit = opts.hitFlash || 0;
    c.save();
    // neck
    c.fillStyle = s.skinDark;
    fillRR(c, -4, 24, 25, 25, 9, s.skinDark);
    // ear
    fillEllipse(c, -23, 2, 8, 12, -0.2, s.skin);
    fillEllipse(c, -23, 2, 4, 7, -0.2, s.skinDark);
    // head (spherical light falloff)
    var hg = c.createRadialGradient(-12, -20, 3, 0, 0, 52);
    hg.addColorStop(0, '#f7cba7');
    hg.addColorStop(0.42, s.skin);
    hg.addColorStop(0.78, s.skin);
    hg.addColorStop(1, s.skinDark);
    fillEllipse(c, 0, -2, 33, 38, 0.02, hg);
    // side plane shadow
    c.save();
    c.globalAlpha = 0.22;
    var sideSh = c.createLinearGradient(14, -20, 30, 20);
    sideSh.addColorStop(0, 'rgba(94,48,38,0)');
    sideSh.addColorStop(1, 'rgba(94,48,38,0.75)');
    fillEllipse(c, 22, 3, 13, 28, 0.05, sideSh);
    c.restore();
    // face plane
    c.save();
    c.globalAlpha = 0.45;
    fillEllipse(c, 8, 3, 24, 29, 0.03, '#f5c8a2');
    c.restore();
    // hair
    c.fillStyle = s.hair;
    c.beginPath();
    c.moveTo(-34, -8);
    c.bezierCurveTo(-43, -44, -3, -58, 24, -38);
    c.bezierCurveTo(38, -29, 32, -15, 25, -18);
    c.bezierCurveTo(13, -29, -5, -31, -15, -18);
    c.bezierCurveTo(-21, -9, -26, 1, -30, 4);
    c.closePath(); c.fill();
    // side part / wave
    c.strokeStyle = 'rgba(255,255,255,0.12)';
    c.lineWidth = 2;
    c.beginPath(); c.moveTo(-22, -35); c.quadraticCurveTo(-2, -43, 17, -27); c.stroke();
    // eyebrow
    c.strokeStyle = '#3a211a'; c.lineWidth = 3; c.lineCap = 'round';
    if (expr === 'ko') {
      c.beginPath(); c.moveTo(-4, -10); c.lineTo(5, -4); c.moveTo(5, -10); c.lineTo(-4, -4); c.stroke();
      c.beginPath(); c.moveTo(16, -10); c.lineTo(25, -4); c.moveTo(25, -10); c.lineTo(16, -4); c.stroke();
    } else {
      c.beginPath(); c.moveTo(-4, -10); c.quadraticCurveTo(2, -15, 8, -10); c.stroke();
      c.beginPath(); c.moveTo(16, -10); c.quadraticCurveTo(22, -14, 27, -9); c.stroke();
    }
    // eyes
    if (expr === 'hit' || expr === 'ko') {
      c.strokeStyle = '#2b1712'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(-3, -1); c.quadraticCurveTo(3, 4, 8, -1); c.stroke();
      c.beginPath(); c.moveTo(16, -1); c.quadraticCurveTo(21, 3, 26, -1); c.stroke();
    } else {
      fillEllipse(c, 2, -2, 6, 4.5, -0.1, '#f7e9d2');
      fillEllipse(c, 22, -1, 5.5, 4.2, 0.1, '#f7e9d2');
      fillEllipse(c, 4, -1, 2.8, 3.1, 0, '#23140f');
      fillEllipse(c, 23.3, 0, 2.5, 2.8, 0, '#23140f');
      c.fillStyle = '#ffffff';
      fillEllipse(c, 3, -2.5, 0.9, 1, 0, '#ffffff');
      fillEllipse(c, 22.4, -1.5, 0.8, 0.9, 0, '#ffffff');
    }
    // nose
    c.fillStyle = s.skinDark;
    c.beginPath();
    c.moveTo(27, 4); c.quadraticCurveTo(34, 8, 28, 12); c.quadraticCurveTo(24, 10, 27, 4); c.fill();
    // mouth
    c.strokeStyle = '#7e342b'; c.lineWidth = 2.2;
    if (expr === 'hit' || expr === 'ko') {
      fillEllipse(c, 17, 19, 7, expr === 'ko' ? 8 : 5.5, 0, '#431311');
      c.fillStyle = '#e69c8e';
      fillEllipse(c, 17, 22, 3.5, 2.2, 0, '#e69c8e');
    } else if (expr === 'smug') {
      c.beginPath(); c.moveTo(10, 18); c.quadraticCurveTo(18, 23, 26, 16); c.stroke();
    } else {
      c.beginPath(); c.moveTo(11, 19); c.quadraticCurveTo(18, 22, 24, 17); c.stroke();
      c.strokeStyle = 'rgba(255,255,255,0.35)'; c.lineWidth = 1.2;
      c.beginPath(); c.moveTo(13, 20); c.quadraticCurveTo(18, 22, 22, 19); c.stroke();
    }
    // cheek blush
    c.globalAlpha = 0.25 + hit * 0.3;
    fillEllipse(c, -8, 13, 8, 4, 0, '#d25e52');
    c.globalAlpha = 1;
    // sweat
    if (opts.sweat) {
      c.fillStyle = 'rgba(173,225,238,0.85)';
      c.beginPath();
      c.moveTo(29, -24); c.bezierCurveTo(34, -18, 34, -14, 30, -13);
      c.bezierCurveTo(26, -14, 25, -19, 29, -24); c.fill();
    }
    c.restore();
  }

  function drawCowHead(c, s, opts) {
    var expr = opts.expression || 'idle';
    c.save();
    // ears
    fillEllipse(c, -39, -3, 15, 9, -0.45, s.skinDark);
    fillEllipse(c, 39, -3, 15, 9, 0.45, s.skinDark);
    fillEllipse(c, -40, -3, 8, 4, -0.45, '#e6a18c');
    fillEllipse(c, 40, -3, 8, 4, 0.45, '#e6a18c');
    // horns
    c.strokeStyle = '#3b2114'; c.lineWidth = 10; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-22, -27); c.bezierCurveTo(-39, -50, -50, -48, -56, -38); c.stroke();
    c.beginPath(); c.moveTo(23, -28); c.bezierCurveTo(40, -51, 52, -48, 57, -37); c.stroke();
    c.strokeStyle = '#7e4f2d'; c.lineWidth = 5;
    c.beginPath(); c.moveTo(-24, -29); c.bezierCurveTo(-39, -47, -48, -46, -53, -39); c.stroke();
    c.beginPath(); c.moveTo(25, -30); c.bezierCurveTo(40, -48, 49, -46, 54, -38); c.stroke();
    // neck
    c.fillStyle = s.skinDark;
    fillRR(c, -7, 25, 28, 25, 10, s.skinDark);
    // head
    var hg = c.createLinearGradient(-35, -38, 32, 36);
    hg.addColorStop(0, '#f4b45a'); hg.addColorStop(0.55, s.skin); hg.addColorStop(1, s.skinDark);
    fillEllipse(c, 0, -2, 38, 39, 0, hg);
    // forehead tuft
    c.fillStyle = s.hair;
    c.beginPath();
    c.moveTo(-10, -38);
    c.quadraticCurveTo(-2, -54, 12, -38);
    c.quadraticCurveTo(4, -43, -2, -35);
    c.closePath(); c.fill();
    // muzzle
    var mg = c.createLinearGradient(-20, 5, 25, 30);
    mg.addColorStop(0, '#f7d5ac'); mg.addColorStop(1, '#e7a98a');
    fillEllipse(c, 7, 13, 25, 19, 0.02, mg);
    fillEllipse(c, -2, 9, 4, 2.6, -0.2, '#6b3429');
    fillEllipse(c, 17, 10, 4, 2.6, 0.2, '#6b3429');
    // nose ring
    c.strokeStyle = s.trim; c.lineWidth = 2;
    c.beginPath(); c.arc(0, 16, 7, 0.1, Math.PI - 0.1); c.stroke();
    // eyes (intentionally dull)
    if (expr === 'hit' || expr === 'ko') {
      c.strokeStyle = '#3b2114'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(-13, -10); c.lineTo(-4, -3); c.moveTo(-4, -10); c.lineTo(-13, -3); c.stroke();
      c.beginPath(); c.moveTo(9, -10); c.lineTo(18, -3); c.moveTo(18, -10); c.lineTo(9, -3); c.stroke();
    } else {
      fillEllipse(c, -8, -7, 7, 6, 0, '#f7ead5');
      fillEllipse(c, 14, -7, 7, 6, 0, '#f7ead5');
      fillEllipse(c, -7, -7, 3.4, 3.6, 0, '#22120d');
      fillEllipse(c, 15, -7, 3.2, 3.5, 0, '#22120d');
      c.fillStyle = '#fff';
      fillEllipse(c, -8, -8.5, 1, 1, 0, '#fff');
      fillEllipse(c, 14, -8.5, 1, 1, 0, '#fff');
    }
    // mouth
    if (expr === 'hit' || expr === 'ko') {
      fillEllipse(c, 9, 24, 7, 5, 0, '#4a1c17');
      c.fillStyle = '#eeb3a4'; fillEllipse(c, 9, 26, 3.5, 1.8, 0, '#eeb3a4');
    } else {
      c.strokeStyle = '#8b4938'; c.lineWidth = 2;
      c.beginPath(); c.moveTo(0, 24); c.quadraticCurveTo(10, 28, 19, 23); c.stroke();
    }
    // blush
    c.globalAlpha = 0.22;
    fillEllipse(c, -22, 17, 7, 4, 0, '#d75c4f');
    c.globalAlpha = 1;
    c.restore();
  }

  function drawRooHead(c, s, opts) {
    var expr = opts.expression || 'idle';
    c.save();
    // ears
    c.save();
    c.rotate(-0.08);
    c.strokeStyle = s.skinDark; c.lineWidth = 19; c.lineCap = 'round';
    c.beginPath(); c.moveTo(-15, -25); c.quadraticCurveTo(-27, -60, -22, -91); c.stroke();
    c.strokeStyle = s.skin; c.lineWidth = 14;
    c.beginPath(); c.moveTo(-15, -25); c.quadraticCurveTo(-27, -60, -22, -91); c.stroke();
    c.strokeStyle = '#e9a39a'; c.lineWidth = 6;
    c.beginPath(); c.moveTo(-17, -35); c.quadraticCurveTo(-25, -62, -22, -82); c.stroke();
    c.restore();
    c.save();
    c.rotate(0.12);
    c.strokeStyle = s.skinDark; c.lineWidth = 19; c.lineCap = 'round';
    c.beginPath(); c.moveTo(14, -25); c.quadraticCurveTo(29, -60, 26, -90); c.stroke();
    c.strokeStyle = s.skin; c.lineWidth = 14;
    c.beginPath(); c.moveTo(14, -25); c.quadraticCurveTo(29, -60, 26, -90); c.stroke();
    c.strokeStyle = '#e9a39a'; c.lineWidth = 6;
    c.beginPath(); c.moveTo(16, -35); c.quadraticCurveTo(27, -62, 25, -81); c.stroke();
    c.restore();
    // neck
    fillRR(c, -7, 25, 28, 25, 10, s.skinDark);
    // head
    var hg = c.createLinearGradient(-34, -38, 33, 36);
    hg.addColorStop(0, '#f8d35f'); hg.addColorStop(0.55, s.skin); hg.addColorStop(1, s.skinDark);
    fillEllipse(c, 0, -1, 37, 38, 0, hg);
    // muzzle
    var mg = c.createLinearGradient(-10, 6, 30, 34);
    mg.addColorStop(0, '#ffe899'); mg.addColorStop(1, '#e7b747');
    fillEllipse(c, 10, 14, 27, 18, 0.04, mg);
    // nose
    fillEllipse(c, 25, 9, 9, 7, 0.2, '#3a2818');
    c.fillStyle = 'rgba(255,255,255,0.25)';
    fillEllipse(c, 22, 7, 3, 2, 0, 'rgba(255,255,255,0.25)');
    // eyes
    if (expr === 'hit' || expr === 'ko') {
      c.strokeStyle = '#4a3010'; c.lineWidth = 3;
      c.beginPath(); c.moveTo(-13, -8); c.lineTo(-4, -2); c.moveTo(-4, -8); c.lineTo(-13, -2); c.stroke();
      c.beginPath(); c.moveTo(8, -8); c.lineTo(17, -2); c.moveTo(17, -8); c.lineTo(8, -2); c.stroke();
    } else {
      fillEllipse(c, -7, -5, 8, 8, 0, '#fff7df');
      fillEllipse(c, 13, -5, 8, 8, 0, '#fff7df');
      fillEllipse(c, -5, -4, 3.5, 4, 0, '#34210e');
      fillEllipse(c, 15, -4, 3.5, 4, 0, '#34210e');
      c.fillStyle = '#fff';
      fillEllipse(c, -6, -5.5, 1.1, 1.1, 0, '#fff');
      fillEllipse(c, 14, -5.5, 1.1, 1.1, 0, '#fff');
    }
    // cheeks
    c.globalAlpha = 0.22;
    fillEllipse(c, -20, 13, 8, 4, 0, '#dc5e4b');
    c.globalAlpha = 1;
    // mouth + buck teeth
    c.strokeStyle = '#7a4b17'; c.lineWidth = 2.2;
    if (expr === 'hit' || expr === 'ko') {
      fillEllipse(c, 10, 27, 7, 5.5, 0, '#592b17');
      c.fillStyle = '#fff2d0'; fillRR(c, 4, 21, 6, 6, 1.5, '#fff2d0'); fillRR(c, 12, 21, 6, 6, 1.5, '#fff2d0');
    } else {
      c.beginPath(); c.moveTo(0, 26); c.quadraticCurveTo(11, 32, 22, 25); c.stroke();
      c.fillStyle = '#fff4d4';
      fillRR(c, 4, 22, 6, 7, 1.5, '#fff4d4');
      fillRR(c, 12, 22, 6, 7, 1.5, '#fff4d4');
    }
    c.restore();
  }

  function drawBotHead(c, s, opts) {
    var expr = opts.expression || 'idle';
    c.save();
    // antenna
    c.strokeStyle = '#8aa6a8'; c.lineWidth = 2.5; c.lineCap = 'round';
    c.beginPath(); c.moveTo(0, -32); c.quadraticCurveTo(4, -50, 11, -55); c.stroke();
    c.fillStyle = s.accent;
    c.shadowColor = s.accent; c.shadowBlur = 9;
    fillEllipse(c, 12, -56, 4, 4, 0, s.accent);
    c.shadowBlur = 0;
    // ear pods
    fillRR(c, -44, -13, 13, 25, 6, '#bacbc9');
    fillRR(c, 31, -13, 13, 25, 6, '#bacbc9');
    c.fillStyle = s.accent;
    fillRR(c, -41, -8, 4, 14, 2, s.accent);
    fillRR(c, 37, -8, 4, 14, 2, s.accent);
    // neck
    fillRR(c, -9, 25, 27, 25, 9, '#b8c9c8');
    fillRR(c, -17, 27, 34, 8, 4, s.accent);
    // bean head
    var hg = c.createLinearGradient(-38, -35, 35, 38);
    hg.addColorStop(0, '#ffffff'); hg.addColorStop(0.55, s.skin); hg.addColorStop(1, '#c6d5d3');
    fillEllipse(c, 0, 0, 38, 35, -0.03, hg);
    c.strokeStyle = 'rgba(73,114,116,0.55)'; c.lineWidth = 2; c.stroke();
    // visor
    var vg = c.createLinearGradient(-25, -18, 25, 12);
    vg.addColorStop(0, '#142b30'); vg.addColorStop(0.5, '#08171c'); vg.addColorStop(1, '#17393d');
    fillRR(c, -26, -19, 52, 28, 13, vg);
    c.strokeStyle = 'rgba(109,225,226,0.38)'; c.lineWidth = 1.4; c.stroke();
    // reflection
    c.globalAlpha = 0.22;
    c.fillStyle = '#b9feff';
    c.beginPath(); c.moveTo(-22, -12); c.lineTo(-8, -16); c.lineTo(-20, 3); c.closePath(); c.fill();
    c.globalAlpha = 1;
    // eyes
    c.strokeStyle = s.accent; c.lineWidth = 4; c.lineCap = 'round';
    c.shadowColor = s.accent; c.shadowBlur = 8;
    if (expr === 'hit' || expr === 'ko') {
      c.beginPath(); c.moveTo(-13, -10); c.lineTo(-4, -3); c.moveTo(-4, -10); c.lineTo(-13, -3); c.stroke();
      c.beginPath(); c.moveTo(7, -10); c.lineTo(16, -3); c.moveTo(16, -10); c.lineTo(7, -3); c.stroke();
    } else {
      c.beginPath(); c.arc(-9, -6, 5, Math.PI * 0.15, Math.PI * 0.85); c.stroke();
      c.beginPath(); c.arc(10, -6, 5, Math.PI * 0.15, Math.PI * 0.85); c.stroke();
    }
    c.shadowBlur = 0;
    // cheek lights
    c.globalAlpha = 0.55;
    fillEllipse(c, -30, 15, 3, 2, 0, s.accent);
    fillEllipse(c, 30, 15, 3, 2, 0, s.accent);
    c.globalAlpha = 1;
    // little mouth LED
    c.strokeStyle = 'rgba(109,225,226,0.7)'; c.lineWidth = 2;
    if (expr === 'hit') {
      c.beginPath(); c.arc(0, 19, 5, 0.2, Math.PI - 0.2); c.stroke();
    } else {
      c.beginPath(); c.moveTo(-4, 19); c.quadraticCurveTo(0, 22, 4, 19); c.stroke();
    }
    // forehead gloss
    c.strokeStyle = 'rgba(255,255,255,0.75)'; c.lineWidth = 3;
    c.beginPath(); c.arc(-8, -20, 17, Math.PI * 1.05, Math.PI * 1.3); c.stroke();
    c.restore();
  }

  function drawHead(c, s, opts) {
    if (s.head === 'cow') drawCowHead(c, s, opts);
    else if (s.head === 'roo') drawRooHead(c, s, opts);
    else if (s.head === 'bot') drawBotHead(c, s, opts);
    else drawSuitHead(c, s, opts);
  }

  function drawCharacter3D(c, s, opts) {
    var fur = s.body === 'fur';
    var bot = s.body === 'bot';
    var glow = fur ? '#fff1b2' : (bot ? '#b9ffff' : '#ffd9cf');
    var sheen = fur ? 'rgba(255,248,190,' : (bot ? 'rgba(160,255,255,' : 'rgba(255,226,214,');

    // ambient occlusion under the hips
    c.save();
    c.globalAlpha = 0.55;
    var ao = c.createRadialGradient(0, -174, 4, 0, -174, 76);
    ao.addColorStop(0, 'rgba(0,0,0,0.62)');
    ao.addColorStop(0.55, 'rgba(0,0,0,0.24)');
    ao.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = ao;
    fillEllipse(c, 0, -174, 77, 19, 0, ao);
    c.restore();

    // crease between the two lobes
    c.save();
    c.globalAlpha = 0.6;
    var seam = c.createLinearGradient(0, -266, 0, -176);
    seam.addColorStop(0, 'rgba(0,0,0,0)');
    seam.addColorStop(0.35, 'rgba(0,0,0,0.55)');
    seam.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = seam;
    c.fillRect(-7, -266, 14, 92);
    c.restore();

    // glossy specular highlights on the latex / fur / armor
    c.save();
    c.globalCompositeOperation = 'lighter';
    function gloss(cx, cy, rx, ry, rot, alpha) {
      var g = c.createRadialGradient(cx, cy, 0, cx, cy, Math.max(rx, ry));
      g.addColorStop(0, sheen + alpha + ')');
      g.addColorStop(0.35, sheen + alpha * 0.45 + ')');
      g.addColorStop(1, sheen + '0)');
      c.fillStyle = g;
      fillEllipse(c, cx, cy, rx, ry, rot, g);
    }
    gloss(-44, -246, 7, 29, -0.35, fur ? 0.36 : (bot ? 0.42 : 0.28));
    gloss(38, -240, 5, 23, 0.28, fur ? 0.28 : (bot ? 0.36 : 0.22));
    gloss(-29, -327, 11, 17, -0.3, 0.12);
    gloss(30, -330, 7, 14, 0.2, 0.10);
    gloss(-58, -383, 7, 11, 0.1, bot ? 0.42 : 0.16);
    if (bot) {
      c.globalAlpha = 0.55;
      fillEllipse(c, -47, -252, 2.2, 3.2, -0.2, glow);
      fillEllipse(c, 35, -245, 1.8, 2.8, 0.2, glow);
    }
    c.restore();

    // warm rim light from the stage spot
    c.save();
    c.globalAlpha = 0.56;
    c.lineCap = 'round';
    c.strokeStyle = fur ? 'rgba(255,225,120,0.5)' : (bot ? 'rgba(127,244,244,0.55)' : 'rgba(255,174,132,0.48)');
    c.lineWidth = 4;
    c.beginPath();
    c.moveTo(-61, -314);
    c.quadraticCurveTo(-67, -268, -55, -227);
    c.stroke();
    c.beginPath();
    c.moveTo(-55, -181);
    c.quadraticCurveTo(-67, -111, -73, -35);
    c.stroke();
    c.globalAlpha = 0.36;
    c.strokeStyle = 'rgba(170,215,255,0.55)';
    c.lineWidth = 2.6;
    c.beginPath();
    c.moveTo(52, -320);
    c.quadraticCurveTo(64, -270, 53, -224);
    c.stroke();
    c.beginPath();
    c.moveTo(53, -178);
    c.quadraticCurveTo(63, -110, 70, -40);
    c.stroke();
    c.restore();

    // floor contact bounce light
    c.save();
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = 0.16;
    var bounce = c.createRadialGradient(0, 8, 4, 0, 8, 90);
    bounce.addColorStop(0, 'rgba(255,142,74,0.7)');
    bounce.addColorStop(1, 'rgba(255,142,74,0)');
    c.fillStyle = bounce;
    c.fillRect(-100, -20, 200, 60);
    c.restore();
  }

  function drawCharacter(x, y, skin, opts) {
    opts = opts || {};
    var t = opts.t !== undefined ? opts.t : game.clock;
    var scale = opts.scale || 1;
    var alpha = opts.alpha === undefined ? 1 : opts.alpha;
    var rot = opts.rot || 0;
    var bob = Math.sin(t * 1.7) * 2.2;
    var headTurn = Math.sin(t * 0.8) * 0.045;

    var c = ctx;
    c.save();
    c.globalAlpha = alpha;
    // shadow
    c.save();
    c.translate(x, y + 4);
    c.scale(scale, scale);
    var sh = c.createRadialGradient(0, 0, 5, 0, 0, 125);
    sh.addColorStop(0, 'rgba(0,0,0,0.65)');
    sh.addColorStop(0.55, 'rgba(0,0,0,0.34)');
    sh.addColorStop(1, 'rgba(0,0,0,0)');
    c.fillStyle = sh;
    fillEllipse(c, 0, 5, 126, 24, 0, sh);
    c.restore();

    c.translate(x, y + bob);
    c.rotate(rot);
    c.scale(scale, scale);

    drawLegs(c, skin, opts);
    drawTorso(c, skin, opts);
    drawButt(c, skin, opts);
    drawJacketTails(c, skin, opts);
    drawArms(c, skin, opts);

    // head group
    c.save();
    c.translate(-44, -360);
    c.rotate(0.1 + headTurn + (opts.hitDir || 0) * 0.035 * (opts.hitFlash || 0));
    var hs = skin.head === 'suit' ? 1.12 : 1.05;
    c.scale(hs, hs);
    drawHead(c, skin, {
      expression: opts.expression || 'idle',
      hitFlash: opts.hitFlash || 0,
      sweat: opts.sweat,
      t: t
    });
    c.restore();

    drawCharacter3D(c, skin, opts);

    // hit flash overlay (limited, no gore)
    if (opts.hitFlash > 0) {
      c.globalAlpha = alpha * opts.hitFlash * 0.30;
      c.globalCompositeOperation = 'lighter';
      var fg = c.createRadialGradient(0, -230, 4, 0, -230, 130);
      fg.addColorStop(0, '#fff2c4'); fg.addColorStop(0.6, '#ff9e5d'); fg.addColorStop(1, 'rgba(255,80,40,0)');
      c.fillStyle = fg;
      c.fillRect(-160, -380, 320, 300);
      c.globalCompositeOperation = 'source-over';
    }
    c.restore();
  }

  function drawAvatar(skin, x, y, r, selected, locked) {
    ctx.save();
    // outer ring
    if (selected) {
      ctx.shadowColor = '#f4c76e'; ctx.shadowBlur = 14;
      fillEllipse(ctx, x, y, r + 4, r + 4, 0, '#f4c76e');
      ctx.shadowBlur = 0;
    } else {
      fillEllipse(ctx, x, y, r + 3, r + 3, 0, 'rgba(204,159,92,0.35)');
    }
    var ag = ctx.createRadialGradient(x - r * 0.3, y - r * 0.35, 2, x, y, r);
    ag.addColorStop(0, rgba(skin.accent, 0.55));
    ag.addColorStop(0.7, '#261019');
    ag.addColorStop(1, '#0d070a');
    fillEllipse(ctx, x, y, r, r, 0, ag);
    ctx.save();
    ellipsePath(ctx, x, y, r - 2, r - 2, 0);
    ctx.clip();
    ctx.translate(x, y + r * 0.20);
    var sc = r / 44;
    if (skin.head === 'cow') sc = r / 58;
    if (skin.head === 'roo') sc = r / 60;
    if (skin.head === 'bot') sc = r / 50;
    ctx.scale(sc, sc);
    drawHead(ctx, skin, { expression: 'idle', hitFlash: 0, t: game.menuT });
    ctx.restore();
    // gloss
    ctx.globalAlpha = 0.25;
    fillEllipse(ctx, x - r * 0.28, y - r * 0.42, r * 0.35, r * 0.16, -0.5, '#ffffff');
    ctx.globalAlpha = 1;
    if (selected) {
      ctx.strokeStyle = '#ffe1a0'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, y, r + 5, 0, TAU); ctx.stroke();
    }
    if (locked) {
      ctx.fillStyle = 'rgba(4,2,4,0.58)';
      fillEllipse(ctx, x, y, r, r, 0, 'rgba(4,2,4,0.58)');
      // lock
      ctx.strokeStyle = '#e8c986'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(x, y - 4, 7, Math.PI, TAU); ctx.stroke();
      fillRR(ctx, x - 10, y - 3, 20, 15, 4, '#e8c986');
      ctx.fillStyle = '#2a150b';
      fillEllipse(ctx, x, y + 4, 2.2, 3.5, 0, '#2a150b');
    }
    ctx.restore();
  }

  /* ------------------------------------------------------------
     Targets, combat math, effects
     ------------------------------------------------------------ */
  function targetPose() {
    var run = game.run;
    var t = game.clock;
    var phase = run && run.target ? run.target.phase : 1.7;
    var stagger = run && run.target ? run.target.stagger : 0;
    var lean = run && run.target ? run.target.hitLean : 0;
    var speed = 0.72;
    if (run && run.target && run.target.enraged) speed = 0.95;
    var aimShift = (game.pointer.x - 195) * -0.014;
    var x = 195 + Math.sin(t * speed + phase) * 43 + Math.sin(t * 1.7 + phase * 2) * 5 + stagger + aimShift;
    var y = (run ? 694 : 692) + Math.sin(t * 1.55 + phase) * 2.2;
    var rot = Math.sin(t * 0.58 + phase) * 0.018 + stagger * 0.0006 + lean;
    return { x: x, y: y, rot: rot, scale: 1 };
  }

  function hitZoneAt(px, py) {
    if (!game.run || !game.run.target) return null;
    var p = targetPose();
    var dx = px - p.x;
    var dy = py - p.y;
    var cos = Math.cos(-p.rot), sin = Math.sin(-p.rot);
    var lx = cos * dx - sin * dy;
    var ly = sin * dx + cos * dy;
    var stats = game.run.stats;
    var br = 1 + (stats ? stats.buttRadius : 0);
    // head
    if ((lx + 44) * (lx + 44) / (44 * 44) + (ly + 358) * (ly + 358) / (47 * 47) <= 1) {
      return { zone: 'head', lx: lx, ly: ly, x: px, y: py };
    }
    // butt
    if ((lx) * (lx) / (78 * br * 78 * br) + (ly + 222) * (ly + 222) / (58 * br * 58 * br) <= 1) {
      return { zone: 'butt', lx: lx, ly: ly, x: px, y: py };
    }
    // torso
    if ((lx + 4) * (lx + 4) / (60 * 60) + (ly + 300) * (ly + 300) / (78 * 78) <= 1) {
      return { zone: 'body', lx: lx, ly: ly, x: px, y: py };
    }
    return null;
  }

  function computeStats(runArg) {
    var up = runArg && runArg.up ? runArg.up : (game.run ? game.run.up : {});
    var perk = selectedSkin().perk || {};
    var lvl = game.save.gunLevel;
    var dmg = gunDamage() * (1 + (up.damage || 0) * 0.22) * (1 + (perk.damage || 0));
    var interval = 0.235 / (1 + (up.rate || 0) * 0.13);
    var mag = 8 + (up.mag || 0) * 2;
    var reload = Math.max(0.45, 0.92 - (up.mag || 0) * 0.035);
    return {
      damage: dmg,
      interval: interval,
      mag: mag,
      reload: reload,
      crit: 0.07 + (up.crit || 0) * 0.07 + (perk.crit || 0),
      buttMult: 2 + (up.buttMult || 0) * 0.5,
      buttRadius: (up.buttRadar || 0) * 0.14,
      coinMult: (1 + (up.gold || 0) * 0.25) * (1 + (perk.coin || 0)),
      scoreMult: 1 + (perk.score || 0),
      echo: (up.echo || 0) * 0.15,
      double: (up.double || 0) * 0.12
    };
  }

  function makeTarget(wave) {
    var hp = 1500 + (wave - 1) * 750 + Math.pow(wave - 1, 2) * 120;
    return {
      skinId: game.save.skin, wave: wave, hp: hp, maxHp: hp,
      phase: rand(0, 10), stagger: 0, hitFlash: 0, buttJiggle: 0,
      headJiggle: 0, hitLean: 0, hitDir: 0, expression: 'idle', expressionT: 0,
      tauntT: rand(2.6, 5.2), dead: false, enraged: false, intro: 0.8
    };
  }

  function makeRun() {
    var run = {
      time: RUN_TIME, elapsed: 0, wave: 1, score: 0,
      coinsEarned: 0, coinsSpent: 0,
      shots: 0, hits: 0, buttHits: 0, headHits: 0, bodyHits: 0,
      combo: 0, maxCombo: 0, comboTimer: 0,
      ammo: 0, reloading: false, reloadT: 0, fireCd: 0,
      recoil: 0, muzzle: 0, shake: 0, flash: 0, flashColor: '#fff0c4',
      up: {}, stats: null,
      target: null, ko: null, shop: null, bubble: null,
      particles: [], rings: [], tracers: [], floaters: [], casings: [], holes: [], pendingShots: [],
      goldenActive: false, goldenLeft: 0, nextGolden: rand(8, 11),
      tutorial: 4.2, tip: '', lastShot: -10, hitStop: 0,
      comboPop: 0, newBest: false
    };
    run.target = makeTarget(1);
    run.stats = computeStats(run);
    run.ammo = run.stats.mag;
    return run;
  }

  function startRun() {
    AudioSys.unlock();
    game.run = makeRun();
    game.scene = 'playing';
    game.result = null;
    game.resultT = 0;
    game.aimZone = null;
    game.modal = null;
    game.pressedButton = null;
    game.pointer.down = false;
    game.pointer.firing = false;
    game.toast = null;
    game.lose = null;
    game.transition = 0.55;
    AudioSys.stopLose();
    AudioSys.music(true);
    AudioSys.duck(false);
    if (HAS_WX && wx.vibrateShort) { try { wx.vibrateShort({ type: 'light' }); } catch (e) {} }
  }

  function addCoins(n, silent) {
    n = Math.round(n);
    if (n <= 0) return;
    game.save.coins += n;
    if (game.run) game.run.coinsEarned += n;
    game.coinPop = 1;
    if (!silent) AudioSys.sfx('coin');
  }

  function addScore(n) {
    if (game.run) game.run.score += Math.round(n);
  }

  function spawnParticle(x, y, vx, vy, life, size, color, type) {
    if (!game.run) return;
    game.run.particles.push({
      x: x, y: y, vx: vx, vy: vy, life: life, maxLife: life,
      size: size, color: color, type: type || 'spark', rot: rand(0, TAU), vr: rand(-9, 9)
    });
  }

  function spawnHitBurst(x, y, zone, crit, golden) {
    var run = game.run;
    var n = zone === 'butt' ? 20 : 11;
    var colors = zone === 'butt'
      ? ['#ffd76f', '#ffb34d', '#ff7c92', '#fff3c4']
      : (zone === 'head' ? ['#ffd0d0', '#ff8b91', '#fff0d0'] : ['#f6dfae', '#caa06b', '#fff4d6']);
    for (var i = 0; i < n; i++) {
      var a = rand(0, TAU);
      var sp = rand(70, crit ? 330 : 240);
      spawnParticle(x, y, Math.cos(a) * sp, Math.sin(a) * sp - 40, rand(0.35, 0.8), rand(1.5, 4.2), choice(colors), 'spark');
    }
    if (zone === 'butt') {
      for (var j = 0; j < 5; j++) {
        var a2 = rand(-Math.PI, 0);
        spawnParticle(x, y, Math.cos(a2) * rand(50, 170), Math.sin(a2) * rand(80, 220), rand(0.5, 0.9), rand(6, 10), '#ffd05a', 'coin');
      }
    }
    if (golden) {
      for (var k = 0; k < 12; k++) {
        var a3 = rand(0, TAU);
        spawnParticle(x, y, Math.cos(a3) * rand(100, 280), Math.sin(a3) * rand(100, 280), rand(0.5, 1.0), rand(2, 5), '#ffe9a4', 'star');
      }
    }
    run.rings.push({ x: x, y: y, r: 8, vr: zone === 'butt' ? 260 : 170, life: 0.42, maxLife: 0.42, color: zone === 'butt' ? '#ffd369' : '#ffe9c4', lw: zone === 'butt' ? 4 : 2.2 });
  }

  function addFloater(x, y, str, color, size, vy, vx) {
    if (!game.run) return;
    game.run.floaters.push({
      x: x, y: y, text: str, color: color, size: size || 18,
      vy: vy === undefined ? -58 : vy, vx: vx || 0,
      life: 0.82, maxLife: 0.82
    });
  }

  function updateTargetExpression(dt) {
    var run = game.run;
    var t = run.target;
    if (!t) return;
    t.hitFlash = Math.max(0, t.hitFlash - dt * 5.2);
    t.buttJiggle = Math.max(0, t.buttJiggle - dt * 2.5);
    t.headJiggle = Math.max(0, t.headJiggle - dt * 4);
    t.hitLean *= Math.pow(0.0006, dt);
    t.stagger *= Math.pow(0.0025, dt);
    t.expressionT -= dt;
    if (t.expressionT <= 0) t.expression = 'idle';
    t.tauntT -= dt;
    if (t.tauntT <= 0 && !run.ko) {
      t.tauntT = rand(4.5, 7.5);
      if (!run.bubble || run.bubble.t <= 0) {
        run.bubble = { text: choice(QUOTES.body), t: 1.6, color: '#f3d8ad' };
      }
    }
    t.enraged = t.hp < t.maxHp * 0.35;
  }

  function startReload(manual) {
    var run = game.run;
    if (!run || run.reloading || run.ko) return;
    if (run.ammo >= run.stats.mag) {
      if (manual) showToast('弹巢是满的', 'soft');
      return;
    }
    run.reloading = true;
    run.reloadT = run.stats.reload;
    AudioSys.sfx('reload');
    if (manual) run.tip = '装填中……';
  }

  function finishReload() {
    var run = game.run;
    run.reloading = false;
    run.ammo = run.stats.mag;
    run.reloadT = 0;
    AudioSys.sfx('click');
  }

  function gunGeometry() {
    var aimX = game.pointer.x, aimY = game.pointer.y;
    var gx = 313, gy = 802;
    var angle = Math.atan2(aimY - gy, aimX - gx);
    angle = clamp(angle, -2.98, -0.30);
    var recoil = game.run ? game.run.recoil * 15 : 0;
    return {
      gx: gx, gy: gy, angle: angle, recoil: recoil,
      mx: gx + Math.cos(angle) * (126 - recoil),
      my: gy + Math.sin(angle) * (126 - recoil)
    };
  }

  function fireBullet(isExtra) {
    var run = game.run;
    if (!run || run.ko) return;
    var stats = run.stats;
    if (!isExtra) {
      if (run.reloading) return;
      if (run.ammo <= 0) { startReload(false); return; }
      run.ammo--;
      run.shots++;
      run.fireCd = stats.interval;
      run.recoil = 1;
      run.muzzle = 0.09;
      AudioSys.sfx('shot');
      // casing
      var g = gunGeometry();
      run.casings.push({
        x: g.gx + Math.cos(g.angle) * 30, y: g.gy + Math.sin(g.angle) * 30 - 8,
        vx: rand(90, 190), vy: rand(-190, -100), rot: rand(0, TAU), vr: rand(-14, 14),
        life: 1.4, maxLife: 1.4
      });
    }

    var ax = game.pointer.x, ay = game.pointer.y;
    var hit = hitZoneAt(ax, ay);
    var g2 = gunGeometry();
    run.tracers.push({
      x1: g2.mx, y1: g2.my, x2: hit ? hit.x : ax, y2: hit ? hit.y : ay,
      life: 0.09, maxLife: 0.09, color: hit ? (hit.zone === 'butt' ? '#ffd36a' : '#ffe7b8') : 'rgba(255,236,200,0.55)', width: hit ? 2.6 : 1.2
    });

    if (!hit) {
      run.combo = 0;
      run.comboTimer = 0;
      run.lastShot = run.elapsed;
      run.holes.push({ x: ax + rand(-2, 2), y: ay + rand(-2, 2), r: rand(2.5, 5), rot: rand(0, TAU), life: 5, maxLife: 5 });
      if (run.holes.length > 28) run.holes.shift();
      if (Math.random() < 0.20) {
        if (!run.bubble || run.bubble.t <= 0) run.bubble = { text: choice(QUOTES.miss), t: 1.1, color: '#b8a48d' };
      }
      return;
    }

    run.hits++;
    run.lastShot = run.elapsed;
    var zone = hit.zone;
    var golden = run.goldenActive;
    var crit = Math.random() < stats.crit;
    var mult = 1;
    var poseNow = targetPose();
    var dir = ax < poseNow.x ? 1 : -1;
    run.target.hitDir = dir;
    if (zone === 'butt') {
      mult = golden ? stats.buttMult + 1.1 : stats.buttMult;
      run.buttHits++;
      run.target.buttJiggle = 1;
      run.target.hitLean = dir * (crit ? 0.10 : 0.072);
      run.target.stagger += dir * 5 * (crit ? 1.8 : 1);
    } else if (zone === 'head') {
      mult = 0.62; run.headHits++; run.target.headJiggle = 1;
      run.target.hitLean = dir * 0.042;
    } else {
      mult = 1; run.bodyHits++;
      run.target.hitLean = dir * 0.028;
    }
    if (crit) mult *= 1.8;
    var dmg = stats.damage * mult;
    run.target.hp = Math.max(0, run.target.hp - dmg);
    run.target.hitFlash = 1;
    run.target.expression = 'hit';
    run.target.expressionT = 0.35;

    run.combo++;
    run.maxCombo = Math.max(run.maxCombo, run.combo);
    run.comboTimer = 1.55;
    run.comboPop = 1;
    var comboMult = 1 + Math.min(40, run.combo) * 0.02;
    var scoreGain = dmg * 8.2 * comboMult * stats.scoreMult * (zone === 'butt' ? 1.25 : 1);
    addScore(scoreGain);
    var baseCoin = zone === 'butt' ? 5 : (zone === 'head' ? 1 : 2);
    var coinGain = Math.round(baseCoin * stats.coinMult * comboMult * (golden ? 2 : 1));
    addCoins(coinGain);

    spawnHitBurst(hit.x, hit.y, zone, crit, golden);
    run.shake = Math.min(22, run.shake + (zone === 'butt' ? 8 : 3.5) + (crit ? 5 : 0));
    run.flash = Math.min(0.7, run.flash + (crit ? 0.16 : 0.04));
    run.flashColor = zone === 'butt' ? '#ffd878' : '#ffe9d0';

    var txt = Math.round(dmg).toString();
    addFloater(
      hit.x + rand(-27, 27), hit.y - 8 + rand(-15, 9), txt,
      zone === 'butt' ? '#ffe28a' : '#fff2cf', zone === 'butt' ? 23 : 17, -70, rand(-42, 42)
    );
    if (crit) addFloater(hit.x + rand(-34, 34), hit.y - 38, '暴击！', '#ff8a78', 16, -88, rand(-30, 30));
    if (zone === 'butt') {
      if (!run.bubble || run.bubble.t <= 0 || Math.random() < 0.4) run.bubble = { text: choice(QUOTES.butt), t: 1.2, color: '#ffd375' };
      if (HAS_WX && wx.vibrateShort) { try { wx.vibrateShort({ type: 'light' }); } catch (e) {} }
      AudioSys.sfx('butt');
    } else if (zone === 'head') {
      if (Math.random() < 0.35) run.bubble = { text: choice(QUOTES.head), t: 1.2, color: '#ffb0b0' };
      AudioSys.sfx('hit');
    } else {
      AudioSys.sfx('hit');
    }
    if (crit) AudioSys.sfx('crit');

    if (stats.echo > 0 && !isExtra && Math.random() < stats.echo) {
      run.ammo++;
    }
    if (stats.double > 0 && !isExtra && Math.random() < stats.double) {
      run.pendingShots.push({ t: 0.075, x: ax, y: ay });
    }
    if (run.ammo <= 0) startReload(false);
    if (run.target.hp <= 0 && !run.ko) startKo();
  }

  function startKo() {
    var run = game.run;
    if (!run || run.ko) return;
    run.ko = { t: 1.55, started: run.elapsed };
    run.target.dead = true;
    run.target.expression = 'ko';
    run.target.expressionT = 999;
    run.target.hitDir = run.target.hitDir || 1;
    run.target.hitLean = 0.09 * (run.target.hitDir || 1);
    run.pendingShots = [];
    game.pointer.down = false;
    game.pointer.firing = false;
    run.shake = 25;
    run.flash = 1;
    run.flashColor = '#ffe3a0';
    run.time = Math.min(99, run.time + 2.5);
    var bonus = 80 + run.wave * 35;
    addCoins(bonus);
    addScore(800 + run.wave * 280);
    addFloater(195, 350, 'KO！', '#ffe08a', 50, -42);
    addFloater(195, 392, '时间 +2.5s  金币 +' + bonus, '#ffd074', 15, -32);
    for (var i = 0; i < 45; i++) {
      var a = rand(-Math.PI, 0);
      var sp = rand(100, 360);
      spawnParticle(195 + rand(-45, 45), 475 + rand(-20, 20), Math.cos(a) * sp, Math.sin(a) * sp, rand(0.7, 1.6), rand(2.5, 7), choice(['#ffd15e', '#ffe9a4', '#ff8d76', '#fff4d6']), i % 4 === 0 ? 'coin' : 'spark');
    }
    run.rings.push({ x: 195, y: 475, r: 10, vr: 420, life: 0.8, maxLife: 0.8, color: '#ffe3a0', lw: 6 });
    AudioSys.sfx('ko');
    if (HAS_WX && wx.vibrateShort) { try { wx.vibrateShort({ type: 'medium' }); } catch (e) {} }
  }

  function openShop() {
    var run = game.run;
    if (!run) return;
    var pool = [];
    for (var i = 0; i < UPGRADES.length; i++) {
      var u = UPGRADES[i];
      if ((run.up[u.key] || 0) < u.max) {
        pool.push({
          key: u.key, name: u.name, desc: u.desc, max: u.max, color: u.color,
          level: run.up[u.key] || 0, cost: u.cost + (run.up[u.key] || 0) * 35, special: false
        });
      }
    }
    // shuffle
    for (var j = pool.length - 1; j > 0; j--) {
      var k = Math.floor(Math.random() * (j + 1));
      var tmp = pool[j]; pool[j] = pool[k]; pool[k] = tmp;
    }
    var cards = pool.slice(0, 3);
    while (cards.length < 3) {
      cards.push({
        key: 'coinpack', name: '应急赏金', desc: '免费领 70 金币', max: 99,
        color: '#ffd66e', level: 0, cost: 0, special: true
      });
    }
    run.shop = { cards: cards, selected: -1 };
    run.ko = null;
    game.scene = 'shop';
    game.shopT = 0;
    AudioSys.duck(true);
    AudioSys.sfx('coin');
  }

  function buyCard(card) {
    var run = game.run;
    if (!run || !card) return;
    if (card.special) {
      addCoins(70);
      showToast('应急赏金 +70', 'gold');
      closeShop();
      return;
    }
    if (run.up[card.key] >= card.max) return;
    if (game.save.coins < card.cost) {
      showToast('金币不够，去多打两枪', 'bad');
      AudioSys.sfx('click');
      return;
    }
    game.save.coins -= card.cost;
    run.coinsSpent += card.cost;
    run.up[card.key] = (run.up[card.key] || 0) + 1;
    run.stats = computeStats(run);
    AudioSys.sfx('buy');
    showToast(card.name + ' 已装备', 'gold');
    persist();
    closeShop();
  }

  function closeShop() {
    var run = game.run;
    if (!run) return;
    run.shop = null;
    game.scene = 'playing';
    AudioSys.duck(false);
    run.wave++;
    run.target = makeTarget(run.wave);
    run.ammo = run.stats.mag;
    run.reloading = false;
    run.reloadT = 0;
    run.ko = null;
    run.goldenActive = false;
    run.goldenLeft = 0;
    run.nextGolden = rand(7, 10);
    run.bubble = { text: choice(QUOTES.start), t: 2.0, color: '#e9cfab' };
    game.transition = 0.5;
    if (run.time <= 0) endRun();
  }

  function rankFor(score) {
    if (score >= 150000) return { rank: 'SSS', title: '琵琶武神', color: '#ffe49a' };
    if (score >= 100000) return { rank: 'S', title: '铁臀判官', color: '#ffd36a' };
    if (score >= 65000) return { rank: 'A', title: '神枪手', color: '#ffb56b' };
    if (score >= 35000) return { rank: 'B', title: '见习枪手', color: '#e9c7a0' };
    return { rank: 'C', title: '手抖患者', color: '#b9a28f' };
  }

  function endRun() {
    var run = game.run;
    if (!run || game.scene === 'result') return;
    if (run.time > 0 && game.scene === 'playing') {
      // Caller may end early from pause. Keep what was earned.
    }
    addCoins(50 + run.wave * 20, true);
    var shots = Math.max(1, run.shots);
    var acc = run.hits / shots;
    var buttRate = run.hits > 0 ? run.buttHits / run.hits : 0;
    var rank = rankFor(run.score);
    var isBest = run.score > game.save.best;
    if (isBest) game.save.best = Math.round(run.score);
    game.save.bestCombo = Math.max(game.save.bestCombo, run.maxCombo);
    game.save.bestButtRate = Math.max(game.save.bestButtRate, buttRate);
    game.save.plays++;
    game.result = {
      score: Math.round(run.score), rank: rank, accuracy: acc,
      buttRate: buttRate, maxCombo: run.maxCombo, wave: run.wave,
      shots: run.shots, hits: run.hits, buttHits: run.buttHits,
      coinsEarned: run.coinsEarned, coinsSpent: run.coinsSpent,
      lost: !!run.lost,
      isBest: isBest, plays: game.save.plays
    };
    game.scene = 'result';
    game.pointer.down = false;
    game.pointer.firing = false;
    game.transition = 0.8;
    game.resultT = 0;
    run.tutorial = 0;
    game.toast = null;
    AudioSys.duck(true);
    persist();
  }

  function quitToMenu() {
    if (game.scene === 'playing' || game.scene === 'paused' || game.scene === 'shop') {
      endRun();
      return;
    }
    game.scene = 'menu';
    game.run = null;
    game.result = null;
    game.pointer.firing = false;
    AudioSys.duck(false);
    persist();
  }

  function pauseGame() {
    if (game.scene !== 'playing') return;
    game.scene = 'paused';
    game.pointer.firing = false;
    game.pointer.down = false;
    AudioSys.duck(true);
    persist();
  }

  function resumeGame() {
    if (game.scene !== 'paused') return;
    game.scene = 'playing';
    AudioSys.duck(false);
  }

  function startLose() {
    if (!game.run || game.scene === 'losing' || game.scene === 'result') return;
    game.scene = 'losing';
    game.lose = { t: 0, duration: 2.95 };
    game.run.lost = true;
    game.pointer.down = false;
    game.pointer.firing = false;
    game.modal = null;
    game.toast = null;
    game.transition = 0;
    AudioSys.music(false);
    AudioSys.playLose();
    if (HAS_WX && wx.vibrateShort) { try { wx.vibrateShort({ type: 'heavy' }); } catch (e) {} }
  }

  function updateLose(dt) {
    if (!game.lose) { endRun(); return; }
    game.lose.t += dt;
    if (game.lose.t >= game.lose.duration) finishLose();
  }

  function finishLose() {
    if (game.scene !== 'losing') return;
    game.lose = null;
    AudioSys.stopLose();
    endRun();
  }

  function drawLose() {
    var lose = game.lose;
    var t = lose ? lose.t : 2.9;
    var sheet = game.assets.cutscene;

    ctx.save();
    ctx.fillStyle = '#050204';
    ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);

    if (sheet) {
      var frame = Math.min(14, Math.floor(t / 2.95 * 15));
      var sx = (frame % 5) * 320;
      var sy = Math.floor(frame / 5) * 692;
      var shake = (t > 1.35 && t < 1.75) ? 8 : 0;
      ctx.save();
      ctx.translate(rand(-shake, shake), rand(-shake, shake));
      var zoom = 1.025 + Math.sin(game.clock * 1.3) * 0.004;
      var w = DESIGN_W * zoom, h = DESIGN_H * zoom;
      ctx.drawImage(sheet, sx, sy, 320, 692, (DESIGN_W - w) / 2, (DESIGN_H - h) / 2, w, h);
      ctx.restore();
    } else {
      var fg = ctx.createRadialGradient(195, 430, 10, 195, 430, 440);
      fg.addColorStop(0, '#4b1019'); fg.addColorStop(0.55, '#1a070d'); fg.addColorStop(1, '#050204');
      ctx.fillStyle = fg;
      ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);
    }

    // red grade + vignette + scanlines
    ctx.save();
    ctx.fillStyle = 'rgba(44,4,9,0.22)';
    ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);
    var vg = ctx.createRadialGradient(195, 420, 150, 195, 430, 490);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(0.6, 'rgba(3,1,2,0.10)');
    vg.addColorStop(1, 'rgba(2,0,1,0.82)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);
    ctx.globalAlpha = 0.13;
    ctx.fillStyle = '#000';
    for (var sl = 0; sl < DESIGN_H; sl += 4) ctx.fillRect(0, sl, DESIGN_W, 1);
    ctx.restore();

    // cinematic bars
    var bar = ctx.createLinearGradient(0, 0, 0, 60);
    bar.addColorStop(0, 'rgba(0,0,0,0.94)'); bar.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = bar; ctx.fillRect(0, 0, DESIGN_W, 60);
    var bar2 = ctx.createLinearGradient(0, 744, 0, 844);
    bar2.addColorStop(0, 'rgba(0,0,0,0)'); bar2.addColorStop(1, 'rgba(0,0,0,0.96)');
    ctx.fillStyle = bar2; ctx.fillRect(0, 744, DESIGN_W, 100);

    // gunshot flash
    if (t > 1.44 && t < 1.68) {
      var fa = 1 - Math.abs((t - 1.56) / 0.12);
      ctx.save();
      ctx.globalAlpha = clamp(fa, 0, 1) * 0.68;
      ctx.fillStyle = '#fff0c2';
      ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);
      ctx.restore();
    }

    // top labels
    text(ctx, '● REC', 22, 36, 9, '#ff8b75', { weight: 'bold' });
    text(ctx, '录像回放 / 真实结局', 56, 36, 8, 'rgba(241,210,164,0.65)');
    text(ctx, 'PIPA PANIC · TAKE ' + (Math.floor(t * 10) % 9 + 1), 366, 36, 8, 'rgba(241,210,164,0.35)', { align: 'right' });

    // subtitles
    var line = '时间到。他站了起来。';
    if (t > 0.72) line = '他从屁股后面掏出了一把左轮。';
    if (t > 1.30) line = '砰！';
    if (t > 1.72) line = '你被屁股拿枪毙了。';
    if (t > 2.42) line = '菜就多练。';
    var alpha = clamp(t * 4, 0, 1);
    ctx.save();
    ctx.globalAlpha = alpha;
    fillRR(ctx, 34, 742, 322, 44, 11, 'rgba(12,5,8,0.78)');
    strokeRR(ctx, 34, 742, 322, 44, 11, 'rgba(232,185,108,0.28)', 1);
    text(ctx, line, 195, 770, 14, t > 1.7 ? '#ffcf9a' : '#f0d7ae', {
      align: 'center', weight: 'bold', stroke: 'rgba(30,8,6,0.85)', strokeWidth: 3
    });
    ctx.restore();

    if (t > 2.35) {
      var stamp = clamp((t - 2.35) / 0.22, 0, 1);
      ctx.save();
      ctx.globalAlpha = stamp;
      ctx.translate(195, 340 + (1 - easeOutBack(stamp)) * -20);
      ctx.rotate(-0.08);
      ctx.scale(0.7 + stamp * 0.3, 0.7 + stamp * 0.3);
      fillRR(ctx, -95, -34, 190, 68, 6, 'rgba(143,29,25,0.88)');
      strokeRR(ctx, -95, -34, 190, 68, 6, 'rgba(255,221,163,0.85)', 2);
      text(ctx, '反 杀', 0, 3, 34, '#ffe3b2', { align: 'center', baseline: 'middle', weight: 'bold' });
      ctx.restore();
    }

    if (t > 0.65 && t < 2.4) {
      text(ctx, '点击跳过', 365, 810, 8, 'rgba(239,204,155,0.45)', { align: 'right' });
    }

    // end fade
    if (t > 2.62) {
      ctx.save();
      ctx.globalAlpha = clamp((t - 2.62) / 0.33, 0, 1);
      ctx.fillStyle = '#030102';
      ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);
      ctx.restore();
    }

    drawGrain();
    ctx.restore();
  }

  /* ------------------------------------------------------------
     Effects update & draw
     ------------------------------------------------------------ */
  function updateEffects(dt) {
    var run = game.run;
    if (!run) return;
    var i;
    for (i = run.particles.length - 1; i >= 0; i--) {
      var p = run.particles[i];
      p.life -= dt;
      if (p.life <= 0) { run.particles.splice(i, 1); continue; }
      p.vy += (p.type === 'coin' ? 720 : 620) * dt;
      p.x += p.vx * dt; p.y += p.vy * dt;
      p.vx *= Math.pow(0.18, dt); p.vy *= Math.pow(0.55, dt);
      p.rot += p.vr * dt;
      if (p.y > 790 && p.vy > 0) { p.y = 790; p.vy *= -0.32; p.vx *= 0.7; }
    }
    for (i = run.rings.length - 1; i >= 0; i--) {
      var r = run.rings[i];
      r.life -= dt; r.r += r.vr * dt; r.vr *= Math.pow(0.1, dt);
      if (r.life <= 0) run.rings.splice(i, 1);
    }
    for (i = run.tracers.length - 1; i >= 0; i--) {
      run.tracers[i].life -= dt;
      if (run.tracers[i].life <= 0) run.tracers.splice(i, 1);
    }
    for (i = run.floaters.length - 1; i >= 0; i--) {
      var f = run.floaters[i];
      f.life -= dt;
      f.y += f.vy * dt;
      f.x += (f.vx || 0) * dt;
      f.vy *= Math.pow(0.35, dt);
      f.vx = (f.vx || 0) * Math.pow(0.4, dt);
      if (f.life <= 0) run.floaters.splice(i, 1);
    }
    for (i = run.casings.length - 1; i >= 0; i--) {
      var cs = run.casings[i];
      cs.life -= dt;
      if (cs.life <= 0) { run.casings.splice(i, 1); continue; }
      cs.vy += 900 * dt;
      cs.x += cs.vx * dt; cs.y += cs.vy * dt; cs.rot += cs.vr * dt;
      if (cs.y > 800 && cs.vy > 0) { cs.y = 800; cs.vy *= -0.4; cs.vx *= 0.7; cs.vr *= 0.8; }
    }
    for (i = run.holes.length - 1; i >= 0; i--) {
      run.holes[i].life -= dt;
      if (run.holes[i].life <= 0) run.holes.splice(i, 1);
    }
    if (run.bubble) { run.bubble.t -= dt; if (run.bubble.t <= 0) run.bubble = null; }
  }

  function drawHoles() {
    var run = game.run;
    if (!run) return;
    for (var i = 0; i < run.holes.length; i++) {
      var h = run.holes[i];
      var a = clamp(h.life / h.maxLife, 0, 1) * 0.7;
      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.rotate(h.rot);
      ctx.globalAlpha = a;
      ctx.fillStyle = '#080407';
      ctx.beginPath();
      for (var k = 0; k < 8; k++) {
        var ang = k / 8 * TAU;
        var rad = h.r * (k % 2 === 0 ? 1.7 : 0.7);
        if (k === 0) ctx.moveTo(Math.cos(ang) * rad, Math.sin(ang) * rad);
        else ctx.lineTo(Math.cos(ang) * rad, Math.sin(ang) * rad);
      }
      ctx.closePath(); ctx.fill();
      ctx.globalAlpha = a * 0.45;
      ctx.strokeStyle = '#d7b483'; ctx.lineWidth = 0.8;
      ctx.beginPath(); ctx.arc(0, 0, h.r * 2.6, 0, TAU); ctx.stroke();
      ctx.restore();
    }
  }

  function drawTarget() {
    var run = game.run;
    if (!run || !run.target) return;
    var t = run.target;
    var p = targetPose();
    var ko = run.ko;
    var koP = ko ? clamp((run.elapsed - ko.started) / 0.95, 0, 1) : 0;
    var alpha = ko ? (1 - koP * 0.16) : 1;
    var rot = p.rot + (ko ? koP * 0.50 : 0);
    var drawY = p.y + (ko ? koP * 62 : 0);
    var scale = 1 + (t.intro > 0 ? (1 - t.intro) * 0.02 : 0);
    if (t.intro > 0) {
      scale = lerp(0.78, 1, easeOutCubic(1 - t.intro / 0.8));
    }
    // platform glow
    ctx.save();
    var pulse = run.goldenActive ? (0.5 + 0.5 * Math.sin(game.clock * 9)) : 0;
    var pg = ctx.createRadialGradient(p.x, p.y - 4, 8, p.x, p.y - 4, 150);
    pg.addColorStop(0, 'rgba(255,196,100,' + (0.20 + pulse * 0.12) + ')');
    pg.addColorStop(0.55, 'rgba(189,75,43,0.08)');
    pg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = pg;
    ctx.fillRect(p.x - 170, p.y - 100, 340, 130);
    ctx.restore();

    // soft cast shadow on the stage curtain
    ctx.save();
    ctx.globalAlpha = 0.34;
    var cast = ctx.createRadialGradient(p.x + 42, p.y - 300, 14, p.x + 42, p.y - 300, 205);
    cast.addColorStop(0, 'rgba(0,0,0,0.62)');
    cast.addColorStop(0.55, 'rgba(0,0,0,0.27)');
    cast.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = cast;
    ctx.fillRect(p.x - 190, p.y - 570, 460, 480);
    ctx.restore();

    // soft backlight separates the character from the video plate
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = 0.18;
    var halo = ctx.createRadialGradient(p.x, p.y - 305, 20, p.x, p.y - 305, 250);
    halo.addColorStop(0, 'rgba(255,154,91,0.55)');
    halo.addColorStop(0.55, 'rgba(189,68,48,0.12)');
    halo.addColorStop(1, 'rgba(255,120,60,0)');
    ctx.fillStyle = halo;
    ctx.fillRect(p.x - 260, p.y - 570, 520, 420);
    ctx.restore();

    drawCharacter(p.x, drawY, skinById(t.skinId), {
      scale: scale, rot: rot, alpha: alpha, t: game.clock,
      expression: t.expression, hitFlash: t.hitFlash, buttJiggle: t.buttJiggle,
      hitDir: t.hitDir, hitLean: t.hitLean,
      golden: run.goldenActive, sweat: t.hp < t.maxHp * 0.25
    });

    // golden butt status near character
    if (run.goldenActive && !ko) {
      var gx = p.x, gy = p.y - 300;
      var gm = Math.round((run.stats.buttMult + 1.1) * 10) / 10;
      ctx.save();
      ctx.globalAlpha = 0.9;
      ctx.shadowColor = '#ffca5c'; ctx.shadowBlur = 14;
      text(ctx, '黄金臀 ×' + gm.toString().replace('.0', ''), gx, gy, 15, '#ffe6a1', {
        align: 'center', weight: 'bold', stroke: 'rgba(58,26,4,0.8)', strokeWidth: 3
      });
      ctx.restore();
    }

    // speech bubble
    if (run.bubble && run.bubble.t > 0 && !ko) {
      drawBubble(p.x - 86, p.y - 414, run.bubble.text, run.bubble.color, run.bubble.t);
    }
  }

  function drawBubble(x, y, str, color, life) {
    var a = clamp(life * 3, 0, 1);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = 'bold 13px "PingFang SC","Microsoft YaHei",sans-serif';
    var w = ctx.measureText(str).width + 22;
    var h = 30;
    fillRR(ctx, x - w / 2, y - h, w, h, 12, 'rgba(18,9,12,0.90)');
    strokeRR(ctx, x - w / 2, y - h, w, h, 12, 'rgba(232,189,112,0.62)', 1);
    ctx.fillStyle = 'rgba(18,9,12,0.90)';
    ctx.beginPath();
    ctx.moveTo(x - 5, y);
    ctx.lineTo(x + 5, y);
    ctx.lineTo(x + 14, y + 9);
    ctx.closePath(); ctx.fill();
    text(ctx, str, x, y - 11, 13, color, { align: 'center', weight: 'bold' });
    ctx.restore();
  }

  function drawEffects() {
    var run = game.run;
    if (!run) return;
    var i;
    // tracers under particles
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    for (i = 0; i < run.tracers.length; i++) {
      var tr = run.tracers[i];
      var a = clamp(tr.life / tr.maxLife, 0, 1);
      ctx.globalAlpha = a;
      ctx.strokeStyle = tr.color;
      ctx.lineWidth = tr.width;
      ctx.beginPath(); ctx.moveTo(tr.x1, tr.y1); ctx.lineTo(tr.x2, tr.y2); ctx.stroke();
      ctx.globalAlpha = a * 0.28;
      ctx.lineWidth = tr.width * 3;
      ctx.stroke();
    }
    ctx.restore();

    for (i = 0; i < run.rings.length; i++) {
      var rg = run.rings[i];
      var ra = clamp(rg.life / rg.maxLife, 0, 1);
      ctx.save();
      ctx.globalAlpha = ra * 0.8;
      ctx.strokeStyle = rg.color;
      ctx.lineWidth = rg.lw * ra;
      ctx.beginPath(); ctx.arc(rg.x, rg.y, rg.r, 0, TAU); ctx.stroke();
      ctx.restore();
    }

    for (i = 0; i < run.particles.length; i++) {
      var p = run.particles[i];
      var pa = clamp(p.life / p.maxLife, 0, 1);
      ctx.save();
      ctx.globalAlpha = pa;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      if (p.type === 'coin') {
        fillEllipse(ctx, 0, 0, p.size, p.size * 0.72, 0, '#f7c94c');
        ctx.strokeStyle = '#9e6317'; ctx.lineWidth = 1;
        ctx.beginPath(); ctx.arc(0, 0, p.size * 0.55, 0, TAU); ctx.stroke();
        ctx.fillStyle = '#fff1b1';
        ctx.fillRect(-0.8, -p.size * 0.45, 1.6, p.size * 0.9);
      } else if (p.type === 'star') {
        ctx.fillStyle = p.color;
        ctx.beginPath();
        for (var s = 0; s < 8; s++) {
          var aa = s / 8 * TAU;
          var rr = s % 2 === 0 ? p.size : p.size * 0.35;
          if (s === 0) ctx.moveTo(Math.cos(aa) * rr, Math.sin(aa) * rr);
          else ctx.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr);
        }
        ctx.closePath(); ctx.fill();
      } else {
        ctx.fillStyle = p.color;
        fillEllipse(ctx, 0, 0, p.size, p.size * 0.55, 0, p.color);
      }
      ctx.restore();
    }

    for (i = 0; i < run.casings.length; i++) {
      var cs = run.casings[i];
      ctx.save();
      ctx.globalAlpha = clamp(cs.life / cs.maxLife, 0, 1);
      ctx.translate(cs.x, cs.y); ctx.rotate(cs.rot);
      fillRR(ctx, -4, -2, 8, 4, 1.5, '#e3b85a');
      ctx.restore();
    }

    for (i = 0; i < run.floaters.length; i++) {
      var f = run.floaters[i];
      var fa = clamp(f.life / f.maxLife, 0, 1);
      ctx.save();
      ctx.globalAlpha = fa;
      var scale = f.life > f.maxLife - 0.12 ? easeOutBack((f.maxLife - f.life) / 0.12) : 1;
      ctx.translate(f.x, f.y);
      ctx.scale(scale, scale);
      text(ctx, f.text, 0, 0, f.size, f.color, {
        align: 'center', weight: 'bold',
        stroke: 'rgba(42,12,8,0.82)', strokeWidth: Math.max(2, f.size * 0.12),
        shadow: 'rgba(255,170,60,0.35)', shadowBlur: 8
      });
      ctx.restore();
    }
  }

  function drawGun() {
    var run = game.run;
    if (!run) return;
    var g = gunGeometry();
    var angle = g.angle;
    // arm + sleeve from bottom-right
    ctx.save();
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#09060a'; ctx.lineWidth = 56;
    ctx.beginPath(); ctx.moveTo(385, 900); ctx.lineTo(g.gx + 2, g.gy + 4); ctx.stroke();
    ctx.strokeStyle = '#1d1720'; ctx.lineWidth = 47;
    ctx.beginPath(); ctx.moveTo(385, 900); ctx.lineTo(g.gx + 2, g.gy + 4); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.moveTo(379, 882); ctx.lineTo(g.gx - 4, g.gy - 4); ctx.stroke();
    // cuff
    ctx.strokeStyle = '#c9a15b'; ctx.lineWidth = 6;
    ctx.beginPath(); ctx.arc(g.gx + 1, g.gy + 2, 23, Math.PI * 0.65, Math.PI * 1.6); ctx.stroke();
    ctx.restore();

    ctx.save();
    ctx.translate(g.gx, g.gy);
    ctx.rotate(angle);
    ctx.translate(-g.recoil, 0);

    // grip
    var gripG = ctx.createLinearGradient(-4, 10, -20, 55);
    gripG.addColorStop(0, '#3a2118'); gripG.addColorStop(0.55, '#1a0e0b'); gripG.addColorStop(1, '#0d0707');
    ctx.fillStyle = gripG;
    ctx.beginPath();
    ctx.moveTo(-2, 12); ctx.quadraticCurveTo(-26, 25, -24, 55);
    ctx.quadraticCurveTo(-8, 63, 4, 49); ctx.quadraticCurveTo(4, 28, 11, 14); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = 'rgba(218,171,91,0.22)'; ctx.lineWidth = 1.2; ctx.stroke();
    // grip checkering
    ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
    for (var gi = 0; gi < 4; gi++) {
      ctx.beginPath(); ctx.moveTo(-20 + gi * 2, 26 + gi * 7); ctx.lineTo(-4 + gi, 20 + gi * 7); ctx.stroke();
    }

    // trigger guard
    ctx.strokeStyle = '#b88b46'; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.arc(28, 17, 17, 0.1, Math.PI * 0.92); ctx.stroke();
    ctx.strokeStyle = '#e5c184'; ctx.lineWidth = 1.1;
    ctx.beginPath(); ctx.arc(28, 16, 17, 0.1, Math.PI * 0.92); ctx.stroke();

    // frame
    var metal = ctx.createLinearGradient(0, -18, 0, 12);
    metal.addColorStop(0, '#d6b275'); metal.addColorStop(0.24, '#8c663d');
    metal.addColorStop(0.5, '#4d3221'); metal.addColorStop(0.8, '#8b623e'); metal.addColorStop(1, '#301e15');
    fillRR(ctx, 2, -16, 46, 29, 8, metal);
    ctx.strokeStyle = 'rgba(255,222,164,0.34)'; ctx.lineWidth = 1;
    rrPath(ctx, 2, -16, 46, 29, 8); ctx.stroke();
    // barrel
    var barrel = ctx.createLinearGradient(0, -11, 0, 8);
    barrel.addColorStop(0, '#ffe3a8'); barrel.addColorStop(0.26, '#bd8d53');
    barrel.addColorStop(0.55, '#664326'); barrel.addColorStop(1, '#2f1e12');
    fillRR(ctx, 30, -11, 91, 20, 7, barrel);
    fillRR(ctx, 112, -8, 16, 15, 5, '#875d33');
    ctx.strokeStyle = 'rgba(255,214,143,0.45)'; ctx.lineWidth = 1.2;
    rrPath(ctx, 30, -11, 91, 20, 7); ctx.stroke();
    // barrel top rib
    ctx.fillStyle = 'rgba(255,235,185,0.35)';
    ctx.fillRect(44, -10, 69, 2.2);
    // cylinder
    var cyl = ctx.createRadialGradient(29, -3, 2, 29, 2, 27);
    cyl.addColorStop(0, '#c19a5f'); cyl.addColorStop(0.5, '#6a4729'); cyl.addColorStop(1, '#2b1b12');
    fillEllipse(ctx, 29, 1, 25, 24, 0, cyl);
    ctx.strokeStyle = '#1e120c'; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = 'rgba(240,205,133,0.45)'; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.arc(29, 1, 17, 0, TAU); ctx.stroke();
    ctx.beginPath(); ctx.arc(29, 1, 8, 0, TAU); ctx.stroke();
    for (var ch = 0; ch < 6; ch++) {
      var ca = ch / 6 * TAU + 0.3;
      ctx.fillStyle = '#17100c';
      fillEllipse(ctx, 29 + Math.cos(ca) * 13, 1 + Math.sin(ca) * 13, 3.1, 3.1, 0, '#17100c');
    }
    // hammer
    ctx.strokeStyle = '#c49959'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(1, -11); ctx.quadraticCurveTo(-10, -22, -4, -27); ctx.stroke();
    // red seal engraving
    ctx.save();
    ctx.translate(80, -2); ctx.rotate(-Math.PI / 2);
    ctx.globalAlpha = 0.75;
    ctx.fillStyle = '#a22b22';
    fillRR(ctx, -7, -7, 14, 14, 3, '#a22b22');
    ctx.fillStyle = '#f0ce8d';
    ctx.font = 'bold 9px "STKaiti","KaiTi",serif';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText('臀', 0, 0.5);
    ctx.restore();

    // glove
    var glove = ctx.createLinearGradient(-14, 4, 7, 43);
    glove.addColorStop(0, '#2f2733'); glove.addColorStop(0.6, '#171219'); glove.addColorStop(1, '#0b080d');
    fillEllipse(ctx, -4, 30, 16, 22, -0.2, glove);
    ctx.strokeStyle = 'rgba(255,255,255,0.11)'; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = 1.3;
    ctx.beginPath(); ctx.moveTo(-15, 23); ctx.lineTo(-2, 21); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-16, 29); ctx.lineTo(-1, 27); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(-14, 35); ctx.lineTo(0, 33); ctx.stroke();

    // muzzle flash
    if (run.muzzle > 0) {
      var mf = run.muzzle / 0.09;
      ctx.save();
      ctx.translate(130, 0);
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = mf;
      ctx.rotate(rand(-0.2, 0.2));
      ctx.fillStyle = '#fff6c9';
      ctx.beginPath();
      for (var mi = 0; mi < 12; mi++) {
        var ma = mi / 12 * TAU;
        var mr = mi % 2 === 0 ? 27 : 8;
        if (mi === 0) ctx.moveTo(Math.cos(ma) * mr, Math.sin(ma) * mr);
        else ctx.lineTo(Math.cos(ma) * mr, Math.sin(ma) * mr);
      }
      ctx.closePath(); ctx.fill();
      ctx.fillStyle = 'rgba(255,149,60,0.55)';
      fillEllipse(ctx, 0, 0, 40, 18, 0, 'rgba(255,149,60,0.55)');
      ctx.restore();
    }
    ctx.restore();

    // smoke
    if (run.muzzle > 0.02) {
      ctx.save();
      ctx.globalAlpha = run.muzzle * 1.8;
      ctx.fillStyle = 'rgba(190,176,160,0.18)';
      var mx = g.gx + Math.cos(angle) * 132;
      var my = g.gy + Math.sin(angle) * 132;
      fillEllipse(ctx, mx + rand(-5, 5), my + rand(-5, 5), 16, 10, angle, 'rgba(190,176,160,0.18)');
      ctx.restore();
    }
  }

  function drawReloadUI() {
    var run = game.run;
    if (!run) return;
    var bottom = 813;
    // ammo pips
    ctx.save();
    for (var i = 0; i < run.stats.mag; i++) {
      var x = 22 + i * 13;
      var filled = i < run.ammo;
      if (filled) {
        fillRR(ctx, x, bottom, 7, 17, 3, '#f4c35f');
        ctx.fillStyle = 'rgba(255,255,255,0.45)';
        ctx.fillRect(x + 1.5, bottom + 2, 1.6, 5);
      } else {
        fillRR(ctx, x, bottom, 7, 17, 3, 'rgba(231,210,173,0.14)');
      }
    }
    ctx.restore();
    if (run.reloading) {
      var p = 1 - run.reloadT / run.stats.reload;
      ctx.save();
      ctx.strokeStyle = 'rgba(255,217,135,0.22)'; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.arc(28, 798, 18, 0, TAU); ctx.stroke();
      ctx.strokeStyle = '#ffd36b'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.arc(28, 798, 18, -Math.PI / 2, -Math.PI / 2 + TAU * p); ctx.stroke();
      ctx.restore();
    }
  }

  function drawCrosshair() {
    if (!game.run || game.scene !== 'playing' || game.run.ko) return;
    var x = game.pointer.x, y = game.pointer.y;
    if (x < 8 || x > DESIGN_W - 8 || y < 8 || y > DESIGN_H - 8) return;
    var zone = game.aimZone;
    var col = zone ? (zone.zone === 'butt' ? '#ffd15e' : (zone.zone === 'head' ? '#ff9a9f' : '#f4e8ce')) : 'rgba(241,226,198,0.72)';
    var t = game.clock;
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(t * 0.65);
    ctx.globalAlpha = game.run.reloading ? 0.38 : 1;
    ctx.strokeStyle = col;
    ctx.lineWidth = 1.6;
    ctx.shadowColor = col; ctx.shadowBlur = zone ? 8 : 3;
    for (var i = 0; i < 4; i++) {
      ctx.save();
      ctx.rotate(i * Math.PI / 2);
      ctx.beginPath();
      ctx.moveTo(0, -27);
      ctx.lineTo(0, -17);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(0, 0, 12, -1.25, -0.55);
      ctx.stroke();
      ctx.restore();
    }
    ctx.rotate(-t * 0.65);
    ctx.fillStyle = col;
    fillEllipse(ctx, 0, 0, 2.2, 2.2, 0, col);
    if (zone) {
      ctx.globalAlpha = 0.25;
      ctx.strokeStyle = col;
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(0, 0, 22 + Math.sin(t * 7) * 2, 0, TAU); ctx.stroke();
    }
    ctx.restore();

    if (zone && zone.zone === 'butt') {
      var mult = game.run.stats.buttMult + (game.run.goldenActive ? 1.1 : 0);
      var multText = (Math.round(mult * 10) / 10).toString().replace('.0', '');
      var label = (game.run.goldenActive ? '黄金 ×' : '打臀 ×') + multText;
      var w = game.run.goldenActive ? 64 : 55;
      fillRR(ctx, x - w / 2, y - 52, w, 20, 10, 'rgba(33,14,8,0.88)');
      strokeRR(ctx, x - w / 2, y - 52, w, 20, 10, 'rgba(255,205,105,0.62)', 1);
      text(ctx, label, x, y - 37, 11, '#ffdf91', { align: 'center', weight: 'bold' });
    }
    if (game.run.reloading) {
      var p = 1 - game.run.reloadT / game.run.stats.reload;
      ctx.save();
      ctx.strokeStyle = 'rgba(255,219,141,0.28)'; ctx.lineWidth = 4;
      ctx.beginPath(); ctx.arc(x, y, 35, 0, TAU); ctx.stroke();
      ctx.strokeStyle = '#ffd36b';
      ctx.beginPath(); ctx.arc(x, y, 35, -Math.PI / 2, -Math.PI / 2 + TAU * p); ctx.stroke();
      ctx.restore();
    }
  }

  /* ------------------------------------------------------------
     Update loop
     ------------------------------------------------------------ */
  function update(dt) {
    game.clock += dt;
    if (game.toast) { game.toast.t -= dt; if (game.toast.t <= 0) game.toast = null; }
    if (game.transition > 0) game.transition = Math.max(0, game.transition - dt);
    if (game.mutedPulse > 0) game.mutedPulse = Math.max(0, game.mutedPulse - dt);
    if (game.coinPop > 0) game.coinPop = Math.max(0, game.coinPop - dt * 3);
    game.pointer.inside = game.pointer.x >= 0 && game.pointer.x <= DESIGN_W && game.pointer.y >= 0 && game.pointer.y <= DESIGN_H;

    if (game.scene === 'losing') {
      updateLose(dt);
      return;
    }
    if (game.scene === 'menu') {
      game.menuT += dt;
      return;
    }
    if (game.scene === 'paused') return;
    if (game.scene === 'result') {
      game.resultT = (game.resultT || 0) + dt;
      return;
    }
    if (game.scene === 'shop') {
      game.shopT += dt;
      return;
    }

    var run = game.run;
    if (!run) return;

    if (run.ko) {
      run.ko.t -= dt;
      run.elapsed += dt;
      run.muzzle = Math.max(0, run.muzzle - dt);
      run.recoil = Math.max(0, run.recoil - dt * 7);
      run.shake *= Math.pow(0.03, dt);
      run.flash = Math.max(0, run.flash - dt * 2.2);
      updateEffects(dt);
      if (run.ko.t <= 0) openShop();
      return;
    }

    if (run.target.intro > 0) run.target.intro = Math.max(0, run.target.intro - dt);
    run.time = Math.max(0, run.time - dt);
    run.elapsed += dt;
    if (run.tutorial > 0) run.tutorial -= dt;

    // combo decay
    if (run.comboTimer > 0) {
      run.comboTimer -= dt;
      if (run.comboTimer <= 0) run.combo = 0;
    }
    if (run.comboPop > 0) run.comboPop = Math.max(0, run.comboPop - dt * 4);

    // reload
    if (run.reloading) {
      run.reloadT -= dt;
      if (run.reloadT <= 0) finishReload();
    }

    // golden butt window
    if (run.goldenActive) {
      run.goldenLeft -= dt;
      if (run.goldenLeft <= 0) {
        run.goldenActive = false;
        run.nextGolden = rand(9, 13);
        showToast('黄金臀退场', 'soft');
      }
    } else {
      run.nextGolden -= dt;
      if (run.nextGolden <= 0) {
        run.goldenActive = true;
        run.goldenLeft = 2.7;
        AudioSys.sfx('gold');
        run.bubble = { text: '黄金臀！快打！', t: 2.2, color: '#ffe08a' };
        addFloater(195, 425, '黄金臀 ×3', '#ffe18b', 24, -38);
      }
    }

    // delayed double-shot
    for (var i = run.pendingShots.length - 1; i >= 0; i--) {
      var ps = run.pendingShots[i];
      ps.t -= dt;
      if (ps.t <= 0) {
        run.pendingShots.splice(i, 1);
        var oldX = game.pointer.x, oldY = game.pointer.y;
        game.pointer.x = ps.x; game.pointer.y = ps.y;
        fireBullet(true);
        game.pointer.x = oldX; game.pointer.y = oldY;
      }
    }

    // weapons
    run.fireCd -= dt;
    run.muzzle = Math.max(0, run.muzzle - dt);
    run.recoil = Math.max(0, run.recoil - dt * 8.5);
    run.shake *= Math.pow(0.015, dt);
    run.flash = Math.max(0, run.flash - dt * 2.6);

    if (game.debugAutoAim) {
      var debugPose = targetPose();
      game.pointer.x = debugPose.x;
      game.pointer.y = debugPose.y - 222;
    }
    if (game.pointer.firing && game.pointer.down && !run.reloading && run.fireCd <= 0 && game.scene === 'playing') {
      fireBullet(false);
    }

    game.aimZone = hitZoneAt(game.pointer.x, game.pointer.y);
    updateTargetExpression(dt);
    updateEffects(dt);

    if (run.time <= 0) startLose();
  }

  /* ------------------------------------------------------------
     HUD / shared UI
     ------------------------------------------------------------ */
  function drawCoinIcon(x, y, r) {
    ctx.save();
    fillEllipse(ctx, x, y, r, r, 0, '#f4c34f');
    ctx.strokeStyle = '#a46b1f'; ctx.lineWidth = Math.max(1, r * 0.14);
    ctx.beginPath(); ctx.arc(x, y, r * 0.72, 0, TAU); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,249,194,0.75)'; ctx.lineWidth = Math.max(1, r * 0.11);
    ctx.beginPath(); ctx.moveTo(x, y - r * 0.5); ctx.lineTo(x, y + r * 0.5); ctx.stroke();
    ctx.beginPath(); ctx.arc(x, y, r * 0.3, 0, TAU); ctx.stroke();
    ctx.restore();
  }

  function drawPanel(x, y, w, h, opts) {
    opts = opts || {};
    ctx.save();
    var g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, opts.top || '#1f0e15');
    g.addColorStop(0.55, opts.mid || '#150a0f');
    g.addColorStop(1, opts.bottom || '#0b0609');
    fillRR(ctx, x, y, w, h, opts.r === undefined ? 18 : opts.r, g);
    strokeRR(ctx, x, y, w, h, opts.r === undefined ? 18 : opts.r, opts.border || 'rgba(216,168,91,0.36)', 1.2);
    // corner accents
    ctx.strokeStyle = opts.corner || 'rgba(247,200,112,0.62)';
    ctx.lineWidth = 1.5;
    var c = 13;
    ctx.beginPath();
    ctx.moveTo(x + 10, y + 10 + c); ctx.lineTo(x + 10, y + 10); ctx.lineTo(x + 10 + c, y + 10);
    ctx.moveTo(x + w - 10 - c, y + 10); ctx.lineTo(x + w - 10, y + 10); ctx.lineTo(x + w - 10, y + 10 + c);
    ctx.moveTo(x + 10, y + h - 10 - c); ctx.lineTo(x + 10, y + h - 10); ctx.lineTo(x + 10 + c, y + h - 10);
    ctx.moveTo(x + w - 10 - c, y + h - 10); ctx.lineTo(x + w - 10, y + h - 10); ctx.lineTo(x + w - 10, y + h - 10 - c);
    ctx.stroke();
    if (opts.glow) {
      ctx.globalAlpha = 0.22;
      ctx.shadowColor = '#ffbe64'; ctx.shadowBlur = 24;
      strokeRR(ctx, x, y, w, h, opts.r === undefined ? 18 : opts.r, 'rgba(255,190,100,0.5)', 1);
    }
    ctx.restore();
  }

  function drawPrimaryButton(x, y, w, h, label, sub, disabled, id, action, opts) {
    opts = opts || {};
    var hot = !disabled && game.pointer.x >= x && game.pointer.x <= x + w && game.pointer.y >= y && game.pointer.y <= y + h;
    ctx.save();
    ctx.globalAlpha = disabled ? 0.48 : 1;
    if (!disabled) {
      ctx.shadowColor = hot ? 'rgba(255,167,72,0.62)' : 'rgba(210,80,45,0.32)';
      ctx.shadowBlur = hot ? 22 : 14;
    }
    var g = ctx.createLinearGradient(x, y, x, y + h);
    g.addColorStop(0, hot ? '#e7523d' : '#c83b2e');
    g.addColorStop(0.55, '#9b241f');
    g.addColorStop(1, '#671511');
    fillRR(ctx, x, y, w, h, opts.r === undefined ? 14 : opts.r, g);
    ctx.shadowBlur = 0;
    // top gloss
    ctx.globalAlpha *= 0.38;
    var gl = ctx.createLinearGradient(x, y, x, y + h * 0.55);
    gl.addColorStop(0, 'rgba(255,255,255,0.6)'); gl.addColorStop(1, 'rgba(255,255,255,0)');
    fillRR(ctx, x + 2, y + 2, w - 4, h * 0.5, 12, gl);
    ctx.globalAlpha = disabled ? 0.48 : 1;
    strokeRR(ctx, x, y, w, h, opts.r === undefined ? 14 : opts.r, 'rgba(255,215,137,0.72)', 1.4);
    // inner hairline
    strokeRR(ctx, x + 5, y + 5, w - 10, h - 10, (opts.r === undefined ? 14 : opts.r) - 3, 'rgba(255,236,188,0.18)', 1);
    if (sub) {
      text(ctx, label, x + w / 2, y + h * 0.43, opts.size || 22, '#fff1cf', {
        align: 'center', weight: 'bold', stroke: 'rgba(70,13,9,0.55)', strokeWidth: 3
      });
      text(ctx, sub, x + w / 2, y + h * 0.72, 10, 'rgba(255,228,178,0.72)', { align: 'center' });
    } else {
      text(ctx, label, x + w / 2, y + h / 2 + 1, opts.size || 22, '#fff1cf', {
        align: 'center', baseline: 'middle', weight: 'bold', stroke: 'rgba(70,13,9,0.55)', strokeWidth: 3
      });
    }
    ctx.restore();
    if (id && action) addButton(id, x, y, w, h, action, { disabled: disabled, layer: opts.layer });
  }

  function drawSoftButton(x, y, w, h, label, id, action, opts) {
    opts = opts || {};
    var hot = game.pointer.x >= x && game.pointer.x <= x + w && game.pointer.y >= y && game.pointer.y <= y + h;
    fillRR(ctx, x, y, w, h, opts.r === undefined ? 12 : opts.r, hot ? 'rgba(67,37,34,0.94)' : 'rgba(26,14,18,0.88)');
    strokeRR(ctx, x, y, w, h, opts.r === undefined ? 12 : opts.r, 'rgba(218,174,104,0.32)', 1);
    text(ctx, label, x + w / 2, y + h / 2 + 1, opts.size || 14, opts.color || '#e8cfa9', {
      align: 'center', baseline: 'middle', weight: opts.light ? '' : 'bold'
    });
    if (id && action) addButton(id, x, y, w, h, action, { layer: opts.layer });
  }

  function drawTopCurrency() {
    ctx.save();
    fillRR(ctx, 16, 16, 112, 32, 16, 'rgba(16,8,11,0.72)');
    strokeRR(ctx, 16, 16, 112, 32, 16, 'rgba(228,185,109,0.31)', 1);
    drawCoinIcon(34, 32, 10);
    text(ctx, fmt(game.save.coins), 50, 37, 15, '#f6d99e', { weight: 'bold' });
    if (game.coinPop > 0) {
      ctx.globalAlpha = game.coinPop;
      text(ctx, '+' + Math.round(game.coinPop * 12), 110, 37, 11, '#ffe49b', { align: 'right', weight: 'bold' });
    }
    ctx.restore();
  }

  function drawSoundButton(x, y, r) {
    var hot = dist(game.pointer.x, game.pointer.y, x, y) < r + 3;
    fillEllipse(ctx, x, y, r, r, 0, hot ? 'rgba(72,37,37,0.92)' : 'rgba(14,7,10,0.72)');
    ctx.strokeStyle = 'rgba(231,190,117,0.32)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.stroke();
    if (game.save.muted) {
      ctx.strokeStyle = '#c9aa7c'; ctx.lineWidth = 1.8;
      ctx.beginPath(); ctx.moveTo(x - 7, y - 2); ctx.lineTo(x - 3, y - 2); ctx.lineTo(x + 2, y - 7); ctx.lineTo(x + 2, y + 7); ctx.lineTo(x - 3, y + 2); ctx.lineTo(x - 7, y + 2); ctx.closePath(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(x + 6, y - 5); ctx.lineTo(x + 11, y + 5); ctx.stroke();
    } else {
      ctx.fillStyle = '#e8cfa3';
      ctx.beginPath(); ctx.moveTo(x - 7, y - 3); ctx.lineTo(x - 3, y - 3); ctx.lineTo(x + 2, y - 8); ctx.lineTo(x + 2, y + 8); ctx.lineTo(x - 3, y + 3); ctx.lineTo(x - 7, y + 3); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#e8cfa3'; ctx.lineWidth = 1.3;
      ctx.beginPath(); ctx.arc(x + 3, y, 8, -0.7, 0.7); ctx.stroke();
      ctx.beginPath(); ctx.arc(x + 3, y, 12, -0.6, 0.6); ctx.stroke();
    }
  }

  function drawHUD() {
    var run = game.run;
    if (!run) return;
    ctx.save();
    var hg = ctx.createLinearGradient(0, 0, 0, 116);
    hg.addColorStop(0, 'rgba(5,2,4,0.88)');
    hg.addColorStop(0.65, 'rgba(9,4,6,0.46)');
    hg.addColorStop(1, 'rgba(9,4,6,0)');
    ctx.fillStyle = hg;
    ctx.fillRect(0, 0, DESIGN_W, 122);

    // score
    text(ctx, '本曲得分', 20, 27, 9, '#d7b784');
    text(ctx, fmt(run.score), 20, 54, 25, '#fff0c9', { weight: 'bold', shadow: 'rgba(0,0,0,0.7)', shadowBlur: 5 });
    text(ctx, '最高 ' + fmt(Math.max(game.save.best, Math.round(run.score))), 20, 69, 9, '#bf9f73');

    // timer
    var seconds = Math.max(0, Math.ceil(run.time));
    var danger = run.time < 10;
    text(ctx, '演奏剩余', 195, 24, 9, danger ? '#ffb09c' : '#d7b784', { align: 'center' });
    text(ctx, pad2(Math.floor(seconds / 60)) + ':' + pad2(seconds % 60), 195, 52, 25, danger ? '#ff9b82' : '#fff0c9', {
      align: 'center', weight: 'bold', shadow: danger ? 'rgba(255,70,55,0.45)' : 'rgba(0,0,0,0.8)', shadowBlur: 7
    });
    ctx.strokeStyle = 'rgba(247,208,132,0.22)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(195, 46, 34, Math.PI * 0.15, Math.PI * 0.85); ctx.stroke();
    ctx.strokeStyle = danger ? '#ff7b65' : '#e4b86a';
    ctx.beginPath(); ctx.arc(195, 46, 34, Math.PI * 0.15, Math.PI * 0.15 + Math.PI * 0.7 * clamp(run.time / RUN_TIME, 0, 1)); ctx.stroke();

    // coins
    drawCoinIcon(306, 31, 9);
    text(ctx, fmt(game.save.coins), 319, 37, 15, '#f8dca4', { weight: 'bold' });
    text(ctx, '金币', 319, 51, 8, 'rgba(238,205,153,0.48)', {});

    // pause
    if (game.scene === 'playing') {
      var pauseHot = dist(game.pointer.x, game.pointer.y, 364, 80) < 18;
      fillEllipse(ctx, 364, 80, 15, 15, 0, pauseHot ? 'rgba(75,39,37,0.9)' : 'rgba(14,7,10,0.55)');
      ctx.strokeStyle = 'rgba(229,189,118,0.28)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(364, 80, 15, 0, TAU); ctx.stroke();
      ctx.fillStyle = '#e5c99a';
      fillRR(ctx, 359, 75, 3.5, 10, 1.5, '#e5c99a');
      fillRR(ctx, 365.5, 75, 3.5, 10, 1.5, '#e5c99a');
      addButton('pause', 347, 63, 34, 34, function () { AudioSys.sfx('click'); pauseGame(); });
    }

    // target hp
    var t = run.target;
    var skin = skinById(t.skinId);
    text(ctx, '第 ' + run.wave + ' 位 · ' + skin.name, 22, 114, 10, '#e8cca0');
    var hpP = clamp(t.hp / t.maxHp, 0, 1);
    fillRR(ctx, 22, 121, 346, 9, 4.5, 'rgba(255,238,208,0.12)');
    var hpg = ctx.createLinearGradient(22, 0, 368, 0);
    hpg.addColorStop(0, '#8e2a25'); hpg.addColorStop(0.55, '#d9563d'); hpg.addColorStop(1, '#f2b45b');
    fillRR(ctx, 22, 121, 346 * hpP, 9, 4.5, hpg);
    ctx.globalAlpha = 0.5;
    fillRR(ctx, 24, 122.5, Math.max(0, 342 * hpP), 2.4, 1.2, 'rgba(255,255,255,0.45)');
    ctx.globalAlpha = 1;
    if (run.goldenActive) {
      var gp = clamp(run.goldenLeft / 2.7, 0, 1);
      fillRR(ctx, 22, 136, 346 * gp, 3, 1.5, '#ffd46a');
      text(ctx, '黄金臀', 22, 150, 9, '#ffd87c', { weight: 'bold' });
    }

    // combo
    if (run.combo > 1) {
      var cp = clamp(run.comboPop, 0, 1);
      var cs = 1 + cp * 0.18;
      ctx.save();
      ctx.translate(362, 205);
      ctx.scale(cs, cs);
      text(ctx, 'COMBO', 0, -16, 9, 'rgba(255,213,141,0.72)', { align: 'right' });
      text(ctx, '×' + run.combo, 0, 9, 27, '#ffd873', {
        align: 'right', weight: 'bold', shadow: 'rgba(0,0,0,0.8)', shadowBlur: 6
      });
      var cm = 1 + Math.min(40, run.combo) * 0.02;
      text(ctx, '金币 ×' + cm.toFixed(1), 0, 24, 9, 'rgba(255,224,168,0.6)', { align: 'right' });
      ctx.restore();
    }

    // tutorial
    if (run.tutorial > 0) {
      var ta = Math.min(1, run.tutorial / 0.5);
      ctx.save();
      ctx.globalAlpha = ta * 0.9;
      fillRR(ctx, 50, 612, 290, 49, 13, 'rgba(17,8,11,0.78)');
      strokeRR(ctx, 50, 612, 290, 49, 13, 'rgba(226,182,107,0.32)', 1);
      text(ctx, '按住屏幕瞄准 · 打屁股双倍伤害', 195, 631, 12, '#f1d6a6', { align: 'center', weight: 'bold' });
      text(ctx, '松开停火 · 空弹匣会自动装填', 195, 648, 9, 'rgba(234,203,156,0.58)', { align: 'center' });
      ctx.restore();
    }
    ctx.restore();
  }

  function drawVignette() {
    var vg = ctx.createRadialGradient(195, 410, 210, 195, 420, 520);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(0.7, 'rgba(3,1,3,0.18)');
    vg.addColorStop(1, 'rgba(2,0,2,0.72)');
    ctx.fillStyle = vg;
    ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);
  }

  function drawGrain() {
    ctx.save();
    for (var i = 0; i < noisePoints.length; i++) {
      var n = noisePoints[i];
      var flicker = 0.55 + 0.45 * Math.sin(game.clock * n.sp + n.ph);
      ctx.globalAlpha = n.a * flicker;
      ctx.fillStyle = n.warm ? '#ffd7a0' : '#ffffff';
      ctx.fillRect(n.x, n.y, n.s, n.s);
    }
    ctx.restore();
  }

  function drawTransition() {
    if (game.transition <= 0) return;
    var a = clamp(game.transition / 0.55, 0, 1);
    ctx.save();
    ctx.globalAlpha = a * 0.42;
    ctx.fillStyle = '#050204';
    ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);
    ctx.restore();
  }

  /* ------------------------------------------------------------
     Game scene
     ------------------------------------------------------------ */
  function drawGame() {
    var run = game.run;
    if (!run) return;
    drawBackground();
    drawHoles();

    // beat pulse light
    var beat = (game.clock * 128 / 60) % 1;
    var pulse = Math.pow(1 - beat, 5);
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = pulse * 0.035;
    var bg = ctx.createRadialGradient(195, 620, 20, 195, 620, 360);
    bg.addColorStop(0, '#ffd28a'); bg.addColorStop(1, 'rgba(255,150,60,0)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 300, DESIGN_W, 544);
    ctx.restore();

    ctx.save();
    // screen shake
    if (run.shake > 0.1) {
      ctx.translate(rand(-run.shake, run.shake) * 0.5, rand(-run.shake, run.shake) * 0.5);
    }
    drawTarget();
    drawEffects();
    ctx.restore();

    drawVignette();
    drawGrain();

    if (run.goldenActive) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.globalAlpha = 0.035 + 0.02 * Math.sin(game.clock * 8);
      ctx.fillStyle = '#ffcc62';
      ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);
      ctx.restore();
    }

    drawReloadUI();
    drawHUD();
    drawGun();
    drawCrosshair();

    if (run.ko) {
      var kp = clamp((run.elapsed - run.ko.started) / 0.3, 0, 1);
      ctx.save();
      ctx.globalAlpha = kp;
      var sc = 1 + (1 - easeOutBack(kp)) * 0.3;
      ctx.translate(195, 330);
      ctx.scale(sc, sc);
      drawGradientDisplay('K.O.', 0, 0, 74, '#ffe9a0', '#e14c32', {
        stroke: 'rgba(56,15,9,0.8)', strokeWidth: 7,
        shadow: 'rgba(255,174,69,0.42)', shadowBlur: 26
      });
      text(ctx, '换人！', 0, 43, 15, 'rgba(255,221,160,0.86)', { align: 'center', weight: 'bold' });
      ctx.restore();
    }

    drawTransition();
    if (run.flash > 0) {
      ctx.save();
      ctx.globalAlpha = run.flash;
      ctx.fillStyle = run.flashColor;
      ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);
      ctx.restore();
    }
  }

  /* ------------------------------------------------------------
     Menu scene
     ------------------------------------------------------------ */
  function buyGunUpgrade() {
    if (game.save.gunLevel >= 12) {
      showToast('枪已经升到顶了', 'soft');
      return;
    }
    var cost = gunUpgradeCost();
    if (game.save.coins < cost) {
      showToast('金币不够 · 再打一曲', 'bad');
      AudioSys.sfx('click');
      return;
    }
    game.save.coins -= cost;
    game.save.gunLevel++;
    AudioSys.sfx('buy');
    showToast('枪械升到 Lv.' + game.save.gunLevel, 'gold');
    persist();
  }

  function toggleMute() {
    game.save.muted = !game.save.muted;
    AudioSys.mute(game.save.muted);
    persist();
    if (!game.save.muted) AudioSys.sfx('click');
  }

  function selectSkin(id) {
    var skin = skinById(id);
    if (isUnlocked(id)) {
      game.save.skin = id;
      persist();
      AudioSys.sfx('click');
      return;
    }
    AudioSys.sfx('click');
    game.modal = { type: 'skin', skinId: id };
  }

  function unlockSkin(id) {
    var skin = skinById(id);
    if (isUnlocked(id)) { game.modal = null; selectSkin(id); return; }
    if (game.save.coins < skin.cost) {
      showToast('还差 ' + fmt(skin.cost - game.save.coins) + ' 金币', 'bad');
      AudioSys.sfx('click');
      return;
    }
    game.save.coins -= skin.cost;
    game.save.unlocked.push(id);
    game.save.skin = id;
    game.modal = null;
    AudioSys.sfx('buy');
    showToast(skin.name + ' 已解锁', 'gold');
    persist();
  }

  function drawMenu() {
    drawBackground();

    // character preview
    var mx = 195 + Math.sin(game.menuT * 0.62) * 13;
    var my = 600 + Math.sin(game.menuT * 1.3) * 1.8;
    var skin = selectedSkin();
    var scale = 0.82;
    // dashed double-damage zone
    ctx.save();
    ctx.translate(mx, my - 222 * scale);
    ctx.rotate(Math.sin(game.menuT * 0.62) * 0.018);
    ctx.globalAlpha = 0.28 + Math.sin(game.menuT * 2.6) * 0.06;
    ctx.strokeStyle = '#ffcf67';
    ctx.lineWidth = 1.4;
    if (ctx.setLineDash) {
      ctx.setLineDash([5, 7]);
      ctx.lineDashOffset = -game.menuT * 10;
    }
    ellipsePath(ctx, 0, 0, 66 * scale, 51 * scale, 0);
    ctx.stroke();
    if (ctx.setLineDash) ctx.setLineDash([]);
    ctx.restore();
    drawCharacter(mx, my, skin, {
      scale: scale, rot: Math.sin(game.menuT * 0.62) * 0.012,
      expression: 'idle', hitFlash: 0, golden: false, t: game.menuT
    });
    ctx.save();
    ctx.globalAlpha = 0.75;
    text(ctx, '双倍区', mx + 76, my - 216 * scale, 9, '#ffd57d', {
      align: 'left', weight: 'bold', stroke: 'rgba(45,16,8,0.75)', strokeWidth: 2
    });
    ctx.restore();

    // left/right decorative strings
    ctx.save();
    ctx.globalAlpha = 0.16;
    ctx.strokeStyle = '#e8bf74';
    ctx.lineWidth = 1;
    for (var i = 0; i < 5; i++) {
      ctx.beginPath(); ctx.moveTo(12 + i * 3, 0); ctx.lineTo(17 + i * 2, 844); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(378 - i * 3, 0); ctx.lineTo(373 - i * 2, 844); ctx.stroke();
    }
    ctx.restore();

    // top currency, sound, best
    drawTopCurrency();
    drawSoundButton(360, 32, 16);
    addButton('sound', 344, 16, 32, 32, toggleMute);
    var bestTxt = game.save.best > 0 ? '最高 ' + fmt(game.save.best) : '尚未开弓';
    fillRR(ctx, 137, 18, 116, 28, 14, 'rgba(16,8,11,0.54)');
    strokeRR(ctx, 137, 18, 116, 28, 14, 'rgba(228,185,109,0.20)', 1);
    text(ctx, bestTxt, 195, 36, 10, 'rgba(241,215,173,0.72)', { align: 'center' });
    if (game.demo) {
      fillRR(ctx, 16, 54, 88, 20, 10, 'rgba(167,45,35,0.62)');
      text(ctx, 'DEMO 全解锁', 60, 68, 8, '#ffe5b2', { align: 'center', weight: 'bold' });
    }

    // title
    ctx.save();
    ctx.globalAlpha = 0.4;
    fillEllipse(ctx, 195, 131, 116, 44, 0, 'rgba(0,0,0,0.45)');
    ctx.restore();
    drawGradientDisplay('琵琶曲', 188, 113, 68, '#fff0bd', '#e4ab49', {
      stroke: 'rgba(54,13,12,0.92)', strokeWidth: 7,
      shadow: 'rgba(255,178,63,0.26)', shadowBlur: 22
    });
    // seal
    ctx.save();
    ctx.translate(313, 98);
    ctx.rotate(0.035);
    fillRR(ctx, -20, -32, 40, 64, 4, 'rgba(154,35,29,0.92)');
    strokeRR(ctx, -20, -32, 40, 64, 4, 'rgba(245,211,152,0.9)', 1.6);
    var sealChars = ['一', '腚', '定', '音'];
    for (var si = 0; si < 4; si++) text(ctx, sealChars[si], 0, -20 + si * 14, 11, '#ffe9c6', { align: 'center', baseline: 'middle', weight: 'bold' });
    ctx.restore();

    text(ctx, 'P I P A   P A N I C', 195, 151, 8, 'rgba(226,189,132,0.62)', { align: 'center' });
    drawDisplay('一 腚 定 音', 195, 178, 23, '#f0d09b', {
      stroke: 'rgba(42,12,10,0.9)', strokeWidth: 4
    });
    text(ctx, '枪枪入魂 · 打臀双倍 · 金币变强', 195, 202, 10, 'rgba(235,205,164,0.61)', { align: 'center' });
    text(ctx, '当前：' + skin.name + ' · ' + skin.perkText, 195, 224, 9, 'rgba(239,204,147,0.72)', { align: 'center' });
    if (game.save.plays > 0) {
      text(ctx, '第 ' + (game.save.plays + 1) + ' 曲', 195, 246, 8, 'rgba(232,191,128,0.38)', { align: 'center' });
    }

    // bottom console
    var pg = ctx.createLinearGradient(0, 570, 0, 844);
    pg.addColorStop(0, 'rgba(10,5,7,0)');
    pg.addColorStop(0.22, 'rgba(10,5,7,0.86)');
    pg.addColorStop(1, 'rgba(8,4,6,0.99)');
    ctx.fillStyle = pg;
    ctx.fillRect(0, 560, DESIGN_W, 284);
    ctx.strokeStyle = 'rgba(225,178,101,0.16)';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(18, 593); ctx.lineTo(372, 593); ctx.stroke();

    text(ctx, '选择接弹人', 24, 615, 10, 'rgba(237,207,161,0.74)');
    text(ctx, totalUnlocked() + ' / ' + SKINS.length + ' 已解锁', 366, 615, 8, 'rgba(233,193,132,0.45)', { align: 'right' });

    var xs = [57, 149, 241, 333];
    for (var k = 0; k < SKINS.length; k++) {
      var sk = SKINS[k];
      var unlocked = isUnlocked(sk.id);
      var selected = game.save.skin === sk.id;
      drawAvatar(sk, xs[k], 650, 26, selected, !unlocked);
      text(ctx, sk.short, xs[k], 689, 10, selected ? '#ffe1a3' : 'rgba(235,207,165,0.65)', { align: 'center', weight: selected ? 'bold' : '' });
      if (!unlocked) {
        drawCoinIcon(xs[k] + 13, 698, 4.5);
        text(ctx, fmt(sk.cost), xs[k] + 20, 701, 8, 'rgba(255,217,150,0.7)', { weight: 'bold' });
      } else if (selected) {
        fillRR(ctx, xs[k] - 20, 697, 40, 2.5, 1.2, '#e4b35f');
      }
      (function (sid) {
        addButton('skin_' + sid, xs[k] - 31, 619, 62, 84, function () { selectSkin(sid); });
      })(sk.id);
    }

    // gun upgrade
    var lvl = game.save.gunLevel;
    var cost = gunUpgradeCost();
    var maxed = lvl >= 12;
    var afford = !maxed && game.save.coins >= cost;
    var uy = 714;
    fillRR(ctx, 22, uy, 346, 44, 12, afford ? 'rgba(65,29,22,0.92)' : 'rgba(25,13,17,0.88)');
    strokeRR(ctx, 22, uy, 346, 44, 12, afford ? 'rgba(255,197,99,0.55)' : 'rgba(220,173,105,0.20)', 1);
    // gun icon
    ctx.save();
    ctx.translate(43, uy + 23);
    fillRR(ctx, -9, -7, 26, 10, 4, '#b9864b');
    fillRR(ctx, 13, -5, 12, 6, 2, '#7c5531');
    fillRR(ctx, -14, -2, 8, 15, 3, '#3a2419');
    fillEllipse(ctx, 1, 0, 7, 7, 0, '#5a3b25');
    ctx.restore();
    text(ctx, '枪械 Lv.' + lvl, 64, uy + 19, 14, '#f0d5aa', { weight: 'bold' });
    text(ctx, maxed ? '伤害 ' + Math.round(gunDamage()) + ' · 已满级' : '伤害 ' + Math.round(gunDamage()) + ' · 升级 +4 基础伤害', 64, uy + 34, 8, 'rgba(235,203,159,0.55)');
    if (maxed) {
      text(ctx, 'MAX', 348, uy + 27, 13, '#e8bb6e', { align: 'right', weight: 'bold' });
    } else {
      drawCoinIcon(286, uy + 22, 7);
      text(ctx, fmt(cost), 300, uy + 27, 13, afford ? '#ffd477' : 'rgba(237,188,126,0.46)', { weight: 'bold' });
      fillRR(ctx, 328, uy + 10, 28, 24, 7, afford ? 'rgba(194,65,42,0.72)' : 'rgba(80,50,40,0.4)');
      text(ctx, '升级', 342, uy + 27, 9, afford ? '#ffe6b5' : 'rgba(240,211,170,0.4)', { align: 'center', weight: 'bold' });
    }
    addButton('upgrade', 22, uy, 346, 44, buyGunUpgrade);

    // start
    drawPrimaryButton(22, 768, 346, 58, '开 始 演 奏', '75 秒 · 打臀双倍 · 金币变强', false, 'start', startRun, { size: 22 });

    text(ctx, '灵感 Kotte Animation · 曲目《琵琶曲》· 非商用原型', 195, 838, 7.5, 'rgba(223,186,132,0.32)', { align: 'center' });
    drawGrain();
    drawTransition();
  }

  /* ------------------------------------------------------------
     Skin purchase modal
     ------------------------------------------------------------ */
  function drawSkinModal() {
    var modal = game.modal;
    if (!modal || modal.type !== 'skin') return;
    var sk = skinById(modal.skinId);
    ctx.save();
    ctx.fillStyle = 'rgba(3,2,3,0.74)';
    ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);
    var px = 28, py = 205, pw = 334, ph = 430;
    drawPanel(px, py, pw, ph, { glow: true });
    drawAvatar(sk, 195, py + 68, 46, false, false);
    text(ctx, sk.name, 195, py + 132, 28, '#ffe2ab', { align: 'center', weight: 'bold', stroke: 'rgba(48,13,8,0.8)', strokeWidth: 4 });
    text(ctx, sk.role, 195, py + 153, 10, 'rgba(230,196,150,0.55)', { align: 'center' });
    text(ctx, sk.desc, 195, py + 178, 11, 'rgba(241,217,181,0.8)', { align: 'center' });
    fillRR(ctx, 63, py + 195, 264, 34, 10, 'rgba(221,165,77,0.10)');
    strokeRR(ctx, 63, py + 195, 264, 34, 10, 'rgba(227,175,91,0.20)', 1);
    text(ctx, sk.perkText, 195, py + 216, 10, '#f6ce86', { align: 'center', weight: 'bold' });
    drawCoinIcon(137, py + 258, 9);
    text(ctx, fmt(sk.cost) + ' 金币', 151, py + 263, 17, game.save.coins >= sk.cost ? '#ffda8d' : '#d88a7e', { weight: 'bold' });
    var canBuy = game.save.coins >= sk.cost;
    drawPrimaryButton(50, py + 286, 290, 48, canBuy ? '解锁并换上' : '金币不足', canBuy ? ('当前 ' + fmt(game.save.coins)) : ('还差 ' + fmt(sk.cost - game.save.coins)), !canBuy, 'unlockSkin', function () { unlockSkin(sk.id); }, { layer: 'modal', size: 18 });
    drawSoftButton(142, py + 346, 108, 30, '再想想', 'closeModal', function () { game.modal = null; }, { layer: 'modal', size: 12 });
    // close X
    text(ctx, '×', 338, py + 30, 22, 'rgba(240,211,170,0.65)', { align: 'center', baseline: 'middle' });
    addButton('closeModalX', 320, py + 10, 34, 34, function () { game.modal = null; }, { layer: 'modal' });
    ctx.restore();
  }

  /* ------------------------------------------------------------
     Roguelite shop
     ------------------------------------------------------------ */
  function drawUpgradeIcon(key, x, y, size, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;
    if (key === 'damage') {
      fillRR(ctx, -size * 0.42, -size * 0.17, size * 0.68, size * 0.34, size * 0.15, color);
      ctx.fillStyle = '#2b160e';
      ctx.beginPath();
      ctx.moveTo(size * 0.26, -size * 0.3); ctx.lineTo(size * 0.6, 0); ctx.lineTo(size * 0.26, size * 0.3); ctx.closePath(); ctx.fill();
      ctx.fillStyle = color;
      fillRR(ctx, -size * 0.5, -size * 0.08, size * 0.18, size * 0.16, 2, color);
    } else if (key === 'rate') {
      ctx.beginPath();
      ctx.moveTo(-size * 0.1, -size * 0.52); ctx.lineTo(size * 0.28, -size * 0.05); ctx.lineTo(size * 0.04, -size * 0.02);
      ctx.lineTo(size * 0.2, size * 0.5); ctx.lineTo(-size * 0.3, 0); ctx.lineTo(-size * 0.02, -size * 0.04);
      ctx.closePath(); ctx.fill();
    } else if (key === 'buttRadar') {
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(-size * 0.18, 0, size * 0.38, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.arc(size * 0.18, 0, size * 0.38, 0, TAU); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-size * 0.46, 0); ctx.lineTo(size * 0.46, 0); ctx.moveTo(0, -size * 0.46); ctx.lineTo(0, size * 0.46); ctx.stroke();
    } else if (key === 'buttMult') {
      text(ctx, '×2', 0, 2, size * 0.5, color, { align: 'center', baseline: 'middle', weight: 'bold' });
    } else if (key === 'gold' || key === 'coinpack') {
      drawCoinIcon(0, 0, size * 0.4);
    } else if (key === 'crit') {
      ctx.beginPath();
      for (var i = 0; i < 10; i++) {
        var a = -Math.PI / 2 + i * Math.PI / 5;
        var r = i % 2 === 0 ? size * 0.52 : size * 0.23;
        if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      ctx.closePath(); ctx.fill();
    } else if (key === 'mag') {
      fillEllipse(ctx, 0, 0, size * 0.38, size * 0.38, 0, 'rgba(0,0,0,0)');
      ctx.beginPath(); ctx.arc(0, 0, size * 0.4, 0, TAU); ctx.stroke();
      for (var c = 0; c < 6; c++) {
        var ca = c / 6 * TAU;
        fillEllipse(ctx, Math.cos(ca) * size * 0.24, Math.sin(ca) * size * 0.24, size * 0.07, size * 0.07, 0, color);
      }
    } else if (key === 'echo') {
      ctx.lineWidth = 2;
      for (var e = 0; e < 3; e++) {
        ctx.beginPath(); ctx.arc(-size * 0.32, 0, size * (0.18 + e * 0.14), -0.9, 0.9); ctx.stroke();
      }
    } else if (key === 'double') {
      fillRR(ctx, -size * 0.32, -size * 0.22, size * 0.6, size * 0.18, 3, color);
      fillRR(ctx, -size * 0.32, 0, size * 0.6, size * 0.18, 3, color);
      ctx.fillStyle = color;
      ctx.beginPath(); ctx.moveTo(size * 0.28, -size * 0.28); ctx.lineTo(size * 0.5, -size * 0.13); ctx.lineTo(size * 0.28, size * 0.02); ctx.fill();
      ctx.beginPath(); ctx.moveTo(size * 0.28, -size * 0.06); ctx.lineTo(size * 0.5, size * 0.09); ctx.lineTo(size * 0.28, size * 0.24); ctx.fill();
    }
    ctx.restore();
  }

  function drawShop() {
    drawGame();
    ctx.save();
    ctx.fillStyle = 'rgba(4,2,4,0.82)';
    ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);
    var p = easeOutCubic(clamp(game.shopT / 0.32, 0, 1));
    ctx.globalAlpha = p;
    ctx.translate(0, (1 - p) * 28);

    drawPanel(18, 104, 354, 636, { glow: true });
    text(ctx, '军 火 商', 195, 144, 25, '#ffe2aa', { align: 'center', weight: 'bold', stroke: 'rgba(48,15,9,0.85)', strokeWidth: 4 });
    text(ctx, '中场加演 · 挑一件，接着打', 195, 166, 9, 'rgba(234,202,158,0.58)', { align: 'center' });
    ctx.strokeStyle = 'rgba(230,180,102,0.22)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(48, 182); ctx.lineTo(342, 182); ctx.stroke();

    var run = game.run;
    if (!run.shop) { ctx.restore(); return; }
    var cards = run.shop.cards;
    var cardY = 198;
    for (var i = 0; i < cards.length; i++) {
      var card = cards[i];
      var y = cardY + i * 143;
      var can = card.special || game.save.coins >= card.cost;
      var hot = game.pointer.x >= 32 && game.pointer.x <= 358 && game.pointer.y >= y && game.pointer.y <= y + 131;
      fillRR(ctx, 32, y, 326, 131, 14, hot ? 'rgba(61,28,27,0.94)' : 'rgba(28,14,20,0.88)');
      strokeRR(ctx, 32, y, 326, 131, 14, can ? 'rgba(239,184,95,0.42)' : 'rgba(198,154,96,0.15)', 1.1);
      // icon tile
      var ig = ctx.createLinearGradient(48, y + 26, 104, y + 82);
      ig.addColorStop(0, rgba(card.color, 0.25)); ig.addColorStop(1, 'rgba(10,6,9,0.5)');
      fillRR(ctx, 46, y + 28, 62, 62, 12, ig);
      strokeRR(ctx, 46, y + 28, 62, 62, 12, rgba(card.color, 0.28), 1);
      drawUpgradeIcon(card.key, 77, y + 59, 42, card.color);
      text(ctx, card.name, 120, y + 37, 18, '#f6dab0', { weight: 'bold' });
      text(ctx, card.desc, 120, y + 58, 10, 'rgba(235,204,161,0.65)');
      if (!card.special) {
        text(ctx, '等级 ' + card.level + ' / ' + card.max, 120, y + 82, 8, 'rgba(235,196,134,0.45)');
        for (var l = 0; l < card.max; l++) {
          fillRR(ctx, 120 + l * 9, y + 91, 6, 3, 1.5, l < card.level ? card.color : 'rgba(238,206,156,0.13)');
        }
      } else {
        text(ctx, '补给 · 不限量', 120, y + 82, 8, 'rgba(235,196,134,0.45)');
      }
      // price
      if (card.special) {
        text(ctx, '免费', 338, y + 112, 16, '#ffe08a', { align: 'right', weight: 'bold' });
      } else {
        drawCoinIcon(300, y + 106, 7);
        text(ctx, fmt(card.cost), 313, y + 111, 15, can ? '#ffda8a' : 'rgba(216,137,120,0.72)', { weight: 'bold' });
        if (!can) text(ctx, '金币不足', 338, y + 112, 8, 'rgba(221,128,112,0.62)', { align: 'right' });
      }
      (function (cardRef) {
        addButton('buy_' + cardRef.key, 32, y, 326, 131, function () { buyCard(cardRef); }, { disabled: false });
      })(card);
    }
    var btnY = 646;
    drawSoftButton(88, btnY, 214, 38, '跳过 · 赏金 +25', 'skipShop', function () {
      addCoins(25);
      showToast('赏金 +25', 'gold');
      closeShop();
    }, { size: 12 });
    text(ctx, '每次换人只能挑一件 · 金币会存进你的钱袋', 195, 703, 8, 'rgba(231,196,145,0.43)', { align: 'center' });
    text(ctx, '本曲已花 ' + fmt(run.coinsSpent) + ' 金币', 195, 719, 8, 'rgba(231,196,145,0.34)', { align: 'center' });
    ctx.restore();
    drawVignette();
    drawGrain();
  }

  /* ------------------------------------------------------------
     Result scene
     ------------------------------------------------------------ */
  function drawResult() {
    var res = game.result;
    if (!res) return;
    drawGame();
    ctx.save();
    var p = easeOutCubic(clamp((game.resultT || 0) / 0.45, 0, 1));
    ctx.fillStyle = 'rgba(4,2,4,0.90)';
    ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);
    ctx.globalAlpha = p;
    ctx.translate(0, (1 - p) * 30);

    // confetti
    if (res.isBest) {
      var crnd = mulberry32(7123);
      for (var c = 0; c < 24; c++) {
        var x = crnd() * DESIGN_W;
        var y = ((game.resultT * (60 + crnd() * 90) + crnd() * 600) % 780) - 30;
        var col = c % 3 === 0 ? '#ffd15e' : (c % 3 === 1 ? '#e05642' : '#f4e0b2');
        ctx.save(); ctx.translate(x, y); ctx.rotate(y * 0.03);
        ctx.globalAlpha = 0.4; ctx.fillStyle = col; ctx.fillRect(-3, -6, 6, 12);
        ctx.restore();
      }
    }

    drawPanel(24, 94, 342, 654, { glow: true });
    text(ctx, res.lost ? '录 像 结 束 · 你 被 反 杀 了' : '本 曲 终 了', 195, 128, 12, res.lost ? 'rgba(255,155,125,0.88)' : 'rgba(234,200,153,0.7)', { align: 'center' });
    ctx.save();
    ctx.translate(274, 168);
    ctx.rotate(-0.09);
    fillRR(ctx, -44, -27, 88, 54, 6, 'rgba(154,35,29,0.92)');
    strokeRR(ctx, -44, -27, 88, 54, 6, 'rgba(249,216,155,0.88)', 1.6);
    text(ctx, res.rank.rank, 0, 2, res.rank.rank.length > 1 ? 27 : 32, '#ffe8bd', { align: 'center', baseline: 'middle', weight: 'bold' });
    ctx.restore();
    text(ctx, res.rank.title, 112, 162, 22, res.rank.color, { stroke: 'rgba(48,14,10,0.85)', strokeWidth: 4 });
    text(ctx, '第 ' + res.wave + ' 位接弹人已被打服', 112, 182, 9, 'rgba(234,201,154,0.5)');

    text(ctx, fmt(res.score), 195, 254, 50, '#ffe6b2', {
      align: 'center', weight: 'bold', stroke: 'rgba(49,13,7,0.82)', strokeWidth: 5,
      shadow: 'rgba(255,180,64,0.3)', shadowBlur: 20
    });
    text(ctx, '本曲得分', 195, 274, 9, 'rgba(235,201,152,0.5)', { align: 'center' });
    if (res.isBest) {
      fillRR(ctx, 157, 286, 76, 22, 11, 'rgba(185,56,37,0.8)');
      text(ctx, '新纪录！', 195, 301, 10, '#ffe7b4', { align: 'center', weight: 'bold' });
    }

    // stats
    var stats = [
      ['打臀率', Math.round(res.buttRate * 100) + '%'],
      ['最高连击', '×' + res.maxCombo],
      ['命中率', Math.round(res.accuracy * 100) + '%'],
      ['打臀命中', res.buttHits + ' 次'],
      ['本曲进账', '+' + fmt(res.coinsEarned)],
      ['商店花费', '-' + fmt(res.coinsSpent)]
    ];
    var sx = 54, sy = 332, sw = 135, sh = 61;
    for (var i = 0; i < stats.length; i++) {
      var col = i % 2, row = Math.floor(i / 2);
      var x = sx + col * 148, y = sy + row * 68;
      fillRR(ctx, x, y, sw, sh, 10, 'rgba(255,236,205,0.035)');
      strokeRR(ctx, x, y, sw, sh, 10, 'rgba(228,183,111,0.12)', 1);
      text(ctx, stats[i][0], x + 12, y + 20, 8, 'rgba(231,198,150,0.48)');
      text(ctx, stats[i][1], x + 12, y + 43, 20, i >= 4 ? '#ffd67d' : '#f2ddb8', { weight: 'bold' });
    }

    text(ctx, '钱袋余量  ', 195, 556, 9, 'rgba(231,198,150,0.48)', { align: 'center' });
    drawCoinIcon(211, 552, 8);
    text(ctx, fmt(game.save.coins), 226, 557, 15, '#ffd986', { weight: 'bold' });

    drawPrimaryButton(44, 584, 302, 52, '再 来 一 曲', '这次试试先打黄金臀', false, 'replay', startRun, { size: 20 });
    drawSoftButton(44, 650, 302, 38, '回到后台 · 换把枪', 'backMenu', function () {
      game.scene = 'menu';
      game.run = null;
      game.result = null;
      game.resultT = 0;
      AudioSys.duck(false);
      persist();
    }, { size: 12 });
    text(ctx, '历史最高 ' + fmt(game.save.best) + ' · 已演奏 ' + game.save.plays + ' 曲', 195, 715, 8, 'rgba(231,197,146,0.42)', { align: 'center' });
    ctx.restore();
    drawVignette();
    drawGrain();
  }

  /* ------------------------------------------------------------
     Pause overlay
     ------------------------------------------------------------ */
  function drawPause() {
    drawGame();
    ctx.save();
    ctx.fillStyle = 'rgba(4,2,4,0.66)';
    ctx.fillRect(0, 0, DESIGN_W, DESIGN_H);
    drawPanel(42, 254, 306, 342, { glow: true });
    drawDisplay('暂 停', 195, 306, 36, '#ffe1ab', { stroke: 'rgba(46,14,10,0.85)', strokeWidth: 5 });
    text(ctx, '琴弦未断，随时回来。', 195, 337, 10, 'rgba(233,200,153,0.54)', { align: 'center' });
    var run = game.run;
    if (run) {
      text(ctx, '本曲得分  ' + fmt(run.score), 195, 382, 14, '#f0d5aa', { align: 'center', weight: 'bold' });
      text(ctx, '剩余 ' + Math.ceil(run.time) + ' 秒 · 第 ' + run.wave + ' 位接弹人', 195, 404, 9, 'rgba(234,199,150,0.5)', { align: 'center' });
    }
    drawPrimaryButton(67, 437, 256, 49, '继续演奏', '', false, 'resume', resumeGame, { size: 18 });
    drawSoftButton(67, 497, 256, 40, '结束本曲 · 查看结算', 'endRun', function () { endRun(); }, { size: 12 });
    text(ctx, '结束后本曲金币会保留', 195, 559, 8, 'rgba(234,198,147,0.4)', { align: 'center' });
    ctx.restore();
    drawVignette();
  }

  /* ------------------------------------------------------------
     Toast + main draw
     ------------------------------------------------------------ */
  function drawToast() {
    if (!game.toast) return;
    var t = game.toast;
    var a = clamp(t.t / 0.3, 0, 1);
    if (t.t > 1.9) a = clamp((2.2 - t.t) / 0.3, 0, 1);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.font = 'bold 13px "PingFang SC","Microsoft YaHei",sans-serif';
    var w = ctx.measureText(t.text).width + 36;
    var y = 246;
    if (game.scene === 'menu') y = 286;
    if (game.scene === 'shop') y = 90;
    if (game.scene === 'result') y = 162;
    fillRR(ctx, 195 - w / 2, y - 18, w, 36, 18, 'rgba(15,7,11,0.94)');
    var tone = t.tone === 'bad' ? 'rgba(255,131,112,0.55)' : (t.tone === 'gold' ? 'rgba(255,205,105,0.62)' : 'rgba(229,187,116,0.32)');
    strokeRR(ctx, 195 - w / 2, y - 18, w, 36, 18, tone, 1);
    text(ctx, t.text, 195, y + 1, 13, t.tone === 'bad' ? '#ffb2a2' : (t.tone === 'gold' ? '#ffe09a' : '#ead2ae'), { align: 'center', baseline: 'middle', weight: 'bold' });
    ctx.restore();
  }

  function draw() {
    game.buttons = [];
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, viewW, viewH);

    // letterbox backdrop
    var out = ctx.createRadialGradient(viewW / 2, viewH * 0.42, 40, viewW / 2, viewH * 0.42, Math.max(viewW, viewH) * 0.7);
    out.addColorStop(0, '#16090d');
    out.addColorStop(1, '#050305');
    ctx.fillStyle = out;
    ctx.fillRect(0, 0, viewW, viewH);

    ctx.save();
    ctx.translate(stage.x, stage.y);
    ctx.scale(stage.scale, stage.scale);
    ctx.beginPath();
    ctx.rect(0, 0, DESIGN_W, DESIGN_H);
    ctx.clip();

    if (game.scene === 'menu') drawMenu();
    else if (game.scene === 'playing') drawGame();
    else if (game.scene === 'losing') drawLose();
    else if (game.scene === 'shop') drawShop();
    else if (game.scene === 'result') drawResult();
    else if (game.scene === 'paused') drawPause();
    else drawMenu();

    if (game.modal) drawSkinModal();
    drawToast();
    ctx.restore();

    // thin stage border on larger screens
    if (stage.x > 1 || stage.y > 1) {
      ctx.save();
      ctx.strokeStyle = 'rgba(220,172,96,0.15)';
      ctx.lineWidth = 1;
      ctx.strokeRect(stage.x + 0.5, stage.y + 0.5, stage.w - 1, stage.h - 1);
      ctx.restore();
    }

    if (!HAS_WX) {
      if (game.scene === 'playing') canvas.style.cursor = 'none';
      else canvas.style.cursor = 'default';
    }
  }

  /* ------------------------------------------------------------
     Input
     ------------------------------------------------------------ */
  function insideStage(p) {
    return p.x >= 0 && p.x <= DESIGN_W && p.y >= 0 && p.y <= DESIGN_H;
  }

  function pointerDown(p, type) {
    AudioSys.unlock();
    game.pointer.x = p.x; game.pointer.y = p.y; game.pointer.type = type || 'mouse';
    if (!insideStage(p)) return;
    if (game.scene === 'losing') {
      if (game.lose && game.lose.t > 0.55) finishLose();
      return;
    }
    if (game.modal) {
      var mb = findButton(p);
      if (mb && !mb.disabled) { game.pressedButton = mb; mb.action(); }
      return;
    }
    var btn = findButton(p);
    if (btn) {
      game.pressedButton = btn;
      if (!btn.disabled) { if (btn.action) btn.action(); }
      return;
    }
    if (game.scene === 'playing') {
      game.pointer.down = true;
      game.pointer.firing = true;
      game.aimZone = hitZoneAt(p.x, p.y);
      if (game.run && game.run.ammo <= 0) startReload(false);
    }
  }

  function pointerMove(p) {
    game.pointer.x = p.x;
    game.pointer.y = p.y;
    game.pointer.inside = insideStage(p);
    if (game.scene === 'playing') game.aimZone = hitZoneAt(p.x, p.y);
  }

  function pointerUp() {
    game.pointer.down = false;
    game.pointer.firing = false;
    game.pressedButton = null;
  }

  function handleKey(e) {
    if (e.repeat) return;
    var k = e.key ? e.key.toLowerCase() : '';
    if (k === 'enter') {
      if (game.scene === 'menu') startRun();
      else if (game.scene === 'result') startRun();
      else if (game.scene === 'paused') resumeGame();
      else if (game.scene === 'losing') finishLose();
    } else if (k === 'r') {
      if (game.scene === 'playing') startReload(true);
    } else if (k === 'p' || k === 'escape') {
      if (game.scene === 'playing') pauseGame();
      else if (game.scene === 'paused') resumeGame();
    } else if (k === 'm') {
      toggleMute();
    } else if (k === ' ' && game.scene === 'playing') {
      game.pointer.down = true;
      game.pointer.firing = true;
      e.preventDefault();
    }
  }

  function bindInput() {
    if (HAS_WX) {
      wx.onTouchStart(function (e) {
        if (!e.touches || !e.touches.length) return;
        var t = e.touches[0];
        pointerDown(toStage(t.clientX, t.clientY), 'touch');
      });
      wx.onTouchMove(function (e) {
        if (!e.touches || !e.touches.length) return;
        var t = e.touches[0];
        pointerMove(toStage(t.clientX, t.clientY));
      });
      wx.onTouchEnd(function () { pointerUp(); });
      wx.onTouchCancel(function () { pointerUp(); });
      if (wx.onHide) wx.onHide(function () { persist(); pauseGame(); });
      if (wx.onShow) wx.onShow(function () { AudioSys.unlock(); });
      if (wx.onWindowResize) wx.onWindowResize(function () { resize(); });
      // share hook
      if (wx.showShareMenu) {
        try { wx.showShareMenu({ withShareTicket: false }); } catch (e) {}
      }
      if (wx.onShareAppMessage) {
        wx.onShareAppMessage(function () {
          return {
            title: '琵琶曲：一腚定音 · 我打了 ' + (game.result ? fmt(game.result.score) : '???') + ' 分，来试试你的准头',
            imageUrl: 'assets/images/share.png'
          };
        });
      }
    } else {
      canvas.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        var p = toStage(e.clientX, e.clientY);
        pointerDown(p, 'mouse');
        try { canvas.setPointerCapture(e.pointerId); } catch (err) {}
      });
      canvas.addEventListener('pointermove', function (e) {
        pointerMove(toStage(e.clientX, e.clientY));
      });
      canvas.addEventListener('pointerup', function (e) {
        e.preventDefault();
        pointerUp();
      });
      canvas.addEventListener('pointercancel', function () { pointerUp(); });
      canvas.addEventListener('pointerleave', function () { if (!game.pointer.down) game.pointer.inside = false; });
      canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
      window.addEventListener('keydown', handleKey);
      window.addEventListener('keyup', function (e) {
        if (e.key === ' ') { game.pointer.down = false; game.pointer.firing = false; }
      });
      window.addEventListener('resize', resize);
      window.addEventListener('orientationchange', function () { setTimeout(resize, 120); });
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) { persist(); pauseGame(); }
      });
      window.addEventListener('beforeunload', persist);
    }
  }

  /* ------------------------------------------------------------
     Boot
     ------------------------------------------------------------ */
  function buildNoise() {
    var rnd = mulberry32(42117);
    noisePoints = [];
    for (var i = 0; i < 115; i++) {
      noisePoints.push({
        x: rnd() * DESIGN_W,
        y: rnd() * DESIGN_H,
        s: rnd() > 0.75 ? 1.5 : 1,
        a: 0.018 + rnd() * 0.045,
        sp: 0.5 + rnd() * 2.2,
        ph: rnd() * TAU,
        warm: rnd() > 0.45
      });
    }
  }

  function boot() {
    resize();
    buildNoise();
    bgSurface = buildBackground();
    preloadAssets();
    bindInput();
    game.resultT = 0;
    var G = typeof GameGlobal !== 'undefined' ? GameGlobal : (typeof window !== 'undefined' ? window : null);
    if (G) G.__PIPA__ = {
      game: game, stage: stage, startRun: startRun, openShop: openShop, endRun: endRun, resize: resize,
      buyCard: buyCard, closeShop: closeShop, selectSkin: selectSkin, unlockSkin: unlockSkin,
      targetPose: targetPose, hitZoneAt: hitZoneAt,
      startLose: startLose, finishLose: finishLose,
      tick: function (dt) { update(dt || 1 / 60); },
      step: function (dt) { update(dt || 1 / 60); draw(); }
    };
    if (!HAS_WX && typeof location !== 'undefined') {
      var qs = location.search || '';
      if (/(?:[?&])unlockall=1(?:&|$)/.test(qs)) {
        game.demo = false;
        game.save.coins = 99999;
        game.save.unlocked = ['suit', 'niulai', 'feidudu', 'doubao'];
        game.save.skin = 'suit';
        game.save.best = 0;
        game.save.plays = 0;
      }
      var skinMatch = qs.match(/(?:[?&])skin=([a-z]+)/);
      if (skinMatch) game.save.skin = skinMatch[1];
      var modalMatch = qs.match(/(?:[?&])modal=([a-z]+)/);
      if (modalMatch) {
        setTimeout(function () { game.modal = { type: 'skin', skinId: modalMatch[1] }; }, 100);
      }
      if (/(?:[?&])(play|shop|result|autofire|lose)=1(?:&|$)/.test(qs)) {
        setTimeout(function () {
          game.transition = 0;
          startRun();
          game.transition = 0;
          if (/(?:[?&])lose=1(?:&|$)/.test(qs)) {
            startLose();
            game.lose.duration = 999;
            game.lose.t = 1.62;
            draw();
            return;
          }
          if (/(?:[?&])autofire=1(?:&|$)/.test(qs)) {
            game.debugAutoAim = true;
            game.pointer.down = true;
            game.pointer.firing = true;
            game.pointer.x = 195;
            game.pointer.y = 470;
          }
          if (/(?:[?&])shop=1(?:&|$)/.test(qs)) {
            game.run.time = 52;
            game.run.score = 42800;
            game.run.buttHits = 64;
            game.run.hits = 91;
            game.run.shots = 112;
            game.run.maxCombo = 38;
            game.run.wave = 3;
            openShop();
            game.shopT = 1;
            game.transition = 0;
          } else if (/(?:[?&])result=1(?:&|$)/.test(qs)) {
            game.run.score = 98765;
            game.run.buttHits = 131;
            game.run.hits = 178;
            game.run.shots = 213;
            game.run.maxCombo = 54;
            game.run.wave = 4;
            game.run.coinsEarned = 1280;
            game.run.coinsSpent = 320;
            endRun();
            game.resultT = 3;
            game.transition = 0;
          }
        }, 220);
      }
    }
    var last = 0;
    function frame(ts) {
      if (!last) last = ts;
      var dt = (ts - last) / 1000;
      last = ts;
      if (!isFinite(dt) || dt < 0) dt = 0;
      dt = Math.min(dt, 0.05);
      update(dt);
      draw();
      if (typeof requestAnimationFrame !== 'undefined') requestAnimationFrame(frame);
      else setTimeout(function () { frame(Date.now()); }, 16);
    }
    if (typeof requestAnimationFrame !== 'undefined') requestAnimationFrame(frame);
    else setTimeout(function () { frame(Date.now()); }, 16);
  }

  // fix local context declaration for character drawing
  // (kept as a wrapper so all drawing helpers share the main context)
  try {
    boot();
  } catch (e) {
    if (!HAS_WX && typeof console !== 'undefined') console.error(e);
    throw e;
  }
})();
