// child.js — 우리 아이 한 명 (이름·생일·대표 사진), 이름 부르기, 생후 개월 수
// 영상 만드는 부분(player·captions)이 쓰는 이름은 선생님용과 같게 Children으로 둬요
var Children = (function () {
  function c() { return State.data.child; }
  function selected() { return c(); }

  function update(fields) { Object.assign(c(), fields); State.save(); }
  function setCover(_, photoId) { update({ coverId: photoId || null }); }

  function isHangul(s) { return /^[가-힣]+$/.test(s); }

  function callName(ch) {
    var n = (ch || c()).name || '우리 아이';
    if (State.data.settings.dropSurname && n.length === 3 && isHangul(n)) return n.slice(1);
    return n;
  }

  function hasBatchim(ch) {
    var code = ch.charCodeAt(0) - 0xAC00;
    if (code < 0 || code > 11171) return false;
    return code % 28 !== 0;
  }

  // {이름} → 다나, {이름아} → 다나야 / 하늘아, {이름이} → 다나 / 하늘이
  function fill(tpl, ch) {
    var n = callName(ch);
    var last = n.charAt(n.length - 1);
    var han = isHangul(last), b = han && hasBatchim(last);
    var a = han ? (b ? n + '아' : n + '야') : n;
    var i = b ? n + '이' : n;
    return String(tpl || '').replace(/\{이름아\}/g, a).replace(/\{이름이\}/g, i).replace(/\{이름\}/g, n);
  }

  // 찍은 날 기준 생후 개월 수 ('' = 표시 안 함)
  function ageText(ms) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(c().birthday || '');
    if (!m) return '';
    var d = new Date(ms);
    var months = (d.getFullYear() - +m[1]) * 12 + (d.getMonth() + 1 - +m[2]);
    if (d.getDate() < +m[3]) months--;
    if (months < 0) return '';
    return months === 0 ? '태어난 달' : '생후 ' + months + '개월';
  }

  return { selected: selected, update: update, setCover: setCover, callName: callName, fill: fill, ageText: ageText, markDone: function () {} };
})();
