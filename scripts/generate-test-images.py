"""
Gera imagens placeholder para os dados de teste do Canaril.

IMPORTANTE: estas são ilustrações geradas (formas simples + texto), NÃO
fotos reais de pássaros de terceiros. Isso evita qualquer problema de
direito de imagem caso um registro de teste apareça por engano na vitrine
pública, e ainda assim testa o pipeline de upload/disco/exibição com
arquivos de tamanho e formato realistas (JPEG, ~800x800px), bem diferente
de um pixel de teste de 1x1.
"""
import os
from PIL import Image, ImageDraw, ImageFont

OUTPUT_DIR = "/tmp/canaril_test_images"
os.makedirs(OUTPUT_DIR, exist_ok=True)

# cor do canário -> (cor de preenchimento RGB, nome de arquivo)
COLOR_MAP = {
    "amarelo_intenso": (240, 200, 30),
    "amarelo_nevado": (245, 225, 140),
    "amarelo_mosaico": (235, 195, 60),
    "vermelho_intenso": (200, 55, 40),
    "vermelho_nevado": (215, 120, 100),
    "vermelho_mosaico": (210, 80, 55),
    "branco": (245, 245, 245),
    "prateado": (200, 200, 205),
    "opalino": (180, 195, 200),
    "feo": (160, 140, 100),
    "topázio": (190, 140, 60),
    "albino": (250, 250, 250),
    "lutino": (250, 235, 150),
}

BG = (235, 230, 220)


def draw_bird_silhouette(color_id: str, fill_rgb: tuple[int, int, int]) -> str:
    size = 800
    img = Image.new("RGB", (size, size), BG)
    draw = ImageDraw.Draw(img)

    cx, cy = size // 2, int(size * 0.55)

    # corpo (oval)
    body_w, body_h = 260, 340
    draw.ellipse(
        [cx - body_w // 2, cy - body_h // 2, cx + body_w // 2, cy + body_h // 2],
        fill=fill_rgb,
        outline=(60, 50, 40),
        width=4,
    )

    # cabeça (círculo)
    head_r = 95
    head_cy = cy - body_h // 2 - head_r + 30
    draw.ellipse(
        [cx - head_r, head_cy - head_r, cx + head_r, head_cy + head_r],
        fill=fill_rgb,
        outline=(60, 50, 40),
        width=4,
    )

    # bico (triângulo)
    draw.polygon(
        [(cx + head_r - 10, head_cy), (cx + head_r + 45, head_cy - 12), (cx + head_r - 10, head_cy + 28)],
        fill=(230, 150, 40),
        outline=(60, 50, 40),
    )

    # olho
    eye_x, eye_y = cx + 25, head_cy - 15
    draw.ellipse([eye_x - 12, eye_y - 12, eye_x + 12, eye_y + 12], fill=(20, 20, 20))
    draw.ellipse([eye_x - 4, eye_y - 6, eye_x + 2, eye_y], fill=(255, 255, 255))

    # asa (forma simples mais escura que o corpo)
    darker = tuple(max(0, c - 35) for c in fill_rgb)
    wing_points = [
        (cx - body_w // 2 + 30, cy - 40),
        (cx + 10, cy - 10),
        (cx - 20, cy + body_h // 2 - 30),
        (cx - body_w // 2 + 10, cy + 60),
    ]
    draw.polygon(wing_points, fill=darker, outline=(60, 50, 40))

    # poleiro (galho simples)
    perch_y = cy + body_h // 2 + 15
    draw.rectangle([cx - 160, perch_y, cx + 160, perch_y + 18], fill=(120, 85, 55))

    # rótulo "TESTE" — deixa inequívoco que não é foto real
    try:
        font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 34)
        font_small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 22)
    except Exception:
        font = ImageFont.load_default()
        font_small = font

    label = "ILUSTRAÇÃO DE TESTE"
    bbox = draw.textbbox((0, 0), label, font=font)
    tw = bbox[2] - bbox[0]
    draw.rectangle([0, size - 70, size, size], fill=(255, 255, 255))
    draw.text(((size - tw) / 2, size - 60), label, fill=(180, 30, 30), font=font)

    color_label = color_id.replace("_", " ")
    bbox2 = draw.textbbox((0, 0), color_label, font=font_small)
    tw2 = bbox2[2] - bbox2[0]
    draw.text(((size - tw2) / 2, 15), color_label, fill=(90, 80, 70), font=font_small)

    filename = f"{OUTPUT_DIR}/{color_id}.jpg"
    img.convert("RGB").save(filename, "JPEG", quality=85)
    return filename


if __name__ == "__main__":
    generated = []
    for color_id, rgb in COLOR_MAP.items():
        path = draw_bird_silhouette(color_id, rgb)
        size_kb = os.path.getsize(path) / 1024
        generated.append((color_id, path, size_kb))
        print(f"OK  {color_id:20s} -> {path}  ({size_kb:.0f} KB)")

    print(f"\n{len(generated)} imagens geradas em {OUTPUT_DIR}")
