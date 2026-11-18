// fonts.js — 제목·본문 글꼴 고르기 (기본 글꼴 / 내 PC 한글 글꼴 / 글꼴 파일)
var Fonts = (function () {
  // 무료(OFL) 한글 웹글꼴 — index.html에서 Google Fonts로 불러와요
  var BUILTIN = [
    { family: 'Jua', name: '주아', weight: 400, scale: 1 },
    { family: 'Do Hyeon', name: '도현', weight: 400, scale: 1 },
    { family: 'Gaegu', name: '개구', weight: 700, scale: 1.1 },
    { family: 'Dongle', name: '동글', weight: 700, scale: 1.5 },
    { family: 'Gamja Flower', name: '감자꽃', weight: 400, scale: 1.05 },
    { family: 'Sunflower', name: '해바라기', weight: 500, scale: 1 },
    { family: 'Single Day', name: '싱글데이', weight: 400, scale: 1 },
    { family: 'Hi Melody', name: '하이멜로디', weight: 400, scale: 1.2 },
    { family: 'Nanum Pen Script', name: '나눔손글씨 펜', weight: 400, scale: 1.35 },
    { family: 'Gowun Dodum', name: '고운돋움', weight: 400, scale: 1 }
  ];

  // PC에 설치된 글꼴의 한글 이름
  var KOREAN_NAMES = {
    'Malgun Gothic': '맑은 고딕', 'Gulim': '굴림', 'GulimChe': '굴림체', 'Dotum': '돋움', 'DotumChe': '돋움체',
    'Batang': '바탕', 'BatangChe': '바탕체', 'Gungsuh': '궁서', 'GungsuhChe': '궁서체',
    'NanumGothic': '나눔고딕', 'Nanum Gothic': '나눔고딕', 'NanumMyeongjo': '나눔명조', 'Nanum Myeongjo': '나눔명조',
    'NanumBarunGothic': '나눔바른고딕', 'NanumSquare': '나눔스퀘어', 'NanumSquareRound': '나눔스퀘어라운드',
    'NanumPen': '나눔손글씨 펜', 'Nanum Pen Script': '나눔손글씨 펜', 'NanumBrush': '나눔손글씨 붓', 'Nanum Brush Script': '나눔손글씨 붓',
    'NanumGothicCoding': '나눔고딕코딩', 'NanumBarunpen': '나눔바른펜',
    'Apple SD Gothic Neo': '애플 SD 산돌고딕 Neo', 'AppleGothic': '애플고딕', 'AppleMyungjo': '애플명조',
    'Noto Sans KR': '본고딕(Noto Sans KR)', 'Noto Sans CJK KR': '본고딕', 'Noto Serif KR': '본명조(Noto Serif KR)', 'Noto Serif CJK KR': '본명조',
    'HCR Batang': '함초롬바탕', 'HCR Dotum': '함초롬돋움', 'HYGothic-Medium': '한양중고딕', 'HYHeadLine-Medium': '한양헤드라인',
    'HYGraphic-Medium': '한양그래픽', 'HYPost-Light': '한양엽서', 'HYShortSamul-Medium': '한양짧은샘물', 'HYSinMyeongJo-Medium': '한양신명조',
    'Pretendard': '프리텐다드', 'Gmarket Sans': 'G마켓 산스', 'GmarketSans': 'G마켓 산스',
    'BM JUA': '배민 주아', 'BMJUA': '배민 주아', 'BM HANNA': '배민 한나', 'BM DoHyeon': '배민 도현', 'BM YEONSUNG': '배민 연성',
    'Jalnan': '여기어때 잘난체', 'Cafe24 Ssurround': '카페24 써라운드', 'S-Core Dream': '에스코어 드림',
    'KoPubWorld Dotum': 'KoPub 돋움', 'KoPubWorld Batang': 'KoPub 바탕', 'Spoqa Han Sans Neo': '스포카 한 산스'
  };

  var localList = [];   // {family, name, weight, scale}
  var fileList = [];    // {family, name, weight, scale}

  function find(key) {
    var kind = key.slice(0, 2);
    var fam = key.slice(2);
    var src = kind === 'l:' ? localList : kind === 'f:' ? fileList : BUILTIN;
    for (var i = 0; i < src.length; i++) if (src[i].family === fam) return src[i];
    // 저장된 PC 글꼴은 목록을 다시 불러오기 전에도 이름으로 쓸 수 있어요
    if (kind === 'l:') return { family: fam, name: KOREAN_NAMES[fam] || fam, weight: 400, scale: 1 };
    return BUILTIN[0];
  }

  function css(key, px) {
    var f = find(key);
    return f.weight + ' ' + Math.round(px * f.scale) + 'px "' + f.family + '", "Jua", sans-serif';
  }

  function label(key) { return find(key).name; }

  // 캔버스에 그리기 전에 필요한 글자를 미리 불러와요
  function ensure(key, text) {
    var p = document.fonts.load(css(key, 40), text || '가나다');
    var timeout = new Promise(function (r) { setTimeout(r, 5000); });
    return Promise.race([p, timeout]).catch(function () {});
  }

  // 한글 글자가 들어 있는 글꼴인지 확인 (대체 글꼴과 폭 비교)
  var testCtx = document.createElement('canvas').getContext('2d');
  function hasHangul(family) {
    var s = '가나다라한글쌤';
    testCtx.font = '40px monospace'; var a0 = testCtx.measureText(s).width;
    testCtx.font = '40px "' + family + '", monospace'; var a1 = testCtx.measureText(s).width;
    testCtx.font = '40px serif'; var b0 = testCtx.measureText(s).width;
    testCtx.font = '40px "' + family + '", serif'; var b1 = testCtx.measureText(s).width;
    return a0 !== a1 && b0 !== b1;
  }

  function canLoadLocal() { return typeof window.queryLocalFonts === 'function'; }

  async function loadLocal() {
    var fonts = await window.queryLocalFonts();
    var seen = {};
    var out = [];
    fonts.forEach(function (f) {
      var fam = f.family;
      if (seen[fam]) return;
      seen[fam] = true;
      var korean = /[가-힣]/.test(fam) || KOREAN_NAMES[fam];
      if (korean || hasHangul(fam)) {
        out.push({ family: fam, name: KOREAN_NAMES[fam] || fam, weight: 400, scale: 1 });
      }
    });
    out.sort(function (a, b) { return a.name.localeCompare(b.name, 'ko'); });
    localList = out;
    return out;
  }

  function registerFile(rec) {
    var face = new FontFace(rec.family, rec.data);
    return face.load().then(function (loaded) {
      document.fonts.add(loaded);
      if (!fileList.some(function (x) { return x.family === rec.family; })) {
        fileList.push({ family: rec.family, name: rec.name, weight: 400, scale: 1 });
      }
    });
  }

  async function addFile(file) {
    var buf = await file.arrayBuffer();
    var base = file.name.replace(/\.(ttf|otf|woff2?|ttc)$/i, '');
    var rec = { family: 'UF_' + base.replace(/[^0-9A-Za-z가-힣]/g, '_'), name: base, data: buf };
    await registerFile(rec);
    await Store.putFont(rec);
    return 'f:' + rec.family;
  }

  async function init() {
    try {
      var list = await Store.allFonts();
      for (var i = 0; i < list.length; i++) { try { await registerFile(list[i]); } catch (e) {} }
    } catch (e) {}
  }

  // ---------- 글꼴 고르기 창 ----------
  function item(key, f, current) {
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'font-item' + (key === current ? ' on' : '');
    b.dataset.key = key;
    b.innerHTML = '<span class="font-sample"></span><span class="font-name"></span>';
    b.querySelector('.font-sample').textContent = '우리 반 1년';
    b.querySelector('.font-sample').style.font = f.weight + ' ' + Math.round(22 * f.scale) + 'px "' + f.family + '", sans-serif';
    b.querySelector('.font-name').textContent = f.name;
    return b;
  }

  function group(title, list, prefix, current) {
    var wrap = document.createElement('div');
    wrap.className = 'font-group';
    var h = document.createElement('p');
    h.className = 'font-group-title';
    h.textContent = title;
    wrap.appendChild(h);
    var grid = document.createElement('div');
    grid.className = 'font-grid';
    list.forEach(function (f) { grid.appendChild(item(prefix + f.family, f, current)); });
    wrap.appendChild(grid);
    return wrap;
  }

  function openPicker(which, current, onPick) {
    var sheet = document.getElementById('fontSheet');
    var body = document.getElementById('fontSheetBody');
    document.getElementById('fontSheetTitle').textContent = which === 'title' ? '제목 글꼴 고르기' : '본문 글꼴 고르기';

    function render() {
      body.innerHTML = '';
      body.appendChild(group('기본 글꼴 (모든 기기)', BUILTIN, 'b:', current));
      if (fileList.length) body.appendChild(group('내가 넣은 글꼴', fileList, 'f:', current));
      if (localList.length) body.appendChild(group('내 PC 한글 글꼴', localList, 'l:', current));
      var tools = document.createElement('div');
      tools.className = 'font-tools';
      if (canLoadLocal()) {
        var lb = document.createElement('button');
        lb.type = 'button';
        lb.className = 'btn';
        lb.textContent = localList.length ? '내 PC 글꼴 다시 불러오기' : '내 PC 글꼴 불러오기';
        lb.onclick = function () {
          lb.textContent = '불러오는 중…';
          loadLocal().then(render).catch(function () {
            App.toast('글꼴을 불러오지 못했어요. 권한을 허용해 주세요.');
            render();
          });
        };
        tools.appendChild(lb);
      }
      var fb = document.createElement('label');
      fb.className = 'btn';
      fb.innerHTML = '글꼴 파일 넣기 <input type="file" accept=".ttf,.otf,.woff,.woff2" hidden>';
      fb.querySelector('input').onchange = function (e) {
        var file = e.target.files[0];
        if (!file) return;
        addFile(file).then(function (key) {
          current = key;
          onPick(key);
          render();
        }).catch(function () { App.toast('이 글꼴 파일은 열 수 없어요.'); });
      };
      tools.appendChild(fb);
      var hint = document.createElement('p');
      hint.className = 'hint';
      hint.textContent = canLoadLocal()
        ? 'PC에 설치된 글꼴은 크롬·엣지에서 불러올 수 있어요.'
        : '휴대폰은 설치된 글꼴을 읽을 수 없어서, 글꼴 파일(ttf·otf)을 넣어 쓰면 돼요.';
      tools.appendChild(hint);
      body.appendChild(tools);
    }

    body.onclick = function (e) {
      var b = e.target.closest('.font-item');
      if (!b) return;
      current = b.dataset.key;
      onPick(current);
      App.closeSheet('fontSheet');
    };
    render();
    App.openSheet('fontSheet');
  }

  return { BUILTIN: BUILTIN, css: css, label: label, ensure: ensure, init: init, openPicker: openPicker };
})();
