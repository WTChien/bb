from PIL import Image
from collections import deque
from pathlib import Path

ROOT = Path(r"d:\program\bb\img")
FILES = [
    ("ton_chest.png", "bronze_chest_nobg.png"),
    ("silver_chest.png", "silver_chest_nobg.png"),
    ("golden_chest.png", "gold_chest_nobg.png"),
]


def color_dist(a, b):
    return abs(int(a[0]) - int(b[0])) + abs(int(a[1]) - int(b[1])) + abs(int(a[2]) - int(b[2]))


def remove_background(src_path: Path, out_path: Path):
    img = Image.open(src_path).convert("RGBA")
    px = img.load()
    w, h = img.size

    # Use corner + edge samples as background seeds.
    seeds = [
        (0, 0), (w - 1, 0), (0, h - 1), (w - 1, h - 1),
        (1, 1), (w - 2, 1), (1, h - 2), (w - 2, h - 2),
        (w // 2, 0), (w // 2, h - 1), (0, h // 2), (w - 1, h // 2),
    ]
    bg_colors = [px[x, y] for x, y in seeds]

    visited = [[False] * h for _ in range(w)]
    q = deque(seeds)
    for x, y in seeds:
        visited[x][y] = True

    # Tolerance tuned for checker/white backgrounds but preserving chest edges.
    tol = 95

    while q:
        x, y = q.popleft()
        r, g, b, a = px[x, y]

        # If pixel is close to any sampled background color, mark transparent.
        if any(color_dist((r, g, b), (bc[0], bc[1], bc[2])) <= tol for bc in bg_colors):
            px[x, y] = (r, g, b, 0)
            for nx, ny in ((x + 1, y), (x - 1, y), (x, y + 1), (x, y - 1)):
                if 0 <= nx < w and 0 <= ny < h and not visited[nx][ny]:
                    visited[nx][ny] = True
                    q.append((nx, ny))

    # Soft cleanup: make near-white fully transparent when they are almost isolated from alpha>0
    for x in range(w):
        for y in range(h):
            r, g, b, a = px[x, y]
            if a == 0:
                continue
            if r > 245 and g > 245 and b > 245:
                px[x, y] = (r, g, b, 0)

    bbox = img.getbbox()
    if bbox:
        img = img.crop(bbox)

    img.save(out_path)


if __name__ == "__main__":
    for src, out in FILES:
        src_path = ROOT / src
        out_path = ROOT / out
        remove_background(src_path, out_path)
        print(f"saved: {out_path}")
