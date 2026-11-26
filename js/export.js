// export.js — 영상 파일(MP4) 만들기, 저장, 공유, 대표 사진 저장
var Exporter = (function () {
  var FPS = 30;
  // 화질: hd = 1080×1920 (인스타 릴스 권장 크기), sd = 720×1280
  var QUALITY = {
    qhd: { w: 1440, h: 2560, bitrate: 24000000, avc: ['avc1.640033', 'avc1.4d4033', 'avc1.640032', 'avc1.4d4032', 'avc1.420033'] },
    hd: { w: 1080, h: 1920, bitrate: 12000000, avc: ['avc1.640028', 'avc1.4d4028', 'avc1.420028', 'avc1.64002a', 'avc1.4d402a', 'avc1.42002a'] },
    sd: { w: 720, h: 1280, bitrate: 5000000, avc: ['avc1.4d401f', 'avc1.42001f', 'avc1.640028', 'avc1.4d4028', 'avc1.42002a'] }
  };
  var forced = null;   // 기기가 고른 화질을 못 만들 때 한 단계 낮춘 값
  function q() { return forced || QUALITY[State.data.settings.quality] || QUALITY.qhd; }
  var W = 720, H = 1280;   // make()가 고른 화질로 바꿔요

  var isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

  var CANCEL = { cancelled: true, message: '멈췄어요' };
  function sleep(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }

  async function pickVideoCodec() {
    if (!window.VideoEncoder || !window.VideoFrame) return null;
    var list = q().avc;
    // 화질 우선 설정을 먼저 시도하고, 안 되는 기기는 기본 설정으로
    for (var pass = 0; pass < 2; pass++) {
      for (var i = 0; i < list.length; i++) {
        var cfg = { codec: list[i], width: W, height: H, bitrate: q().bitrate, framerate: FPS };
        if (pass === 0) { cfg.bitrateMode = 'variable'; cfg.latencyMode = 'quality'; }
        try {
          var r = await VideoEncoder.isConfigSupported(cfg);
          if (r && r.supported) return cfg;
        } catch (e) {}
      }
    }
    return null;
  }

  async function aacSupported() {
    if (!window.AudioEncoder || !window.AudioData) return false;
    try {
      var r = await AudioEncoder.isConfigSupported({ codec: 'mp4a.40.2', sampleRate: 44100, numberOfChannels: 2, bitrate: 128000 });
      return !!(r && r.supported);
    } catch (e) { return false; }
  }

  var isSafari = /Safari\//.test(navigator.userAgent) && !/Chrome|Chromium|CriOS|Edg|SamsungBrowser/.test(navigator.userAgent);

  // 녹화 방식은 아이폰·갤럭시·PC 모두에서 재생되는 H.264+AAC MP4일 때만 써요
  function recorderType() {
    if (!window.MediaRecorder) return null;
    var list = ['video/mp4;codecs="avc1.42E01E,mp4a.40.2"', 'video/mp4;codecs=avc1,mp4a.40.2', 'video/mp4;codecs=avc1.42E01E,mp4a.40.2'];
    if (isSafari) list.push('video/mp4');
    for (var i = 0; i < list.length; i++) {
      try { if (MediaRecorder.isTypeSupported(list[i])) return list[i]; } catch (e) {}
    }
    return null;
  }

  function webmType() {
    if (!window.MediaRecorder) return null;
    var list = ['video/webm;codecs=vp8,opus', 'video/webm'];
    for (var i = 0; i < list.length; i++) {
      try { if (MediaRecorder.isTypeSupported(list[i])) return list[i]; } catch (e) {}
    }
    return null;
  }

  // ---------- 방법 1: WebCodecs로 빠르게 MP4 만들기 ----------
  async function viaWebCodecs(canvas, tl, audio, vcfg, withAudio, onProgress, stop) {
    var ctx = canvas.getContext('2d');
    var opts = {
      target: new Mp4Muxer.ArrayBufferTarget(),
      video: { codec: 'avc', width: W, height: H },
      fastStart: 'in-memory',
      firstTimestampBehavior: 'offset'
    };
    if (withAudio) opts.audio = { codec: 'aac', numberOfChannels: 2, sampleRate: audio.sampleRate };
    var muxer = new Mp4Muxer.Muxer(opts);
    var failure = null;

    var venc = new VideoEncoder({
      output: function (chunk, meta) { muxer.addVideoChunk(chunk, meta); },
      error: function (e) { failure = e; }
    });
    venc.configure(vcfg);

    var frames = Math.ceil(tl.total * FPS);
    for (var f = 0; f < frames; f++) {
      if (failure) throw failure;
      if (stop()) throw CANCEL;
      var t = f / FPS;
      if (f % 15 === 0) await Player.prepare(tl, t);
      Player.renderAt(ctx, tl, t);
      var vf = new VideoFrame(canvas, { timestamp: Math.round(t * 1e6), duration: Math.round(1e6 / FPS) });
      venc.encode(vf, { keyFrame: f % (FPS * 2) === 0 });
      vf.close();
      while (venc.encodeQueueSize > 6) await sleep(4);
      if (f % 8 === 0) { onProgress(f / frames * (withAudio ? 0.95 : 1)); await sleep(0); }
    }
    await venc.flush();
    venc.close();

    if (withAudio) {
      var aenc = new AudioEncoder({
        output: function (chunk, meta) { muxer.addAudioChunk(chunk, meta); },
        error: function (e) { failure = e; }
      });
      aenc.configure({ codec: 'mp4a.40.2', sampleRate: audio.sampleRate, numberOfChannels: 2, bitrate: 128000 });
      var L = audio.getChannelData(0);
      var R = audio.numberOfChannels > 1 ? audio.getChannelData(1) : L;
      var CH = 4096;
      for (var i = 0; i < audio.length; i += CH) {
        if (failure) throw failure;
        var n = Math.min(CH, audio.length - i);
        var data = new Float32Array(n * 2);
        data.set(L.subarray(i, i + n), 0);
        data.set(R.subarray(i, i + n), n);
        var ad = new AudioData({ format: 'f32-planar', sampleRate: audio.sampleRate, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round(i / audio.sampleRate * 1e6), data: data });
        aenc.encode(ad);
        ad.close();
        if ((i / CH) % 50 === 0) await sleep(0);
      }
      await aenc.flush();
      aenc.close();
    }
    if (failure) throw failure;
    muxer.finalize();
    onProgress(1);
    return { blob: new Blob([muxer.target.buffer], { type: 'video/mp4' }), ext: 'mp4' };
  }

  // ---------- 방법 2: 화면을 녹화하듯 만들기 (영상 길이만큼 걸려요) ----------
  function viaRecorder(canvas, tl, audio, mime, onProgress, stop) {
    return new Promise(function (resolve, reject) {
      var ctx = canvas.getContext('2d');
      Player.renderAt(ctx, tl, 0);
      var stream = canvas.captureStream(FPS);
      var actx = null, src = null;
      if (audio) {
        actx = new (window.AudioContext || window.webkitAudioContext)();
        var dest = actx.createMediaStreamDestination();
        src = actx.createBufferSource();
        src.buffer = audio;
        src.connect(dest);
        dest.stream.getAudioTracks().forEach(function (tr) { stream.addTrack(tr); });
      }
      var rec = new MediaRecorder(stream, { mimeType: mime, videoBitsPerSecond: q().bitrate });
      var chunks = [], cancelled = false;
      rec.ondataavailable = function (e) { if (e.data && e.data.size) chunks.push(e.data); };
      rec.onerror = function (e) { reject(e.error || e); };
      rec.onstop = function () {
        try { if (actx) actx.close(); } catch (e) {}
        stream.getTracks().forEach(function (tr) { tr.stop(); });
        if (cancelled) { reject(CANCEL); return; }
        var type = mime.split(';')[0];
        resolve({ blob: new Blob(chunks, { type: type }), ext: type.indexOf('mp4') >= 0 ? 'mp4' : 'webm' });
      };
      rec.start(1000);
      if (src) src.start();
      var t0 = performance.now(), lastF = -1, lastPrep = -1;
      function loop() {
        var t = (performance.now() - t0) / 1000;
        var f = Math.floor(t * FPS);
        if (Math.floor(t * 2) !== lastPrep) { lastPrep = Math.floor(t * 2); Player.prepare(tl, t); }
        if (f !== lastF) {   // 120Hz 폰에서도 1초에 30번만 그려서 장면이 고르게 녹화돼요
          lastF = f;
          Player.renderAt(ctx, tl, Math.min(f / FPS, tl.total));
          onProgress(Math.min(1, t / tl.total));
        }
        if (stop()) { cancelled = true; rec.stop(); return; }
        if (t >= tl.total + 0.2) { rec.stop(); return; }
        requestAnimationFrame(loop);
      }
      requestAnimationFrame(loop);
    });
  }

  // 화면 꺼짐 방지
  async function keepAwake() {
    try { if (navigator.wakeLock) return await navigator.wakeLock.request('screen'); } catch (e) {}
    return null;
  }

  // 결과: {blob, ext, note}
  // 만든 영상이 이 기기에서 실제로 재생되는지 확인
  function playable(blob) {
    return new Promise(function (resolve) {
      var v = document.createElement('video');
      var url = URL.createObjectURL(blob);
      var done = false;
      function finish(ok) { if (done) return; done = true; clearTimeout(timer); v.removeAttribute('src'); v.load(); URL.revokeObjectURL(url); resolve(ok); }
      var timer = setTimeout(function () { finish(v.videoWidth > 0); }, 8000);
      v.muted = true;
      v.playsInline = true;
      v.preload = 'auto';
      v.onloadeddata = function () { finish(v.videoWidth > 0); };
      v.onerror = function () { finish(false); };
      v.src = url;
    });
  }

  async function make(canvas, tl, audio, onProgress, stop) {
    await Player.prepare(tl, 0);
    var r = await makeOnce(canvas, tl, audio, onProgress, stop, null);
    if (W > 1080 && !(await playable(r.blob))) {
      // 1440p가 이 기기에서 재생되지 않으면 1080p로 다시 만들어요
      onProgress(0);
      await Player.prepare(tl, 0);
      r = await makeOnce(canvas, tl, audio, onProgress, stop, QUALITY.hd);
      r.note = '이 기기에서 1440p 영상이 재생되지 않아 1080p로 다시 만들었어요. ' + (r.note || '');
    }
    return r;
  }

  async function makeOnce(canvas, tl, audio, onProgress, stop, force) {
    stop = stop || function () { return false; };
    forced = force || null;
    W = q().w; H = q().h;
    var lowered = '';
    var vcheck = await pickVideoCodec();
    if (!vcheck && State.data.settings.quality === 'qhd') {
      forced = QUALITY.hd; W = 1080; H = 1920;
      lowered = '이 기기는 1440p를 만들 수 없어 1080p로 만들었어요.';
    }
    canvas.width = W; canvas.height = H;
    var lock = await keepAwake();
    try {
      var vcfg = await pickVideoCodec();
      var aac = audio ? await aacSupported() : false;
      if (vcfg && (!audio || aac)) {
        try { var rw = await viaWebCodecs(canvas, tl, audio, vcfg, !!audio, onProgress, stop); rw.note = lowered; rw.method = '빠른 변환'; return rw; } catch (e) {
          if (e === CANCEL) throw e;
          console.warn(e);
        }
      }
      var mime = recorderType();
      if (mime) { var rr = await viaRecorder(canvas, tl, audio, mime, onProgress, stop); rr.note = lowered; rr.method = '녹화 방식'; return rr; }
      if (vcfg) {
        var r2 = await viaWebCodecs(canvas, tl, null, vcfg, false, onProgress, stop);
        r2.note = (lowered ? lowered + ' ' : '') + '이 브라우저는 음악을 넣은 MP4를 만들 수 없어 음악 없이 저장했어요. 음악이 필요하면 크롬·삼성 인터넷·사파리 최신 버전에서 만들어 주세요.';
        r2.method = '빠른 변환';
        return r2;
      }
      var wm = webmType();
      if (wm) {
        var r = await viaRecorder(canvas, tl, audio, wm, onProgress, stop);
        r.note = '이 브라우저는 MP4를 만들 수 없어 WebM으로 저장했어요. 아이폰에서는 재생되지 않을 수 있어요.';
        return r;
      }
      throw new Error('이 브라우저는 영상 만들기를 지원하지 않아요. 크롬, 삼성 인터넷, 사파리 최신 버전에서 열어 주세요.');
    } finally {
      try { if (lock) lock.release(); } catch (e) {}
    }
  }

  // ---------- 저장·공유 ----------
  function download(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 60000);
  }

  function canShareFile(blob, name) {
    try {
      var file = new File([blob], name, { type: blob.type });
      return !!(navigator.canShare && navigator.canShare({ files: [file] }));
    } catch (e) { return false; }
  }

  async function share(blob, name, title) {
    var file = new File([blob], name, { type: blob.type });
    await navigator.share({ files: [file], title: title });
  }

  // 아이폰은 공유 창의 '동영상 저장'으로 사진 앱에 저장돼요
  async function save(blob, name) {
    if (isIOS && canShareFile(blob, name)) {
      try { await share(blob, name, name); return 'shared'; } catch (e) { if (e && e.name === 'AbortError') return 'cancel'; }
    }
    download(blob, name);
    return 'downloaded';
  }

  // 대표 사진(제목 장면) 이미지
  function cover(tl) {
    var c = document.createElement('canvas');
    c.width = q().w; c.height = q().h;
    var first = tl.slides[0];
    Frames.render(c.getContext('2d'), first, 1, { settings: State.data.settings, theme: Frames.THEMES[State.data.settings.theme] || Frames.THEMES.cloud });
    return new Promise(function (r) { c.toBlob(r, 'image/jpeg', 0.92); });
  }

  return { make: make, download: download, canShareFile: canShareFile, share: share, save: save, cover: cover, isIOS: isIOS };
})();
