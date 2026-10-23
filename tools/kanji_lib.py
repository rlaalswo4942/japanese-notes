"""한자 읽기 ↔ 단어 예시 연결 공용 함수 (prep_kanji.py · build.py 에서 씀)

원자료(DATA 폴더): kanji.json (davidluzgouveia/kanji-data, KANJIDIC2+Waller JLPT 급수, MIT),
furi.json (Doublevil/JmdictFurigana, 단어별 한자 읽기 분해, CC BY-SA 4.0),
jmdict-eng-*.json (scriptin/jmdict-simplified, CC BY-SA 4.0)
"""
import glob, json, os

DATA = os.environ.get("JA_DATA", os.path.join(os.path.dirname(__file__), "..", "..", "data"))
HERE = os.path.dirname(__file__)

H2K = {chr(c): chr(c + 0x60) for c in range(0x3041, 0x3097)}
kata = lambda s: "".join(H2K.get(c, c) for c in s)
VOICE = dict(zip("かきくけこさしすせそたちつてとはひふへほ", "がぎぐげござじずぜぞだぢづでどばびぶべぼ"))
HALF = dict(zip("はひふへほ", "ぱぴぷぺぽ"))


def variants(r):
    """읽기 r 이 단어 안에서 바뀌는 모양: 연탁(か→が, は→ば/ぱ), 촉음화(つ·ち·く·き → っ)"""
    out = {r}
    if r and r[0] in VOICE:
        out.add(VOICE[r[0]] + r[1:])
    if r and r[0] in HALF:
        out.add(HALF[r[0]] + r[1:])
    for v in list(out):
        if len(v) > 1 and v[-1] in "つちくき":
            out.add(v[:-1] + "っ")
    if r == "じゅう":
        out.add("じっ")
    return out


def load_kanji():
    return json.load(open(os.path.join(DATA, "kanji.json"), encoding="utf-8"))


def load_furi():
    """(표기, 읽기) → [(글자 또는 묶음, 읽기)] — 한자 부분만"""
    raw = json.load(open(os.path.join(DATA, "furi.json"), encoding="utf-8-sig"))
    out = {}
    for e in raw:
        out.setdefault((e["text"], e["reading"]), [(f["ruby"], f.get("rt")) for f in e["furigana"]])
    return out


def readings(k):
    """KANJIDIC 읽기 → [(종류, 키, 표시, 어간, 오쿠리가나)]. 훈독 'い.きる' → 표시 'い(きる)', 어간 'い', 오쿠리가나 'きる'"""
    out = []
    for r in k.get("readings_on") or []:
        r = r.strip("-")
        out.append(("音", r, kata(r), r, ""))
    for r in k.get("readings_kun") or []:
        r0 = r.strip("-")
        stem, _, oku = r0.partition(".")
        out.append(("訓", r0, stem + (f"({oku})" if oku else ""), stem, oku))
    seen, res = set(), []
    for x in out:
        if (x[0], x[1]) not in seen:
            seen.add((x[0], x[1]))
            res.append(x)
    return res


def match(rs, rt, after):
    """단어 속 한자 한 글자의 읽기 rt(+ 뒤에 붙은 가나 after)가 어느 읽기인지. 오쿠리가나까지 맞는 훈독 > 그대로 같음 > 연탁·촉음화"""
    best, bs = None, 0
    for i, (kind, _, _, stem, oku) in enumerate(rs):
        if rt == stem and oku and after.startswith(oku):
            s = 3
        elif rt == stem and not (oku and after and "ぁ" <= after[0] <= "ゖ"):
            s = 2
        elif oku and rt.startswith(stem) and len(rt) > len(stem) and oku.startswith(rt[len(stem):]):
            s = 2  # 오쿠리가나를 생략한 표기 예: 売上(うりあげ)의 上 = あ(げる)
        elif rt in variants(stem):
            s = 1
        else:
            continue
        if s > bs:
            best, bs = i, s
    return best


def segments(segs):
    """[(ruby, rt)] → [(한자 한 글자, 읽기, 뒤에 붙은 가나)] (여러 글자 묶음 = 숙자훈은 건너뜀)"""
    out = []
    for i, (ruby, rt) in enumerate(segs):
        if rt and len(ruby) == 1:
            after = ""
            for r2, t2 in segs[i + 1:]:
                if t2:
                    break
                after += r2
            out.append((ruby, rt, after))
    return out
