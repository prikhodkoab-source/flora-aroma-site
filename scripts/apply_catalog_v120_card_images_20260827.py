from __future__ import annotations

import csv
import hashlib
from io import StringIO
from pathlib import Path

from PIL import Image


SITE = Path(__file__).resolve().parents[1]
PRODUCTS = SITE / "data" / "products.csv"
IMAGE_SOURCES = SITE / "data" / "plant-image-sources.csv"

GALLERIES = {
    "PLANT-0032": (
        "/images/plants/plant-0032-local-review.jpg",
        "/images/plants/local/plant-0032-format-01.jpg",
        "/images/plants/local/plant-0032-local-01.jpg",
        "/images/plants/local/plant-0032-card-01.png",
    ),
    "PLANT-0091": (
        "/images/plants/local/plant-0091-local-01.jpg",
        "/images/plants/local/plant-0091-format-01-v2.jpg",
        "/images/plants/local/plant-0091-local-02.jpg",
        "/images/plants/local/plant-0091-card-01.png",
    ),
    "PLANT-0092": (
        "/images/plants/local/plant-0092-local-01.jpg",
        "/images/plants/local/plant-0092-format-01-v2.jpg",
        "/images/plants/local/plant-0092-local-02.jpg",
        "/images/plants/local/plant-0092-card-01.png",
    ),
    "PLANT-0096": (
        "/images/plants/local/plant-0096-local-gallery-01.jpg",
        "/images/plants/local/plant-0096-format-01-v2.jpg",
        "/images/plants/local/plant-0096-local-gallery-02.jpg",
        "/images/plants/local/plant-0096-card-01.png",
    ),
    "PLANT-0097": (
        "/images/plants/local/plant-0097-local-gallery-01.jpg",
        "/images/plants/local/plant-0097-format-01-v2.jpg",
        "/images/plants/local/plant-0097-card-01.png",
    ),
    "PLANT-0099": (
        "/images/plants/local/plant-0099-local-gallery-01.jpg",
        "/images/plants/local/plant-0099-format-01-v2.jpg",
        "/images/plants/local/plant-0099-local-gallery-02.jpg",
        "/images/plants/local/plant-0099-card-01.png",
    ),
}

NEW_IMAGES = (
    ("PLANT-0091", "plant-0091-format-01-v2.jpg", "Изображения/Котівник гроновидний 'Felix' V-120.jpg", "Котівник гроновидний 'Felix' — формат V-120", "4571BC38042211D2B6ADE138B232E4E0EC355A1698A9FCC7F1A380019AEB2E1C", "container_photo_operator_approved_2026-08-27"),
    ("PLANT-0092", "plant-0092-format-01-v2.jpg", "Изображения/Котівник гроновидний 'Alba' V-120.jpg", "Котівник гроновидний 'Alba' — формат V-120", "93214D043265E16675DE3C082B883FF99D4BF994A12E5EBA033BD34280CECA32", "container_photo_operator_approved_2026-08-27"),
    ("PLANT-0096", "plant-0096-format-01-v2.jpg", "Изображения/Шавлія дібровна ‘Rosakönigin’ V-120.jpg", "Шавлія дібровна 'Rosakönigin' — формат V-120", "694FE46E46804D778E2AE13498E2DFF0765D33D81E9CDD73F8A21B839203C82C", "container_photo_operator_approved_2026-08-27"),
    ("PLANT-0097", "plant-0097-format-01-v2.jpg", "Изображения/Шавлія дібровна ‘Blaukönigin’ V-120.jpg", "Шавлія дібровна 'Blaukönigin' — формат V-120", "4A74DB6D91E65D4AECE4CED0A26E9BD2A5F29C93000EECEDB862E3D6B20A03C2", "container_photo_operator_approved_2026-08-27"),
    ("PLANT-0099", "plant-0099-format-01-v2.jpg", "Изображения/Шавлія лікарська Purpurascens V-120.jpg", "Шавлія лікарська 'Purpurascens' — формат V-120", "FD54A18B5A63DA8AEB09840354D71CCCB884303C9B3DDC264015AF79F2D13AB6", "container_photo_operator_approved_2026-08-27"),
    ("PLANT-0032", "plant-0032-card-01.png", "Изображения/Картки рослин/Сосна звичайна.png", "Сосна звичайна — картка рослини", "45BCB579BBFC3B5CD31462A51E19D458DE497A06D3210D56FB668F4E90C1ADAB", "operator_approved_for_storefront_2026-08-27"),
    ("PLANT-0091", "plant-0091-card-01.png", "Изображения/Картки рослин/Котівник гроновидний 'Felix'.png", "Котівник гроновидний 'Felix' — картка рослини", "8FA5DF82A3533BE1A77482FBB3A1196746DEE75371E7508AD3179B71484D8AF2", "operator_approved_for_storefront_2026-08-27"),
    ("PLANT-0092", "plant-0092-card-01.png", "Изображения/Картки рослин/Котівник гроновидний 'Alba'.png", "Котівник гроновидний 'Alba' — картка рослини", "603315C4E8C5DFCF0E7D4D321A1FA6933745286AFDCB939B2BC7BF8657CA3E8F", "operator_approved_for_storefront_2026-08-27"),
    ("PLANT-0096", "plant-0096-card-01.png", "Изображения/Картки рослин/Шавлія дібровна ‘Rosakönigin’.png", "Шавлія дібровна 'Rosakönigin' — картка рослини", "DA36267E47BBABD836A5C2DB8E9A2049FEE017AE2F78787A0DB00F802253E272", "operator_approved_for_storefront_2026-08-27"),
    ("PLANT-0097", "plant-0097-card-01.png", "Изображения/Картки рослин/Шавлія дібровна ‘Blaukönigin’.png", "Шавлія дібровна 'Blaukönigin' — картка рослини", "C471088A4033B22DFA122FAEE115CA0F8CE4BE1C2F2BE1642038458B4DD56034", "operator_approved_for_storefront_2026-08-27"),
    ("PLANT-0099", "plant-0099-card-01.png", "Изображения/Картки рослин/Шавлія лікарська Purpurascens.png", "Шавлія лікарська 'Purpurascens' — картка рослини", "77545E7D5AB62420A6022F740BD46CD85D8EE61E5A2D7ED6D951C3598273410D", "operator_approved_for_storefront_2026-08-27"),
)

