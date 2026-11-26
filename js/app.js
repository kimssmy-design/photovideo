// app.js — 화면 연결 (설정 패널, 사진 판, 미리보기, 영상 만들기, 백업)
var App = (function () {
  var $ = function (id) { return document.getElementById(id); };
  var OWNER = 'me';
  var photos = [];
  var result = null, resultUrl = null;
  var cancelFlag = false;
  var bigCtl = null, cardCtl = null;
  var cardTimer = null;

  var COLORS = [
    { name: '검정', color: '#111111' }, { name: '회색', color: '#7a7a7a' }, { name: '테라코타', color: '#b5543b' },
    { name: '하늘', color: '#6f8ea5' }, { name: '올리브', color: '#7f9a6f' }, { name: '머스터드', color: '#c99a3c' }
  ];

  // ---------- 공통 ----------
  var toastTimer = null;
  function toast(msg, ms) {
    var t = $('toast');
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { t.hidden = true; }, ms || 2600);
  }
  var closeHooks = {};
  function onClose(id, fn) { closeHooks[id] = fn; }
  function openSheet(id) { $(id).hidden = false; }
  function closeSheet(id) {
    $(id).hidden = true;
    if (id === 'previewSheet' && bigCtl) { bigCtl.stop(); bigCtl = null; }
    if (id === 'resultSheet') { cancelFlag = true; $('resultVideo').pause(); }
    if (closeHooks[id]) { var f = closeHooks[id]; delete closeHooks[id]; f(); }
  }
  function ask(text, yes) {
    return new Promise(function (resolve) {
      $('askText').textContent = text;
      $('askYes').textContent = yes || '확인';
      openSheet('askSheet');
      $('askYes').onclick = function () { closeSheet('askSheet'); resolve(true); };
      $('askNo').onclick = function () { closeSheet('askSheet'); resolve(false); };
    });
  }
  function S() { return State.data.settings; }
  function C() { return State.data.child; }
  function changed() { State.save(); updateStatus(); scheduleCard(); }

  // ---------- 설정 패널 ----------
  function seg(el, items, current, onPick) {
    el.innerHTML = '';
    items.forEach(function (it) {
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = it[1];
      if (String(it[0]) === String(current)) b.className = 'on';
      b.onclick = function () { onPick(it[0]); };
      el.appendChild(b);
    });
  }

  function renderSettings() {
    var s = S();
    $('cName').value = C().name;
    $('cBirth').value = C().birthday;
    $('sDrop').checked = !!s.dropSurname;
    $('sTitle').value = s.titleTpl;
    $('sEnd').value = s.endTpl;
    $('sShowDate').checked = !!s.showDate;
    $('sShowAge').checked = !!s.showAge;
    $('sCaps').checked = !!s.captionsOn;
    $('sSeason').checked = !!s.seasons;
    $('sBorder').checked = !!s.optBorder;
    $('sSticker').checked = !!s.optSticker;
    var shuffle = s.order === 'shuffle';
    seg($('orderSeg'), [['date', '날짜순'], ['shuffle', '골고루 섞기']], s.order, function (v) { s.order = v; changed(); renderSettings(); });
    $('reshuffleBtn').hidden = !shuffle;
    $('seasonRow').style.visibility = shuffle ? 'hidden' : '';
    seg($('secSeg'), [[2, '2초'], [3, '3초'], [4, '4초'], [5, '5초']], s.photoSec, function (v) { s.photoSec = v; changed(); renderSettings(); });
    seg($('themeSeg'), [['mono', '흑백'], ['cloud', '구름'], ['star', '별'], ['flower', '꽃']], s.theme, function (v) { s.theme = v; changed(); renderSettings(); });
    $('monoOpts').hidden = s.theme !== 'mono';
    $('transSel').value = s.transition || 'fade';
    $('qualitySel').value = s.quality;
    markColor();
    renderFontBtns();
    renderMusic();
  }

  function renderFontBtns() {
    var s = S();
    $('titleFontBtn').innerHTML = '<small>제목</small><span></span>';
    $('titleFontBtn').lastChild.textContent = Fonts.label(s.titleFont);
    $('titleFontBtn').lastChild.style.font = Fonts.css(s.titleFont, 15);
    $('bodyFontBtn').innerHTML = '<small>본문</small><span></span>';
    $('bodyFontBtn').lastChild.textContent = Fonts.label(s.bodyFont);
    $('bodyFontBtn').lastChild.style.font = Fonts.css(s.bodyFont, 15);
  }

  function renderMusic() {
    var s = S(), sel = $('musicSel');
    var items = [['none', '음악 없음']].concat(Object.keys(Music.SONGS).map(function (k) { return [k, Music.SONGS[k].name]; }));
    if (s.musicName) items.push(['file', '내 음악: ' + s.musicName]);
    sel.innerHTML = '';
    items.forEach(function (it) {
      var o = document.createElement('option');
      o.value = it[0];
      o.textContent = it[1];
      sel.appendChild(o);
    });
    sel.value = s.music;
  }

  function initColors() {
    var row = $('colorRow');
    COLORS.forEach(function (c) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'color-chip';
      b.style.background = c.color;
      b.dataset.color = c.color;
      b.title = c.name;
      b.setAttribute('aria-label', c.name);
      b.onclick = function () { S().accent = c.color; markColor(); changed(); };
      row.insertBefore(b, row.lastElementChild);
    });
    $('colorCustom').addEventListener('input', function () { S().accent = $('colorCustom').value; markColor(); changed(); });
  }
  function markColor() {
    var a = (S().accent || '#111111').toLowerCase();
    document.querySelectorAll('.color-chip').forEach(function (b) { b.classList.toggle('on', b.dataset.color === a); });
    $('colorCustom').value = a;
  }

  function bindSettings() {
    $('cName').addEventListener('input', function () { Children.update({ name: $('cName').value.trim() }); changed(); });
    $('cBirth').addEventListener('change', function () { Children.update({ birthday: $('cBirth').value }); changed(); renderGrid(); });
    function text(id, key) { $(id).addEventListener('input', function () { S()[key] = $(id).value; changed(); }); }
    text('sTitle', 'titleTpl');
    text('sEnd', 'endTpl');
    function check(id, key, regrid) {
      $(id).onchange = function () { S()[key] = $(id).checked; changed(); if (regrid) renderGrid(); };
    }
    check('sDrop', 'dropSurname');
    check('sShowDate', 'showDate', true);
    check('sShowAge', 'showAge', true);
    check('sCaps', 'captionsOn');
    check('sSeason', 'seasons');
    check('sBorder', 'optBorder');
    check('sSticker', 'optSticker');
    $('reshuffleBtn').onclick = function () { S().shuffleSeed = (S().shuffleSeed || 1) + 1; changed(); toast('순서를 다시 섞었어요'); };
    $('capsEditBtn').onclick = function () { $('capsText').value = Captions.list().join('\n'); openSheet('capsSheet'); };
    $('capsText').addEventListener('input', function () {
      var lines = $('capsText').value.split('\n').map(function (x) { return x.trim(); }).filter(Boolean);
      S().captions = lines.length ? lines : null;
      changed();
    });
    $('capsReset').onclick = function () { S().captions = null; $('capsText').value = Captions.DEFAULT.join('\n'); changed(); };
    $('titleFontBtn').onclick = function () {
      Fonts.openPicker('title', S().titleFont, function (k) { S().titleFont = k; renderFontBtns(); changed(); });
    };
    $('bodyFontBtn').onclick = function () {
      Fonts.openPicker('body', S().bodyFont, function (k) { S().bodyFont = k; renderFontBtns(); changed(); });
    };
    $('qualitySel').onchange = function () { S().quality = $('qualitySel').value; changed(); };
    $('transSel').onchange = function () { S().transition = $('transSel').value; changed(); };
    $('musicSel').onchange = function () { S().music = $('musicSel').value; State.save(); };
    $('musicFile').onchange = function (e) {
      var f = e.target.files[0];
      e.target.value = '';
      if (!f) return;
      Music.setFile(f).then(function () { renderMusic(); toast('음악을 넣었어요'); }).catch(function () { toast('음악 파일을 저장하지 못했어요'); });
    };
    var tryCtx = null;
    $('musicTry').onclick = async function () {
      if (tryCtx) { tryCtx.close(); tryCtx = null; $('musicTry').textContent = '들어보기'; return; }
      if (S().music === 'none') { toast('음악 없음으로 되어 있어요'); return; }
      try {
        var buf = await Music.build(10);
        if (!buf) return;
        tryCtx = new (window.AudioContext || window.webkitAudioContext)();
        var src = tryCtx.createBufferSource();
        src.buffer = buf;
        src.connect(tryCtx.destination);
        src.start();
        $('musicTry').textContent = '멈추기';
        src.onended = function () { if (tryCtx) { tryCtx.close(); tryCtx = null; } $('musicTry').textContent = '들어보기'; };
      } catch (e) { toast('이 음악은 재생할 수 없어요'); }
    };
    $('panelToggle').onclick = function () {
      var open = document.body.classList.toggle('panel-open');
      $('panelToggle').textContent = open ? '설정 ▴' : '설정 ▾';
    };
  }

  // ---------- 사진 판 ----------
  function tileLabel(p) {
    if (!p.exif) return '';
    var d = new Date(p.date), parts = [];
    if (S().showDate) parts.push((d.getMonth() + 1) + '.' + d.getDate());
    if (S().showAge) { var a = Children.ageText(p.date); if (a) parts.push(a.replace('생후 ', '')); }
    return parts.join(' · ');
  }

  function renderGrid() {
    var grid = $('grid');
    grid.innerHTML = '';
    var list = Photos.sortByDate(photos);
    var paper = $('paper');
    var empty = paper.querySelector('.empty-guide');
    if (!list.length) {
      grid.hidden = true;
      if (!empty) {
        empty = document.createElement('button');
        empty.type = 'button';
        empty.className = 'empty-guide';
        var touch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
        empty.innerHTML = '<span class="empty-icon">+</span>' +
          (touch ? '<strong>눌러서 사진 고르기</strong><span>여러 장을 한꺼번에 골라도 돼요</span>'
                 : '<strong>사진을 끌어다 놓으세요</strong><span>또는 여기를 눌러 고르기</span>') +
          '<span class="empty-sub">찍은 날짜순으로 자동 정리 · 사진은 이 기기 안에만</span>';
        empty.onclick = function () { $('photoInput').click(); };
        paper.appendChild(empty);
      }
    } else {
      grid.hidden = false;
      if (empty) empty.remove();
      var cover = Player.coverOf(C(), photos);
      list.forEach(function (p) { grid.appendChild(tile(p, cover && cover.id === p.id)); });
      var add = document.createElement('div');
      add.className = 'tile add';
      add.innerHTML = '<div class="tile-frame">+</div>';
      add.onclick = function () { $('photoInput').click(); };
      grid.appendChild(add);
    }
    var ys = list.filter(function (p) { return p.exif; }).map(function (p) { return new Date(p.date).getFullYear(); });
    $('paperYear').textContent = ys.length ? (Math.min.apply(null, ys) === Math.max.apply(null, ys) ? ys[0] : Math.min.apply(null, ys) + ' — ' + Math.max.apply(null, ys)) : '';
    $('paperTitle').textContent = '사진 ' + list.length + '장';
    updateStatus();
    scheduleCard();
  }

  function tile(p, isCover) {
    var d = document.createElement('div');
    d.className = 'tile';
    d.innerHTML = '<div class="tile-frame"><img alt=""></div><div class="tile-cap"><span class="t"></span><span class="d"></span></div>';
    d.querySelector('img').src = Photos.thumb(p);
    if (isCover) d.querySelector('.tile-frame').insertAdjacentHTML('beforeend', '<span class="cv">★ 대표</span>');
    var t = d.querySelector('.t');
    t.textContent = p.text || '글';
    if (!p.text) t.className = 't empty';
    d.querySelector('.d').textContent = tileLabel(p);
    d.onclick = function () { openPhoto(p, isCover); };
    return d;
  }

  var textTimer = null;
  function openPhoto(p, isCover) {
    $('photoView').src = Photos.thumb(p);
    $('photoText').value = p.text || '';
    $('photoText').oninput = function () {
      clearTimeout(textTimer);
      var v = $('photoText').value.trim();
      textTimer = setTimeout(function () { Photos.setText(p, v).then(function () { renderGrid(); }); }, 400);
    };
    $('coverSetBtn').textContent = isCover ? '★ 지금 대표 사진이에요' : '★ 대표 사진으로 정하기';
    $('coverSetBtn').onclick = function () {
      Children.setCover(null, p.id);
      closeSheet('photoSheet');
      renderGrid();
      toast('대표 사진으로 정했어요');
    };
    $('photoDelBtn').onclick = async function () {
      closeSheet('photoSheet');
      await Photos.remove(p.id);
      photos = photos.filter(function (x) { return x.id !== p.id; });
      if (C().coverId === p.id) Children.setCover(null, null);
      renderGrid();
    };
    openSheet('photoSheet');
  }

  async function addPhotos(files) {
    var r = await Photos.addFiles(files, OWNER, function (i, n) { toast('사진 넣는 중 ' + i + ' / ' + n, 60000); });
    photos = photos.concat(r.added);
    renderGrid();
    if (r.failed) toast(r.failed + '장은 열 수 없는 형식이에요 (HEIC는 JPG로 바꿔서 넣어 주세요)', 4000);
    else toast(r.added.length + '장을 넣었어요');
  }

  function bindPhotos() {
    $('photoInput').onchange = function (e) {
      var files = e.target.files;
      if (files && files.length) addPhotos(files).finally(function () { e.target.value = ''; });
    };
    var depth = 0;
    function hasFiles(e) { return e.dataTransfer && Array.prototype.indexOf.call(e.dataTransfer.types, 'Files') !== -1; }
    window.addEventListener('dragenter', function (e) { if (hasFiles(e)) { depth++; document.body.classList.add('dragging'); } });
    window.addEventListener('dragleave', function () { depth = Math.max(0, depth - 1); if (!depth) document.body.classList.remove('dragging'); });
    window.addEventListener('dragover', function (e) { if (hasFiles(e)) e.preventDefault(); });
    window.addEventListener('drop', function (e) {
      if (!hasFiles(e)) return;
      e.preventDefault();
      depth = 0;
      document.body.classList.remove('dragging');
      addPhotos(e.dataTransfer.files);
    });
  }

  // ---------- 상태·예상 길이 ----------
  function fmtSec(sec) {
    sec = Math.round(sec);
    var m = Math.floor(sec / 60), r = sec % 60;
    return m ? m + '분' + (r ? ' ' + r + '초' : '') : r + '초';
  }
  function updateStatus() {
    var e = Player.estimate(C(), photos, []);
    $('status').textContent = e ? '사진 ' + e.count + '장 · 약 ' + fmtSec(e.sec) + ' · 약 ' + Math.max(1, Math.round(e.mb)) + 'MB' : '사진 0장';
    $('estText').textContent = e ? '영상 약 ' + fmtSec(e.sec) + ' · 눌러서 미리보기' : '영상 첫 장 미리보기';
  }

  // ---------- 오른쪽 미리보기 카드 ----------
  function scheduleCard() {
    clearTimeout(cardTimer);
    cardTimer = setTimeout(drawCard, 400);
  }
  async function drawCard() {
    if (cardCtl) return;   // 재생 중에는 그대로
    var ctx = $('previewCanvas').getContext('2d');
    try {
      var tl = await Player.build(C(), photos, []);
      await Player.prepare(tl, 2.2);
      Player.renderAt(ctx, tl, 2.2);
    } catch (e) {}
  }
  async function toggleCard() {
    var btn = $('playBtn');
    if (cardCtl) { cardCtl.stop(); return; }
    if (!photos.length) { toast('사진을 먼저 넣어 주세요'); return; }
    btn.textContent = '…';
    var tl = await Player.build(C(), photos, []);
    await Player.prepare(tl, 0);
    var audio = null;
    try { audio = await Music.build(tl.total); } catch (e) {}
    btn.textContent = '■';
    btn.classList.add('playing');
    cardCtl = Player.play($('previewCanvas'), tl, audio, function (t, i) {
      if (i === -1) {
        cardCtl = null;
        btn.textContent = '▶';
        btn.classList.remove('playing');
        drawCard();
      }
    });
  }

  // 큰 미리보기 (폰에서도)
  async function onPreview() {
    if (!photos.length) { toast('사진을 먼저 넣어 주세요'); return; }
    openSheet('previewSheet');
    $('previewText').textContent = '준비 중…';
    try {
      var tl = await Player.build(C(), photos, []);
      await Player.prepare(tl, 0);
      var audio = null;
      try { audio = await Music.build(tl.total); } catch (e) {}
      var start = function () {
        if (bigCtl) bigCtl.stop();
        Player.prepare(tl, 0);
        bigCtl = Player.play($('bigPreview'), tl, audio, function (t) {
          $('previewFill').style.width = Math.round(t / tl.total * 100) + '%';
          $('previewText').textContent = Math.floor(t) + '초 / ' + Math.round(tl.total) + '초';
        });
      };
      $('replayBtn').onclick = start;
      if (!$('previewSheet').hidden) start();
    } catch (e) { closeSheet('previewSheet'); toast('미리보기를 준비하지 못했어요'); }
  }

  // ---------- 영상 만들기 ----------
  function fileName(ext) { return (C().name || '우리아이') + '_포토영상.' + ext; }

  async function onMake() {
    if (!photos.length) { toast('사진을 먼저 넣어 주세요'); return; }
    if (cardCtl) cardCtl.stop();
    $('resultTitle').textContent = '영상 만드는 중';
    $('workCanvas').hidden = false;
    $('resultVideo').hidden = true;
    $('working').hidden = false;
    $('done').hidden = true;
    $('barFill').style.width = '0%';
    openSheet('resultSheet');
    cancelFlag = false;
    try {
      var tl = await Player.build(C(), photos, []);
      var audio = null;
      try { audio = await Music.build(tl.total); } catch (e) { toast('음악을 불러오지 못해 음악 없이 만들어요', 3000); }
      var r = await Exporter.make($('workCanvas'), tl, audio, function (p) {
        $('barFill').style.width = Math.round(p * 100) + '%';
        $('workText').textContent = '영상 만드는 중… ' + Math.round(p * 100) + '% · 화면을 켜 두세요';
      }, function () { return cancelFlag; });
      if ($('resultSheet').hidden) return;
      r.tl = tl;
      showDone(r);
    } catch (e) {
      if (e && e.cancelled) return;
      closeSheet('resultSheet');
      toast(e && e.message ? e.message : '영상을 만들지 못했어요', 4500);
    }
  }

  function showDone(r) {
    result = r;
    if (resultUrl) URL.revokeObjectURL(resultUrl);
    resultUrl = URL.createObjectURL(r.blob);
    $('resultTitle').textContent = '영상 완성!';
    $('workCanvas').hidden = true;
    $('resultVideo').src = resultUrl;
    $('resultVideo').hidden = false;
    $('working').hidden = true;
    $('done').hidden = false;
    $('doneNote').textContent = (r.note ? r.note + ' ' : '') + '(' + (r.blob.size / 1048576).toFixed(1) + 'MB' + (r.method ? ' · ' + r.method : '') + ')' + (Exporter.isIOS ? " · 저장할 때 '동영상 저장'을 눌러 주세요" : '');
    $('shareBtn').hidden = !Exporter.canShareFile(r.blob, fileName(r.ext));
  }

  function bindResult() {
    $('saveBtn').onclick = function () {
      if (!result) return;
      Exporter.save(result.blob, fileName(result.ext)).then(function (how) { if (how === 'downloaded') toast('저장했어요'); });
    };
    $('shareBtn').onclick = function () {
      if (!result) return;
      Exporter.share(result.blob, fileName(result.ext), Children.callName() + ' 포토 영상')
        .catch(function (e) { if (!e || e.name !== 'AbortError') toast('공유하지 못했어요. 저장한 뒤 보내 주세요'); });
    };
    $('coverBtn').onclick = async function () {
      if (!result) return;
      var blob = await Exporter.cover(result.tl);
      var name = (C().name || '우리아이') + '_대표사진.jpg';
      if (Exporter.isIOS && Exporter.canShareFile(blob, name)) Exporter.share(blob, name, name).catch(function () {});
      else { Exporter.download(blob, name); toast('대표 사진을 저장했어요'); }
    };
    $('cancelBtn').onclick = function () { closeSheet('resultSheet'); toast('만들기를 멈췄어요'); };
  }

  // ---------- 백업·모두 지우기 ----------
  function bindBackup() {
    $('backupSaveBtn').onclick = async function () {
      toast('백업 파일 만드는 중…', 60000);
      try {
        var b = await Backup.make();
        await Exporter.save(b.blob, b.name);
        toast('사진 ' + b.count + '장을 백업 파일로 저장했어요', 3500);
      } catch (e) { toast('백업 파일을 만들지 못했어요'); }
    };
    $('backupFile').onchange = async function (e) {
      var f = e.target.files[0];
      e.target.value = '';
      if (!f) return;
      if (!(await ask('백업 파일을 불러올까요?\n지금 작업은 백업 파일의 내용으로 바뀌어요.', '불러오기'))) return;
      toast('불러오는 중…', 120000);
      try {
        var n = await Backup.read(f);
        toast('사진 ' + n + '장을 불러왔어요', 3000);
        setTimeout(function () { location.reload(); }, 800);
      } catch (er) { toast(er && er.message ? er.message : '불러오지 못했어요', 4000); }
    };
    $('clearBtn').onclick = async function () {
      if (!photos.length) return;
      if (!(await ask('사진 ' + photos.length + '장을 모두 지울까요?\n(이름·생일·설정은 남아요)', '모두 지우기'))) return;
      photos.forEach(function (p) { Photos.forget(p.id); });
      await Store.deleteOwner(OWNER);
      photos = [];
      Children.setCover(null, null);
      renderGrid();
      toast('모두 지웠어요');
    };
  }

  // ---------- 카톡 등 앱 안 브라우저 ----------
  function checkInApp() {
    var ua = navigator.userAgent;
    if (!/KAKAOTALK|NAVER\(inapp|Instagram|FBAN|FBAV|Line\//i.test(ua)) return;
    $('inappNotice').hidden = false;
    var ios = /iPhone|iPad|iPod/i.test(ua);
    if (/KAKAOTALK/i.test(ua)) {
      $('inappBtn').onclick = function () { location.href = 'kakaotalk://web/openExternal?url=' + encodeURIComponent(location.href); };
    } else {
      $('inappHow').textContent = ios ? "··· 버튼 → 'Safari로 열기'" : "⋮ 버튼 → '다른 브라우저로 열기'";
      $('inappBtn').hidden = true;
    }
  }

  async function init() {
    document.querySelectorAll('[data-close]').forEach(function (b) { b.addEventListener('click', function () { closeSheet(b.dataset.close); }); });
    document.querySelectorAll('.sheet').forEach(function (sh) {
      sh.addEventListener('click', function (e) { if (e.target === sh && sh.id !== 'resultSheet') closeSheet(sh.id); });
    });
    $('helpBtn').onclick = function () { openSheet('helpSheet'); };
    $('makeBtn').onclick = onMake;
    $('previewBtn').onclick = onPreview;
    $('playBtn').onclick = toggleCard;
    checkInApp();
    Store.persist();
    await State.load();
    await Fonts.init();
    photos = await Store.photosByOwner(OWNER);
    initColors();
    bindSettings();
    bindPhotos();
    bindResult();
    bindBackup();
    renderSettings();
    renderGrid();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { renderFontBtns(); scheduleCard(); });
  }

  return { init: init, toast: toast, ask: ask, openSheet: openSheet, closeSheet: closeSheet, onClose: onClose };
})();

App.init().catch(function (e) {
  console.error(e);
  alert('시작하지 못했어요. 브라우저를 최신으로 바꾸거나 다른 브라우저로 열어 주세요.');
});
