"""Reproduce Cyrillic coverage and metric-adjusted fallback values (fontTools required).

Run from frontend: python docs/font-audit.py
The WOFF and WOFF2 files in each pinned Fontsource package contain the same faces;
WOFF is inspected so this script does not require the optional Brotli decoder.
Fallback metrics are calibrated against Windows Arial and Georgia, not guessed
from their Latin x-height. No system font is copied into the application.
"""

import json
import os
from pathlib import Path

from fontTools.ttLib import TTFont

ROOT = Path(__file__).resolve().parents[1]
FONT_DIR = Path(os.environ.get("WINDIR", "C:/Windows")) / "Fonts"
SUBSETS = ("latin", "latin-ext", "cyrillic", "cyrillic-ext")
RUSSIAN = "АБВГДЕЁЖЗИЙКЛМНОПРСТУФХЦЧШЩЪЫЬЭЮЯабвгдеёжзийклмнопрстуфхцчшщъыьэюя"
# Every modern Russian letter, plus the Cyrillic letters used by Ukrainian,
# Belarusian, Serbian, Macedonian, Bulgarian and Kazakh (Cyrillic-ext included).
CYRILLIC = RUSSIAN + "ҐґЄєІіЇїЎўЂђЈјЉљЊњЋћЏџЃѓЅѕЌќӘәҒғҚқҢңӨөҰұҮүҺһӀӏ"
BODY = (
    "Рассчитайте площадь комнаты, выберите материалы и проверьте смету. "
    "Длина и ширина, высота потолка, окна и двери. Стоимость работ и запас материалов. "
    "Ламинат, плитка, обои, краска. Добавить комнату, сохранить проект. "
    "Площадь 24,5 м². Материалы 128 450 ₽. RepairCalc 0123456789."
)
HEADINGS = (
    "Ремонт начинается с плана Мои проекты Материалы для ремонта "
    "Каталог материалов Помощник по ремонту Подбор материалов "
    "Смета на ремонт Параметры комнаты Сводка по проекту"
)


def load_face(family, weight):
    faces = [
        TTFont(ROOT / f"node_modules/@fontsource/{family}/files/{family}-{subset}-{weight}-normal.woff")
        for subset in SUBSETS
    ]
    cmap = {}
    for face in faces:
        for point, glyph in face.getBestCmap().items():
            cmap[point] = (face, glyph)
    return faces[0], cmap


def width(cmap, text):
    return sum(cmap[ord(char)][0]["hmtx"][cmap[ord(char)][1]][0] / cmap[ord(char)][0]["head"].unitsPerEm for char in text)


report = []
for family, weight, fallback_file, sample in (
    ("pt-sans", 400, "arial.ttf", BODY),
    ("pt-sans", 700, "arialbd.ttf", BODY),
    ("lora", 500, "georgia.ttf", HEADINGS),
):
    face, cmap = load_face(family, weight)
    fallback = TTFont(FONT_DIR / fallback_file)
    fallback_cmap = {point: (fallback, glyph) for point, glyph in fallback.getBestCmap().items()}
    missing = sorted(set(char for char in CYRILLIC + BODY if ord(char) not in cmap))
    assert not missing, f"{family} {weight}: missing {missing}"
    scale = width(cmap, sample) / width(fallback_cmap, sample)
    units = face["head"].unitsPerEm
    features = sorted(set(record.FeatureTag for record in face["GSUB"].table.FeatureList.FeatureRecord))
    digits = [cmap[ord(char)][0]["hmtx"][cmap[ord(char)][1]][0] for char in "0123456789"]
    tabular_digits = []
    for char in "0123456789":
        digit_face, glyph = cmap[ord(char)]
        substitution = digit_face["GSUB"].table
        for feature in substitution.FeatureList.FeatureRecord:
            if feature.FeatureTag != "tnum":
                continue
            for index in feature.Feature.LookupListIndex:
                for subtable in substitution.LookupList.Lookup[index].SubTable:
                    glyph = getattr(subtable, "mapping", {}).get(glyph, glyph)
        tabular_digits.append(digit_face["hmtx"][glyph][0])
    if family == "pt-sans":
        assert len(set(tabular_digits)) == 1
    report.append({
        "family": family,
        "weight": weight,
        "subsets": list(SUBSETS),
        "cyrillic_letters_checked": len(set(CYRILLIC)),
        "missing": missing,
        "unique_glyph_codepoints": len(cmap),
        "fallback": fallback_file,
        "size_adjust_percent": round(scale * 100, 4),
        "ascent_override_percent": round(face["hhea"].ascent / units / scale * 100, 4),
        "descent_override_percent": round(-face["hhea"].descent / units / scale * 100, 4),
        "line_gap_override_percent": round(face["hhea"].lineGap / units / scale * 100, 4),
        "tabular_feature": "tnum" in features,
        "tabular_digit_advances": tabular_digits,
        "default_digit_advances": digits,
    })

print(json.dumps(report, ensure_ascii=False, indent=2))
