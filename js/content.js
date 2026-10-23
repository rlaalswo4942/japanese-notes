/* 일본어 학습노트 - 사이트 설정
 * 원고는 content/ 의 md 여러 개(SITE.book.files 순서대로 이어 붙여 한 교재로 해석)
 *   손으로 쓰는 원고: start · grammar_n5~n1 · keigo · vocab_topics · kanji_intro · kanji_words · reading_short/long · talk_daily/business · review
 *   생성 원고(python tools/build.py — 손으로 고치지 말 것): vocab · kanji · dict · questions.json
 */
window.SITE = {
  title: "일본어 학습노트",
  icon: "日",
  eyebrow: "기초부터 JLPT N1 · 일상 회화 · 비즈니스 회화",
  sub: "문자·문법·어휘 8,034개·한자 2,211자·단문/장문 독해·회화를 한곳에서. 읽음 체크·필기·연습문제로 꾸준히.",
  notice: "",
  key: "japanese-n1",                     // ★ 저장 키 — 바꾸지 말 것 (필기·진도 기록)
  syncApi: "https://ai-hackathon-sync.vercel.app/api/state",
  unit: "", unitPrefix: "", unitEn: "UNIT",
  book: {
    files: ["content/start.md", "content/grammar_n5.md", "content/grammar_n4.md", "content/grammar_n3.md", "content/grammar_n2.md", "content/grammar_n1.md", "content/keigo.md",
      "content/vocab.md", "content/vocab_topics.md", "content/kanji_intro.md", "content/kanji.md", "content/kanji_words.md",
      "content/reading_short.md", "content/reading_short2.md", "content/reading_long.md", "content/talk_daily.md", "content/talk_business.md", "content/dict.md", "content/review.md"],
    groups: [
      { h: "입문", from: "U01", to: "U02", desc: "문자·발음·문장의 뼈대" },
      { h: "문법", from: "U03", to: "U21", desc: "N5 → N1 · 경어" },
      { h: "어휘", from: "U22", to: "U36", desc: "JLPT 8,034단어 빈도순 · 주제별 표현" },
      { h: "한자", from: "U37", to: "U49", desc: "2,211자 · 모든 음독·훈독과 예시" },
      { h: "독해 · 단문", from: "U50", to: "U54", desc: "N5 → N1 짧은 글" },
      { h: "독해 · 장문", from: "U55", to: "U58", desc: "중문 · 장문 · 통합이해 · 정보검색" },
      { h: "회화 · 일상", from: "U59", to: "U62", desc: "생활 · 친구 · 의견" },
      { h: "회화 · 비즈니스", from: "U63", to: "U69", desc: "매너 · 전화 · 회의 · 메일 · 면접" }
    ],
    start: "^시작하기",
    startDesc: "사이트 사용법 · 학습 로드맵 · 전체 지도",
    map: "## 전체 지도",
    mapDesc: "첫 목표", mapLevel: "난이도",
    dict: "^용어 사전",
    goals: "오늘의 목표",
    reviewTitle: "한눈에 복습", reviewEn: "총정리 표", reviewDesc: "활용표 · 헷갈리는 문법 비교 · 조사 · 경어 · 숫자 읽기"
  },
  labels: {
    book: "",
    extraGroup: "보강 자료", extra: "",
    dictTitle: "단어 사전",
    sources: "자료의 출처와 라이선스입니다. 단어·한자 데이터는 공개 사전 데이터를 가공했습니다.",
    quizNote: "자체 제작 연습문제", scoreNote: "JLPT 실제 점수와 무관합니다."
  },
  features: { calc: false, exam: false, login: true },
  resetEpoch: "",
  resetKeys: ""
};

(function () {
  window.RESEARCH_SOURCES = {};
  window.EXTRA = [];
})();
