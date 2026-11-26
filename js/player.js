// player.js — 장면 순서(타임라인) 만들기, 시간에 맞춰 그리기, 미리보기 재생
var Player = (function () {
  var FADE = 0.6;          // 장면이 겹치며 바뀌는 시간(초)
  var DUR = { title: 3.5, season: 2.2, end: 4.5 };
  var buffer = null;

  function env() {
    var s = State.data.settings;
    return { settings: s, theme: Frames.THEMES[s.theme] || Frames.THEMES.cloud };
  }

  // child: 아이, own: 아이 사진, common: 공통 사진
  // 대표 사진: 직접 정한 사진, 없으면 아이 사진 중 가장 먼저 찍은 것
  function coverOf(child, own) {
    if (child.coverId) {
      for (var i = 0; i < own.length; i++) if (own[i].id === child.coverId) return own[i];
    }
    return Photos.sortByDate(own)[0] || null;
  }

  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  // 아이마다 다르지만, 같은 아이는 미리보기·영상이 같은 순서가 되게 섞어요
  function shuffled(list, child) {
    var seed = (hash(child.id || child.name) + (State.data.settings.shuffleSeed || 1) * 7919) >>> 0;
    var out = list.slice().sort(function (a, b) { return a.id < b.id ? -1 : 1; });
    for (var j = out.length - 1; j > 0; j--) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      var r = seed % (j + 1);
      var tmp = out[j]; out[j] = out[r]; out[r] = tmp;
    }
    return out;
  }

  // 영상에 들어갈 사진 순서
  function order(child, own, common) {
    var list = own.concat(child.noCommon ? [] : common);
    return State.data.settings.order === 'shuffle' ? shuffled(list, child) : Photos.sortByDate(list);
  }

  function useSeasons() {
    var s = State.data.settings;
    return s.order !== 'shuffle' && s.seasons;
  }

  // 예상 길이(초)·용량(MB) — 사진을 열지 않고 빠르게 계산
  function estimate(child, own, common) {
    var all = order(child, own, common);
    if (!all.length) return null;
    var n = 2, sec = DUR.title + DUR.end, last = null;
    all.forEach(function (p) {
      if (useSeasons()) {
        var se = Photos.seasonOf(p.date);
        if (se !== last) { n++; sec += DUR.season; last = se; }
      }
      n++;
      sec += +State.data.settings.photoSec || 3;
    });
    sec -= FADE * (n - 1);
    return { count: all.length, sec: sec, mb: sec * 0.22 };
  }

  // 사진 아래 표시: 날짜(5.10) · 생후 개월 수 (설정에서 각각 켜고 끄기, 찍은 날짜를 알 때만)
  function photoLabel(p) {
    var s = State.data.settings;
    if (!p.exif) return '';
    var d = new Date(p.date), parts = [];
    if (s.showDate) parts.push((d.getMonth() + 1) + '.' + d.getDate());
    if (s.showAge) { var a = Children.ageText(p.date); if (a) parts.push(a); }
    return parts.join(' · ');
  }

  // 첫 장 아래 작은 글씨: 2025 — 2026
  function yearRange(list) {
    var ys = list.filter(function (p) { return p.exif; }).map(function (p) { return new Date(p.date).getFullYear(); });
    if (!ys.length) return '';
    var a = Math.min.apply(null, ys), b = Math.max.apply(null, ys);
    return a === b ? String(a) : a + ' — ' + b;
  }

  async function build(child, own, common) {
    var s = State.data.settings;
    var shuffle = s.order === 'shuffle';
    var all = order(child, own, common);
    var cover = coverOf(child, own) || all[0];
    var caps = s.captionsOn ? Captions.forChild(child, all.length) : [];
    var slides = [];
    slides.push({ type: 'title', title: Children.fill(s.titleTpl, child), years: yearRange(all), img: cover ? await Photos.image(cover) : null, dur: DUR.title });
    var last = null, idx = 0;
    for (var i = 0; i < all.length; i++) {
      var p = all[i];
      if (useSeasons()) {
        var season = Photos.seasonOf(p.date);
        if (season !== last) { slides.push({ type: 'season', season: season, year: p.exif ? new Date(p.date).getFullYear() : '', dur: DUR.season }); last = season; }
      }
      var ownText = s.photoTextOn && p.text ? Children.fill(p.text, child) : '';
      var d = new Date(p.date);
      slides.push({
        type: 'photo', photo: p, img: null,
        date: photoLabel(p),
        caption: ownText || caps[i] || '',
        year: p.exif ? d.getFullYear() : '', month: p.exif ? (d.getMonth() + 1) + '월' : '',
        idx: idx++, dur: +s.photoSec || 3
      });
    }
    var msg = s.personalOn && child.message && child.message.trim() ? child.message.trim() : s.endTpl;
    slides.push({ type: 'end', text: Children.fill(msg, child), from: [s.className, s.from].filter(Boolean).join(' '), dur: DUR.end });
    Photos.keepOnly(cover ? [cover.id] : []);

    var t = 0;
    slides.forEach(function (sl, k) {
      sl.start = t;
      t += sl.dur - (k < slides.length - 1 ? FADE : 0);
    });

    // 캔버스에 쓸 글자를 미리 불러오기
    var titleText = slides.map(function (x) { return (x.title || x.text || x.season || '') + (x.caption || ''); }).join('');
    var bodyText = slides.map(function (x) { return (x.date || '') + (x.from || ''); }).join('') + (s.className || '') + '0123456789월일—·생후개월태어난달봄여름가을겨울';
    await Promise.all([Fonts.ensure(s.titleFont, titleText + '가'), Fonts.ensure(s.bodyFont, bodyText + '가')]);

    return { slides: slides, total: t, photoCount: all.length };
  }

  // t초 근처(앞 1초 ~ 뒤 3초) 사진만 열어 두고, 지난 사진은 메모리에서 내려놓아요
  function prepare(tl, t) {
    var keep = {}, jobs = [];
    var cover = tl.slides[0].img;
    tl.slides.forEach(function (sl) {
      if (sl.type !== 'photo') return;
      var near = sl.start + sl.dur > t - 1 && sl.start < t + 3;
      if (near) {
        keep[sl.photo.id] = true;
        if (!sl.img) {
          var ready = Photos.loaded(sl.photo.id);
          if (ready) sl.img = ready;
          else jobs.push(Photos.image(sl.photo).then(function (img) { sl.img = img; }).catch(function () {}));
        }
      }
    });
    tl.slides.forEach(function (sl) {
      if (sl.type === 'photo' && sl.img && !keep[sl.photo.id] && sl.img !== cover) {
        Photos.release(sl.photo.id);
        sl.img = null;
      }
    });
    return Promise.all(jobs);
  }

  function renderAt(ctx, tl, t) {
    var e = env();
    var sl = tl.slides, i = 0;
    while (i < sl.length - 1 && sl[i + 1].start <= t) i++;
    var cur = sl[i];
    var local = Math.min(1, Math.max(0, (t - cur.start) / cur.dur));
    var mode = e.settings.transition || 'fade';   // fade: 페이드, slide: 슬라이드, none: 바로 바뀜
    if (i > 0 && t < cur.start + FADE && mode !== 'none') {
      var prev = sl[i - 1];
      var k = (t - cur.start) / FADE;
      var pPrev = Math.min(1, (t - prev.start) / prev.dur);
      if (prev.type === 'photo' && cur.type === 'photo') {
        // 사진 → 사진: 틀은 그대로 두고 사진 칸 안에서만 넘어가요
        Frames.swap(ctx, prev, pPrev, cur, local, k, mode, e);
      } else {
        // 첫 장·계절 장·마지막 장처럼 틀이 바뀔 때는 부드럽게 겹쳐요
        Frames.render(ctx, prev, pPrev, e);
        if (!buffer) buffer = document.createElement('canvas');
        if (buffer.width !== ctx.canvas.width) { buffer.width = ctx.canvas.width; buffer.height = ctx.canvas.height; }
        Frames.render(buffer.getContext('2d'), cur, local, e);
        ctx.globalAlpha = k;
        ctx.drawImage(buffer, 0, 0, Frames.W, Frames.H);
        ctx.globalAlpha = 1;
      }
    } else {
      Frames.render(ctx, cur, local, e);
    }
    return i;
  }

  // 미리보기 재생 (영상 파일을 만들지 않고 화면에서만)
  function play(canvas, tl, audio, onTick) {
    var ctx = canvas.getContext('2d');
    var actx = null, src = null, stopped = false, t0 = performance.now();
    if (audio) {
      try {
        actx = new (window.AudioContext || window.webkitAudioContext)();
        src = actx.createBufferSource();
        src.buffer = audio;
        src.connect(actx.destination);
        src.start();
      } catch (e) { actx = null; }
    }
    function now() { return (performance.now() - t0) / 1000; }
    var lastPrep = -1;
    function loop() {
      if (stopped) return;
      var t = Math.min(tl.total, now());
      if (Math.floor(t * 2) !== lastPrep) { lastPrep = Math.floor(t * 2); prepare(tl, t); }
      var i = renderAt(ctx, tl, t);
      if (onTick) onTick(t, i);
      if (t >= tl.total) { stop(); return; }
      requestAnimationFrame(loop);
    }
    function stop() {
      if (stopped) return;
      stopped = true;
      try { if (src) src.stop(); } catch (e) {}
      try { if (actx) actx.close(); } catch (e) {}
      if (onTick) onTick(tl.total, -1);
    }
    requestAnimationFrame(loop);
    return { stop: stop };
  }

  return { prepare: prepare, build: build, estimate: estimate, coverOf: coverOf, renderAt: renderAt, play: play, FADE: FADE };
})();
