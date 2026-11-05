"""Buat favicon.ico dan ikon PWA dengan PIL.

Digambar langsung dengan PIL (bukan rasterisasi SVG) supaya hasilnya tajam
di setiap ukuran dan tidak butuh dependensi tambahan. Hasilnya:

- assets/images/favicon.ico            (7 ukuran)
- assets/images/icon-512.png           (ikon manifest)
- assets/images/icon-192.png           (ikon manifest)
- assets/images/icon-180.png           (apple-touch-icon iOS)
- assets/images/icon-maskable-512.png  (varian maskable, zona aman 80%)

Jalankan: python scripts/make-favicon.py
"""

from pathlib import Path

from PIL import Image, ImageDraw

# Pillow >=10: _RESAMPLE deprecated.
_RESAMPLE = getattr(Image, "Resampling", Image).LANCZOS

ROOT = Path(__file__).resolve().parent.parent
IMG_DIR = ROOT / "assets" / "images"
OUT_ICO = IMG_DIR / "favicon.ico"

# Palet sama dengan token di base.css (kayu + muka dadu).
WOOD_LIGHT = (201, 138, 75, 255)
WOOD_DARK = (138, 83, 38, 255)
FACE_LIGHT = (247, 234, 208, 255)
FACE_DARK = (223, 201, 160, 255)
PIP = (107, 68, 35, 255)

# Skala gambar di 256 px lalu diperkecil; supersampling bikin tepi halus.
BASE = 256


def lerp(a, b, t):
    return tuple(round(a[i] + (b[i] - a[i]) * t) for i in range(4))


def vertical_gradient(size, top, bottom, box, radius):
    """Isi kotak bersudut bulat dengan gradasi vertikal, di luar kotak transparan."""
    grad = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(grad)
    x0, y0, x1, y1 = box
    height = max(1, y1 - y0)
    for y in range(y0, y1):
        draw.line([(x0, y), (x1, y)], fill=lerp(top, bottom, (y - y0) / height))

    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle(box, radius=radius, fill=255)
    grad.putalpha(mask)
    return grad


def build():
    size = BASE
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))

    # Badan kayu
    img.alpha_composite(
        vertical_gradient(size, WOOD_LIGHT, WOOD_DARK, (16, 16, 240, 240), 52)
    )
    # Muka dadu
    img.alpha_composite(
        vertical_gradient(size, FACE_LIGHT, FACE_DARK, (32, 32, 224, 224), 36)
    )

    # Pip pola 5, sama dengan sisi dadu di permainan
    draw = ImageDraw.Draw(img)
    r = 18
    for cx, cy in [(88, 88), (168, 88), (128, 128), (88, 168), (168, 168)]:
        draw.ellipse((cx - r, cy - r, cx + r, cy + r), fill=PIP)

    return img


def write_png_icons(icon):
    """Ikon PWA: PNG 512 & 192, plus varian maskable dengan latar penuh."""
    icon.resize((512, 512), _RESAMPLE).save(IMG_DIR / "icon-512.png")
    icon.resize((192, 192), _RESAMPLE).save(IMG_DIR / "icon-192.png")
    icon.resize((180, 180), _RESAMPLE).save(IMG_DIR / "icon-180.png")

    # Maskable: latar kayu penuh, dadu di zona aman tengah (80%) agar
    # aman terhadap topeng lingkaran / squircle Android.
    maskable = Image.new("RGBA", (512, 512), WOOD_DARK)
    inner = icon.resize((410, 410), _RESAMPLE)
    maskable.alpha_composite(inner, ((512 - 410) // 2, (512 - 410) // 2))
    maskable.convert("RGB").save(IMG_DIR / "icon-maskable-512.png")
    print(
        "Ditulis: icon-512.png, icon-192.png, icon-maskable-512.png "
        f"di {IMG_DIR}"
    )


def main():
    icon = build()
    sizes = [(16, 16), (24, 24), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]
    icon.save(OUT_ICO, format="ICO", sizes=sizes)
    print(f"Ditulis: {OUT_ICO} ({OUT_ICO.stat().st_size} byte, {len(sizes)} ukuran)")
    write_png_icons(icon)


if __name__ == "__main__":
    main()
