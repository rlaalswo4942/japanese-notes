# 일본어 학습노트

기초부터 JLPT N1, 일상·비즈니스 회화까지 한 사이트에서 공부하는 학습노트. 스터디_프레임(study-site-frame) 엔진을 쓴다.
배포: https://rlaalswo4942.github.io/japanese-notes/

## 구성 (단원 태그는 배포 후 바꾸지 않음 — 필기·진도·문제 기록 키)
| 묶음 | 단원 | 원고 |
|---|---|---|
| 시작·입문 | START · U01–U02 | `content/start.md` (손으로 씀) |
| 문법 | U03–U21 (N5→N1, 경어) | `content/grammar.md` |
| 어휘 | U22–U33 급수별 8,034단어 · U34–U36 주제별 | `content/vocab.md` (생성) · `content/vocab_topics.md` |
| 한자 | U37 원리 · U38–U48 2,211자 · U49 읽기별 뜻 | `content/kanji_intro.md` · `content/kanji.md` (생성) · `content/kanji_words.md` |
| 독해 | U50–U54 단문 · U55–U58 장문 | `content/reading.md` |
| 회화 | U59–U62 일상 · U63–U69 비즈니스 | `content/talk.md` |
| 사전·복습 | 단어 사전 · 한눈에 복습 | `content/dict.md` (생성) · `content/review.md` |

## 생성 데이터 다시 만들기
`python tools/build.py` → `content/vocab.md` `kanji.md` `dict.md` `questions.json`
- 단어 목록 고정본 `tools/vocab_base.tsv` (id = 문제 id `V…`), 한국어 뜻 `tools/ko/v*.tsv`
- 한자 훈음 `tools/kanji_hun.tsv`, 한자 예시용 추가 단어 `tools/kanji_extra.tsv` + 뜻 `tools/ko/e*.tsv`
- 사전 원자료에서 잘라 둔 것 `tools/cache.json` (원자료 없이 다시 빌드 가능)
- 손으로 쓴 문제 `tools/q/*.json` 을 합쳐 넣음 (문법·독해·회화)
- 처음 만들 때만: `tools/prep_vocab.py` `tools/prep_kanji.py` (원자료 내려받기 안내는 각 파일 머리말)

## 라이선스
단어·한자 데이터는 EDRDG(JMdict·KANJIDIC2, CC BY-SA 4.0), JmdictFurigana(CC BY-SA 4.0), wordfreq(CC BY-SA 4.0), JLPT 단어 목록(Jonathan Waller, CC BY)을 가공했다 → 생성 데이터(`content/vocab.md` `kanji.md` `dict.md` `tools/cache.json`)도 CC BY-SA 4.0. 출처는 사이트의 '출처 모음'.

## 엔진
`js/app.js` `draw.js` `store.js` `search.js` `css/style.css` 는 스터디_프레임과 동일하게 유지 (AGENTS.md).
