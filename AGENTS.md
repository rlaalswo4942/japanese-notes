# 학습사이트 프레임 — 에이전트 안내

공부용 웹페이지 틀(내용 없음). 사용법·새 사이트 만드는 순서는 README.md.

## 규칙
- 새 과목 사이트는 이 폴더를 **복사해서** 만들고, 바꾸는 곳은 `js/content.js` 와 `content/` 뿐. 엔진(`js/app.js` `draw.js` `store.js` `search.js` `css/style.css`)은 손대지 않는다
- 엔진을 고쳤다면 이 프레임과 실사용 사이트(README '이 엔진을 쓰는 사이트')에 **같이** 반영 — 엔진 파일은 동일해야 함. 패치 때 `SITE.key`·`resetEpoch`는 건드리지 않음(기록 보존)
- `SITE.key` 는 사이트마다 고유하게. 단원 id(u00…)·섹션 id(s01…)는 필기·체크 저장 키라 원고 구조를 바꾸면 기존 필기가 어긋남
- 디자인은 무채색(배경 #f5f5f7, 흰 타일, 글자 #1d1d1f). 색은 정답/오답과 필기 잉크에만. 장식 이모지 쓰지 않음
- 원고 md는 그대로 두고 앱이 파싱·렌더(marked + DOMPurify). 요약·재작성해서 넣지 않는다
- 확인: `학습노트_열기.bat`(포트 8780) — file:// 로는 동작 안 함

## 입력 동작
- 펜 전용: 손가락 드래그 = 스크롤, 손가락 탭 = 아래 요소 클릭 전달(읽음·링크·가림 토글), 펜 = 필기
- 포스트잇 위 막대 스위치(T/✎): 타이핑용 ↔ 필기용. 필기는 툴바 펜 색·굵기, 지우개 도구로 메모지 안 획 삭제
- 포스트잇 – 버튼: 46px 아이콘으로 접기, 아이콘 탭 = 펼치기 · 끌기 = 이동. 불투명도는 종이·글자·필기에 함께
- 손가락 제스처(클립 스튜디오 방식): 필기 도구 사용 중·필기용 포스트잇 위에서 두 손가락 탭 = 실행취소, 세 손가락 탭 = 다시실행(메모지 필기 포함). 300ms 안에 함께 닿고 움직이지 않아야 탭
- 형광펜은 별도 svg 층(`.ink-hl`, `mix-blend-mode: multiply`)에 그려 글자가 형광 위로 진하게 보임. 펜·가림펜은 위 층(`.ink`)
- 검색(js/search.js): 상단 '검색' → 오른쪽 사이드바, 입력하면 구글 탭(`study-google` 재사용). 경계를 끌어 너비 조절

## 저장 형식
- localStorage `<key>:<이름>` = `{t, v}` (최신값 우선), 동기화 서버도 같은 형식
- `ink:<단원id>` 필기 `{k, c, w, a: 기준 요소 id, pts|rects: 기준 상자 0~1 비율}`
- `notes:<단원id>` 포스트잇 `{id, a, x, y(비율), w, h(1000px 페이지 기준), text, op, c, z, mode("text"|"ink"), ink:[{c, w, pts(메모지 기준 px)}], min(접힘)}`
- `exam` 모의고사 `{<세트id>: {ans: {번호: 답}, ok: {번호: true|false|null}(채점 후), at}}`
- `features.login`: localStorage `<key>-user` = `{id, name}`, 동기화 공간 = sha256(`<key>:user:<아이디>`) (Store.syncConnect("user:"+아이디))
- `exam.json`: `{notice, sets: [{id, name, items: [{t: blank|ox|short|code, topic, q(blank은 "( )" 자리에 입력칸), a(O/X 문자 · 정답 배열 · code는 모범 답안), pts(code 채점 기준), ex}]}]}` — 세트 id·문항 순서는 기록 키라 배포 후 바꾸지 않음
- `checks` `goals` `quiz` `last` 진도·문제 기록 (연습문제 '공부한 범위' 모드 = `checks[단원id]`에 true가 하나라도 있는 단원의 `topic` 문제), `inkopts` `sideOpen` `searchOpen` `searchW` `searchHist` 는 기기별(동기화 안 함)

## 일본어 학습노트 전용
- 단원 태그 U01–U69·START·REVIEW 와 각 단원의 섹션 순서는 기록 키 → 배포 후 섹션을 지우거나 끼워 넣지 말고 끝에 추가
- `content/vocab.md` `kanji.md` `dict.md` `questions.json` 은 `python tools/build.py` 생성물 — 직접 고치지 말고 tools/ 원본(뜻 ko/*.tsv, 훈음 kanji_hun.tsv, 문제 q/*.json)을 고친 뒤 다시 빌드
- 문제 id: V+단어id(어휘), K+한자코드포인트-n(한자) = 자동 생성 / G(문법)·W(주제 어휘)·J(한자 원리)·R(독해)·T(회화) = 손으로 쓴 문제(tools/q) — 한번 배포한 id 는 바꾸지 않음
- 한국어 뜻·해석은 자연스러운 한국어로, 일본어 예문은 문법·표기 정확성 우선(띄어쓰기 없는 표준 표기, 초급 예문만 띄어쓰기 허용)
