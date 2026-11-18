// storage.js — 모든 자료는 이 기기 안(IndexedDB)에만 저장돼요. 서버로 보내지 않아요.
var Store = (function () {
  var DB_NAME = 'family-photo-video';   // 선생님용과 저장 공간을 따로 써요
  var VERSION = 1;
  var dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      var req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
        if (!db.objectStoreNames.contains('photos')) {
          var s = db.createObjectStore('photos', { keyPath: 'id' });
          s.createIndex('owner', 'owner');
        }
        if (!db.objectStoreNames.contains('fonts')) db.createObjectStore('fonts', { keyPath: 'family' });
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
    return dbPromise;
  }

  function run(storeName, mode, fn) {
    return open().then(function (db) {
      return new Promise(function (resolve, reject) {
        var t = db.transaction(storeName, mode);
        var s = t.objectStore(storeName);
        var result;
        var r = fn(s);
        if (r) r.onsuccess = function () { result = r.result; };
        t.oncomplete = function () { resolve(result); };
        t.onerror = function () { reject(t.error); };
        t.onabort = function () { reject(t.error); };
      });
    });
  }

  return {
    get: function (key) { return run('kv', 'readonly', function (s) { return s.get(key); }); },
    set: function (key, val) { return run('kv', 'readwrite', function (s) { return s.put(val, key); }); },
    del: function (key) { return run('kv', 'readwrite', function (s) { return s.delete(key); }); },

    putPhoto: function (p) { return run('photos', 'readwrite', function (s) { return s.put(p); }); },
    deletePhoto: function (id) { return run('photos', 'readwrite', function (s) { return s.delete(id); }); },
    photosByOwner: function (owner) {
      return run('photos', 'readonly', function (s) { return s.index('owner').getAll(owner); })
        .then(function (list) { return list || []; });
    },
    deleteOwner: function (owner) {
      return run('photos', 'readwrite', function (s) {
        var req = s.index('owner').openCursor(owner);
        req.onsuccess = function () {
          var c = req.result;
          if (c) { c.delete(); c.continue(); }
        };
        return null;
      });
    },

    putFont: function (f) { return run('fonts', 'readwrite', function (s) { return s.put(f); }); },
    clearPhotos: function () { return run('photos', 'readwrite', function (s) { return s.clear(); }); },
    allPhotos: function () {
      return run('photos', 'readonly', function (s) { return s.getAll(); }).then(function (l) { return l || []; });
    },
    allFonts: function () {
      return run('fonts', 'readonly', function (s) { return s.getAll(); })
        .then(function (list) { return list || []; });
    },

    // 브라우저가 저장 공간을 함부로 지우지 않도록 요청
    persist: function () {
      try { if (navigator.storage && navigator.storage.persist) navigator.storage.persist(); } catch (e) {}
    }
  };
})();

// 설정·아이 정보 상태 (자동 저장)
var State = (function () {
  var DEFAULTS = {
    titleTpl: '{이름}의 1년',
    endTpl: '{이름아}, 태어나 줘서 고마워. 사랑해!',
    dropSurname: true,
    titleFont: 'b:Do Hyeon',
    bodyFont: 'b:Gowun Dodum',
    theme: 'mono',        // mono: 흑백, cloud·star·flower: 귀여운 프레임
    accent: '#111111',    // 포인트 색 (월 글자·선)
    optBorder: false,     // 사진 흰 테두리
    optSticker: false,    // 작은 별·하트
    showDate: true,       // 사진 아래 날짜
    showAge: true,        // 사진 아래 생후 개월 수
    seasons: true,
    transition: 'fade',   // fade: 페이드, slide: 슬라이드, none: 효과 없음
    order: 'date',
    shuffleSeed: 1,
    captionsOn: true,
    captions: null,
    photoTextOn: true,
    personalOn: false,
    className: '',
    from: '',
    photoSec: 3,
    music: 'picnic',
    musicName: '',
    quality: 'qhd',       // qhd: 1440p 최고화질, hd: 1080p 고화질, sd: 720p 보통
    qualityV: 2
  };
  var CHILD = { id: 'me', name: '', birthday: '', coverId: null };
  var data = { settings: Object.assign({}, DEFAULTS), child: Object.assign({}, CHILD) };
  var timer = null;

  function load() {
    return Store.get('state').then(function (saved) {
      if (saved) {
        data.settings = Object.assign({}, DEFAULTS, saved.settings || {});
        data.child = Object.assign({}, CHILD, saved.child || {});
        if (!saved.settings || !saved.settings.qualityV) { data.settings.quality = 'qhd'; data.settings.qualityV = 2; }
      }
      return data;
    }).catch(function () { return data; });
  }

  function save() {
    clearTimeout(timer);
    timer = setTimeout(function () {
      Store.set('state', JSON.parse(JSON.stringify(data))).catch(function () {});
    }, 300);
  }

  function saveNow() {
    clearTimeout(timer);
    return Store.set('state', JSON.parse(JSON.stringify(data)));
  }

  // 백업 불러오기·모두 지우기
  function replace(st) {
    st = st || {};
    data.settings = Object.assign({}, DEFAULTS, st.settings || {});
    data.child = Object.assign({}, CHILD, st.child || {});
  }

  return { data: data, load: load, save: save, saveNow: saveNow, replace: replace, DEFAULTS: DEFAULTS };
})();
