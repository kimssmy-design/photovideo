// frames.js — 영상 한 장면씩 그리기 (흑백 프레임 + 귀여운 프레임)
var Frames = (function () {
  var W = 720, H = 1280;

  var THEMES = {
    cloud: { name: '구름', bg: '#DDF0FF', soft: '#EAF6FF', deco: 'cloud', a: '#FFFFFF', b: '#FFD66B', text: '#1E4E79', line: '#8CC8F2', sticker: '#FF8FB1' },
    star: { name: '별', bg: '#EEE8FF', soft: '#F6F2FF', deco: 'star', a: '#FFD66B', b: '#C9B8FF', text: '#45358C', line: '#B7A6F2', sticker: '#FFB547' },
    flower: { name: '꽃', bg: '#FFE9F0', soft: '#FFF3F7', deco: 'flower', a: '#FF9DBB', b: '#FFD66B', text: '#9A2F5A', line: '#F6A8C2', sticker: '#FF6F9A' }
  };

  var SEASONS = {
    '봄': { bg: '#FFEAF2', soft: '#FFF4F8', main: '#FF8FB1', sub: '#FFD66B', icon: 'flower', text: '#A0305A' },
    '여름': { bg: '#DFF6F2', soft: '#EEFBF8', main: '#3CC3A8', sub: '#FFC93C', icon: 'sun', text: '#0E6B5C' },
    '가을': { bg: '#FFF0DC', soft: '#FFF7EC', main: '#F49A3A', sub: '#D9622B', icon: 'leaf', text: '#8A4B0B' },
    '겨울': { bg: '#E6F0FF', soft: '#F2F7FF', main: '#7FA8F0', sub: '#FFFFFF', icon: 'snow', text: '#2C4F8C' }
  };

  // ---------- 도형 ----------
  function rng(seed) {
    return function () {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      var t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  function rr(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function cloud(ctx, x, y, s, color) {
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 30 * s, 0, Math.PI * 2);
    ctx.arc(x + 34 * s, y - 16 * s, 38 * s, 0, Math.PI * 2);
    ctx.arc(x + 72 * s, y, 30 * s, 0, Math.PI * 2);
    ctx.fill();
    rr(ctx, x - 30 * s, y - 4 * s, 132 * s, 34 * s, 17 * s);
    ctx.fill();
  }

  function star(ctx, x, y, r, color, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot || 0);
    ctx.fillStyle = color;
    ctx.strokeStyle = color;
    ctx.lineJoin = 'round';
    ctx.lineWidth = r * 0.25;
    ctx.beginPath();
    for (var i = 0; i < 10; i++) {
      var rad = i % 2 ? r * 0.45 : r;
      var a = -Math.PI / 2 + i * Math.PI / 5;
      ctx.lineTo(Math.cos(a) * rad, Math.sin(a) * rad);
    }
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  function flower(ctx, x, y, r, petal, center) {
    ctx.fillStyle = petal;
    for (var i = 0; i < 5; i++) {
      var a = i * Math.PI * 2 / 5 - Math.PI / 2;
      ctx.beginPath();
      ctx.arc(x + Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6, r * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = center;
    ctx.beginPath();
    ctx.arc(x, y, r * 0.38, 0, Math.PI * 2);
    ctx.fill();
  }

  function heart(ctx, x, y, s, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(s, s);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, 30);
    ctx.bezierCurveTo(-60, -10, -30, -55, 0, -25);
    ctx.bezierCurveTo(30, -55, 60, -10, 0, 30);
    ctx.fill();
    ctx.restore();
  }

  function sun(ctx, x, y, r, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineWidth = r * 0.18;
    for (var i = 0; i < 8; i++) {
      var a = i * Math.PI / 4;
      ctx.beginPath();
      ctx.moveTo(Math.cos(a) * r * 0.85, Math.sin(a) * r * 0.85);
      ctx.lineTo(Math.cos(a) * r * 1.25, Math.sin(a) * r * 1.25);
      ctx.stroke();
    }
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.65, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function leaf(ctx, x, y, s, color, rot) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(rot || 0);
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(0, -40 * s);
    ctx.quadraticCurveTo(36 * s, -10 * s, 0, 40 * s);
    ctx.quadraticCurveTo(-36 * s, -10 * s, 0, -40 * s);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 3 * s;
    ctx.beginPath();
    ctx.moveTo(0, -30 * s);
    ctx.lineTo(0, 48 * s);
    ctx.stroke();
    ctx.restore();
  }

  function snow(ctx, x, y, r, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = color;
    ctx.lineCap = 'round';
    ctx.lineWidth = r * 0.16;
    for (var i = 0; i < 6; i++) {
      ctx.rotate(Math.PI / 3);
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(0, -r);
      ctx.moveTo(0, -r * 0.55); ctx.lineTo(r * 0.25, -r * 0.8);
      ctx.moveTo(0, -r * 0.55); ctx.lineTo(-r * 0.25, -r * 0.8);
      ctx.stroke();
    }
    ctx.restore();
  }

  function deco(ctx, kind, x, y, s, c1, c2, rot) {
    if (kind === 'cloud') cloud(ctx, x - 36 * s, y, s, c1);
    else if (kind === 'star') star(ctx, x, y, 34 * s, c1, rot);
    else if (kind === 'flower') flower(ctx, x, y, 44 * s, c1, c2);
    else if (kind === 'sun') sun(ctx, x, y, 36 * s, c1);
    else if (kind === 'leaf') leaf(ctx, x, y, s, c1, rot);
    else if (kind === 'snow') snow(ctx, x, y, 34 * s, c1);
    else if (kind === 'heart') heart(ctx, x, y, s, c1);
  }

  // ---------- 배경 (미리 그려서 재사용) ----------
  var bgCache = {};
  var scale = 1;            // 실제 캔버스 크기 ÷ 720 (고화질 1080p면 1.5)
  function background(pal, kind, seed) {
    var key = pal.bg + kind + seed + '@' + scale;
    if (bgCache[key]) return bgCache[key];
    var c = document.createElement('canvas');
    c.width = Math.round(W * scale); c.height = Math.round(H * scale);
    var ctx = c.getContext('2d');
    ctx.scale(scale, scale);
    var r = rng(seed * 977 + 13);
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, H);
    ctx.fillStyle = pal.soft;
    for (var i = 0; i < 5; i++) {
      ctx.beginPath();
      ctx.arc(r() * W, r() * H, 120 + r() * 160, 0, Math.PI * 2);
      ctx.fill();
    }
    // 동그란 색종이 점
    for (i = 0; i < 26; i++) {
      ctx.fillStyle = i % 2 ? pal.c1 : pal.c2;
      ctx.globalAlpha = 0.55;
      ctx.beginPath();
      ctx.arc(r() * W, r() * H, 5 + r() * 7, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    // 가장자리 장식 (가운데 사진 자리는 비워요)
    var placed = 0, tries = 0;
    while (placed < 11 && tries < 200) {
      tries++;
      var x = 40 + r() * (W - 80), y = 40 + r() * (H - 80);
      if (x > 110 && x < W - 110 && y > 200 && y < H - 170) continue;
      deco(ctx, kind, x, y, 0.7 + r() * 0.6, kind === 'cloud' || i % 3 ? pal.c1 : pal.c2, pal.c2, r() * Math.PI);
      placed++;
      i++;
    }
    bgCache[key] = c;
    return c;
  }

  function themePal(t) { return { bg: t.bg, soft: t.soft, c1: t.a, c2: t.b }; }
  function seasonPal(s) { return { bg: s.bg, soft: s.soft, c1: s.main, c2: s.sub }; }

  // ---------- 글자 ----------
  function wrapLines(ctx, text, maxW) {
    var out = [];
    String(text).split('\n').forEach(function (para) {
      var words = para.split(' ');
      var line = '';
      words.forEach(function (w) {
        var test = line ? line + ' ' + w : w;
        if (ctx.measureText(test).width <= maxW) { line = test; return; }
        if (line) out.push(line);
        line = '';
        // 한 단어가 너무 길면 글자 단위로 자르기
        var piece = '';
        for (var i = 0; i < w.length; i++) {
          if (ctx.measureText(piece + w[i]).width > maxW && piece) { out.push(piece); piece = ''; }
          piece += w[i];
        }
        line = piece;
      });
      out.push(line);
    });
    return out;
  }

  function fitText(ctx, text, fontKey, px, maxW, maxLines) {
    var lines;
    while (true) {
      ctx.font = Fonts.css(fontKey, px);
      lines = wrapLines(ctx, text, maxW);
      if (lines.length <= maxLines || px <= 36) break;
      px -= 6;
    }
    return { lines: lines, px: px };
  }

  function drawLines(ctx, lines, x, y, lh, fill, stroke, sw) {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.lineJoin = 'round';
    var top = y - (lines.length - 1) * lh / 2;
    lines.forEach(function (l, i) {
      if (stroke) {
        ctx.strokeStyle = stroke;
        ctx.lineWidth = sw;
        ctx.strokeText(l, x, top + i * lh);
      }
      ctx.fillStyle = fill;
      ctx.fillText(l, x, top + i * lh);
    });
  }

  function easeOut(t) { t = Math.min(1, Math.max(0, t)); return 1 - Math.pow(1 - t, 3); }
  function easeBack(t) {
    t = Math.min(1, Math.max(0, t));
    var c1 = 1.7, c3 = c1 + 1;
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
  }

  // 사진을 칸에 꽉 차게(가운데 기준) 그리기
  function drawCover(ctx, img, x, y, w, h, zoom) {
    var s = Photos.sizeOf(img);
    var r = Math.max(w / s.w, h / s.h) * (zoom || 1);
    var dw = s.w * r, dh = s.h * r;
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  }

  // ---------- 장면 ----------
  function drawTitle(ctx, sl, p, env) {
    var t = env.theme;
    ctx.drawImage(background(themePal(t), t.deco, 1), 0, 0, W, H);
    var k = 0.92 + 0.08 * easeOut(p * 3);   // 첫 화면부터 보이게 (카톡 미리보기 썸네일)
    if (env.settings.className) {
      ctx.font = Fonts.css(env.settings.bodyFont, 40);
      var tw = ctx.measureText(env.settings.className).width + 70;
      ctx.fillStyle = '#FFFFFF';
      rr(ctx, (W - tw) / 2, 120, tw, 76, 38);
      ctx.fill();
      ctx.fillStyle = t.text;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(env.settings.className, W / 2, 160);
    }
    var cx = W / 2, cy = 560, R = 230;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(k, k);
    ctx.fillStyle = t.line;
    ctx.beginPath(); ctx.arc(0, 0, R + 26, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    ctx.beginPath(); ctx.arc(0, 0, R + 16, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.clip();
    if (sl.img) drawCover(ctx, sl.img, -R, -R, R * 2, R * 2, 1 + 0.04 * p);
    else { ctx.fillStyle = t.soft; ctx.fillRect(-R, -R, R * 2, R * 2); }
    ctx.restore();
    heart(ctx, cx + 200, cy - 190, 0.9 * k, t.sticker);
    star(ctx, cx - 215, cy + 175, 30 * k, '#FFD66B', 0.3);
    var tk = easeOut(p * 3);
    var ft = fitText(ctx, sl.title, env.settings.titleFont, 100, 640, 2);
    ctx.font = Fonts.css(env.settings.titleFont, ft.px);
    drawLines(ctx, ft.lines, W / 2, 975 + (1 - tk) * 16, ft.px * 1.2, t.text, '#FFFFFF', 16);
  }

  function drawSeason(ctx, sl, p, env) {
    var s = SEASONS[sl.season];
    ctx.drawImage(background(seasonPal(s), s.icon, 5 + Object.keys(SEASONS).indexOf(sl.season)), 0, 0, W, H);
    var k = easeBack(p * 2.6);
    ctx.save();
    ctx.translate(W / 2, 500);
    ctx.scale(k * 3.2, k * 3.2);
    deco(ctx, s.icon, 0, 0, 1, s.main, s.sub, 0.2);
    ctx.restore();
    ctx.globalAlpha = easeOut(p * 3);
    ctx.font = Fonts.css(env.settings.titleFont, 200);
    drawLines(ctx, [sl.season], W / 2, 830, 200, s.text, '#FFFFFF', 22);
    ctx.globalAlpha = 1;
  }

  // ---------- 사진 채우기: 세로 사진은 꽉 차게, 가로 사진은 전체가 보이게 + 뒤에 흐린 같은 사진 ----------
  var blurCache = typeof WeakMap === 'function' ? new WeakMap() : null;
  function blurOf(img) {
    if (blurCache && blurCache.has(img)) return blurCache.get(img);
    var s = Photos.sizeOf(img);
    var c = document.createElement('canvas');
    c.width = 36; c.height = Math.max(1, Math.round(36 * s.h / s.w));
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);   // 아주 작게 줄였다가 키우면 자연스럽게 흐려져요
    if (blurCache) blurCache.set(img, c);
    return c;
  }
  function fillPhoto(ctx, img, x, y, w, h, zoom) {
    if (!img) return;
    var sz = Photos.sizeOf(img);
    var ia = sz.w / sz.h, sa = w / h;
    if (ia <= sa * 1.25) { drawCover(ctx, img, x, y, w, h, zoom); return; }
    drawCover(ctx, blurOf(img), x, y, w, h, 1.15);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(x, y, w, h);
    var r = Math.min(w / sz.w, h / sz.h) * (zoom || 1);
    var dw = sz.w * r, dh = sz.h * r;
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
  }

  // ---------- 귀여운 프레임 사진 장: 틀(배경·카드·스티커)은 고정, 사진·글만 바뀜 ----------
  var CUTE = { cx: W / 2, cy: 560, w: 570, h: 760, pad: 18, tilt: -1.5 * Math.PI / 180 };
  function cuteFrame(ctx) {
    ctx.translate(CUTE.cx, CUTE.cy);
    ctx.rotate(CUTE.tilt);
  }
  function cuteChrome(ctx, env) {
    var t = env.theme, w = CUTE.w, h = CUTE.h, pad = CUTE.pad;
    ctx.drawImage(background(themePal(t), t.deco, 2), 0, 0, W, H);
    ctx.save();
    cuteFrame(ctx);
    ctx.fillStyle = t.line;
    rr(ctx, -w / 2 - pad - 6, -h / 2 - pad - 6, w + pad * 2 + 12, h + pad * 2 + 12, 40);
    ctx.fill();
    ctx.fillStyle = '#FFFFFF';
    rr(ctx, -w / 2 - pad, -h / 2 - pad, w + pad * 2, h + pad * 2, 34);
    ctx.fill();
    ctx.fillStyle = t.soft;
    rr(ctx, -w / 2, -h / 2, w, h, 20);
    ctx.fill();
    ctx.restore();
  }
  function cuteContent(ctx, sl, p, env, dx) {
    var w = CUTE.w, h = CUTE.h;
    ctx.save();
    cuteFrame(ctx);
    rr(ctx, -w / 2, -h / 2, w, h, 20);
    ctx.clip();
    ctx.translate(dx || 0, 0);
    fillPhoto(ctx, sl.img, -w / 2, -h / 2, w, h, 1 + 0.05 * p);
    ctx.restore();
  }
  function cuteSticker(ctx, env) {
    ctx.save();
    cuteFrame(ctx);
    star(ctx, CUTE.w / 2 - 4, -CUTE.h / 2 + 4, 40, '#FFD66B', 0.25);
    ctx.restore();
  }
  function cuteText(ctx, sl, p, env, alpha) {
    var t = env.theme;
    var bottom = CUTE.cy + CUTE.h / 2 + CUTE.pad;
    if (sl.caption) {
      var ck = easeOut((p - 0.08) * 4);
      var ft = fitText(ctx, sl.caption, env.settings.titleFont, 56, 640, 2);
      ctx.font = Fonts.css(env.settings.titleFont, ft.px);
      var capY = bottom + 50 + (ft.lines.length - 1) * ft.px * 0.6;
      ctx.globalAlpha = alpha * ck;
      drawLines(ctx, ft.lines, W / 2, capY, ft.px * 1.2, t.text, '#FFFFFF', 14);
      ctx.globalAlpha = alpha;
      if (sl.date) {
        ctx.font = Fonts.css(env.settings.bodyFont, 34);
        drawLines(ctx, [sl.date], W / 2, Math.min(H - 50, capY + ft.lines.length * ft.px * 0.6 + 44), 34, t.text, '#FFFFFF', 8);
      }
    } else if (sl.date) {
      ctx.globalAlpha = alpha;
      ctx.font = Fonts.css(env.settings.bodyFont, 44);
      drawLines(ctx, [sl.date], W / 2, bottom + 70, 44, t.text, '#FFFFFF', 10);
    }
    ctx.globalAlpha = 1;
  }
  function drawPhoto(ctx, sl, p, env) {
    cuteChrome(ctx, env);
    cuteContent(ctx, sl, p, env, 0);
    cuteSticker(ctx, env);
    cuteText(ctx, sl, p, env, 1);
  }

  function drawEnd(ctx, sl, p, env) {
    var t = env.theme;
    ctx.drawImage(background(themePal(t), t.deco, 9), 0, 0, W, H);
    var k = easeBack(p * 2.5) * (1 + 0.05 * Math.sin(p * Math.PI * 6));
    heart(ctx, W / 2, 420, 3.2 * k, t.sticker);
    ctx.globalAlpha = easeOut((p - 0.1) * 3);
    var ft = fitText(ctx, sl.text, env.settings.titleFont, 80, 620, 4);
    ctx.font = Fonts.css(env.settings.titleFont, ft.px);
    drawLines(ctx, ft.lines, W / 2, 760, ft.px * 1.3, t.text, '#FFFFFF', 14);
    if (sl.from) {
      ctx.font = Fonts.css(env.settings.bodyFont, 46);
      drawLines(ctx, [sl.from], W / 2, 1080, 46, t.text, '#FFFFFF', 10);
    }
    ctx.globalAlpha = 1;
  }

  // ======================================================
  // 흑백 프레임 — 베이비 앨범 인쇄 화면처럼 흰 바탕 + 얇은 선 + 큰 월 글자
  // 포인트 색(accent)은 월 글자와 선에만, 장식(흰 테두리·별·하트)은 옵션
  // ======================================================
  var M = 56;                       // 바깥 여백
  var INK = '#111111', SOFT = '#8a8a8a', FRAME_BG = '#ececec';

  function spacing(ctx, px) { if ('letterSpacing' in ctx) ctx.letterSpacing = px + 'px'; }

  function monoBase(ctx) {
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, W, H);
  }

  function rule(ctx, x, y, w, color, thick) {
    ctx.fillStyle = color;
    ctx.fillRect(x, y, w, thick || 3);
  }

  // 사진 + (옵션) 흰 테두리 그림자
  function monoPhoto(ctx, img, x, y, w, h, zoom, s) {
    if (s.optBorder) {
      ctx.fillStyle = 'rgba(0,0,0,0.10)';
      ctx.fillRect(x - 14, y - 14 + 6, w + 28, h + 52);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(x - 16, y - 16, w + 32, h + 52);
      ctx.strokeStyle = '#E4E4E4';
      ctx.lineWidth = 2;
      ctx.strokeRect(x - 16, y - 16, w + 32, h + 52);
    }
    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, w, h);
    ctx.clip();
    ctx.fillStyle = FRAME_BG;
    ctx.fillRect(x, y, w, h);
    if (img) drawCover(ctx, img, x, y, w, h, zoom);
    ctx.restore();
  }

  function monoStickers(ctx, x, y, w, h, s) {
    if (!s.optSticker) return;
    star(ctx, x + w - 6, y + 10, 30, '#C99A3C', 0.2);
    heart(ctx, x + 10, y + h - 14, 0.7, s.accent || INK);
  }

  function monoTitle(ctx, sl, p, env) {
    var s = env.settings, acc = s.accent || INK;
    monoBase(ctx);
    var bw = 470, bh = Math.round(bw * 4 / 3);
    var bx = (W - bw) / 2, by = 170;
    ctx.globalAlpha = easeOut(p * 3);
    monoPhoto(ctx, sl.img, bx, by, bw, bh, 1 + 0.04 * p, s);
    monoStickers(ctx, bx, by, bw, bh, s);
    ctx.globalAlpha = 1;
    var ry = by + bh + (s.optBorder ? 80 : 56);
    rule(ctx, bx, ry, bw, acc, 3);
    var ft = fitText(ctx, sl.title, s.titleFont, 80, bw + 60, 2);
    ctx.font = Fonts.css(s.titleFont, ft.px);
    drawLines(ctx, ft.lines, W / 2, ry + 50 + (ft.lines.length - 1) * ft.px * 0.6, ft.px * 1.2, INK);
    if (sl.years) {
      ctx.font = Fonts.css(s.bodyFont, 26);
      spacing(ctx, 6);
      drawLines(ctx, [sl.years], W / 2, ry + 70 + ft.lines.length * ft.px * 1.2, 26, SOFT);
      spacing(ctx, 0);
    }
  }

  function monoSeason(ctx, sl, p, env) {
    var s = env.settings, acc = s.accent || INK;
    monoBase(ctx);
    var k = easeOut(p * 3);
    ctx.globalAlpha = k;
    rule(ctx, W / 2 - 40, 500, 80, acc, 3);
    ctx.font = Fonts.css(s.titleFont, 190);
    drawLines(ctx, [sl.season], W / 2, 640 + (1 - k) * 16, 190, acc === INK ? INK : acc);
    rule(ctx, W / 2 - 40, 780, 80, acc, 3);
    if (sl.year) {
      ctx.font = Fonts.css(s.bodyFont, 26);
      spacing(ctx, 6);
      drawLines(ctx, [String(sl.year)], W / 2, 840, 26, SOFT);
      spacing(ctx, 0);
    }
    ctx.globalAlpha = 1;
  }

  // 흑백 사진 장: 틀(흰 바탕·위쪽 선·사진 칸)은 고정, 사진·글만 바뀜
  var BAND_Y = 168;
  function monoSlot(s) {
    var w = W - M * 2 - (s.optBorder ? 40 : 0);
    var h = Math.round(w * 4 / 3);
    return { x: (W - w) / 2, y: BAND_Y + 60 + (s.optBorder ? 16 : 0), w: w, h: h };
  }
  function monoChrome(ctx, env) {
    var s = env.settings, acc = s.accent || INK, r = monoSlot(s);
    monoBase(ctx);
    rule(ctx, M, BAND_Y, W - M * 2, acc, 3);
    if (s.optBorder) {
      ctx.fillStyle = 'rgba(0,0,0,0.10)';
      ctx.fillRect(r.x - 14, r.y - 10, r.w + 28, r.h + 52);
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(r.x - 16, r.y - 16, r.w + 32, r.h + 52);
      ctx.strokeStyle = '#E4E4E4';
      ctx.lineWidth = 2;
      ctx.strokeRect(r.x - 16, r.y - 16, r.w + 32, r.h + 52);
    }
    ctx.fillStyle = FRAME_BG;
    ctx.fillRect(r.x, r.y, r.w, r.h);
  }
  function monoContent(ctx, sl, p, env, dx) {
    var r = monoSlot(env.settings);
    ctx.save();
    ctx.beginPath();
    ctx.rect(r.x, r.y, r.w, r.h);
    ctx.clip();
    ctx.translate(dx || 0, 0);
    fillPhoto(ctx, sl.img, r.x, r.y, r.w, r.h, 1 + 0.04 * p);
    ctx.restore();
  }
  function monoText(ctx, sl, p, env, alpha) {
    var s = env.settings, acc = s.accent || INK, r = monoSlot(s);
    ctx.globalAlpha = alpha;
    ctx.textBaseline = 'alphabetic';
    if (sl.year) {
      ctx.font = Fonts.css(s.bodyFont, 26);
      ctx.fillStyle = SOFT;
      ctx.textAlign = 'left';
      spacing(ctx, 6);
      ctx.fillText(String(sl.year), M + 4, BAND_Y - 14);
      spacing(ctx, 0);
    }
    if (sl.month) {
      ctx.font = Fonts.css(s.titleFont, 92);
      ctx.fillStyle = acc;
      ctx.textAlign = 'right';
      ctx.fillText(sl.month, W - M - 4, BAND_Y - 12);
    }
    var capY = r.y + r.h + (s.optBorder ? 70 : 52);
    var right = sl.date || '';
    ctx.font = Fonts.css(s.bodyFont, 28);
    var rw = right ? ctx.measureText(right).width : 0;
    if (right) {
      ctx.fillStyle = INK;
      ctx.textAlign = 'right';
      ctx.textBaseline = 'middle';
      ctx.fillText(right, r.x + r.w, capY);
    }
    if (sl.caption) {
      var maxCap = Math.max(160, r.w - rw - 24);
      ctx.globalAlpha = alpha * easeOut((p - 0.08) * 4);
      var ft = fitText(ctx, sl.caption, s.bodyFont, 32, maxCap, 2);
      ctx.font = Fonts.css(s.bodyFont, ft.px);
      ctx.fillStyle = INK;
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ft.lines.forEach(function (l, i) { ctx.fillText(l, r.x, capY + i * ft.px * 1.3); });
    }
    ctx.globalAlpha = 1;
  }
  function monoPhotoSlide(ctx, sl, p, env) {
    var r = monoSlot(env.settings);
    monoChrome(ctx, env);
    monoContent(ctx, sl, p, env, 0);
    monoStickers(ctx, r.x, r.y, r.w, r.h, env.settings);
    monoText(ctx, sl, p, env, 1);
  }

  // ---------- 사진 장 → 사진 장: 틀은 그대로, 사진만 넘어가요 ----------
  function swap(ctx, a, pa, b, pb, k, mode, env) {
    scale = ctx.canvas.width / W;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    var mono = env.settings.theme === 'mono';
    var e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
    var slotW = mono ? monoSlot(env.settings).w : CUTE.w;
    var content = mono ? monoContent : cuteContent;
    if (mono) monoChrome(ctx, env); else cuteChrome(ctx, env);
    if (mode === 'slide') {
      content(ctx, a, pa, env, -slotW * e);
      content(ctx, b, pb, env, slotW * (1 - e));
    } else {
      content(ctx, a, pa, env, 0);
      ctx.globalAlpha = k;
      content(ctx, b, pb, env, 0);
      ctx.globalAlpha = 1;
    }
    if (mono) {
      var r = monoSlot(env.settings);
      monoStickers(ctx, r.x, r.y, r.w, r.h, env.settings);
      monoText(ctx, a, pa, env, 1 - k);
      monoText(ctx, b, pb, env, k);
    } else {
      cuteSticker(ctx, env);
      cuteText(ctx, a, pa, env, 1 - k);
      cuteText(ctx, b, pb, env, k);
    }
  }

  function monoEnd(ctx, sl, p, env) {
    var s = env.settings, acc = s.accent || INK;
    monoBase(ctx);
    var k = easeOut(p * 2.5);
    ctx.globalAlpha = k;
    var ft = fitText(ctx, sl.text, s.titleFont, 66, 560, 5);
    ctx.font = Fonts.css(s.titleFont, ft.px);
    var lh = ft.px * 1.45;
    var half = (ft.lines.length - 1) * lh / 2;
    rule(ctx, W / 2 - 36, H / 2 - half - 90, 72, acc, 3);
    drawLines(ctx, ft.lines, W / 2, H / 2, lh, INK);
    rule(ctx, W / 2 - 36, H / 2 + half + 86, 72, acc, 3);
    if (s.optSticker) heart(ctx, W / 2, H / 2 + half + 170, 0.9, acc === INK ? '#B5543B' : acc);
    ctx.globalAlpha = 1;
  }

  function render(ctx, sl, p, env) {
    // 효과 없음: 장면이 바뀔 때 글자가 다시 나타나거나 사진이 커지는 움직임도 없애서 깜빡이지 않게
    if (env.settings.transition === 'none') p = 1;
    // 좌표는 늘 720×1280 기준, 캔버스가 크면 그만큼 확대해서 선명하게
    scale = ctx.canvas.width / W;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    if (env.settings.theme === 'mono') {
      if (sl.type === 'title') monoTitle(ctx, sl, p, env);
      else if (sl.type === 'season') monoSeason(ctx, sl, p, env);
      else if (sl.type === 'photo') monoPhotoSlide(ctx, sl, p, env);
      else monoEnd(ctx, sl, p, env);
      return;
    }
    if (sl.type === 'title') drawTitle(ctx, sl, p, env);
    else if (sl.type === 'season') drawSeason(ctx, sl, p, env);
    else if (sl.type === 'photo') drawPhoto(ctx, sl, p, env);
    else drawEnd(ctx, sl, p, env);
  }

  return { W: W, H: H, THEMES: THEMES, render: render, swap: swap };
})();
