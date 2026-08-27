from __future__ import annotations

import csv
import hashlib
from io import StringIO
from pathlib import Path


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
        "/images/plants/local/plant-0091-format-01.jpg",
        "/images/plants/local/plant-0091-local-02.jpg",
        "/images/plants/local/plant-0091-card-01.png",
    ),
    "PLANT-0092": (
        "/images/plants/local/plant-0092-local-01.jpg",
        "/images/plants/local/plant-0092-format-01.jpg",
        "/images/plants/local/plant-0092-local-02.jpg",
        "/images/plants/local/plant-0092-card-01.png",
    ),
    "PLANT-0096": (
        "/images/plants/local/plant-0096-local-gallery-01.jpg",
        "/images/plants/local/plant-0096-format-01.jpg",
        "/images/plants/local/plant-0096-local-gallery-02.jpg",
        "/images/plants/local/plant-0096-card-01.png",
    ),
    "PLANT-0097": (
        "/images/plants/local/plant-0097-local-gallery-01.jpg",
        "/images/plants/local/plant-0097-format-01.jpg",
        "/images/plants/local/plant-0097-card-01.png",
    ),
    "PLANT-0099": (
        "/images/plants/local/plant-0099-local-gallery-01.jpg",
        "/images/plants/local/plant-0099-format-01.jpg",
        "/images/plants/local/plant-0099-local-gallery-02.jpg",
        "/images/plants/local/plant-0099-card-01.png",
    ),
}

NEW_IMAGES = (
    ("PLANT-0091", "plant-0091-format-01.jpg", "Изображения/Котівник гроновидний 'Felix' V-120.jpg", "Котівник гроновидний 'Felix' — формат V-120", "F940E09B4361FF6C728E71D060680B92F0CE205243BFB8D5E978584ADD6CBB02", "container_photo_operator_approved_2026-08-27"),
    ("PLANT-0092", "plant-0092-format-01.jpg", "Изображения/Котівник гроновидний 'Alba' V-120.jpg", "Котівник гроновидний 'Alba' — формат V-120", "FE5DE5FDAD483CEC3DB3DE5CDAE74F854AEF8990A02B70FD6876979BD0E7A18A", "container_photo_operator_approved_2026-08-27"),
    ("PLANT-0096", "plant-0096-format-01.jpg", "Изображения/Шавлія дібровна ‘Rosakönigin’ V-120.jpg", "Шавлія дібровна 'Rosakönigin' — формат V-120", "D06237109576691900337A2FDD620ED3382EE43AF32CA011BFC87698DEB6DB29", "container_photo_operator_approved_2026-08-27"),
    ("PLANT-0097", "plant-0097-format-01.jpg", "Изображения/Шавлія дібровна ‘Blaukönigin’ V-120.jpg", "Шавлія дібровна 'Blaukönigin' — формат V-120", "68EE289A7B73C3DAFF1A5085C09C89C0E3809B2D7C8F452F3ABD63AE4D093DEC", "container_photo_operator_approved_2026-08-27"),
    ("PLANT-0099", "plant-0099-format-01.jpg", "Изображения/Шавлія лікарська Purpurascens V-120.jpg", "Шавлія лікарська 'Purpurascens' — формат V-120", "76CA7334D4215F89144149098CD2E79D294C0246C1AE425848F4229C8D70FD25", "container_photo_operator_approved_2026-08-27"),
    ("PLANT-0032", "plant-0032-card-01.png", "Изображения/Картки рослин/Сосна звичайна.png", "Сосна звичайна — картка рослини", "45BCB579BBFC3B5CD31462A51E19D458DE497A06D3210D56FB668F4E90C1ADAB", "operator_approved_for_storefront_2026-08-27"),
    ("PLANT-0091", "plant-0091-card-01.png", "Изображения/Картки рослин/Котівник гроновидний 'Felix'.png", "Котівник гроновидний 'Felix' — картка рослини", "8FA5DF82A3533BE1A77482FBB3A1196746DEE75371E7508AD3179B71484D8AF2", "operator_approved_for_storefront_2026-08-27"),
    ("PLANT-0092", "plant-0092-card-01.png", "Изображения/Картки рослин/Котівник гроновидний 'Alba'.png", "Котівник гроновидний 'Alba' — картка рослини", "603315C4E8C5DFCF0E7D4D321A1FA6933745286AFDCB939B2BC7BF8657CA3E8F", "operator_approved_for_storefront_2026-08-27"),
    ("PLANT-0096", "plant-0096-card-01.png", "Изображения/Картки рослин/Шавлія дібровна ‘Rosakönigin’.png", "Шавлія дібровна 'Rosakönigin' — картка рослини", "DA36267E47BBABD836A5C2DB8E9A2049FEE017AE2F78787A0DB00F802253E272", "operator_approved_for_storefront_2026-08-27"),
    ("PLANT-0097", "plant-0097-card-01.png", "Изображения/Картки рослин/Шавлія дібровна ‘Blaukönigin’.png", "Шавлія дібровна 'Blaukönigin' — картка рослини", "C471088A4033B22DFA122FAEE115CA0F8CE4BE1C2F2BE1642038458B4DD56034", "operator_approved_for_storefront_2026-08-27"),
    ("PLANT-0099", "plant-0099-card-01.png", "Изображения/Картки рослин/Шавлія лікарська Purpurascens.png", "Шавлія лікарська 'Purpurascens' — картка рослини", "77545E7D5AB62420A6022F740BD46CD85D8EE61E5A2D7ED6D951C3598273410D", "operator_approved_for_storefront_2026-08-27"),
)


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
    source_rows = [row for row in source_rows if row.get("image_path") not in new_paths]

    for plant_id, target_name, source_path, title, expected_hash, status in NEW_IMAGES:
        target = SITE / "public" / "images" / "plants" / "local" / target_name
        if not target.is_file():
            raise FileNotFoundError(target)
        actual_hash = sha256(target)
        if actual_hash != expected_hash:
            raise RuntimeError(f"Unexpected hash for {target_name}: {actual_hash}")
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
