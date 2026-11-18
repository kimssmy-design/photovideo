// captions.js — 사진마다 바뀌는 응원 문구 (선생님·부모 누가 보내도 어울리게)
// {이름} → 서아 / 하늘, {이름이} → 서아 / 하늘이, {이름아} → 서아야 / 하늘아
var Captions = (function () {
  var DEFAULT = [
    '넌 언제나 사랑스러워',
    '{이름이}는 우리의 귀염둥이',
    '오늘도 반짝반짝 빛났어',
    '웃는 얼굴이 참 예뻐',
    '하루하루 쑥쑥 자라는 중',
    '언제나 너를 응원해',
    '이렇게 멋지게 해냈구나!',
    '너와 함께라서 행복해',
    '{이름이}의 웃음은 최고의 선물',
    '우리 {이름이} 최고!',
    '작은 손으로 큰 세상을 만나는 중',
    '오늘도 신나게 놀았지?',
    '친구들과 함께라서 더 즐거워',
    '세상에 하나뿐인 소중한 {이름이}',
    '씩씩하게 한 걸음씩',
    '너의 모든 순간이 소중해',
    '호기심 가득 탐험대장',
    '사랑 듬뿍 받고 자라렴',
    '반짝이는 눈빛, 반짝이는 마음',
    '오늘의 {이름이}도 참 예뻐',
    '무럭무럭 자라라, 사랑해',
    '함께한 하루하루가 선물이었어',
    '너는 우리의 햇살이야',
    '{이름아}, 꿈을 마음껏 펼쳐 봐'
  ];

  function list() {
    var c = State.data.settings.captions;
    return c && c.length ? c : DEFAULT;
  }

  function hash(str) {
    var h = 2166136261;
    for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  // 아이마다 순서를 다르게 섞고, 다 쓰기 전에는 같은 문구가 반복되지 않아요
  function forChild(child, n) {
    var src = list();
    var seed = hash(child.id || child.name);
    var out = [];
    var order = [];
    for (var i = 0; i < n; i++) {
      if (!order.length) {
        order = src.map(function (_, k) { return k; });
        for (var j = order.length - 1; j > 0; j--) {
          seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
          var r = seed % (j + 1);
          var tmp = order[j]; order[j] = order[r]; order[r] = tmp;
        }
      }
      out.push(Children.fill(src[order.shift()], child));
    }
    return out;
  }

  return { DEFAULT: DEFAULT, list: list, forChild: forChild };
})();
