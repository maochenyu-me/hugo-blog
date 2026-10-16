#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
PWA / favicon / OG 资产生成器（kemiao 主题）

用法：
    python tools/gen-pwa-assets.py                 # 用内置占位图生成
    python tools/gen-pwa-assets.py --src logo.png  # 用你自己的源图（建议 >=512x512 透明 PNG）

产出（写入 blog/themes/kemiao/static/）：
    favicon.ico                 多尺寸 ICO (16/32/48)
    apple-touch-icon.png        180x180（不透明，iOS 会自己加圆角）
    pwa/favicon-{36,48,72,96,144,192,256,384,512}.png
    pwa/favicon-mask.svg        Safari pinned tab 单色剪影
    og.webp                     1200x630 社交分享图

设计说明：
- 占位图是「克」字 + 主题色背景，仅为让资产可用、控制台不再 404；
  换成自己的 logo 只需重跑并传 --src。
- mask-icon 必须是单色 SVG，颜色无关（Safari 用 color 属性染色）。
- og.webp 由 --og-bg 指定的背景色 + 站点标题文字合成。
"""

import argparse
import io
import sys
from pathlib import Path

# Windows 控制台默认 GBK，输出的 ✓ 等符号会炸；强制 UTF-8 并容错
try:
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
except (AttributeError, ValueError):
    pass

try:
    from PIL import Image, ImageDraw, ImageFont
except ImportError:
    sys.exit("需要 Pillow：pip install Pillow")

# ---- 常量 ----------------------------------------------------------------
THEME_COLOR = (36, 36, 36)          # #242424，与源站 manifest 一致
ACCENT = (110, 168, 254)            # 主题强调色（毛玻璃蓝）
ICON_SIZES = [16, 32, 36, 48, 72, 96, 144, 192, 256, 384, 512]
ICO_SIZES = [16, 32, 48]
APPLE_SIZE = 180
OG_SIZE = (1200, 630)

HERE = Path(__file__).resolve().parent
THEME_STATIC = HERE.parent / "themes" / "kemiao" / "static"


def find_cjk_font(size: int) -> ImageFont.FreeTypeFont:
    """找一个能渲染中文的字体，找不到就退回默认位图字体。"""
    candidates = [
        r"C:\Windows\Fonts\msyhbd.ttc",   # 微软雅黑 Bold
        r"C:\Windows\Fonts\msyh.ttc",     # 微软雅黑
        r"C:\Windows\Fonts\simhei.ttf",   # 黑体
        r"C:\Windows\Fonts\segoeui.ttf",
    ]
    for path in candidates:
        if Path(path).exists():
            try:
                return ImageFont.truetype(path, size)
            except OSError:
                continue
    print("  ! 未找到中文字体，文字将退化为默认字体（不影响资产可用性）")
    return ImageFont.load_default()


def make_placeholder_icon(size: int, glyph: str = "克") -> Image.Image:
    """内置占位图：圆角方底 + 主题色渐层 + 居中立字。"""
    # 4x 超采样再缩，边缘更干净
    ss = 4
    dim = size * ss
    img = Image.new("RGBA", (dim, dim), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    # 圆角方底（PWA maskable 安全区约 80%，这里内缩留白）
    radius = int(dim * 0.22)
    draw.rounded_rectangle(
        [(0, 0), (dim - 1, dim - 1)],
        radius=radius,
        fill=THEME_COLOR + (255,),
    )

    # 居中文字
    font = find_cjk_font(int(dim * 0.52))
    text = glyph
    bbox = draw.textbbox((0, 0), text, font=font)
    tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
    tx = (dim - tw) / 2 - bbox[0]
    ty = (dim - th) / 2 - bbox[1]
    draw.text((tx, ty), text, font=font, fill=ACCENT + (255,))

    return img.resize((size, size), Image.LANCZOS)


def make_mask_svg(glyph: str = "克") -> str:
    """Safari pinned-tab 单色剪影 SVG。"""
    return (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32">\n'
        '  <text x="16" y="16" text-anchor="middle" dominant-baseline="central"\n'
        '        font-family="PingFang SC, Microsoft YaHei, sans-serif"\n'
        f'        font-size="24" font-weight="700" fill="#000">{glyph}</text>\n'
        "</svg>\n"
    )


def make_og_image(title: str, subtitle: str, glyph: str = "克") -> Image.Image:
    """1200x630 社交分享图：暗底 + 强调色光晕 + 标题。"""
    w, h = OG_SIZE
    img = Image.new("RGB", (w, h), THEME_COLOR)
    draw = ImageDraw.Draw(img, "RGBA")

    # 左上 / 右下两团光晕（模拟主题 aurora）
    draw.ellipse([-260, -320, 620, 300], fill=ACCENT + (26,))
    draw.ellipse([w - 560, h - 300, w + 240, h + 260], fill=ACCENT + (18,))

    # 左侧竖条强调
    draw.rounded_rectangle([80, 210, 92, 420], radius=6, fill=ACCENT + (255,))

    f_title = find_cjk_font(68)
    f_sub = find_cjk_font(32)
    f_glyph = find_cjk_font(140)

    draw.text((140, 250), title, font=f_title, fill=(245, 245, 245))
    draw.text((142, 345), subtitle, font=f_sub, fill=(170, 180, 195))
    draw.text((w - 300, h - 260), glyph, font=f_glyph, fill=ACCENT + (46,))

    return img


def main() -> int:
    ap = argparse.ArgumentParser(description="生成 PWA / favicon / OG 资产")
    ap.add_argument("--src", help="源图路径（建议 >=512x512 透明 PNG）；省略则用内置占位图")
    ap.add_argument("--glyph", default="克", help="占位图用的字（默认「克」）")
    ap.add_argument("--title", default="LiuShen's Blog", help="OG 图主标题")
    ap.add_argument("--subtitle", default="好奇心转化为代码的空间。", help="OG 图副标题")
    args = ap.parse_args()

    pwa_dir = THEME_STATIC / "pwa"
    pwa_dir.mkdir(parents=True, exist_ok=True)

    # ---- 基础方形源图 ----
    if args.src:
        src_path = Path(args.src)
        if not src_path.exists():
            sys.exit(f"源图不存在：{src_path}")
        base = Image.open(src_path).convert("RGBA")
        if max(base.size) < 512:
            print(f"  ! 源图仅 {base.size[0]}x{base.size[1]}，放大到 512 会有损")
        print(f"源图：{src_path} ({base.size[0]}x{base.size[1]})")
    else:
        print(f"使用内置占位图（字：{args.glyph}）")
        base = make_placeholder_icon(1024, args.glyph)

    # ---- PWA PNG 套件（16/32 供 head 的 favicon 尺寸声明） ----
    for size in ICON_SIZES:
        icon = base.resize((size, size), Image.LANCZOS)
        out = pwa_dir / f"favicon-{size}x{size}.png"
        icon.save(out, "PNG", optimize=True)
        print(f"  ✓ {out.relative_to(THEME_STATIC.parent)}")

    # ---- favicon.ico（多尺寸内嵌） ----
    ico_path = THEME_STATIC / "favicon.ico"
    base.resize((max(ICO_SIZES), max(ICO_SIZES)), Image.LANCZOS).save(
        ico_path, "ICO", sizes=[(s, s) for s in ICO_SIZES]
    )
    print(f"  ✓ {ico_path.relative_to(THEME_STATIC.parent)}")

    # ---- apple-touch-icon（不透明底，iOS 不加透明通道） ----
    flat = Image.new("RGB", (APPLE_SIZE, APPLE_SIZE), THEME_COLOR)
    flat.paste(base.resize((APPLE_SIZE, APPLE_SIZE), Image.LANCZOS), (0, 0),
               base.resize((APPLE_SIZE, APPLE_SIZE), Image.LANCZOS))
    flat.save(THEME_STATIC / "apple-touch-icon.png", "PNG", optimize=True)
    print(f"  ✓ themes/kemiao/static/apple-touch-icon.png")

    # ---- mask-icon ----
    mask_path = pwa_dir / "favicon-mask.svg"
    mask_path.write_text(make_mask_svg(args.glyph), encoding="utf-8")
    print(f"  ✓ {mask_path.relative_to(THEME_STATIC.parent)}")

    # ---- OG 图 ----
    og = make_og_image(args.title, args.subtitle, args.glyph)
    og_path = THEME_STATIC / "og.webp"
    og.save(og_path, "WEBP", quality=88, method=6)
    print(f"  ✓ {og_path.relative_to(THEME_STATIC.parent)}")

    print("\n完成。")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
