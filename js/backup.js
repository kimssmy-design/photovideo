// backup.js — 작업 저장하기 / 불러오기 (사진·설정·글꼴·음악을 파일 하나로)
// 파일 구조: "PVBK1" + 머리말 길이(10자리) + 머리말(JSON) + 사진·글꼴·음악 데이터를 차례로 이어 붙임
var Backup = (function () {
  var MAGIC = 'PVBK1';

  function pad10(n) { var s = String(n); while (s.length < 10) s = '0' + s; return s; }

  function today() {
    var d = new Date();
    return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0');
  }

  async function make() {
    var photos = await Store.allPhotos();
    var fonts = await Store.allFonts();
    var music = await Store.get('music');
    var parts = [];
    var head = { version: 1, state: State.data, photos: [], fonts: [], music: null };

    photos.forEach(function (p) {
      head.photos.push({ id: p.id, owner: p.owner, w: p.w, h: p.h, date: p.date, exif: !!p.exif, text: p.text || '', size: p.blob.size });
      parts.push(p.blob);
    });
    fonts.forEach(function (f) {
      head.fonts.push({ family: f.family, name: f.name, size: f.data.byteLength });
      parts.push(f.data);
    });
    if (music && music.blob) {
      head.music = { name: music.name, type: music.blob.type || 'audio/mpeg', size: music.blob.size };
      parts.push(music.blob);
    }
    var json = new TextEncoder().encode(JSON.stringify(head));
    var blob = new Blob([MAGIC, pad10(json.length), json].concat(parts), { type: 'application/octet-stream' });
    return { blob: blob, name: '포영포영_백업_' + today() + '.pvbak', count: photos.length };
  }

  async function read(file) {
    var top = await file.slice(0, 15).text();
    if (top.slice(0, 5) !== MAGIC) throw new Error('이 앱의 백업 파일이 아니에요');
    var len = parseInt(top.slice(5, 15), 10);
    var head = JSON.parse(await file.slice(15, 15 + len).text());
    var off = 15 + len;
    function next(size, type) { var b = file.slice(off, off + size, type); off += size; return b; }

    await Store.clearPhotos();
    for (var i = 0; i < head.photos.length; i++) {
      var p = head.photos[i];
      var blob = next(p.size, 'image/jpeg');
      // 파일 조각이 아니라 실제 데이터로 저장 (원본 파일이 없어져도 괜찮게)
      var data = new Blob([await blob.arrayBuffer()], { type: 'image/jpeg' });
      await Store.putPhoto({ id: p.id, owner: p.owner, blob: data, w: p.w, h: p.h, date: p.date, exif: p.exif, text: p.text });
    }
    for (var k = 0; k < head.fonts.length; k++) {
      var f = head.fonts[k];
      var buf = await next(f.size).arrayBuffer();
      await Store.putFont({ family: f.family, name: f.name, data: buf });
    }
    if (head.music) {
      var mb = new Blob([await next(head.music.size).arrayBuffer()], { type: head.music.type });
      await Store.set('music', { name: head.music.name, blob: mb });
    }
    State.replace(head.state);
    await State.saveNow();
    return head.photos.length;
  }

  return { make: make, read: read };
})();
