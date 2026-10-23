"""생성 원고·문제 만들기:  python tools/build.py

만드는 것 (손으로 고치지 말 것 — 다시 만들면 덮어씀)
  content/vocab.md   U22~U33 급수별 어휘 (빈도순, 50단어씩 섹션)
  content/kanji.md   U38~U48 급수별 한자 (모든 음독·훈독 + 읽기별 예시 단어)
  content/dict.md    # 용어 사전 = 전체 단어 색인
  content/questions.json  어휘·한자 자동 문제 + tools/q/*.json 손으로 쓴 문제
원본: tools/vocab_base.tsv · ko/v*.tsv(단어 뜻) · kanji_hun.tsv(훈음) · kanji_extra.tsv · ko/e*.tsv · cache.json
cache.json 이 없으면 원자료(JA_DATA 폴더, kanji_lib.py 참고)에서 필요한 부분만 잘라 만든다.
"""
import csv, glob, json, os, random, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
CONTENT = os.path.join(ROOT, "content")
sys.path.insert(0, HERE)
from kanji_lib import readings, match, segments, kata  # noqa: E402

tsv = lambda f: list(csv.DictReader(open(os.path.join(HERE, f), encoding="utf-8"), delimiter="\t"))
V = tsv("vocab_base.tsv")
E = tsv("kanji_extra.tsv")
HUN = {r["kanji"]: r for r in tsv("kanji_hun.tsv")}
KO = {}
for f in sorted(glob.glob(os.path.join(HERE, "ko", "*.tsv"))):
    for l in open(f, encoding="utf-8"):
        if "\t" in l:
            k, v = l.rstrip("\n").split("\t", 1)
            KO[k] = v
missing = [w["id"] for w in V if w["id"] not in KO] + [e["id"] for e in E if e["id"] not in KO]
if missing:
    sys.exit(f"뜻이 없는 항목 {len(missing)}개: {missing[:10]}")

