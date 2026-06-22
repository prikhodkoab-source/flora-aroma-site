from __future__ import annotations

import csv
import re
import shutil
import subprocess
from io import StringIO
from pathlib import Path


SITE = Path(__file__).resolve().parents[1]
ROOT = SITE.parent
CARDS = ROOT / "data" / "normalized" / "PlantCards_Gate1.csv"
PRODUCTS = SITE / "data" / "products.csv"
PUBLIC_LOCAL = SITE / "public" / "images" / "plants" / "local"
RUTA_FILES = [
    ("Рута запашна-1.jpg", "plant-0074-local-gallery-01.jpg"),
    ("рута запашна-4.jpg", "plant-0074-local-gallery-02.jpg"),
    ("Рута запашна.jpg", "plant-0074-local-gallery-03.jpg"),
]
ECHIUM_FILES = [
    ("Ехіум червоний.jpg", "plant-0045-local-gallery-01.jpg"),
    ("Ехіум червоний V-120.jpg", "plant-0045-local-gallery-02.jpg"),
]


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def kyiv_sentence(value: str) -> str:
    normalized = value.casefold()
    if "однорічник" in normalized:
        return "У Києві вирощується як однорічна культура і не зимує у відкритому ґрунті."
    minimum_match = re.search(r"(\d+)", value)
    if not minimum_match:
        return "Зимостійкість в умовах Києва потребує уточнення."
    minimum_zone = int(minimum_match.group(1))
    if minimum_zone <= 5:
        level = "високий" if minimum_zone <= 4 else "достатній"
        return f"Зимостійка в умовах Києва, рівень {level}."
    if minimum_zone <= 7:
        return "Не має надійної зимостійкості у відкритому ґрунті в умовах Києва; рівень низький, потрібне зимове укриття."
    return (
        "Не зимостійка у відкритому ґрунті в умовах Києва; "
        "потрібна захищена зимівля."
    )


def localize_text(
    text: str,
    old_summary: str,
    new_summary: str,
    winter_hardy: str,
) -> str:
    result = text.replace(old_summary, new_summary)
    return replace_winter_sentence(result, winter_hardy)


def replace_winter_sentence(text: str, winter_hardy: str) -> str:
    cleaned = re.sub(
        r"\s*(?:"
        r"Зимостійкість:\s*USDA[^.]*\.?|"
        r"Добре зимує в умовах Києва\s*\(USDA[^)]*\)\.|"
        r"У Києві вирощується як однорічна культура\s*\(USDA[^)]*\)\.|"
        r"Зимує в умовах Києва[^.]*\(USDA[^)]*\)\.|"
        r"Зимівля у відкритому ґрунті[^.]*\(USDA[^)]*\)\.|"
        r"Не зимує у відкритому ґрунті[^.]*\(USDA[^)]*\)\."
        r")",
        " ",
        text.strip(),
        flags=re.IGNORECASE,
    )
    cleaned = re.sub(
        r"\s+(?:"
        r"Зимостійкість:.*|"
        r"Добре зимує в умовах Києва.*|"
        r"У Києві вирощується.*|"
        r"Зимівля у відкритому ґрунті.*|"
        r"Не зимує у відкритому ґрунті.*|"
        r"Зимостійка в умовах Києва.*|"
        r"Не має надійної зимостійкості.*|"
        r"Не зимостійка у відкритому ґрунті.*"
        r")$",
        "",
        cleaned.strip(),
        flags=re.IGNORECASE,
    ).strip()
    return f"{cleaned} {kyiv_sentence(winter_hardy)}".strip()


def main() -> None:
    cards = {row["plant_id"]: row for row in read_csv(CARDS)}
    head_text = subprocess.check_output(
        [
            "git",
            "-c",
            f"safe.directory={SITE.as_posix()}",
            "show",
            "HEAD:data/products.csv",
        ],
        cwd=SITE,
        text=True,
        encoding="utf-8",
    )
    reader = csv.DictReader(StringIO(head_text))
    fields = list(reader.fieldnames or [])
    products = list(reader)

    for product in products:
        card = cards.get(product["plant_id"])
        if not card:
            continue
        old_summary = product.get("summary", "")
        new_summary = card["client_description"]
        winter_hardy = card["winter_hardy"]
        product["summary"] = replace_winter_sentence(
            new_summary,
            winter_hardy,
        )
        for field in ("ecology_text", "full_description"):
            product[field] = localize_text(
                product.get(field, ""),
                old_summary,
                new_summary,
                winter_hardy,
            )

    PUBLIC_LOCAL.mkdir(parents=True, exist_ok=True)
    def copy_gallery(files: list[tuple[str, str]]) -> list[str]:
        paths: list[str] = []
        for source_name, target_name in files:
            source = ROOT / "Изображения" / source_name
            target = PUBLIC_LOCAL / target_name
            if not source.is_file():
                raise RuntimeError(f"missing_gallery_source:{source}")
            shutil.copy2(source, target)
            paths.append(f"/images/plants/local/{target_name}")
        return paths

    ruta_paths = copy_gallery(RUTA_FILES)
    ruta = next(row for row in products if row["plant_id"] == "PLANT-0074")
    ruta["image_path"] = "; ".join(
        [*ruta_paths, "/images/plants/plant-0074-commons.jpg"]
    )

    echium_paths = copy_gallery(ECHIUM_FILES)
    echium = next(row for row in products if row["plant_id"] == "PLANT-0045")
    echium["image_path"] = "; ".join(
        [echium_paths[0], "/images/plants/plant-0045.webp", echium_paths[1]]
    )

    with PRODUCTS.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fields, lineterminator="\n")
        writer.writeheader()
        writer.writerows(products)

    print(f"products={len(products)}")
    print("kyiv_card_copy_synced=yes")
    print("ruta_local_gallery=3")
    print("echium_local_gallery=2")
    print("prices_changed=no")


if __name__ == "__main__":
    main()
