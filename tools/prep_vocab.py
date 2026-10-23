"""JLPT 급수별 단어 목록 → tools/vocab_base.tsv (단어 id 고정본)

원자료(내려받아 DATA 폴더에 두기, 저장소에는 넣지 않음):
  n5~n1.csv  https://github.com/jamsinclair/open-anki-jlpt-decks (src/n*.csv, Jonathan Waller JLPT 목록 기반, CC BY)
  jmdict-eng-*.json  https://github.com/scriptin/jmdict-simplified (JMdict, EDRDG CC BY-SA 4.0) — 품사
  wordfreq (pip) — 빈도 (CC BY-SA 4.0)
vocab_base.tsv 는 한 번 만들면 id 를 바꾸지 않는다 (문제 id·뜻 파일 ko_vocab.tsv 가 이 id 를 씀).
"""
import csv, json, math, os, re, sys, glob
import wordfreq

DATA = os.environ.get("JA_DATA", os.path.join(os.path.dirname(__file__), "..", "..", "data"))
OUT = os.path.join(os.path.dirname(__file__), "vocab_base.tsv")
if os.path.exists(OUT):
    sys.exit("vocab_base.tsv 가 이미 있음 — id 고정본이라 다시 만들지 않음")

POS = [("v5", "동사1"), ("v1", "동사2"), ("vk", "동사3"), ("vs-i", "동사3"), ("vs-s", "동사3"), ("vz", "동사3"),
       ("adj-i", "い형"), ("adj-ix", "い형"), ("adj-na", "な형"), ("adj-pn", "연체사"), ("adj-no", "명사"), ("adv", "부사"),
       ("conj", "접속사"), ("int", "감탄사"), ("prt", "조사"), ("suf", "접미"), ("pref", "접두"), ("ctr", "조수사"),
       ("pn", "대명사"), ("exp", "표현"), ("aux", "조동사"), ("cop", "조동사"), ("num", "수사"), ("n", "명사")]


def pos_ko(tags):
    out = []
    for t in tags:
        for p, k in POS:
            if t == p or t.startswith(p + "-") or (p == "v5" and t.startswith("v5")):
                if k not in out:
                    out.append(k)
                break
    if "vs" in tags and "명사" in out:
        out[out.index("명사")] = "명사·する"
    return "·".join(out[:2])


jm = json.load(open(glob.glob(os.path.join(DATA, "jmdict-eng-*.json"))[0], encoding="utf-8"))["words"]
idx = {}  # (표기, 읽기) → [(common, 품사, 영어 단어 집합)] — 같은 표기의 여러 항목 중 영어 뜻이 가장 겹치는 것을 고름
for w in jm:
    if not w["sense"]:
        continue
    tags = w["sense"][0]["partOfSpeech"]
    common = any(k["common"] for k in w["kanji"] + w["kana"])
    en = set(re.findall(r"[a-z]+", " ".join(g["text"] for s_ in w["sense"] for g in s_["gloss"]).lower()))
    for k in w["kana"]:
        for f in [x["text"] for x in w["kanji"]] + [k["text"]]:
            idx.setdefault((f, k["text"]), []).append((common, tags, en))


def best(key, en):
    ws = set(re.findall(r"[a-z]+", en.lower())) - {"to", "a", "the", "of", "be", "an", "e", "g"}
    c = idx.get(key) or []
    return max(c, key=lambda x: (len(ws & x[2]), x[0]))[1] if c else None


freq = wordfreq.get_frequency_dict("ja")

clean = lambda s: re.sub(r"[～〜]", "", s).strip()
rows, seen = [], set()
for lv in "54321":
    for r in csv.DictReader(open(os.path.join(DATA, f"n{lv}.csv"), encoding="utf-8")):
        key = (r["expression"], r["reading"])
        if key in seen:
            continue  # 여러 급수에 있으면 쉬운 급수에만
        seen.add(key)
        word = " · ".join(x.strip() for x in r["expression"].split(";"))
        read = " · ".join(x.strip().replace(" (", "(") for x in r["reading"].split(";"))
        if read == word:
            read = ""
        w0 = clean(r["expression"].split(";")[0])
        r0 = clean(re.sub(r"\s*\(.*?\)", "", r["reading"].split(";")[0]))
        tags = best((w0, r0), r["meaning"]) or best((r0, r0), r["meaning"]) or []
        f = freq.get(w0) or freq.get(r0) or 0
        rows.append([lv, word, read, pos_ko(tags), f, w0, r0, r["meaning"]])

rows.sort(key=lambda x: (-int(x[0]), -x[4]))
with open(OUT, "w", encoding="utf-8", newline="") as fp:
    fp.write("id\tlv\tword\treading\tpos\tzipf\tw0\tr0\ten\n")
    for i, x in enumerate(rows, 1):
        z = round(math.log10(x[4] * 1e9), 2) if x[4] else 0
        fp.write("\t".join(map(str, [i, "N" + x[0], x[1], x[2], x[3], z, x[5], x[6], x[7]])) + "\n")
print(len(rows), "단어 →", OUT)
