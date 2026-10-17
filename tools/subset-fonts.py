#!/usr/bin/env python
# 字体子集化工具：把 FontAwesome 图标字体裁到项目实际用到的图标。
# 源字体备份在 tools/fonts/full/，可反复重跑（新增图标后执行一次即可）。
# 用法：<venv-python> tools/subset-fonts.py
import re
import glob
import os

from fontTools.ttLib import TTFont
from fontTools.pens.boundsPen import BoundsPen
from fontTools.subset import Options, Subsetter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CSS = os.path.join(ROOT, "themes/kemiao/static/fontawesome/css/all.min.css")
WEBFONTS = os.path.join(ROOT, "themes/kemiao/static/fontawesome/webfonts")
FULL = os.path.join(ROOT, "tools/fonts/full")
FONTS = ["fa-solid-900", "fa-brands-400", "fa-regular-400"]

SCAN_GLOBS = [
    "themes/kemiao/layouts/**/*.html",
    "themes/kemiao/assets/js/*.js",
    "themes/kemiao/data/*.yaml",
    "content/**/*.md",
    "data/*.yaml",
    "hugo.toml",
]


def icon_map():
    """解析 CSS：支持 `,.fa-xxx` 组合选择器，返回 {图标名: 码点}。"""
    css = open(CSS, encoding="utf-8").read()
    mapping = {}
    for m in re.finditer(r'([^{}]+)\{--fa:"\\([0-9a-f]+)\s*"\}', css):
        cp = int(m.group(2), 16)
        for name in re.findall(r"\.fa-([a-z0-9-]+)", m.group(1)):
            mapping[name] = cp
    return mapping


def used_icons(mapping):
    used = set()
    for pattern in SCAN_GLOBS:
        for path in glob.glob(os.path.join(ROOT, pattern), recursive=True):
            try:
                text = open(path, encoding="utf-8").read()
            except OSError:
                continue
            for name in re.findall(r"\bfa-([a-z0-9-]+)\b", text):
                if name in mapping:
                    used.add(name)
    return used


def glyph_bounds(font, cp):
    cmap = font.getBestCmap()
    name = cmap.get(cp)
    if not name:
        return None
    pen = BoundsPen(font.getGlyphSet())
    font.getGlyphSet()[name].draw(pen)
    return pen.bounds


def main():
    mapping = icon_map()
    used = used_icons(mapping)
    cps = sorted({mapping[u] for u in used})
    print(f"图标定义 {len(mapping)} 个，项目用到 {len(used)} 个（{len(cps)} 个码点）")

    os.makedirs(FULL, exist_ok=True)
    for name in FONTS:
        target = os.path.join(WEBFONTS, f"{name}.woff2")
        backup = os.path.join(FULL, f"{name}.woff2")
        if not os.path.exists(target):
            continue
        if not os.path.exists(backup):
            os.replace(target, backup)
        if not os.path.getsize(backup):
            continue
        font = TTFont(backup)
        options = Options()
        options.flavor = "woff2"
        options.layout_features = ["*"]
        subsetter = Subsetter(options=options)
        subsetter.populate(unicodes=cps)
        subsetter.subset(font)
        font.save(target)
        print(f"  {name}: {os.path.getsize(backup) // 1024}KB -> {os.path.getsize(target) // 1024}KB")

    # 自检：用到的每个图标都必须能在某一款子集字体里画出轮廓
    subset_fonts = []
    for name in FONTS:
        path = os.path.join(WEBFONTS, f"{name}.woff2")
        if os.path.exists(path):
            subset_fonts.append((name, TTFont(path)))
    missing = []
    for icon in sorted(used):
        cp = mapping[icon]
        if not any(glyph_bounds(font, cp) for _, font in subset_fonts):
            missing.append(f"{icon} (U+{cp:04X})")
    if missing:
        print("!! 以下图标在子集字体中缺失：" + ", ".join(missing))
        raise SystemExit(1)
    print("自检通过：所有用到的图标均有字形")


if __name__ == "__main__":
    main()