# ───────── 원자료 캐시 (저장소에 넣어 두고 원자료 없이 다시 빌드) ─────────
CACHE = os.path.join(HERE, "cache.json")
if not os.path.exists(CACHE):
    import gzip
    from kanji_lib import DATA, load_kanji, load_furi
    K, F = load_kanji(), load_furi()
    xml = gzip.open(os.path.join(DATA, "kanjidic2.xml.gz"), "rt", encoding="utf-8").read()
    kor = {m.group(1): re.findall(r'<reading r_type="korean_h">(.*?)</reading>', m.group(2))[:1]
           for m in re.finditer(r"<literal>(.)</literal>(.*?)</character>", xml, re.S)}
    words = {(w["w0"], w["r0"]) for w in V} | {(e["word"], e["reading"]) for e in E}
    chars = {c for w, _ in words for c in w if "一" <= c <= "鿿"}
    json.dump({
        "kanji": {c: {k: K[c].get(k) for k in ("strokes", "grade", "readings_on", "readings_kun", "meanings")} for c in HUN},
        "furi": {f"{w}|{r}": F[(w, r)] for w, r in words if (w, r) in F},
        "kor": {c: kor[c][0] for c in chars if kor.get(c)},
    }, open(CACHE, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
C = json.load(open(CACHE, encoding="utf-8"))
FURI = {k: [tuple(x) for x in v] for k, v in C["furi"].items()}

# ───────── 한국 한자음 (단어 옆 힌트) ─────────
EUM = dict(C["kor"])
for c, r in HUN.items():
    EUM[c] = r["hun"].split("·")[0].split()[-1]  # '날 생' → '생', '바꿀 역·쉬울 이' → '역'


def dueum(s):
    """두음법칙: 첫 글자 녀·료·락 → 여·요·낙"""
    if not s:
        return s
    o = ord(s[0]) - 0xAC00
    if not 0 <= o < 11172:
        return s
    cho, jung, jong = o // 588, (o % 588) // 28, o % 28
    if cho in (2, 5) and jung in (2, 3, 6, 7, 12, 17, 20):  # ㄴ·ㄹ + ㅑㅒㅕㅖㅛㅠㅣ → ㅇ
        cho = 11
    elif cho == 5:  # ㄹ + 그 밖 → ㄴ
        cho = 2
    return chr(0xAC00 + cho * 588 + jung * 28 + jong) + s[1:]


def eum(word):
    cs = [c for c in word if "一" <= c <= "鿿" or c == "々"]
    if not cs:
        return ""
    out = []
    for i, c in enumerate(cs):
        e = out[-1] if c == "々" and out else EUM.get(c, "?")
        if c == "不" and i + 1 < len(cs) and EUM.get(cs[i + 1], " ")[0] in "다더도두드디자저조주즈지":
            e = "부"
        out.append(e)
    joined = "".join(out)
    kana_inside = re.search(r"[぀-ヿ]", re.sub(r"^[^一-鿿]+|[^一-鿿々]+$", "", word))
    return dueum(joined) if not kana_inside else "·".join([dueum(out[0])] + out[1:])


short = lambda ko: ko.split(";")[0].split(" 예:")[0].split(" ※")[0].strip()
esc = lambda s: s.replace("|", "\\|")
ruby = lambda w, r: f"<ruby>{w}<rt>{r}</rt></ruby>" if r and r != w else w

# ───────── 단원 배치 (태그는 배포 후 바꾸지 않음 — 필기·문제 기록 키) ─────────
VOCAB_UNITS = [("U22", "N5", 1), ("U23", "N4", 1), ("U24", "N3", 3), ("U27", "N2", 3), ("U30", "N1", 4)]
KANJI_UNITS = [("U38", "N5", 1), ("U39", "N4", 1), ("U40", "N3", 2), ("U42", "N2", 2), ("U44", "N1", 5)]
LV_DESC = {"N5": "기초 중의 기초 — 인사·숫자·시간·가족·일상 사물", "N4": "일상 대화의 뼈대 — 동작·감정·생활 표현",
           "N3": "일상과 업무의 경계 — 뉴스·설명문에 자주 나오는 말", "N2": "사회·직장·신문 — 논리적 글과 비즈니스",
           "N1": "논설·전문·문어체 — 원어민 수준의 폭"}


def split(lst, n):
    k, m = divmod(len(lst), n)
    return [lst[i * k + min(i, m):(i + 1) * k + min(i + 1, m)] for i in range(n)]


def utag(t, i):
    return f"U{int(t[1:]) + i:02d}"


# ───────── 어휘 ─────────
md, WORD_UNIT = [], {}
for t0, lv, n in VOCAB_UNITS:
    ws = [w for w in V if w["lv"] == lv]
    for ui, part in enumerate(split(ws, n)):
        tag = utag(t0, ui)
        a, b = ws.index(part[0]) + 1, ws.index(part[-1]) + 1
        title = f"{lv} 어휘" + (f" {'①②③④⑤'[ui]} ({a:04d}–{b:04d})" if n > 1 else f" ({len(ws)}단어)")
        md.append(f"\n---\n\n# {tag}. {title}\n\n### 오늘의 목표\n\n- {lv} 단어 {len(part)}개의 읽기와 뜻을 말할 수 있다\n- 가림펜으로 뜻·읽기를 가리고 3초 안에 떠올릴 수 있다\n- 자주 틀리는 단어를 포스트잇에 모아 복습한다\n")
        md.append(f"\n### 이 단원 공부법\n\n**{LV_DESC[lv]}.** JLPT {lv} 단어 목록(공식 목록이 아닌 학습용 목록 [S06])을 **실제 사용 빈도가 높은 순서**로 배열했습니다 [S12]. 위쪽 단어일수록 자주 나옵니다.\n\n"
                  "- **한자음**: 한국 한자음입니다. 経済(경제)처럼 한국어와 뜻이 같은 한자어가 많아 기억에 도움이 됩니다. 가나가 섞인 단어는 한자마다 `·`로 나눴습니다.\n"
                  "- **품사**: 동사1 = 5단(u) 동사, 동사2 = 1단(ru) 동사, 동사3 = する·くる, 명사·する = する를 붙여 동사로도 씀, い형·な형 = 형용사.\n"
                  "- **외우는 법**: 가림펜으로 `뜻` 열을 칠한 뒤 단어만 보고 뜻을 말해 보고, 탭해서 확인하세요. 다음엔 `읽기` 열을 가리고 같은 방법으로.\n"
                  "- 이 단원 문제(단원 끝 버튼)는 단어마다 1문제씩 — 뜻 고르기와 읽기 고르기가 번갈아 나옵니다.\n")
        for si in range(0, len(part), 50):
            chunk = part[si:si + 50]
            s0 = ws.index(chunk[0]) + 1
            md.append(f"\n### {lv} {s0:04d}–{s0 + len(chunk) - 1:04d}\n\n| # | 단어 | 읽기 | 뜻 | 품사 | 한자음 |\n|---|---|---|---|---|---|\n")
            for w in chunk:
                WORD_UNIT[w["id"]] = tag
                md.append(f"| {ws.index(w) + 1} | **{esc(w['word'])}** | {esc(w['reading'])} | {esc(KO[w['id']])} | {w['pos']} | {eum(w['w0'])} |\n")
open(os.path.join(CONTENT, "vocab.md"), "w", encoding="utf-8").write("".join(md))

# ───────── 한자 ─────────
WK = {}  # (표기, 읽기) → (단어 뜻, 급수, 순서)
for w in V:
    WK.setdefault((w["w0"], w["r0"]), (KO[w["id"]], w["lv"], int(w["id"])))
for e in E:
    WK.setdefault((e["word"], e["reading"]), (KO[e["id"]], "", 100000 + int(e["id"][1:])))
EX = {c: {} for c in HUN}  # 한자 → 읽기 번호 → [(표기, 읽기)]
R = {c: readings(C["kanji"][c]) for c in HUN}
for (w, r), (_, lv, order) in sorted(WK.items(), key=lambda x: x[1][2]):
    for ch, rt, after in segments(FURI.get(f"{w}|{r}") or []):
        if ch in R:
            i = match(R[ch], rt, after)
            if i is not None:
                EX[ch].setdefault(i, []).append((w, r))

md, KANJI_UNIT = [], {}
for t0, lv, n in KANJI_UNITS:
    ks = [c for c in HUN if HUN[c]["lv"] == lv]
    for ui, part in enumerate(split(ks, n)):
        tag = utag(t0, ui)
        a, b = ks.index(part[0]) + 1, ks.index(part[-1]) + 1
        title = f"{lv} 한자" + (f" {'①②③④⑤'[ui]} ({a:04d}–{b:04d})" if n > 1 else f" ({len(ks)}자)")
        md.append(f"\n---\n\n# {tag}. {title}\n\n### 오늘의 목표\n\n- {lv} 한자 {len(part)}자의 한국 훈음과 대표 읽기를 말할 수 있다\n- 한 한자의 읽기가 단어마다 어떻게 바뀌는지 예시로 설명할 수 있다\n- 음독(중국에서 온 소리)과 훈독(일본 고유어 읽기)을 구분할 수 있다\n")
        md.append(f"\n### 이 단원 공부법\n\n한자는 신문에 자주 나오는 순서로 배열했습니다 [S07]. 한 한자에 **사전에 실린 모든 읽기**를 실었습니다 [S08].\n\n"
                  "- **音 = 음독**: 중국 한자음에서 온 읽기(가타카나로 표기). 한자어(두 글자 이상)에서 주로 씀 — 한국 한자음과 닮은 경우가 많습니다.\n"
                  "- **訓 = 훈독**: 한자의 뜻에 일본 고유어를 붙인 읽기(히라가나). `い(きる)`의 괄호는 한자 뒤에 붙는 가나(오쿠리가나)입니다 → 生きる.\n"
                  "- **읽기가 다르면 뜻도 다를 수 있습니다**: 같은 한자라도 읽기마다 붙은 예시 단어의 뜻을 비교하세요. 生 → 生きる(살다)·生まれる(태어나다)·生(날것)·一生(일생).\n"
                  "- 예시는 JLPT 단어를 먼저, 없으면 자주 쓰는 일반 단어를 실었습니다 [S09][S10]. 예시가 없는 읽기는 `드문 읽기`에 모았습니다(인명·고어·옛 문헌용).\n"
                  "- 연탁(か→が)·촉음화(つ→っ) 등 읽기가 살짝 변한 예도 같은 읽기로 묶었습니다. 원리는 U37에서 설명합니다.\n")
        for si in range(0, len(part), 20):
            chunk = part[si:si + 20]
            s0 = ks.index(chunk[0]) + 1
            md.append(f"\n### {lv} 한자 {s0:04d}–{s0 + len(chunk) - 1:04d}\n")
            for c in chunk:
                KANJI_UNIT[c] = tag
                h, k = HUN[c], C["kanji"][c]
                trad = f" ({h['trad']})" if h["trad"] else ""
                md.append(f"\n#### {c} — {h['hun']}{trad}\n\n"
                          f"<small>{k['strokes']}획 · {ks.index(c) + 1}번째로 자주 쓰는 {lv} 한자</small>\n\n| 읽기 | 예시 단어 |\n|---|---|\n")
                rare = []
                for i, (kind, key, show, *_rest) in enumerate(R[c]):
                    exs = EX[c].get(i, [])[:3]
                    if not exs:
                        rare.append(show)
                        continue
                    cells = " · ".join(f"{ruby(w, r)} {esc(short(WK[(w, r)][0]))}" for w, r in exs)
                    md.append(f"| {'音' if kind == '音' else '訓'} **{show}** | {cells} |\n")
                if rare:
                    md.append(f"| 드문 읽기 | {' · '.join(rare)} |\n")
open(os.path.join(CONTENT, "kanji.md"), "w", encoding="utf-8").write("".join(md))

# ───────── 용어 사전 = 전체 단어 색인 ─────────
md = ["# 용어 사전\n\n| 단어 | 읽기 | 뜻 | 급수 | 단원 |\n|---|---|---|---|---|\n"]
for w in V:
    md.append(f"| {esc(w['word'])} | {esc(w['reading'])} | {esc(KO[w['id']])} | {w['lv']} | {WORD_UNIT[w['id']]} |\n")
open(os.path.join(CONTENT, "dict.md"), "w", encoding="utf-8").write("".join(md))

# ───────── 문제 ─────────
Q = []


def mcq(qid, topic, level, question, right, wrongs, expl, src, rnd):
    ch = [right] + wrongs[:3]
    rnd.shuffle(ch)
    Q.append({"id": qid, "topic": topic, "level": level, "question": question, "choices": ch,
              "answerIndex": ch.index(right), "explanation": expl, "sourceIds": src})


def pick(pool, n, avoid, rnd):
    out = []
    for x in rnd.sample(pool, min(len(pool), n * 4)):
        if x not in avoid and x not in out:
            out.append(x)
        if len(out) == n:
            break
    return out


for lv in ("N5", "N4", "N3", "N2", "N1"):
    ws = [w for w in V if w["lv"] == lv]
    for w in ws:
        rnd = random.Random("V" + w["id"])
        kanji = re.search(r"[一-鿿]", w["w0"]) and w["reading"]
        mean, word = short(KO[w["id"]]), w["word"]
        rd = f"({w['reading']})" if w["reading"] else ""
        expl = f"{word}{rd} — {KO[w['id']]}"
        if kanji and int(w["id"]) % 2:
            same = [x["r0"] for x in ws if x["reading"] and abs(len(x["r0"]) - len(w["r0"])) <= 1]  # r0 = 대표 읽기 하나
            if len(same) < 8:
                same = [x["r0"] for x in V if x["reading"] and abs(len(x["r0"]) - len(w["r0"])) <= 2]
            mcq("V" + w["id"], WORD_UNIT[w["id"]], "기본", f"「{word}」의 읽기는?", w["r0"],
                pick(same, 3, {w["r0"]}, rnd), expl, ["S06"], rnd)
        else:
            pos = [short(KO[x["id"]]) for x in ws if x["pos"] == w["pos"] and x["id"] != w["id"]]
            if len(set(pos)) < 6:  # 같은 품사가 적으면 같은 급수 전체에서
                pos = [short(KO[x["id"]]) for x in ws if x["id"] != w["id"]]
            mcq("V" + w["id"], WORD_UNIT[w["id"]], "기본", f"「{word}」{rd}의 뜻은?", mean,
                pick(pos, 3, {mean}, rnd), expl, ["S06"], rnd)

# 한자: 같은 한자의 다른 읽기를 보기로 — "읽기에 따라 뜻이 바뀌는" 점을 직접 연습
for c in HUN:
    used = sorted(EX[c].items(), key=lambda x: -len(x[1]))
    if len(used) < 2:
        continue
    for n, (i, exs) in enumerate(used[:2]):
        w, r = next((x for x in exs if len(re.sub(r"[～〜]", "", x[0])) > 1), exs[0])  # 한 글자 단어는 읽기가 모호해서 뒤로
        segs = FURI.get(f"{w}|{r}")
        pos = next((j for j, s in enumerate(segs) if s[0] == c and s[1]), None)
        if pos is None:
            continue
        alts = []
        for kind, key, show, stem, oku in R[c]:
            if stem != segs[pos][1]:
                alt = "".join((stem if j == pos else (s[1] or s[0])) for j, s in enumerate(segs))
                if alt != r and alt not in alts:
                    alts.append(alt)
        rnd = random.Random(f"K{ord(c):x}{n}")
        if len(alts) < 3:
            alts += pick([x["reading"] for x in V if x["reading"] and len(x["reading"]) == len(r)], 3 - len(alts), {r, *alts}, rnd)
        reading_of = lambda i2: R[c][i2][2]
        others = " / ".join(f"{reading_of(i2)}: {ruby(*EX[c][i2][0]).replace('<ruby>', '').replace('</ruby>', '').replace('<rt>', '(').replace('</rt>', ')')}" for i2, _ in used[:4] if i2 != i)
        mcq(f"K{ord(c):x}-{n + 1}", KANJI_UNIT[c], "기본", f"「{w}」를 바르게 읽은 것은? ({c}의 읽기에 주의)", r, rnd.sample(alts, min(3, len(alts))),
            f"{w}({r}) — {short(WK[(w, r)][0])}. 여기서 {c}는 {reading_of(i)}(으)로 읽습니다. 다른 읽기: {others}", ["S08", "S10"], rnd)

# 손으로 쓴 문제 tools/q/*.txt — 블록 형식 (정답을 + 로 먼저 쓰면 보기 순서는 id 로 섞음)
#   @G0301 U03 기본        ← id 단원 난이도(입문·기본·응용)
#   ? 私（　）学生です。     ← 문제 (여러 줄 가능)
#   + は                    ← 정답
#   - を                    ← 오답 3개
#   = 해설
#   ! S16                   ← 출처 id (선택)
for f in sorted(glob.glob(os.path.join(HERE, "q", "*.txt"))):
    for blk in re.split(r"^@", open(f, encoding="utf-8").read(), flags=re.M)[1:]:
        head, *lines = blk.strip().split("\n")
        qid, topic, level = head.split()
        get = lambda p: [l[2:].strip() for l in lines if l.startswith(p + " ")]
        right, wrongs = get("+"), get("-")
        if len(right) != 1 or len(wrongs) != 3:
            sys.exit(f"{os.path.basename(f)} {qid}: 정답 1개·오답 3개가 필요")
        mcq(qid, topic, level, "\n".join(get("?")), right[0], wrongs, " ".join(get("=")), get("!") or [], random.Random(qid))
ids = [q["id"] for q in Q]
dup = {x for x in ids if ids.count(x) > 1} if len(ids) != len(set(ids)) else set()
if dup:
    sys.exit(f"문제 id 중복: {list(dup)[:10]}")
json.dump({"notice": "자체 제작 연습문제입니다. JLPT 공식 문제가 아니며, 어휘·한자 문제는 단어 목록에서 자동으로 만들었습니다.", "questions": Q},
          open(os.path.join(CONTENT, "questions.json"), "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(f"어휘 {len(V)} · 한자 {len(HUN)} · 문제 {len(Q)} (손으로 쓴 문제 {len(Q) - sum(1 for q in Q if q['id'][0] in 'VK')})")
