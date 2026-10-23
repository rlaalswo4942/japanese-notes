/* 학습노트 엔진 - 앱 본체 (학습사이트_프레임과 공용. 과목별 내용·문구는 js/content.js 와 content/ 에서만 바꿈)
 * content/ 의 원본(교재 md·문제 json·출처 json)을 읽어 그대로 표시 + 보강 단원(js/content.js EXTRA)
 * 라우트: #home #guide #start #u00~#u12 #review #quiz(.U04) #calc #dict #sources #info #u13 #u14 #extra-review  (섹션: #u04.s03)
 */
(function () {
  const SITE = window.SITE;
  const main = document.getElementById("main");
  const crumb = document.getElementById("crumb");
  let scale = 1, page = null, scaler = null, ro = null;
  let UNITS = [], BOOK = [], QUESTIONS = [], QNOTICE = "", SRC = {}, DICT = [], PREFACE = "", MAP = {}, EXAM = null;

  document.title = SITE.title;
  document.head.insertAdjacentHTML("beforeend", `<link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>${SITE.icon}</text></svg>">`);
  /* 교재 원고(md) 해석 규칙 · 화면 문구 — 과목마다 content.js 의 SITE.book / SITE.labels 로 바꿈 */
  const BKraw = Object.assign({
    start: "^시작하기", startDesc: "읽는 법 · 전체 지도", // '# 시작하기…' 블록 = START 단원 (섹션은 ##)
    map: "## 전체 지도", mapDesc: "첫 목표", mapLevel: "난이도", // START 안의 단원 지도 표 → 홈 카드 설명·난이도
    dict: "^용어 사전", goals: "오늘의 목표",                    // '# 용어 사전' 표 → 사전 페이지, '### 오늘의 목표' 목록 → 자가점검
    reviewTitle: "한눈에 복습", reviewEn: "교재 끝부분", reviewDesc: "교재 끝의 정리·비교·확인 질문"
  }, SITE.book || {});
  const BK = Object.assign({}, BKraw, { start: new RegExp(BKraw.start), dict: new RegExp(BKraw.dict), goals: new RegExp(BKraw.goals), map: new RegExp(BKraw.map) });
  const LB = Object.assign({ book: "", extra: "", extraGroup: "보강 자료", sources: "출처가 있다는 것은 개념의 근거라는 뜻입니다.", dictTitle: "용어 사전", calcTitle: "혼동행렬 계산기", quizNote: "자체 제작 연습문제", scoreNote: "실제 시험 점수와 무관합니다." }, SITE.labels || {});
  const FEAT = Object.assign({ calc: false, exam: false, login: false }, SITE.features || {});
  const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const tagOf = L => L.tag;

  /* ───────── 원본 불러오기 · 파싱 ───────── */


  const LABELS = { "공식공지": "off", "기술근거": "tech", "가상자료": "case", "가상사례": "case", "모든 상황은 가상": "case", "교육용 설명": "plan", "교육용 설계": "plan", "교육용 프레임": "plan", "교육용 템플릿": "plan", "근거 및 성격": "tech" };
  const KIND = { official_event: "행사 공식 사이트", secondary_event_reporting: "언론 보도", primary_technical: "AI 기술 자료", open_standard: "AI 기술 자료", standards_risk: "AI 기술 자료", security_owasp: "AI 기술 자료" };

  // 교재의 \[ ... \] 수식 → 읽을 수 있는 텍스트 (원본 수식은 title에 보존)
  function plainMath(tex) {
    let s = tex.trim();
    for (let i = 0; i < 5; i++) s = s.replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, "($1) / ($2)").replace(/\\text\{([^{}]*)\}/g, "$1");
    return s.replace(/\\times/g, "×").replace(/\\cdot/g, "·").replace(/[{}]/g, "").replace(/\s+/g, " ");
  }
  // CommonMark는 '**…)**은'처럼 닫는 ** 앞이 문장부호이고 뒤가 한글이면 굵게로 인식하지 않음 → 코드 밖의 **…**를 직접 <strong>으로
  function boldFix(src) {
    return src.split(/(```[\s\S]*?```)/g).map((part, i) => i % 2 ? part
      : part.split(/(`[^`\n]*`)/g).map((p, j) => j % 2 ? p : p.replace(/\*\*([^*\n]+?)\*\*/g, "<strong>$1</strong>")).join("")).join("");
  }
  function md(src) {
    src = boldFix(src);
    const maths = [];
    src = src.replace(/\\\[([\s\S]*?)\\\]/g, (_, t) => { maths.push(t); return `\n\nMATHBLOCK${maths.length - 1}\n\n`; });
    let html = DOMPurify.sanitize(marked.parse(src, { gfm: true, breaks: false }));
    html = html.replace(/<p>MATHBLOCK(\d+)<\/p>/g, (_, i) => `<div class="formula" title="${esc(maths[i].trim())}">${esc(plainMath(maths[i]))}</div>`);
    html = html.replace(/<table>/g, '<div class="tbl"><table>').replace(/<\/table>/g, "</table></div>");
    html = html.replace(/\[(공식공지|기술근거|가상자료|가상사례|모든 상황은 가상|교육용 설명|교육용 설계|교육용 프레임|교육용 템플릿|근거 및 성격)\]/g, (_, l) => `<span class="lb ${LABELS[l]}">${l}</span>`);
    html = html.replace(/\[(S\d\d)\]/g, (m, id) => SRC[id] ? `<a class="sref" href="${esc(SRC[id].u)}" target="_blank" rel="noopener" title="${esc(SRC[id].t)}">${id}</a>` : m);
    return html;
  }
  const citedIn = text => [...new Set((text.match(/\[(S\d\d)\]/g) || []).map(s => s.slice(1, -1)))];
  const stripMd = s => s.replace(/\*\*|`|\*/g, "").replace(/^\s*(?:[-*]|\d+\.)\s+/, "").trim();

  function splitSections(body) {
    const lines = body.split(/\r?\n/);
    const lvl = lines.some(l => /^### /.test(l)) ? "### " : "## ";
    const secs = []; let cur = { t: "", lines: [] };
    lines.forEach(l => {
      if (l.startsWith(lvl)) { secs.push(cur); cur = { t: l.slice(lvl.length).trim(), lines: [] }; }
      else cur.lines.push(l);
    });
    secs.push(cur);
    return secs.map(s => ({ t: s.t, raw: s.lines.join("\n").replace(/\n-{3,}\s*$/g, "").replace(/^\s*-{3,}\s*$/gm, "").trim() }))
      .filter(s => s.raw || s.t);
  }
  function parseBook(text) {
    const lines = text.split(/\r?\n/);
    const blocks = []; let cur = null; const pre = [];
    lines.forEach(l => {
      if (/^# /.test(l)) { cur = { title: l.slice(2).trim(), lines: [] }; blocks.push(cur); }
      else if (cur) cur.lines.push(l); else pre.push(l);
    });
    PREFACE = pre.join("\n");
    const units = [], review = [];
    blocks.forEach((b, bi) => {
      const body = b.lines.join("\n");
      const m = b.title.match(/^(U\d\d)\.\s*(.*)$/);
      if (bi === 0 && !m) return; // 맨 처음 '# 제목'은 문서 제목 → 표시 안 함
      if (BK.dict.test(b.title)) { DICT = parseTable(body); return; }
      if (BK.start.test(b.title)) {
        units.push(mkUnit("start", "START", b.title, BK.startDesc, "", "", body));
        const mapRows = parseTable(body.split(BK.map)[1] || "");
        mapRows.forEach(r => { const id = Object.values(r).join(" ").match(/U\d\d/); if (id) MAP[id[0]] = r; });
        return;
      }
      if (m) {
        const r = MAP[m[1]] || {};
        units.push(mkUnit(m[1].toLowerCase(), m[1], m[2], r[BK.mapDesc] || "", "", "", body, r[BK.mapLevel]));
        return;
      }
      review.push({ t: b.title, raw: body.replace(/^\s*-{3,}\s*$/gm, "").trim() });
    });
    if (!review.length) return { units, review: null };
    const rv = { id: "review", tag: "REVIEW", title: BK.reviewTitle, en: BK.reviewEn, color: "", icon: "", desc: BK.reviewDesc, book: true, goals: [] };
    rv.sections = review.map((s, i) => sec(i, s.t, s.raw));
    return { units, review: rv };
  }
  // 섹션 HTML은 처음 열 때 변환 (원고가 커도 첫 화면이 바로 뜨게)
  const sec = (i, t, raw) => ({ id: "s" + String(i + 1).padStart(2, "0"), t, src: citedIn(raw), get html() { return this._h != null ? this._h : (this._h = md(raw)); } });
  function mkUnit(id, tag, title, desc, color, icon, body, level) {
    const secs = splitSections(body);
    let goals = [];
    const g = secs.find(s => BK.goals.test(s.t));
    if (g) goals = g.raw.split(/\r?\n/).filter(l => /^\s*(?:[-*]|\d+\.)\s+/.test(l)).map(stripMd);
    return {
      id, tag, title, en: level ? "난이도 · " + level : "", desc, color, icon, book: true, goals,
      sections: secs.map((s, i) => sec(i, s.t || "들어가며", s.raw))
    };
  }
  function parseTable(text) {
    const rows = text.split(/\r?\n/).filter(l => /^\s*\|/.test(l));
    if (rows.length < 3) return [];
    const cells = l => l.trim().replace(/^\||\|$/g, "").split("|").map(c => c.trim());
    const head = cells(rows[0]);
    return rows.slice(2).map(r => { const c = cells(r), o = {}; head.forEach((h, i) => (o[h] = c[i] || "")); return o; });
  }

  async function boot() {
    main.innerHTML = `<div class="home"><p class="sub">교재를 불러오는 중…</p></div>`;
    try {
      const get = u => fetch(u, { cache: "no-cache" }).then(r => { if (!r.ok) throw new Error(u + " " + r.status); return u.endsWith(".md") ? r.text() : r.json(); });
      // 원고가 길면 SITE.book.files 로 여러 md 파일에 나눠 쓸 수 있음 (순서대로 이어 붙여 한 교재로 해석)
      const [mds, q, s] = await Promise.all([Promise.all((BKraw.files || ["content/textbook.md"]).map(get)), get("content/questions.json"), get("content/sources.json")]);
      const t = mds.join("\n\n");
      s.sources.forEach(x => (SRC[x.id] = { t: `${x.organization} — ${x.title}`, u: x.url, kind: KIND[x.kind] || x.kind || "참고 자료", scope: x.scope }));
      Object.entries(window.RESEARCH_SOURCES || {}).forEach(([id, x]) => (SRC[id] = x));
      QUESTIONS = q.questions; QNOTICE = q.notice;
      if (FEAT.exam) EXAM = await fetch("content/exam.json", { cache: "no-cache" }).then(r => r.ok ? r.json() : null).catch(() => null);
      const b = parseBook(t);
      BOOK = b.units.filter(u => u.id !== "start");
      UNITS = [...b.units, b.review, ...(window.EXTRA || [])].filter(Boolean);
    } catch (e) {
      main.innerHTML = `<div class="home"><h1>교재를 불러오지 못했어요</h1><p class="sub">${esc(e.message)} — 인터넷 연결을 확인하고 새로고침하세요. (파일을 직접 더블클릭해 열면 동작하지 않습니다)</p></div>`;
      return;
    }
    route();
  }

  /* ───────── 진행도 ───────── */
  const checks = () => Store.get("checks", {});
  const goalsSt = () => Store.get("goals", {});
  const quizSt = () => Store.get("quiz", {});
  function isDone(lid, sid) { const c = checks(); return !!(c[lid] && c[lid][sid]); }
  function setDone(lid, sid, v) { const c = checks(); (c[lid] = c[lid] || {})[sid] = v; if (!v) delete c[lid][sid]; Store.set("checks", c); }
  function progress(L) { const c = checks()[L.id] || {}; const n = L.sections.filter(s => c[s.id]).length, total = L.sections.length; return { n, total, pct: total ? Math.round(n / total * 100) : 0 }; }
  function overall(list) { let n = 0, t = 0; list.forEach(L => { const p = progress(L); n += p.n; t += p.total; }); return { n, t, pct: t ? Math.round(n / t * 100) : 0 }; }
  function quizStats(topic) {
    const st = quizSt(); let graded = 0, ok = 0, total = 0;
    QUESTIONS.forEach(q => { if (topic && q.topic !== topic) return; total++; const r = st[q.id]; if (r) { graded++; if (r.ok) ok++; } });
    return { total, graded, ok, pct: graded ? Math.round(ok / graded * 1000) / 10 : null };
  }

  /* ───────── 사이드바 (카테고리) ───────── */
  const GROUPS = () => [
    { h: "시작", items: [{ id: "", t: "홈" }, { id: "guide", t: "사용법 · 동기화 안내" }, uItem("start")] },
    ...bookGroups().map(g => ({ h: g.h, fold: g.fold, items: g.units.map(L => uItem(L.id)) })),
    { h: "연습 · 도구", items: [QUESTIONS.length && { id: "quiz", t: "연습문제", sub: () => { const s = quizStats(); return `응답 ${s.graded}/${s.total}${s.pct != null ? " · 정답률 " + s.pct + "%" : ""}`; } }, EXAM && { id: "exam", t: "모의고사", sub: () => `${EXAM.sets.length}개 유형 · 유형별 ${EXAM.sets[0].items.length}문항` }, FEAT.calc && { id: "calc", t: LB.calcTitle }, DICT.length && { id: "dict", t: LB.dictTitle }, uItem("review")] },
    (window.EXTRA || []).length && { h: LB.extraGroup, items: (window.EXTRA || []).map(L => uItem(L.id)) },
    { h: "근거", items: [{ id: "sources", t: "출처 모음" }] }
  ];
  // SITE.book.groups = [{ h: "문법", from: "U03", to: "U21", desc }] → 교재 단원을 묶음별로 표시 (없으면 '교재' 하나). 사이드바에선 묶음 제목을 눌러 접고 펼침
  const bookGroups = () => (BKraw.groups || [{ h: "교재", desc: LB.book }]).map(g => ({ h: g.h, desc: g.desc || "", fold: !!BKraw.groups, units: BOOK.filter(L => (!g.from || L.tag >= g.from) && (!g.to || L.tag <= g.to)) })).filter(g => g.units.length);
  const foldSt = {}; // 묶음 제목 → 접힘 여부 (직접 누른 것만, 나머지는 지금 보는 단원이 든 묶음만 펼침)
  function uItem(id) { const L = UNITS.find(u => u.id === id); return L ? { id, t: L.title, L } : null; }
  function renderSide() {
    const nav = document.getElementById("side-nav");
    const route = (parseHash()[0] || "").replace(/^home$/, "");
    let h = "";
    GROUPS().filter(g => g && g.items.some(Boolean)).forEach(g => {
      const shut = g.fold && (g.h in foldSt ? foldSt[g.h] : !g.items.some(it => it && it.id === route));
      h += g.fold ? `<div class="side-group" data-fold="${esc(g.h)}" data-shut="${shut ? 1 : 0}" style="cursor:pointer">${g.h} ${shut ? "▸" : "▾"}</div>` : `<div class="side-group">${g.h}</div>`;
      if (shut) return;
      g.items.filter(Boolean).forEach(it => {
        const L = it.L;
        let sub = "";
        if (L) { const p = progress(L); sub = `<small>${tagOf(L)} · 읽음 ${p.n}/${p.total}</small>`; }
        else if (it.sub) sub = `<small>${it.sub()}</small>`;
        h += `<button class="side-item ${route === it.id ? "active" : ""}" data-go="#${it.id || "home"}"><span class="txt">${sub}<span>${esc(it.t)}</span>${L ? `<div class="mini-bar"><i style="width:${progress(L).pct}%"></i></div>` : ""}</span></button>`;
      });
    });
    nav.innerHTML = h;
  }
  document.getElementById("side-nav").addEventListener("click", e => {
    const f = e.target.closest("[data-fold]"); if (f) { foldSt[f.dataset.fold] = f.dataset.shut !== "1"; renderSide(); return; }
    const b = e.target.closest("[data-go]"); if (!b) return;
    location.hash = b.dataset.go;
    if (window.innerWidth < 900) setSide(false);
  });
  function setSide(open) { document.body.classList.toggle("side-closed", !open); Store.set("sideOpen", open); setTimeout(fit, 280); }
  document.getElementById("side-toggle").addEventListener("click", () => setSide(document.body.classList.contains("side-closed")));
  document.getElementById("side-close").addEventListener("click", () => setSide(false));

  /* ───────── 홈 ───────── */
  function renderHome() {
    const o = overall(BOOK), qs = quizStats(), last = Store.get("last", null), lastL = last && UNITS.find(u => u.id === last), firstL = UNITS.find(u => u.id === "start") || BOOK[0];
    let h = `<div class="home">${SITE.eyebrow ? `<p class="eyebrow">${esc(SITE.eyebrow)}</p>` : ""}<h1>${esc(SITE.title)}</h1><p class="sub">${esc(SITE.sub)}</p>
      <div class="start-row">${firstL ? `<button class="big" data-go="#${firstL.id}">처음부터 시작하기</button>` : ""}${lastL ? `<button class="big alt" data-go="#${lastL.id}">이어하기 · ${esc(tagOf(lastL))} ${esc(lastL.title)}</button>` : ""}${QUESTIONS.length ? `<button class="big alt" data-go="#quiz">연습문제</button>` : ""}</div>
      ${SITE.notice ? `<div class="notice">${SITE.notice}</div>` : ""}
      <div class="stats"><div><small>교재 읽기</small><b>${o.pct}%</b><span>${o.n}/${o.t} 섹션</span></div>${QUESTIONS.length ? `<div><small>문제 정답률</small><b>${qs.pct != null ? qs.pct + "%" : "—"}</b><span>채점 ${qs.graded}/${qs.total} · 미응답 제외</span></div>` : ""}</div>
      ${bookGroups().map(g => `<h2 class="grp">${esc(g.h)} <small>${esc(g.desc)}</small></h2><div class="cat-grid">${g.units.map(L => card(L)).join("")}</div>`).join("")}
      <h2 class="grp">연습 · 복습</h2><div class="cat-grid">`;
    if (QUESTIONS.length) h += tool("quiz", "PRACTICE", `연습문제 ${QUESTIONS.length}문항`, "공부한 범위 · 입문·기본·응용·계산 · 단원별 · 오답 다시 풀기");
    if (EXAM) h += tool("exam", "MOCK EXAM", `모의고사 ${EXAM.sets.length}개 유형`, "빈칸 단답 · O/X · 질문형 단답 · 코드 작성 — 시험지처럼 한 장에 풀고 한 번에 채점");
    if (FEAT.calc) h += tool("calc", "TOOL", LB.calcTitle, "TP·TN·FP·FN을 넣어 정확도·정밀도·재현율·F1 계산");
    if (DICT.length) h += tool("dict", "TOOL", LB.dictTitle, `교재의 용어 ${DICT.length}개 검색`);
    const rvL = UNITS.find(u => u.id === "review"); if (rvL) h += card(rvL);
    h += `</div>`;
    if ((window.EXTRA || []).length) h += `<h2 class="grp">${esc(LB.extraGroup)} <small>${esc(LB.extra)}</small></h2><div class="cat-grid">${window.EXTRA.map(L => card(L)).join("")}</div>`;
    h += `</div>`;
    main.innerHTML = h;
    main.querySelectorAll("[data-go]").forEach(b => b.addEventListener("click", () => (location.hash = b.dataset.go)));
  }
  function card(L) {
    const p = progress(L), qs = /^U\d\d$/.test(L.tag) ? quizStats(L.tag) : null;
    return `<button class="cat" data-go="#${L.id}"><span class="body"><span class="tag">${esc(L.tag)}${L.en ? " · " + esc(L.en) : ""}</span><b>${esc(L.title)}</b><p>${esc(L.desc || "")}</p>
      <span class="prog"><span class="mini-bar"><i style="width:${p.pct}%"></i></span>읽음 ${p.n}/${p.total}${qs ? ` · 정답률 ${qs.pct != null ? qs.pct + "%" : "—"}` : ""}</span></span></button>`;
  }
  function tool(id, tag, t, d) {
    return `<button class="cat" data-go="#${id}"><span class="body"><span class="tag">${tag}</span><b>${t}</b><p>${d}</p></span></button>`;
  }

  /* ───────── 단원 페이지 (필기 가능, 1000px 고정폭) ───────── */
  function srcHtml(ids) {
    if (!ids || !ids.length) return "";
    return `<div class="src"><b>근거 자료</b><ul>${ids.map(id => { const s = SRC[id]; return `<li><span class="sid">${id}</span>${s ? `<span class="kind">${esc(s.kind)}</span>${esc(s.t)} — <a href="${esc(s.u)}" target="_blank" rel="noopener">${esc(s.u.replace(/^https?:\/\//, ""))}</a>` : "(출처 목록에 없음)"}</li>`; }).join("")}</ul></div>`;
  }
  function renderLecture(L, anchor) {
    Store.set("last", L.id);
    const p = progress(L), C = 2 * Math.PI * 34, goals = L.goals || [];
    const qn = /^U\d\d$/.test(L.tag) ? QUESTIONS.filter(q => q.topic === L.tag).length : 0;
    let h = `<div class="hero" id="top">
      <div class="k">${esc(L.tag)}${L.book ? " · 교재 원문" : " · 보강 자료"}</div><h1>${esc(L.title)}</h1><div class="en">${esc(L.en || "")}</div>
      <div class="hero-row"><button data-jump="checklist">체크리스트</button>${goals.length ? `<button data-jump="goals">목표 점검</button>` : ""}${qn ? `<button data-go="#quiz.${L.tag}">확인 문제 ${qn}개 ›</button>` : ""}</div>
      <svg class="ring" viewBox="0 0 84 84"><circle cx="42" cy="42" r="34" fill="none" stroke="#e8e8ed" stroke-width="6"/><circle class="ring-fg" cx="42" cy="42" r="34" fill="none" stroke="#1d1d1f" stroke-width="6" stroke-linecap="round" stroke-dasharray="${C}" stroke-dashoffset="${C * (1 - p.pct / 100)}" transform="rotate(-90 42 42)"/></svg>
      <div class="ring"><b class="ring-txt">${p.pct}%</b></div></div>`;
    h += `<div class="card" id="checklist"><h2>읽음 체크리스트 <small>${L.sections.length}개 섹션 · 다 읽으면 체크</small></h2><div class="checklist">`;
    L.sections.forEach((s, i) => (h += `<div class="ck ${isDone(L.id, s.id) ? "done" : ""}" data-sec="${s.id}"><span class="num">${i + 1}</span><span class="box"></span><span class="lbl">${esc(s.t)}</span><span class="go" data-goto="${s.id}">이동 ›</span></div>`));
    h += `</div></div>`;
    L.sections.forEach((s, i) => {
      const body = s.html != null ? s.html : `${s.h || ""}${s.tip ? `<div class="tip">${s.tip}</div>` : ""}`;
      h += `<section class="sec ${isDone(L.id, s.id) ? "done" : ""}" id="s-${s.id}" data-sec="${s.id}">
        <div class="sec-head"><span class="n">${i + 1}</span><h3>${esc(s.t)}</h3><button class="done-btn">${isDone(L.id, s.id) ? "✓ 완료" : "읽음"}</button></div>
        <div class="sec-body wide"><div class="notes${s.html != null ? " md" : ""}">${body}${srcHtml(s.src)}</div></div></section>`;
    });
    if (goals.length) {
      const gs = goalsSt()[L.id] || {};
      h += `<div class="card" id="goals"><h2>목표 자가점검 <small style="font-size:13px;color:var(--sub);font-weight:500">설명할 수 있으면 체크</small></h2><div class="checklist" style="grid-template-columns:1fr">`;
      goals.forEach((g, i) => (h += `<div class="ck goal ${gs[i] ? "done" : ""}" data-goal="${i}"><span class="num">${i + 1}</span><span class="box"></span><span class="lbl">${esc(g)}</span></div>`));
      h += `</div></div>`;
    }
    if (qn) { const qs = quizStats(L.tag); h += `<div class="card" id="quizcard"><h2>이 단원 확인 문제</h2><p>${qn}문항 · 채점 ${qs.graded}개 · 정답률 ${qs.pct != null ? qs.pct + "%" : "—"} <small>(${esc(LB.quizNote)})</small></p><button class="pill" data-go="#quiz.${L.tag}">문제 풀기 ›</button></div>`; }
    const seq = UNITS, idx = seq.indexOf(L), prev = seq[idx - 1], next = seq[idx + 1];
    h += `<div class="pn" id="pn">${prev ? `<button data-go="#${prev.id}"><small>‹ 이전</small>${esc(prev.tag)} ${esc(prev.title)}</button>` : "<span></span>"}${next ? `<button data-go="#${next.id}"><small>다음 ›</small>${esc(next.tag)} ${esc(next.title)}</button>` : `<button data-go="#home"><small>마지막</small>홈으로</button>`}</div>`;

    main.innerHTML = `<div class="scaler"><div class="page" id="page">${h}</div></div>`;
    scaler = main.querySelector(".scaler"); page = main.querySelector(".page");
    page.addEventListener("click", e => onPageClick(L, e));
    ro = new ResizeObserver(() => fit()); ro.observe(page);
    fit();
    Ink.attach(page, L.id, () => scale, main);
    if (anchor) requestAnimationFrame(() => jumpTo(anchor === "checklist" || anchor === "goals" ? anchor : "s-" + anchor));
  }
  function onPageClick(L, e) {
    const t = e.target;
    if (t.closest(".postit")) return; // 포스트잇 안의 클릭은 페이지 동작과 분리
    if (t.closest("a[href^='http']")) return;
    const jump = t.closest("[data-jump]"); if (jump) return jumpTo(jump.dataset.jump);
    const go = t.closest("[data-goto]"); if (go) { e.stopPropagation(); return jumpTo("s-" + go.dataset.goto); }
    const nav = t.closest("[data-go]"); if (nav) return (location.hash = nav.dataset.go);
    const ck = t.closest(".ck[data-sec]"); if (ck) return toggleSec(L, ck.dataset.sec);
    const db = t.closest(".done-btn"); if (db) return toggleSec(L, db.closest(".sec").dataset.sec);
    const gl = t.closest(".ck.goal"); if (gl) { const g = goalsSt(); const o = (g[L.id] = g[L.id] || {}); o[gl.dataset.goal] = !o[gl.dataset.goal]; Store.set("goals", g); gl.classList.toggle("done", !!o[gl.dataset.goal]); return; }
    const img = t.closest(".notes img"); if (img) openLightbox(img.src);
  }
  function toggleSec(L, sid) {
    const v = !isDone(L.id, sid); setDone(L.id, sid, v);
    page.querySelectorAll(`[data-sec="${sid}"]`).forEach(el => el.classList.toggle("done", v));
    const btn = page.querySelector(`#s-${sid} .done-btn`); if (btn) btn.textContent = v ? "✓ 완료" : "읽음";
    updateRing(L); renderSide();
    if (v) { const p = progress(L); toast(p.n === p.total ? `${L.tag} 모든 섹션 읽음!` : `✓ 읽음 (${p.n}/${p.total})`); }
  }
  function updateRing(L) {
    const p = progress(L), C = 2 * Math.PI * 34;
    const fg = page.querySelector(".ring-fg"); if (fg) fg.setAttribute("stroke-dashoffset", C * (1 - p.pct / 100));
    const tx = page.querySelector(".ring-txt"); if (tx) tx.textContent = p.pct + "%";
  }
  function jumpTo(id) {
    const el = page && page.querySelector("#" + id); if (!el) return;
    let y = 0, n = el; while (n && n !== page) { y += n.offsetTop; n = n.offsetParent; }
    main.scrollTo({ top: scaler.offsetTop + y * scale - 10, behavior: "smooth" });
  }
  function fit() {
    if (!page || !page.isConnected) return;
    const avail = main.clientWidth - (window.innerWidth >= 1000 ? 84 : 12);
    scale = Math.max(0.3, Math.min(1.25, avail / 1000));
    page.style.transform = `scale(${scale})`;
    scaler.style.width = 1000 * scale + "px";
    scaler.style.height = page.offsetHeight * scale + "px";
    Ink.resize();
  }
  window.addEventListener("resize", fit);

  /* ───────── 연습문제 ───────── */
  let QS = null; // 현재 풀이 세션 { mode, topic, list:[id], i, answered:{id:{a,ok}} }
  const LEVEL_MODES = { basic: ["입문", "기본"], applied: ["응용", "계산"] };
  // 공부한 범위 = 읽음 체크가 하나라도 있는 단원
  const studiedTags = () => { const c = checks(); return new Set(BOOK.filter(L => c[L.id] && Object.values(c[L.id]).some(Boolean)).map(L => L.tag)); };
  function quizList(mode, topic) {
    const st = quizSt();
    let list = QUESTIONS;
    if (mode === "basic") list = list.filter(q => LEVEL_MODES.basic.includes(q.level));
    else if (mode === "applied") list = list.filter(q => LEVEL_MODES.applied.includes(q.level));
    else if (mode === "unit") list = list.filter(q => q.topic === topic);
    else if (mode === "wrong") list = list.filter(q => st[q.id] && !st[q.id].ok);
    else if (mode === "studied") { const t = studiedTags(); list = list.filter(q => t.has(q.topic)); }
    const ids = list.map(q => q.id);
    for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; } // 문제 순서만 섞음 (보기 순서는 원본 유지)
    return ids;
  }
  function renderQuiz(topic) {
    if (topic && !QS) QS = { mode: "unit", topic, list: quizList("unit", topic), i: 0, answered: {} };
    if (topic && QS && (QS.mode !== "unit" || QS.topic !== topic)) QS = { mode: "unit", topic, list: quizList("unit", topic), i: 0, answered: {} };
    const s = quizStats(), st = quizSt(), wrongN = QUESTIONS.filter(q => st[q.id] && !st[q.id].ok).length, studied = studiedTags(), studiedN = QUESTIONS.filter(q => studied.has(q.topic)).length;
    let h = `<div class="home quiz"><h1>연습문제</h1>
      <div class="notice"><b>${esc(QNOTICE)}</b> 정답률은 <b>정답 수 ÷ 채점된 응답 수 × 100</b>(미응답 제외)이며 ${esc(LB.scoreNote)}</div>
      <div class="overall"><b>전체</b><span class="bar"><i style="width:${s.total ? s.graded / s.total * 100 : 0}%"></i></span><small>채점 ${s.graded}/${s.total}</small><b>정답률 ${s.pct != null ? s.pct + "%" : "—"}</b>${wrongN ? `<small>오답 ${wrongN}개</small>` : ""}</div>
      <div class="modes">
        <button data-mode="studied" ${studiedN ? "" : "disabled"} title="${studied.size ? "체크한 단원: " + esc([...studied].join(" · ")) : "교재에서 읽음 체크를 하면 그 단원 문제가 나와요"}">공부한 범위 <small>${studied.size ? studied.size + "개 단원 · " + studiedN : "체크 없음"}</small></button>
        <button data-mode="basic">기본 모드 <small>입문·기본 ${QUESTIONS.filter(q => LEVEL_MODES.basic.includes(q.level)).length}</small></button>
        <button data-mode="all">전 범위 <small>${QUESTIONS.length}</small></button>
        <button data-mode="applied">응용 문제 <small>응용·계산 ${QUESTIONS.filter(q => LEVEL_MODES.applied.includes(q.level)).length}</small></button>
        <button data-mode="wrong" ${wrongN ? "" : "disabled"}>오답 다시 풀기 <small>${wrongN}</small></button>
        <select data-unit><option value="">단원별 선택…</option>${bookGroups().map(g => (g.fold ? `<optgroup label="${esc(g.h)}">` : "") + g.units.map(L => `<option value="${L.tag}" ${QS && QS.mode === "unit" && QS.topic === L.tag ? "selected" : ""}>${L.tag} ${esc(L.title)} (${QUESTIONS.filter(q => q.topic === L.tag).length})</option>`).join("") + (g.fold ? "</optgroup>" : "")).join("")}</select>
      </div><div id="qbox"></div>
      <h2 class="grp">단원별 기록</h2><div class="tbl"><table class="qtable"><tr><th>단원</th><th>문항</th><th>채점</th><th>정답률</th><th></th></tr>${BOOK.map(L => { const u = quizStats(L.tag); return `<tr><td>${L.tag} ${esc(L.title)}</td><td>${u.total}</td><td>${u.graded}</td><td>${u.pct != null ? u.pct + "%" : "—"}</td><td><a href="#${L.id}">교재 ›</a></td></tr>`; }).join("")}</table></div>
      <p><button class="pill ghost" data-reset>기록 초기화</button></p></div>`;
    main.innerHTML = h;
    main.querySelectorAll("[data-mode]").forEach(b => b.addEventListener("click", () => { QS = { mode: b.dataset.mode, list: quizList(b.dataset.mode), i: 0, answered: {} }; if (location.hash !== "#quiz") location.hash = "#quiz"; else drawQ(); }));
    main.querySelector("[data-unit]").addEventListener("change", e => { if (e.target.value) location.hash = "#quiz." + e.target.value; });
    main.querySelector("[data-reset]").addEventListener("click", e => {
      if (!e.target.dataset.armed) { e.target.dataset.armed = 1; e.target.textContent = "한 번 더 누르면 모든 문제 기록 삭제"; return; }
      Store.set("quiz", {}); QS = null; renderQuiz(); renderSide(); toast("문제 기록을 초기화했어요");
    });
    drawQ();
  }
  function drawQ() {
    const box = document.getElementById("qbox"); if (!box) return;
    if (!QS) { box.innerHTML = `<div class="qcard empty">위에서 모드를 고르면 문제가 시작됩니다. 공부하면서 읽음 체크를 했다면 <b>공부한 범위</b>, 처음이면 <b>기본 모드</b>를 추천해요.</div>`; return; }
    if (!QS.list.length) { box.innerHTML = `<div class="qcard empty">이 모드에 해당하는 문제가 없어요.</div>`; return; }
    if (QS.i >= QS.list.length) {
      const a = Object.values(QS.answered), ok = a.filter(x => x.ok).length;
      box.innerHTML = `<div class="qcard"><h3>이번 풀이 끝</h3><p>${a.length}문항 중 <b>${ok}개 정답</b> (${a.length ? Math.round(ok / a.length * 1000) / 10 : 0}%) — 자체 연습 결과이며 합격 가능성과 무관합니다.</p>
        <div class="qnav"><button class="pill" data-again>같은 모드 다시</button>${a.some(x => !x.ok) ? `<button class="pill alt" data-wrong>이번 오답만 다시</button>` : ""}</div></div>`;
      box.querySelector("[data-again]").onclick = () => { QS = { ...QS, list: quizList(QS.mode, QS.topic), i: 0, answered: {} }; drawQ(); };
      const w = box.querySelector("[data-wrong]"); if (w) w.onclick = () => { const ids = QS.list.filter(id => QS.answered[id] && !QS.answered[id].ok); QS = { ...QS, list: ids, i: 0, answered: {} }; drawQ(); };
      return;
    }
    const q = QUESTIONS.find(x => x.id === QS.list[QS.i]), done = QS.answered[q.id], L = BOOK.find(u => u.tag === q.topic), prev = quizSt()[q.id];
    let h = `<div class="qcard"><div class="qmeta"><span>${QS.i + 1} / ${QS.list.length}</span><span class="lv">${esc(q.level)}</span><span>${esc(q.topic)}${L ? " " + esc(L.title) : ""}</span><span class="qid">${q.id}${prev ? ` · 지난 기록 ${prev.ok ? "맞힘" : "틀림"} (${prev.n}회)` : ""}</span></div>
      ${q.passage ? `<div class="qcode" style="font:inherit;font-size:16px;line-height:1.75;white-space:pre-wrap">${esc(q.passage)}</div>` : ""}<h3>${esc(q.question)}</h3>${q.code ? `<pre class="qcode">${esc(q.code)}</pre>` : ""}<div class="choices${q.code ? " mono" : ""}">`;
    q.choices.forEach((c, i) => {
      let cls = "";
      if (done) cls = i === q.answerIndex ? "right" : i === done.a ? "wrong" : "dim";
      h += `<button class="choice ${cls}" data-c="${i}" ${done ? "disabled" : ""}><b>${"①②③④"[i]}</b> ${esc(c)}</button>`;
    });
    h += `</div>`;
    if (done) {
      h += `<div class="result ${done.ok ? "ok" : "no"}">${done.ok ? "정답" : `오답 — 정답은 ${"①②③④"[q.answerIndex]}`}</div>
        <div class="expl"><b>해설</b> ${esc(q.explanation)}</div>${srcHtml(q.sourceIds)}
        ${L ? `<p><a href="#${L.id}">${L.tag} 교재로 돌아가 복습 ›</a></p>` : ""}<p class="origin">${esc(q.origin || "")}</p>`;
    }
    h += `<div class="qnav"><button class="pill ghost" data-prev ${QS.i ? "" : "disabled"}>‹ 이전</button>${done ? `<button class="pill" data-next>${QS.i + 1 < QS.list.length ? "다음 문제 ›" : "결과 보기 ›"}</button>` : `<span class="hint">보기를 누르면 바로 채점됩니다</span>`}</div></div>`;
    box.innerHTML = h;
    box.querySelectorAll("[data-c]").forEach(b => b.addEventListener("click", () => answer(q, +b.dataset.c)));
    const nx = box.querySelector("[data-next]"); if (nx) nx.onclick = () => { QS.i++; drawQ(); box.scrollIntoView({ block: "start", behavior: "smooth" }); };
    const pv = box.querySelector("[data-prev]"); if (pv) pv.onclick = () => { QS.i = Math.max(0, QS.i - 1); drawQ(); };
  }
  function answer(q, a) {
    const ok = a === q.answerIndex;
    QS.answered[q.id] = { a, ok };
    const st = quizSt(), r = st[q.id] || { n: 0 };
    st[q.id] = { a, ok, n: r.n + 1, t: Date.now() };
    Store.set("quiz", st);
    drawQ(); renderSide();
  }

  /* ───────── 모의고사 (features.exam, content/exam.json) ─────────
   * 시험지처럼 한 장에 풀고 한 번에 채점. 문항 t: blank(q 안의 "( )" 자리에 입력) · ox · short · code(모범 답안 보고 자가 채점)
   * 저장: exam = { <세트id>: { ans: {번호: 답}, ok: {번호: true|false|null} (채점 후에만), at } } */
  const examSt = () => Store.get("exam", {});
  const normAns = s => String(s == null ? "" : s).normalize("NFKC").toLowerCase().replace(/[\s`'"“”‘’()@.\-_]/g, "");
  function examScore(set, r) { return set.items.filter((_, i) => r.ok && r.ok[i]).length; }
  function renderExam(setId) {
    const set = EXAM.sets.find(s => s.id === setId), all = examSt();
    if (!set) {
      main.innerHTML = `<div class="home"><h1>모의고사</h1><div class="notice">${esc(EXAM.notice || "")}</div>
        <p class="sub">유형마다 문항이 다릅니다. 답은 입력하는 대로 저장되고, <b>제출하고 채점</b>을 누르면 한 번에 채점됩니다. 코드 작성 문항은 모범 답안과 비교해 직접 채점하세요.</p>
        <div class="cat-grid">${EXAM.sets.map(s => { const r = all[s.id] || {}; return tool("exam." + s.id, `${s.items.length}문항`, esc(s.name), r.ok ? `최근 점수 ${examScore(s, r)} / ${s.items.length}` : Object.keys(r.ans || {}).length ? "푸는 중 — 이어서 풀기" : "아직 안 풂"); }).join("")}</div></div>`;
      main.querySelectorAll("[data-go]").forEach(b => b.addEventListener("click", () => (location.hash = b.dataset.go)));
      return;
    }
    const r = all[set.id] || { ans: {} }, graded = !!r.ok, ans = r.ans || {};
    const unitLink = tag => { const L = BOOK.find(u => u.tag === tag); return L ? ` <a href="#${L.id}">${L.tag} ${esc(L.title)} ›</a>` : ""; };
    let h = `<div class="home exam"><p class="eyebrow">모의고사</p><h1>${esc(set.name)}</h1>`;
    if (graded) {
      const pend = set.items.filter((it, i) => it.t === "code" && r.ok[i] == null).length;
      h += `<div class="overall"><b class="ex-score">${examScore(set, r)} / ${set.items.length}</b><small>${pend ? "코드 문항 자가 채점이 남았어요" : "채점 완료"} · ${esc(LB.scoreNote)}</small></div>`;
    }
    h += `<ol class="exam-sheet">`;
    set.items.forEach((it, i) => {
      const a = ans[i] == null ? "" : ans[i], ok = graded ? r.ok[i] : undefined, dis = graded ? "disabled" : "";
      h += `<li class="ex-item ${ok === true ? "ok" : ok === false ? "no" : ""}" data-i="${i}"><span class="n">${i + 1}.</span> `;
      if (it.t === "blank") { const [x, y = ""] = it.q.split("( )"); h += `${esc(x)}(<input class="ex-blank" data-i="${i}" value="${esc(a)}" ${dis} autocomplete="off" autocapitalize="off" spellcheck="false">)${esc(y)}`; }
      else if (it.t === "ox") h += `${esc(it.q)} <span class="ox">${["O", "X"].map(v => `<button data-ox="${v}" data-i="${i}" class="${a === v ? "on" : ""}" ${dis}>${v}</button>`).join("")}</span>`;
      else if (it.t === "short") h += `${esc(it.q)}<input class="ex-short" data-i="${i}" value="${esc(a)}" ${dis} autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="답">`;
      else h += `${esc(it.q)}<textarea class="ex-code" data-i="${i}" ${dis} spellcheck="false" autocapitalize="off" placeholder="여기에 코드를 작성하세요">${esc(a)}</textarea>`;
      if (graded) {
        h += `<div class="ex-res">`;
        if (it.t === "code") {
          h += `<b>모범 답안</b><pre class="qcode">${esc(it.a)}</pre><b>채점 기준</b><ul>${(it.pts || []).map(p => `<li>${esc(p)}</li>`).join("")}</ul>
            <div class="ox self">내 답은 ${["맞음", "틀림"].map((v, j) => `<button data-self="${j ? 0 : 1}" data-i="${i}" class="${ok === !j ? "on" : ""}">${v}</button>`).join("")}</div>`;
        } else {
          h += `<b class="${ok ? "ok" : "no"}">${ok ? "정답" : "오답"}</b> · 정답: <b>${esc(it.t === "ox" ? it.a : it.a[0])}</b>${it.t !== "ox" && it.a.length > 1 ? ` <small>(${it.a.slice(1).map(esc).join(", ")}도 정답)</small>` : ""}`;
          if (it.t !== "ox") h += ` <button class="flip" data-flip="${i}">${ok ? "오답으로 바꾸기" : "맞은 걸로 바꾸기"}</button>`;
        }
        h += `<div>${esc(it.ex || "")}${unitLink(it.topic)}</div></div>`;
      }
      h += `</li>`;
    });
    h += `</ol><div class="qnav">${graded ? `<button class="pill ghost" data-retry>다시 풀기</button>` : `<span class="hint">답은 입력하는 대로 저장됩니다</span>`}<span><a href="#exam">유형 목록</a> ${graded ? "" : `<button class="pill" data-submit>제출하고 채점</button>`}</span></div></div>`;
    main.innerHTML = h;
    const save = () => { all[set.id] = r; r.ans = ans; Store.set("exam", all); };
    main.querySelectorAll("input[data-i], textarea[data-i]").forEach(el => el.addEventListener("input", () => { ans[el.dataset.i] = el.value; save(); }));
    main.querySelectorAll("textarea.ex-code").forEach(el => el.addEventListener("keydown", e => { if (e.key === "Tab") { e.preventDefault(); el.setRangeText("    ", el.selectionStart, el.selectionEnd, "end"); el.dispatchEvent(new Event("input")); } }));
    const rerender = () => { const y = main.scrollTop; renderExam(set.id); main.scrollTop = y; };
    main.querySelectorAll("[data-ox]").forEach(b => b.addEventListener("click", () => { ans[b.dataset.i] = b.dataset.ox; save(); rerender(); }));
    main.querySelectorAll("[data-self]").forEach(b => b.addEventListener("click", () => { r.ok[b.dataset.i] = b.dataset.self === "1"; save(); rerender(); }));
    main.querySelectorAll("[data-flip]").forEach(b => b.addEventListener("click", () => { r.ok[b.dataset.flip] = !r.ok[b.dataset.flip]; save(); rerender(); }));
    const sb = main.querySelector("[data-submit]");
    if (sb) sb.addEventListener("click", () => {
      const empty = set.items.filter((_, i) => !String(ans[i] || "").trim()).length;
      if (empty && !confirm(`${empty}문항이 비어 있어요. 그대로 채점할까요?`)) return;
      r.ok = {};
      set.items.forEach((it, i) => { r.ok[i] = it.t === "code" ? null : it.t === "ox" ? ans[i] === it.a : it.a.some(x => normAns(x) === normAns(ans[i])); });
      r.at = Date.now(); save(); renderExam(set.id); main.scrollTop = 0;
    });
    const rb = main.querySelector("[data-retry]");
    if (rb) rb.addEventListener("click", () => { if (!confirm("답과 채점 결과를 지우고 다시 풀까요?")) return; all[set.id] = { ans: {} }; Store.set("exam", all); renderExam(set.id); main.scrollTop = 0; });
  }

  /* ───────── 혼동행렬 계산기 ───────── */
  function renderCalc() {
    const v = Store.get("calc", { TP: 8, TN: 85, FP: 5, FN: 2 });
    main.innerHTML = `<div class="home calc"><h1>${esc(LB.calcTitle)}</h1>
      <p class="sub">먼저 <b>무엇을 양성(Positive)으로 볼지</b> 정하세요. 예: 불량 = 양성. 값은 0 이상의 정수, 결과는 소수점 둘째 자리 반올림.</p>
      <div class="cm">
        <div></div><div class="hd">예측: 양성</div><div class="hd">예측: 음성</div>
        <div class="hd">실제: 양성</div>${inp("TP", "불량을 제대로 잡음", v)}${inp("FN", "불량을 놓침 (미탐)", v)}
        <div class="hd">실제: 음성</div>${inp("FP", "정상인데 불량이라 함 (오탐)", v)}${inp("TN", "정상을 정상으로", v)}
      </div>
      <div class="presets"><span>교재 예제:</span><button data-p="8,85,5,2">TP8 TN85 FP5 FN2</button><button data-p="6,88,2,4">TP6 TN88 FP2 FN4</button><button data-p="0,10,0,0">분모 0 예: TN10</button></div>
      <div id="calc-out"></div></div>`;
    const read = () => { const o = {}; ["TP", "TN", "FP", "FN"].forEach(k => { const n = Math.max(0, Math.floor(+main.querySelector(`[data-k="${k}"]`).value || 0)); o[k] = n; }); return o; };
    const draw = () => { const o = read(); Store.set("calc", o); document.getElementById("calc-out").innerHTML = calcOut(o); };
    main.querySelectorAll("[data-k]").forEach(i => i.addEventListener("input", draw));
    main.querySelectorAll("[data-p]").forEach(b => b.addEventListener("click", () => { const [a, b2, c, d] = b.dataset.p.split(",").map(Number); Object.entries({ TP: a, TN: b2, FP: c, FN: d }).forEach(([k, n]) => (main.querySelector(`[data-k="${k}"]`).value = n)); draw(); }));
    draw();
  }
  const inp = (k, d, v) => `<label class="cell ${k}"><b>${k}</b><input type="number" min="0" step="1" inputmode="numeric" data-k="${k}" value="${v[k]}"><small>${d}</small></label>`;
  function calcOut({ TP, TN, FP, FN }) {
    const N = TP + TN + FP + FN;
    const pct = (num, den) => den ? (Math.round(num / den * 10000) / 100).toFixed(2).replace(/\.00$/, "") + "%" : null;
    const rows = [
      ["정확도 Accuracy", "(TP + TN) / (TP + TN + FP + FN)", `(${TP} + ${TN}) / ${N}`, pct(TP + TN, N), "전체 건수가 0"],
      ["정밀도 Precision", "TP / (TP + FP)", `${TP} / (${TP} + ${FP})`, pct(TP, TP + FP), "양성이라고 예측한 것이 0개 (TP+FP=0)"],
      ["재현율 Recall", "TP / (TP + FN)", `${TP} / (${TP} + ${FN})`, pct(TP, TP + FN), "실제 양성이 0개 (TP+FN=0)"],
      ["F1", "2TP / (2TP + FP + FN)", `${2 * TP} / (${2 * TP} + ${FP} + ${FN})`, pct(2 * TP, 2 * TP + FP + FN), "2TP+FP+FN=0 (정밀도·재현율 모두 정의 안 됨)"]
    ];
    return `<div class="tbl"><table class="calc-t"><tr><th>지표</th><th>공식</th><th>대입</th><th>결과</th></tr>${rows.map(r => `<tr><td><b>${r[0]}</b></td><td>${r[1]}</td><td>${r[2]}</td><td class="res">${r[3] != null ? r[3] : `<span class="na">N/A</span><small>${r[4]}</small>`}</td></tr>`).join("")}</table></div>
      <p class="sub">실제 양성 = TP+FN = ${TP + FN} · 실제 음성 = TN+FP = ${TN + FP} · 모델의 양성 판정 = TP+FP = ${TP + FP} · 전체 = ${N}</p>`;
  }

  /* ───────── 사전 ───────── */
  function renderDict() {
    const DCOLS = Object.keys(DICT[0] || {}); // 사전 표의 열 이름을 그대로 사용 (첫 열 = 용어)
    main.innerHTML = `<div class="home dict"><h1>${esc(LB.dictTitle)}</h1><p class="sub">교재 원문의 용어 ${DICT.length}개. 처음 배울 단원을 누르면 이동합니다.</p>
      <input class="search" type="search" placeholder="용어 검색" data-q><div class="tbl"><table class="dict-t"><thead><tr>${DCOLS.map(c => `<th>${esc(c)}</th>`).join("")}</tr></thead><tbody></tbody></table></div></div>`;
    const tb = main.querySelector("tbody");
    const draw = q => {
      q = (q || "").trim().toLowerCase();
      tb.innerHTML = DICT.filter(r => !q || Object.values(r).join(" ").toLowerCase().includes(q)).map(r => `<tr>${DCOLS.map((c, i) => `<td>${i ? "" : "<b>"}${esc(r[c]).replace(/U\d\d/g, m => `<a href="#${m.toLowerCase()}">${m}</a>`)}${i ? "" : "</b>"}</td>`).join("")}</tr>`).join("") || `<tr><td colspan="${DCOLS.length}">찾는 용어가 없어요</td></tr>`;
    };
    main.querySelector("[data-q]").addEventListener("input", e => draw(e.target.value));
    draw("");
  }

  /* ───────── 출처 모음 ───────── */
  function renderSources() {
    const used = {};
    UNITS.forEach(L => L.sections.forEach(s => (s.src || []).forEach(id => ((used[id] = used[id] || new Set()).add(L.tag)))));
    QUESTIONS.forEach(q => (q.sourceIds || []).forEach(id => ((used[id] = used[id] || new Set()).add("문제"))));
    const groups = [...new Set(Object.values(SRC).map(s => s.kind))]; // 출처의 kind 별로 묶음 (나온 순서대로)
    let h = `<div class="home srcs"><h1>출처 모음</h1><p class="sub">${esc(LB.sources)}</p>`;
    groups.forEach(g => {
      const ids = Object.keys(SRC).filter(id => SRC[id].kind === g).sort();
      if (!ids.length) return;
      h += `<h2 class="grp">${g}</h2><div class="tbl"><table><tr><th>ID</th><th>문서</th><th>쓰인 곳</th></tr>${ids.map(id => `<tr><td><b>${id}</b></td><td>${esc(SRC[id].t)}<br><a href="${esc(SRC[id].u)}" target="_blank" rel="noopener">${esc(SRC[id].u)}</a>${SRC[id].scope ? `<br><small>근거 범위: ${esc(SRC[id].scope)}</small>` : ""}</td><td>${used[id] ? [...used[id]].join(", ") : "—"}</td></tr>`).join("")}</table></div>`;
    });
    main.innerHTML = h + `</div>`;
  }

  /* ───────── 사용법 ───────── */
  function renderGuide() {
    main.innerHTML = `<div class="home guide"><h1>사용법</h1>
      <div class="howto"><h3>공부 순서</h3>
      홈의 <b>처음부터 시작하기</b>를 누르고 교재 단원을 순서대로 읽고, 각 단원 끝의 <b>확인 문제</b>로 점검하세요. 섹션을 다 읽으면 <b>읽음</b>을 눌러 진도를 기록합니다.
      홈 카드에는 <b>읽음 진도</b>와 <b>문제 정답률</b>이 따로 표시됩니다. ${DICT.length ? `모르는 용어는 <a href="#dict">${esc(LB.dictTitle)}</a>에서 찾으세요.` : ""}</div>
      ${FEAT.login ? `<div class="howto"><h3>이름(아이디)과 여러 기기</h3>
      처음 들어올 때 정한 <b>이름이 내 아이디</b>입니다(비밀번호 없음). 필기·읽음 체크·목표 점검·문제·모의고사 기록은 <b>내 이름에만</b> 저장되고, 다른 사람의 기록은 보이지 않아요.<br>
      • 노트북·태블릿 등 다른 기기에서 <b>같은 이름</b>을 입력하면 몇 초 안에 같은 기록으로 이어집니다.<br>
      • 이름을 아는 사람은 그 이름으로 들어올 수 있으니 겹치지 않는 이름을 쓰세요.<br>
      • 기기를 다른 사람에게 넘길 때는 목차 아래 <b>로그아웃</b>을 누르세요(서버의 기록은 그대로 남아요).<br>
      • 인터넷이 끊겨도 이 기기에 저장되고, 다시 연결되면 자동으로 올라갑니다.</div>` : `<div class="howto"><h3>기기 간 실시간 동기화</h3>
      왼쪽 목차 아래 <b>동기화 설정</b>에서 <b>동기화 코드</b>(6자 이상, 나만 아는 문구)를 입력하세요. 노트북·갤럭시탭 등 <b>같은 코드를 입력한 모든 기기</b>에서 필기·읽음 체크·목표 점검·문제 기록이 몇 초 안에 똑같이 보입니다.<br>
      • 코드는 비밀번호처럼 다루세요. 같은 코드를 아는 사람은 같은 필기를 보고 고칠 수 있어요.<br>
      • 인터넷이 끊겨도 이 기기에 저장되고, 다시 연결되면 자동으로 올라갑니다.<br>
      • 같은 페이지를 두 기기에서 <b>동시에</b> 필기하면 나중에 저장된 쪽이 남을 수 있으니, 한 번에 한 기기에서 필기하세요.<br>
      • 동기화 없이도 <b>백업 저장 / 백업 불러오기</b>로 파일을 옮길 수 있습니다.</div>`}
      <div class="howto"><h3>필기 툴바</h3>
      (단원 페이지 오른쪽, 좁은 화면에선 아래) 펜 · 형광펜 · 가림펜 · 지우개 · ↶ 실행취소<br>
      • <b>색·굵기 바꾸기</b>: 펜/형광펜/가림펜을 고르면 옵션 창이 열립니다. 색 버튼, 무지개 버튼(원하는 색 직접 고르기), 굵기 버튼 3개 또는 <b>굵기 슬라이더</b>로 조절하고 미리보기로 확인하세요. 이미 고른 도구를 한 번 더 누르면 옵션 창이 다시 열립니다.<br>
      • <b>가림펜</b>: 외울 부분을 칠하면 가려지고, <b>탭하면 투명</b>해져 답이 보입니다. 로 페이지 전체 보기/가리기.<br>
      • <b>스냅</b>(기본 켬): 형광펜·가림펜을 대충 칠해도 글자/단어 크기에 맞게 정리됩니다.<br>
      • <b>손가락 제스처</b>(클립 스튜디오 방식): 필기 중 <b>두 손가락 탭 = 실행취소</b>, <b>세 손가락 탭 = 다시실행</b>. 메모지 안 필기에도 적용됩니다.<br>
      • <b>펜전용</b>: 갤럭시탭에서 켜면 손가락은 스크롤, S펜으로만 필기됩니다. 손가락으로 짧게 누르면 읽음 버튼·링크·가림펜도 그대로 눌립니다.<br>
      • 단축키: <kbd>V</kbd> 읽기 <kbd>P</kbd> 펜 <kbd>H</kbd> 형광펜 <kbd>M</kbd> 가림펜 <kbd>E</kbd> 지우개 <kbd>Ctrl+Z</kbd> 취소</div>
      <div class="howto"><h3>포스트잇</h3>
      필기 툴바의 <b>포스트잇</b>을 누르면 지금 보는 위치에 메모지가 붙습니다. 바로 글을 입력하세요.<br>
      • <b>이동</b>: 위쪽 막대(점 6개 부분)를 끌어서 옮깁니다.<br>
      • <b>크기</b>: 왼쪽·오른쪽·아래 가장자리나 아래 모서리를 끌어서 조절합니다.<br>
      • <b>불투명도</b>: 위쪽 막대의 가는 선 조절바를 좌우로 움직이면 메모지가 비쳐서 아래 본문을 함께 볼 수 있어요.<br>
      • <b>접기</b>: 위쪽 막대의 <b>–</b> 버튼을 누르면 작은 아이콘이 됩니다. 아이콘을 한 번 탭하면 원래 크기로, 끌면 이동합니다. 불투명도를 낮추면 쓴 글자·필기도 함께 비칩니다.<br>
      • <b>필기 / 타이핑</b>: 조절바 옆 <b>T / ✎</b> 스위치로 바꿉니다. ✎(필기용)에서는 메모지 안에 펜으로 쓰고(툴바의 펜 색·굵기), 툴바에서 지우개를 고르면 메모지 안 획을 지웁니다.<br>
      • 동그란 버튼으로 종이 색, ✕로 삭제(내용이 있으면 한 번 더 눌러 확인). 메모도 동기화됩니다.</div>
      <div class="howto"><h3>검색</h3>
      위쪽 <b>검색</b> 버튼을 누르면 오른쪽에 검색창이 열립니다. 입력하면 <b>구글</b>이 새 탭으로 열리고(로그인된 내 계정 그대로), 다음 검색도 같은 탭에서 열립니다. 본문과의 경계를 끌면 너비가 바뀝니다.</div>
      <div class="howto"><h3>기기마다 같은 자리에</h3>
      필기와 포스트잇은 화면 픽셀이 아니라 <b>들어 있는 섹션 안의 비율 위치</b>로 저장됩니다. 노트북·태블릿에서 글꼴이나 줄바꿈이 조금 달라 섹션 길이가 바뀌어도, 섹션 안의 같은 위치에 표시됩니다.</div>
      <div class="howto"><h3>라벨 읽는 법</h3>
      <span class="lb off">공식공지</span> 대회 공식 페이지 사실 · <span class="lb tech">기술근거</span> 기술 문서 근거 · <span class="lb plan">교육용 설명</span> 이해를 돕는 재구성 · <span class="lb case">가상자료</span> 임의 값 · <span class="lb news">언론 보도</span> 보도 내용 · <span class="lb add">보강</span> 교재 밖 웹 조사.
      본문의 <a class="sref" href="#sources">S03</a> 같은 표시는 출처 링크입니다.</div></div>`;
  }

  /* ───────── 라이트박스 / 토스트 ───────── */
  const lb = document.getElementById("lightbox");
  function openLightbox(src) { if (document.body.classList.contains("drawing")) return; lb.querySelector("img").src = src; lb.classList.add("show"); }
  lb.addEventListener("click", () => lb.classList.remove("show"));
  let tt; function toast(msg) { const t = document.getElementById("toast"); t.textContent = msg; t.classList.add("show"); clearTimeout(tt); tt = setTimeout(() => t.classList.remove("show"), 2400); }

  /* ───────── 백업 · 동기화 설정 ───────── */
  document.getElementById("btn-export").addEventListener("click", () => {
    Ink.flushSave();
    const blob = new Blob([JSON.stringify(Store.exportAll())], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `${SITE.title.replace(/\s+/g, "")}_백업_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast("백업 파일을 저장했어요");
  });
  const fImp = document.getElementById("file-import");
  document.getElementById("btn-import").addEventListener("click", () => fImp.click());
  fImp.addEventListener("change", async e => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const o = JSON.parse(await f.text());
      if (!o || typeof o !== "object" || Array.isArray(o) || !Object.values(o).every(r => r && typeof r === "object" && "t" in r && "v" in r)) throw new Error("형식");
      const n = Store.importAll(o); toast(`백업을 불러왔어요 (${n}개 항목)`); route();
    } catch (err) { toast(`이 파일은 ${SITE.title} 백업 파일이 아니에요`); }
    e.target.value = "";
  });
  const modal = document.getElementById("sync-modal");
  function openSync() {
    const on = Store.syncConnected();
    modal.querySelector(".state").innerHTML = on ? "이 기기는 동기화 중입니다." : Store.syncAvailable() ? "이 기기는 아직 동기화되지 않았어요." : "이 주소에서는 동기화를 쓸 수 없어요 (https 웹 주소에서 열어 주세요).";
    modal.querySelector("[data-off]").style.display = on ? "" : "none";
    modal.querySelector("input").value = "";
    modal.classList.add("show");
    setTimeout(() => modal.querySelector("input").focus(), 50);
  }
  document.getElementById("btn-sync").addEventListener("click", openSync);
  modal.addEventListener("click", e => { if (e.target === modal || e.target.closest("[data-close]")) modal.classList.remove("show"); });
  modal.querySelector("form").addEventListener("submit", async e => {
    e.preventDefault();
    const code = modal.querySelector("input").value.trim();
    if (code.length < 6) { toast("코드는 6자 이상으로 정해 주세요"); return; }
    const btn = modal.querySelector("[type=submit]"); btn.disabled = true; btn.textContent = "연결 중…";
    const ok = await Store.syncConnect(code);
    btn.disabled = false; btn.textContent = "연결";
    if (ok) { modal.classList.remove("show"); toast("동기화 연결! 다른 기기에서도 같은 코드를 입력하세요"); route(); }
    else toast("동기화 서버에 연결하지 못했어요. 인터넷을 확인해 주세요");
  });
  modal.querySelector("[data-off]").addEventListener("click", () => { Store.syncDisconnect(); modal.classList.remove("show"); toast("동기화를 껐어요. 이 기기 기록은 그대로 남아요"); });

  /* ───────── 이름 로그인 (features.login) ─────────
   * 이름 = 개인 아이디(비밀번호 없음, 인원 제한 없음). 기록은 개인 동기화 공간 sha256(key + ":user:" + 아이디) — 같은 이름이면 어느 기기에서든 이어서
   * 다른 사람의 진도를 보는 기능은 없음. 로그인하면 '동기화 설정'(공유 코드) 대신 이 공간을 씀 */
  const USER_KEY = SITE.key + "-user", SPACE_KEY = SITE.key + "-sync-space";
  const cleanName = n => String(n || "").normalize("NFKC").trim().replace(/\s+/g, " ");
  function me() { try { return JSON.parse(localStorage.getItem(USER_KEY)); } catch (e) { return null; } }
  async function sha(s) { const b = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s)); return [...new Uint8Array(b)].map(x => x.toString(16).padStart(2, "0")).join(""); }
  function clearLocal() {
    const P = SITE.key + ":", ks = [];
    try { for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(P)) ks.push(k); } ks.forEach(k => localStorage.removeItem(k)); localStorage.removeItem(SPACE_KEY); } catch (e) {}
  }
  function renderGate(msg) {
    document.body.classList.add("gate");
    crumb.innerHTML = esc(SITE.title);
    main.innerHTML = `<div class="home gate-box">${SITE.eyebrow ? `<p class="eyebrow">${esc(SITE.eyebrow)}</p>` : ""}<h1>${esc(SITE.title)}</h1>
      <p class="sub">사용할 이름을 정해 주세요. 이 이름이 내 아이디가 되어 필기·읽음 체크·문제 기록이 나에게만 저장됩니다. 다른 기기에서도 같은 이름을 입력하면 이어서 공부할 수 있어요.</p>
      <form class="gate-form" autocomplete="off"><input name="n" maxlength="20" placeholder="이름 (1~20자)" autocapitalize="off" spellcheck="false" enterkeyhint="go"><button class="pill">시작하기</button></form>
      <p class="gate-msg" role="status">${msg || ""}</p>
      <p class="gate-note">비밀번호가 없어서 이름을 아는 사람은 그 이름으로 들어올 수 있어요. 다른 사람과 겹치지 않게 <b>이름+숫자</b>처럼 정하는 걸 추천해요.</p></div>`;
    main.querySelector(".gate-form").addEventListener("submit", e => { e.preventDefault(); submitName(e.target.n.value, e.target.querySelector("button")); });
    setTimeout(() => { const i = main.querySelector(".gate-form input"); if (i && window.innerWidth >= 700) i.focus(); }, 50);
  }
  async function submitName(raw, btn) {
    const say = t => { main.querySelector(".gate-msg").textContent = t; };
    const name = cleanName(raw), id = name.toLowerCase();
    if (!name || name.length > 20) return say("이름은 1~20자로 정해 주세요.");
    if (/[:/\\#?]/.test(name)) return say("이름에 : / \\ # ? 는 쓸 수 없어요.");
    if (!Store.syncAvailable()) return say("이 주소에서는 로그인할 수 없어요 (https 웹 주소에서 열어 주세요).");
    btn.disabled = true; say("확인 중…");
    try {
      const sp = await sha(SITE.key + ":user:" + id);
      const r = await fetch(`${SITE.syncApi}?space=${sp}&since=0`, { cache: "no-store" });
      if (!r.ok) throw new Error(r.status);
      const used = Object.keys((await r.json()).items || {}).length > 0;
      if (used && !confirm(`‘${name}’ 이름으로 저장된 기록이 있어요.\n본인이면 확인을 눌러 이어서 공부하세요. 다른 사람이면 취소하고 다른 이름을 정해 주세요.`)) { btn.disabled = false; return say("다른 이름을 입력해 주세요."); }
    } catch (e) { btn.disabled = false; return say("서버에 연결하지 못했어요. 잠시 후 다시 시도해 주세요."); }
    // 로그인 전부터 이 기기에 있던 기록: 옮길지 물어봄 (아니면 지워서 다른 사람 기록과 섞이지 않게)
    const had = Object.entries(Store.exportAll()).some(([k, v]) => v && v.v != null && /^(checks|goals|quiz|exam|ink:|notes:)/.test(k));
    if (had && !confirm(`이 기기에 로그인 전 기록(필기·진도 등)이 있어요. ‘${name}’ 계정으로 옮길까요?\n\n다른 사람과 같이 쓰던 기록이면 취소하세요. 이 기기의 기록을 지우고 ‘${name}’의 기록을 불러옵니다.`)) clearLocal();
    else try { localStorage.removeItem(SPACE_KEY); } catch (e) {}
    localStorage.setItem(USER_KEY, JSON.stringify({ id, name }));
    location.hash = "#home"; location.reload(); // 새로 열면서 내 공간에 연결 (아래 시작 부분)
  }
  async function logout() {
    const u = me(); if (!u) return;
    if (!confirm(`‘${u.name}’에서 로그아웃할까요?\n이 기기에 저장된 기록만 지워지고, 서버의 기록은 남아 있어 같은 이름으로 다시 들어오면 이어서 할 수 있어요.`)) return;
    Ink.flushSave(); await Store.flushNow().catch(() => {});
    clearLocal(); try { localStorage.removeItem(USER_KEY); } catch (e) {}
    location.hash = ""; location.reload();
  }
  function renderWho() {
    const u = me(), foot = document.querySelector(".side-foot");
    document.getElementById("btn-sync").hidden = true;
    const w = document.createElement("div"); w.id = "who"; foot.prepend(w);
    w.innerHTML = `<b>${esc(u.name)}</b> 님<button type="button">로그아웃</button>`;
    w.querySelector("button").addEventListener("click", logout);
  }

  /* ───────── 라우팅 ───────── */
  function parseHash() { return decodeURIComponent(location.hash).replace(/^#\/?/, "").split(/[./]/); }
  function route() {
    if (!UNITS.length) return;
    const parts = parseHash();
    const id = parts[0] === "home" ? "" : parts[0] || "";
    Ink.detach();
    if (ro) { ro.disconnect(); ro = null; }
    page = null;
    main.scrollTop = 0;
    const L = UNITS.find(l => l.id === id);
    if (L) { crumb.innerHTML = `${esc(L.tag)} · ${esc(L.title)}<small>${esc(L.en || "")}</small>`; renderLecture(L, parts[1]); }
    else if (id === "quiz") { crumb.innerHTML = `연습문제<small>${esc(LB.quizNote)}</small>`; if (!parts[1] && QS && QS.mode === "unit") QS = null; renderQuiz(parts[1]); }
    else if (id === "exam" && EXAM) { crumb.innerHTML = `모의고사<small>${esc(LB.quizNote)}</small>`; renderExam(parts[1]); }
    else if (id === "calc" && FEAT.calc) { crumb.innerHTML = esc(LB.calcTitle); renderCalc(); }
    else if (id === "dict") { crumb.innerHTML = esc(LB.dictTitle); renderDict(); }
    else if (id === "sources") { crumb.innerHTML = `출처 모음`; renderSources(); }
    else if (id === "guide") { crumb.innerHTML = `사용법`; renderGuide(); }
    else { crumb.innerHTML = `${esc(SITE.title)}`; renderHome(); }
    renderSide();
  }
  window.addEventListener("hashchange", route);
  Store.onRemote(keys => {
    if (!keys.some(k => k === "checks" || k === "goals" || k === "quiz")) return;
    const id = parseHash()[0];
    if (id === "quiz" || id === "calc") { renderSide(); return; } // 문제 푸는 중엔 화면을 바꾸지 않음
    const typing = document.activeElement && document.activeElement.closest && document.activeElement.closest(".postit");
    if (!document.body.classList.contains("drawing") && !typing) { const y = main.scrollTop; route(); main.scrollTop = y; } else renderSide();
  });

  window.App = { toast, fit };
  if (Store.get("sideOpen", window.innerWidth >= 1100) === false || window.innerWidth < 900) document.body.classList.add("side-closed");
  const syncLabel = mode => mode === "sync" ? "실시간 동기화 중" : mode === "server" ? "기기 간 동기화 중 (노트북 서버)" : "이 기기에만 저장 · 동기화 설정으로 기기 연결";
  // 먼저 이 기기 저장분으로 그리고, 동기화가 연결되면 최신 내용으로 갱신
  const user = FEAT.login && me();
  if (FEAT.login && !user) renderGate();
  else {
    if (user) renderWho();
    Promise.all([boot(), Store.init()]).then(async ([, mode]) => {
      if (user && mode !== "sync") mode = (await Store.syncConnect("user:" + user.id)) ? "sync" : mode; // 로그인한 기기: 내 공간에 연결
      document.getElementById("sync-state").textContent = user && mode !== "sync" ? "서버 연결 안 됨 — 이 기기에 저장 후 다시 연결" : syncLabel(mode);
      if (mode === "sync") route();
    });
  }
})();