V120_DIMENSIONS = {
    "plant-0091-format-01-v2.jpg": (1200, 1600),
    "plant-0092-format-01-v2.jpg": (1200, 1600),
    "plant-0096-format-01-v2.jpg": (1200, 1600),
    "plant-0097-format-01-v2.jpg": (1200, 1600),
    "plant-0099-format-01-v2.jpg": (1200, 1600),
}

LEGACY_V120_PATHS = {
    "/images/plants/local/plant-0091-format-01.jpg",
    "/images/plants/local/plant-0092-format-01.jpg",
    "/images/plants/local/plant-0096-format-01.jpg",
    "/images/plants/local/plant-0097-format-01.jpg",
    "/images/plants/local/plant-0099-format-01.jpg",
}


def read_csv(path: Path) -> tuple[list[str], list[dict[str, str]]]:
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        return list(reader.fieldnames or []), list(reader)


def write_csv(path: Path, fields: list[str], rows: list[dict[str, str]]) -> bool:
    buffer = StringIO(newline="")
    writer = csv.DictWriter(buffer, fieldnames=fields, lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
    content = buffer.getvalue().encode("utf-8")
    if path.read_bytes() == content:
        return False
    path.write_bytes(content)
    return True


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()


def main() -> None:
    product_fields, products = read_csv(PRODUCTS)
    found = set()
    for row in products:
        plant_id = row.get("plant_id", "")
        if plant_id in GALLERIES:
            row["image_path"] = "; ".join(GALLERIES[plant_id])
            found.add(plant_id)
    missing = set(GALLERIES) - found
    if missing:
        raise RuntimeError(f"Missing products: {sorted(missing)}")

    source_fields, source_rows = read_csv(IMAGE_SOURCES)
    new_paths = {f"/images/plants/local/{item[1]}" for item in NEW_IMAGES}
    excluded_paths = new_paths | LEGACY_V120_PATHS
    source_rows = [
        row for row in source_rows if row.get("image_path") not in excluded_paths
    ]

    for plant_id, target_name, source_path, title, expected_hash, status in NEW_IMAGES:
        target = SITE / "public" / "images" / "plants" / "local" / target_name
        if not target.is_file():
            raise FileNotFoundError(target)
        actual_hash = sha256(target)
        if actual_hash != expected_hash:
            raise RuntimeError(f"Unexpected hash for {target_name}: {actual_hash}")
        expected_dimensions = V120_DIMENSIONS.get(target_name)
        if expected_dimensions:
            with Image.open(target) as image:
                if image.size != expected_dimensions:
                    raise RuntimeError(
                        f"Unexpected dimensions for {target_name}: {image.size}"
                    )
        source_rows.append(
            {
                "plant_id": plant_id,
                "image_path": f"/images/plants/local/{target_name}",
                "source": "Local Flora image folder",
                "source_page": source_path,
                "source_file_url": source_path,
                "downloaded_file_url": "",
                "title": title,
                "author": "Flora & Aroma local file",
                "license": "operator_approved_repository_site",
                "license_url": "",
                "reviewed_status": status,
            }
        )

    products_changed = write_csv(PRODUCTS, product_fields, products)
    sources_changed = write_csv(IMAGE_SOURCES, source_fields, source_rows)
    print(f"PRODUCTS_CHANGED={str(products_changed).lower()}")
    print(f"IMAGE_SOURCES_CHANGED={str(sources_changed).lower()}")
    print(f"UPDATED_PLANTS={','.join(sorted(GALLERIES))}")


if __name__ == "__main__":
    main()
