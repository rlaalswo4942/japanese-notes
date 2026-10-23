"""JLPT 한자 → tools/kanji_hun.tsv (한국 훈음, 손으로 검토해 고치는 원본) · tools/kanji_extra.tsv (JLPT 단어 밖 예시 단어 고정본)

원자료(DATA): kanji.json, furi.json, jmdict-eng-*.json (kanji_lib.py 참고),
kanjidic2.xml.gz (EDRDG KANJIDIC2, CC BY-SA 4.0 — 한국 한자음),
hanja.txt (libhangul data/hanja/hanja.txt — 한자 훈음), Unihan_Variants.txt (유니코드 이체자)
두 파일 모두 이미 있으면 다시 만들지 않는다 (손으로 고친 내용 보존).
"""
import csv, glob, gzip, json, os, re, sys, collections
import wordfreq
from kanji_lib import DATA, HERE, load_kanji, load_furi, readings, match, segments

HUN = os.path.join(HERE, "kanji_hun.tsv")
EXTRA = os.path.join(HERE, "kanji_extra.tsv")

# 일본 신자체 → 한국 정자 (Unihan 에 연결이 없는 것). 일본에서 만든 국자(働 込 枠 畑 峠 匂 凪 등)는 짝이 없음
SHIN = "広廣気氣毎每図圖売賣青靑歩步辺邊対對絵繪楽樂実實乗乘発發転轉軽輕読讀伝傳労勞戦戰悪惡歯齒様樣緑綠駅驛囲圍帰歸単單仏佛険險専專薬藥栄榮渉涉覚覺焼燒脳腦験驗団團続續圧壓経經済濟挙擧総總権權検檢増增価價営營観觀応應沢澤庁廳抜拔満滿巻卷捜搜隠隱従從徴徵獣獸悩惱児兒清淸録錄撃擊壊壞渇渴覧覽懐懷騒騷既旣巣巢帯帶徳德桜櫻雑雜銭錢厳嚴訳譯拡擴蔵藏臓臟縦縱粋粹拝拜歓歡遅遲舎舍亀龜剣劍払拂廃廢縄繩継繼塁壘戻戾弾彈聴聽闘鬪恵惠掲揭齢齡択擇渋澁勧勸圏圈慎愼稲稻譲讓駆驅剤劑犠犧瀬瀨拠據蛍螢鉱鑛偽僞斎齋髪髮涙淚姫姬嬢孃暦曆霊靈滝瀧穏穩穂穗砕碎畳疊釈釋聡聰陥陷猟獵寛寬浄淨壌壤舗舖剰剩繊纖荘莊勲勳尚尙粛肅髄髓摂攝醸釀閲閱鶏鷄暁曉鋳鑄亜亞渓溪桟棧倹儉壱壹巌巖尭堯薫薰穣穰弐貳"
SHIN = dict(zip(SHIN[::2], SHIN[1::2]))

if os.path.exists(HUN) and os.path.exists(EXTRA):
    sys.exit("kanji_hun.tsv · kanji_extra.tsv 가 이미 있음 — 손으로 고친 원본이라 다시 만들지 않음")

K = load_kanji()
J = {c: v for c, v in K.items() if v.get("jlpt_new")}
freq = wordfreq.get_frequency_dict("ja")

# 한국 한자음 (KANJIDIC2 korean_h) · 훈음 (hanja.txt) · 이체자 (Unihan)
kor = {}
xml = gzip.open(os.path.join(DATA, "kanjidic2.xml.gz"), "rt", encoding="utf-8").read()
for m in re.finditer(r"<literal>(.)</literal>(.*?)</character>", xml, re.S):
    kor[m.group(1)] = re.findall(r'<reading r_type="korean_h">(.*?)</reading>', m.group(2))
hj = collections.defaultdict(list)
for l in open(os.path.join(DATA, "hanja.txt"), encoding="utf-8"):
    p = l.rstrip("\n").split(":")
    if len(p) >= 3 and len(p[1]) == 1 and p[2] and not l.startswith("#"):
        hj[p[1]].append((p[0], p[2]))
var = collections.defaultdict(list)
for l in open(os.path.join(DATA, "Unihan_Variants.txt"), encoding="utf-8"):
    if l.startswith("#") or not l.strip():
        continue
    cp, f, v = l.rstrip().split("\t")
    if f in ("kTraditionalVariant", "kZVariant", "kSemanticVariant", "kSpecializedSemanticVariant"):
        var[chr(int(cp[2:], 16))] += [chr(int(x.split("<")[0][2:], 16)) for x in v.split()]


def hun(c):
    """대표 훈음 1개 (예: '날 생'). 정자가 다르면 '学 → 學' 처럼 정자도 돌려줌"""
    for t in [c] + ([SHIN[c]] if c in SHIN else []) + var.get(c, []):
        if t in hj:
            es = hj[t]
            want = kor.get(c) or kor.get(t) or []
            es = sorted(es, key=lambda e: want.index(e[0]) if e[0] in want else 99)
            return es[0][1].split(",")[0].strip(), (t if t != c else "")
    return "", ""


if not os.path.exists(HUN):
    lv = lambda c: J[c]["jlpt_new"]
    rows = sorted(J, key=lambda c: (-lv(c), J[c].get("freq") or 9999))
    with open(HUN, "w", encoding="utf-8", newline="") as fp:
        fp.write("kanji\tlv\thun\ttrad\ten\n")
        for c in rows:
            h, t = hun(c)
            fp.write(f"{c}\tN{lv(c)}\t{h}\t{t}\t{', '.join(J[c]['meanings'][:3])}\n")
    print(len(rows), "한자 →", HUN)

if not os.path.exists(EXTRA):
    F = load_furi()
    V = list(csv.DictReader(open(os.path.join(HERE, "vocab_base.tsv"), encoding="utf-8"), delimiter="\t"))
    R = {c: readings(v) for c, v in J.items()}
    have = collections.defaultdict(set)
    for w in V:
        for ch, rt, after in segments(F.get((w["w0"], w["r0"])) or []):
            if ch in R:
                have[ch].add(match(R[ch], rt, after))
    need = {(c, i) for c in R for i in range(len(R[c])) if i not in have[c]}
    jm = json.load(open(glob.glob(os.path.join(DATA, "jmdict-eng-*.json"))[0], encoding="utf-8"))["words"]
    best = {}  # (한자, 읽기 번호) → JMdict 상용어 중 가장 자주 쓰는 단어 1개
    for w in jm:
        ks = [k for k in w["kanji"] if k["common"]]
        if not ks:
            continue
        kana = [k for k in w["kana"] if "*" in k["appliesToKanji"] or ks[0]["text"] in k["appliesToKanji"]] or w["kana"]
        t, r = ks[0]["text"], kana[0]["text"]
        for ch, rt, after in segments(F.get((t, r)) or []):
            if ch in R:
                i = match(R[ch], rt, after)
                f = freq.get(t, 0)
                if (ch, i) in need and f > best.get((ch, i), ("", "", "", -1))[3]:
                    best[(ch, i)] = (t, r, "; ".join(g["text"] for g in w["sense"][0]["gloss"][:2]), f)
    words = sorted({v[:3] for v in best.values()}, key=lambda x: -freq.get(x[0], 0))
    with open(EXTRA, "w", encoding="utf-8", newline="") as fp:
        fp.write("id\tword\treading\ten\n")
        for i, (t, r, en) in enumerate(words, 1):
            fp.write(f"E{i}\t{t}\t{r}\t{en}\n")
    print(len(words), "예시 단어 →", EXTRA)
