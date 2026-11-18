// music.js — 배경음악 (기본 곡 3개 또는 내가 넣은 음악 파일)
var Music = (function () {
  var SR = 44100;

  // music 폴더에 들어 있는 기본 곡
  var SONGS = {
    picnic: { name: '신나는 소풍', file: 'music/picnic.mp3' },
    giggle: { name: '깔깔 웃는 하루', file: 'music/giggle.mp3' },
    rainbow: { name: '무지개 물감', file: 'music/rainbow.mp3' }
  };
  var cache = {};

  async function songData(key) {
    if (!cache[key]) {
      var res = await fetch(SONGS[key].file);
      if (!res.ok) throw new Error('음악 파일을 불러오지 못했어요');
      cache[key] = await res.arrayBuffer();
    }
    return cache[key].slice(0); // 변환하면 원본이 비워져서 복사본을 써요
  }

  function decodeOn(ctx, buf) {
    return new Promise(function (resolve, reject) {
      var r = ctx.decodeAudioData(buf, resolve, reject);
      if (r && r.then) r.then(resolve, reject);
    });
  }

  function renderOffline(ctx) {
    return new Promise(function (resolve, reject) {
      ctx.oncomplete = function (e) { resolve(e.renderedBuffer); };
      var r = ctx.startRendering();
      if (r && r.then) r.then(resolve, reject);
    });
  }

  // 영상 길이에 맞춘 음악(AudioBuffer). 끝에서 2.5초 동안 소리가 줄어요. 음악 없음이면 null
  async function build(duration) {
    var s = State.data.settings;
    if (s.music === 'none') return null;
    var Off = window.OfflineAudioContext || window.webkitOfflineAudioContext;
    if (!Off) return null;

    var data;
    if (s.music === 'file') {
      var rec = await Store.get('music');
      if (!rec || !rec.blob) return null;
      data = await rec.blob.arrayBuffer();
    } else {
      data = await songData(SONGS[s.music] ? s.music : 'picnic');
    }

    var ctx = new Off(2, Math.ceil(duration * SR), SR);
    var audio = await decodeOn(ctx, data);
    var master = ctx.createGain();
    master.connect(ctx.destination);
    var end = Math.max(0.5, duration);
    master.gain.setValueAtTime(0, 0);
    master.gain.linearRampToValueAtTime(0.9, Math.min(0.4, end / 2));
    master.gain.setValueAtTime(0.9, Math.max(0.5, end - 2.5));
    master.gain.linearRampToValueAtTime(0, end);

    var src = ctx.createBufferSource();
    src.buffer = audio;
    src.loop = true; // 영상이 곡보다 길면 처음부터 다시
    src.connect(master);
    src.start(0);
    return renderOffline(ctx);
  }

  async function setFile(file) {
    await Store.set('music', { name: file.name, blob: file });
    State.data.settings.music = 'file';
    State.data.settings.musicName = file.name;
    State.save();
  }

  return { SONGS: SONGS, build: build, setFile: setFile };
})();
