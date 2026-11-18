// photos.js — 사진 넣기, 촬영 날짜 읽기, 날짜순 정렬, 계절 구분
var Photos = (function () {
  var MAX_SIDE = 2160;   // 저장할 때 줄이는 크기 (고화질 1080p 영상에 맞춤)
  var images = {};       // id -> ImageBitmap 또는 Image (그리기용)
  var thumbs = {};       // id -> objectURL (목록 표시용)

  function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }

  // ---------- EXIF 촬영 날짜 ----------
  function readStr(v, off, len) {
    var s = '';
    for (var i = 0; i < len && off + i < v.byteLength; i++) {
      var c = v.getUint8(off + i);
      if (!c) break;
      s += String.fromCharCode(c);
    }
    return s;
  }

  function parseExif(v, start) {
    if (v.getUint32(start) !== 0x45786966) return null; // "Exif"
    var tiff = start + 6;
    var le = v.getUint16(tiff) === 0x4949;
    function u16(o) { return v.getUint16(o, le); }
    function u32(o) { return v.getUint32(o, le); }
    var ifd0 = tiff + u32(tiff + 4);
    var n = u16(ifd0);
    var exifPtr = 0, dt = null, dto = null, i, e;
    for (i = 0; i < n; i++) {
      e = ifd0 + 2 + i * 12;
      var tag = u16(e);
      if (tag === 0x8769) exifPtr = tiff + u32(e + 8);
      if (tag === 0x0132) dt = readStr(v, tiff + u32(e + 8), 19);
    }
    if (exifPtr) {
      var m = u16(exifPtr);
      for (i = 0; i < m; i++) {
        e = exifPtr + 2 + i * 12;
        if (u16(e) === 0x9003) dto = readStr(v, tiff + u32(e + 8), 19);
      }
    }
    var s = dto || dt;
    var mt = s && s.match(/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})/);
    if (!mt) return null;
    var d = new Date(+mt[1], +mt[2] - 1, +mt[3], +mt[4], +mt[5], +mt[6]).getTime();
    return isNaN(d) || +mt[1] < 1990 ? null : d;
  }

  // 파일 이름 속 날짜 (예: 20261003_142211.jpg, KakaoTalk_20261003_...)
  function nameDate(name) {
    var m = /(20\d{2})[-_.]?(0[1-9]|1[0-2])[-_.]?(0[1-9]|[12]\d|3[01])(?:[-_ ]?(\d{2})(\d{2})(\d{2}))?/.exec(name || '');
    if (!m) return null;
    var d = new Date(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0), +(m[6] || 0)).getTime();
    return isNaN(d) ? null : d;
  }

  async function exifDate(file) {
    try {
      var buf = await file.slice(0, 256 * 1024).arrayBuffer();
      var v = new DataView(buf);
      if (v.getUint16(0) !== 0xFFD8) return null;
      var off = 2;
      while (off < v.byteLength - 4) {
        var marker = v.getUint16(off);
        if ((marker & 0xFF00) !== 0xFF00) break;
        var size = v.getUint16(off + 2);
        if (marker === 0xFFE1) {
          var d = parseExif(v, off + 4);
          if (d) return d;
        }
        if (marker === 0xFFDA) break;
        off += 2 + size;
      }
    } catch (e) {}
    return null;
  }

  // ---------- 그림 열기 ----------
  function decode(blob) {
    if (window.createImageBitmap) {
      return createImageBitmap(blob).catch(function () { return decodeImg(blob); });
    }
    return decodeImg(blob);
  }
  function decodeImg(blob) {
    return new Promise(function (resolve, reject) {
      var url = URL.createObjectURL(blob);
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = function () { URL.revokeObjectURL(url); reject(new Error('decode')); };
      img.src = url;
    });
  }
  function sizeOf(img) { return { w: img.width || img.naturalWidth, h: img.height || img.naturalHeight }; }

  async function shrink(file) {
    var img = await decode(file);
    var s = sizeOf(img);
    var r = Math.min(1, MAX_SIDE / Math.max(s.w, s.h));
    var w = Math.round(s.w * r), h = Math.round(s.h * r);
    var c = document.createElement('canvas');
    c.width = w; c.height = h;
    var cx = c.getContext('2d');
    cx.imageSmoothingQuality = 'high';
    cx.drawImage(img, 0, 0, w, h);
    if (img.close) img.close();
    var blob = await new Promise(function (res) { c.toBlob(res, 'image/jpeg', 0.92); });
    return { blob: blob, w: w, h: h };
  }

  // files: FileList, owner: 아이 id 또는 'common'
  async function addFiles(files, owner, onStep) {
    var added = [], failed = 0;
    var list = Array.prototype.slice.call(files).filter(function (f) {
      return /^image\//.test(f.type) || /\.(jpe?g|png|webp|heic|heif|gif)$/i.test(f.name);
    });
    for (var i = 0; i < list.length; i++) {
      var f = list[i];
      try {
        var date = await exifDate(f) || nameDate(f.name);
        var s = await shrink(f);
        var p = { id: uid(), owner: owner, blob: s.blob, w: s.w, h: s.h, date: date || f.lastModified || Date.now(), exif: !!date };
        await Store.putPhoto(p);
        added.push(p);
      } catch (e) {
        failed++;
      }
      if (onStep) onStep(i + 1, list.length);
    }
    return { added: added, failed: failed };
  }

  function sortByDate(list) {
    return list.slice().sort(function (a, b) { return a.date - b.date; });
  }

  function seasonOf(ms) {
    var m = new Date(ms).getMonth() + 1;
    if (m >= 3 && m <= 5) return '봄';
    if (m >= 6 && m <= 8) return '여름';
    if (m >= 9 && m <= 11) return '가을';
    return '겨울';
  }

  function dateLabel(ms) {
    var d = new Date(ms);
    return (d.getMonth() + 1) + '월 ' + d.getDate() + '일';
  }

  function thumb(p) {
    if (!thumbs[p.id]) thumbs[p.id] = URL.createObjectURL(p.blob);
    return thumbs[p.id];
  }

  async function image(p) {
    if (!images[p.id]) images[p.id] = await decode(p.blob);
    return images[p.id];
  }

  // 지금 쓰는 사진만 남기고 메모리 정리
  function keepOnly(ids) {
    var keep = {};
    ids.forEach(function (id) { keep[id] = true; });
    Object.keys(images).forEach(function (id) {
      if (!keep[id]) {
        if (images[id].close) images[id].close();
        delete images[id];
      }
    });
  }

  function forget(id) {
    if (thumbs[id]) { URL.revokeObjectURL(thumbs[id]); delete thumbs[id]; }
    if (images[id]) { if (images[id].close) images[id].close(); delete images[id]; }
  }

  // 다른 아이에게도 넣기 (같은 사진을 복사)
  async function copyTo(p, owner) {
    var c = { id: uid(), owner: owner, blob: p.blob, w: p.w, h: p.h, date: p.date, exif: p.exif, text: p.text || '' };
    await Store.putPhoto(c);
    return c;
  }

  // 다른 아이로 옮기기
  async function moveTo(p, owner) {
    p.owner = owner;
    await Store.putPhoto(p);
    return p;
  }

  // 사진별 글 저장
  function setText(p, text) {
    p.text = text;
    return Store.putPhoto(p);
  }

  async function remove(id) {
    forget(id);
    await Store.deletePhoto(id);
  }

  return {
    addFiles: addFiles, sortByDate: sortByDate, seasonOf: seasonOf, dateLabel: dateLabel,
    thumb: thumb, image: image, keepOnly: keepOnly, remove: remove, forget: forget, sizeOf: sizeOf,
    copyTo: copyTo, moveTo: moveTo, setText: setText
  };
})();
