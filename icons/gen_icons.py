from PIL import Image, ImageDraw
import math

BG = (10, 14, 20, 255)      # #0A0E14
ACCENT = (57, 255, 136, 255)  # #39FF88
ACCENT_DIM = (31, 163, 92, 255)  # #1FA35C


def draw_mark(draw, cx, cy, r, width):
    # Partial ring (hourglass/progress motif) with a gap, like an XP ring.
    bbox = [cx - r, cy - r, cx + r, cy + r]
    draw.arc(bbox, start=-90, end=230, fill=ACCENT, width=width)
    # small filled dot at the ring's leading end
    end_angle = math.radians(230)
    dot_x = cx + r * math.cos(end_angle)
    dot_y = cy + r * math.sin(end_angle)
    dr = width * 0.9
    draw.ellipse([dot_x - dr, dot_y - dr, dot_x + dr, dot_y + dr], fill=ACCENT)


def make_icon(size, maskable=False, out_path=None):
    img = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    corner = int(size * 0.22)
    draw.rounded_rectangle([0, 0, size - 1, size - 1], radius=corner, fill=BG)

    # maskable icons need extra safe-zone padding (content within ~80% center)
    r = size * (0.26 if maskable else 0.30)
    width = max(2, int(size * 0.045))
    cx, cy = size / 2, size / 2
    draw_mark(draw, cx, cy, r, width)

    img.save(out_path)


make_icon(192, maskable=False, out_path="icon-192.png")
make_icon(512, maskable=False, out_path="icon-512.png")
make_icon(192, maskable=True, out_path="icon-maskable-192.png")
make_icon(512, maskable=True, out_path="icon-maskable-512.png")

# Simple favicon (multi-size ICO)
base = Image.open("icon-512.png")
sizes = [(16, 16), (32, 32), (48, 48)]
base.save("favicon.ico", sizes=sizes)

print("done")
