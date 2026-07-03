import csv
import shutil
from pathlib import Path

from PIL import Image, ImageOps


SITE_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = SITE_ROOT.parent
LOCAL_IMAGES = PROJECT_ROOT / "Изображения"
ATTACHMENTS = (
    PROJECT_ROOT
    / ".codex-remote-attachments"
    / "019e8f18-cef9-7783-a869-6e6865f20c2a"
    / "5a10a05e-cfd4-413b-8844-2b06741e09d7"
)
PRODUCTS_CSV = SITE_ROOT / "data" / "products.csv"
IMAGE_SOURCES_CSV = SITE_ROOT / "data" / "plant-image-sources.csv"
PUBLIC_LOCAL = SITE_ROOT / "public" / "images" / "plants" / "local"


V120_MAP = {
    "PLANT-0084": "Агастахе фенхельне V-120.jpg",
    "PLANT-0064": "Волошка синя V-120.jpg",
    "PLANT-0004": "Гвоздика бородата V-120.jpg",
    "PLANT-0014": "Котівник котячий V-120.jpg",
    "PLANT-0055": "Лаванда широколиста V-120-2.jpg",
    "PLANT-0027": "Левиний зів V-120.jpg",
    "PLANT-0037": "Мята гірська V-120.jpg",
    "PLANT-0044": "Майоран садовий V-120.jpg",
    "PLANT-0081": "Мята перцева V-120.jpg",
    "PLANT-0066": "Розмарин лікарський V-120.jpg",
    "PLANT-0074": "Рута запашна V-120.jpg",
}

POPPY_GALLERY = [
    ("1-Photo-1.jpg", "plant-0057-local-gallery-01.jpg"),
    ("2-Photo-2.jpg", "plant-0057-local-gallery-02.jpg"),
]


def read_csv(path):
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def write_csv(path, rows, fieldnames):
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def split_paths(value):
    return [part.strip() for part in (value or "").replace("|", ";").split(";") if part.strip()]


def join_paths(paths):
    result = []
    for path in paths:
        if path and path not in result:
            result.append(path)
    return "; ".join(result)


def optimize_image(source, target):
    PUBLIC_LOCAL.mkdir(parents=True, exist_ok=True)
    with Image.open(source) as image:
        image = ImageOps.exif_transpose(image)
        image.thumbnail((1600, 1600), Image.Resampling.LANCZOS)
        if image.mode not in ("RGB", "L"):
            image = image.convert("RGB")
        image.save(target, "JPEG", quality=84, optimize=True, progressive=True)


def ensure_source_row(image_sources, fieldnames, plant_id, image_path, source_path, title, status):
    key = (plant_id, image_path)
    for row in image_sources:
        if (row.get("plant_id"), row.get("image_path")) == key:
            row["reviewed_status"] = status
            row["source"] = "Local Flora image folder"
            row["source_page"] = str(source_path)
            row["source_file_url"] = str(source_path)
            row["title"] = title
            row["author"] = "Flora & Aroma local file"
            row["license"] = "local_review_needed"
            return

    row = {field: "" for field in fieldnames}
    row.update(
        {
            "plant_id": plant_id,
            "image_path": image_path,
            "source": "Local Flora image folder",
            "source_page": str(source_path),
            "source_file_url": str(source_path),
            "downloaded_file_url": "",
            "title": title,
            "author": "Flora & Aroma local file",
            "license": "local_review_needed",
            "license_url": "",
            "reviewed_status": status,
        }
    )
    image_sources.append(row)


def add_non_primary_paths(product, new_gallery_paths, new_format_paths):
    paths = split_paths(product.get("image_path"))
    format_existing = [path for path in paths if "format" in Path(path).name.lower()]
    normal_existing = [path for path in paths if path not in format_existing]

    for path in new_gallery_paths:
        if path not in normal_existing:
            normal_existing.append(path)
    for path in new_format_paths:
        if path not in format_existing:
            format_existing.append(path)

    product["image_path"] = join_paths(normal_existing + format_existing)


def is_container_path(path, container_paths):
    name = Path(path).name.lower()
    return path in container_paths or "format" in name or "v-120" in path.lower() or "v120" in path.lower()


def normalize_gallery_order(product, container_paths):
    paths = split_paths(product.get("image_path"))
    if not paths:
        return

    unique_paths = []
    for path in paths:
        if path not in unique_paths:
            unique_paths.append(path)

    containers = [path for path in unique_paths if is_container_path(path, container_paths)]
    normal = [path for path in unique_paths if path not in containers]

    if not containers:
        product["image_path"] = join_paths(unique_paths)
        return

    selected_container = containers[0]
    if normal:
        product["image_path"] = join_paths([normal[0], selected_container, *normal[1:]])
    else:
        product["image_path"] = selected_container


def main():
    products = read_csv(PRODUCTS_CSV)
    image_sources = read_csv(IMAGE_SOURCES_CSV)
    product_fields = list(products[0].keys())
    image_fields = list(image_sources[0].keys())
    product_by_id = {row["plant_id"]: row for row in products}

    added_v120 = []
    skipped_v120 = []
    for plant_id, source_name in V120_MAP.items():
        product = product_by_id.get(plant_id)
        source = LOCAL_IMAGES / source_name
        if not product or not source.exists():
            skipped_v120.append((plant_id, source_name))
            continue
        public_name = f"{plant_id.lower()}-format-01.jpg"
        target = PUBLIC_LOCAL / public_name
        image_path = f"/images/plants/local/{public_name}"
        optimize_image(source, target)
        add_non_primary_paths(product, [], [image_path])
        ensure_source_row(
            image_sources,
            image_fields,
            plant_id,
            image_path,
            source,
            f"{product['name_uk']} - касета Hiko V-120ss",
            "container_photo_not_primary",
        )
        added_v120.append((plant_id, product["name_uk"], source_name, image_path))

    poppy = product_by_id.get("PLANT-0057")
    added_poppy = []
    if poppy:
        new_paths = []
        for source_name, public_name in POPPY_GALLERY:
            source = ATTACHMENTS / source_name
            if not source.exists():
                continue
            target = PUBLIC_LOCAL / public_name
            image_path = f"/images/plants/local/{public_name}"
            optimize_image(source, target)
            new_paths.append(image_path)
            ensure_source_row(
                image_sources,
                image_fields,
                "PLANT-0057",
                image_path,
                source,
                "Мак східний червоний - додаткове фото цвітіння",
                "operator_selected_for_storefront",
            )
            added_poppy.append((source_name, image_path))
        add_non_primary_paths(poppy, new_paths, [])

    container_paths = {
        row.get("image_path", "").strip()
        for row in image_sources
        if row.get("reviewed_status") == "container_photo_not_primary" and row.get("image_path", "").strip()
    }
    for product in products:
        normalize_gallery_order(product, container_paths)

    write_csv(PRODUCTS_CSV, products, product_fields)
    write_csv(IMAGE_SOURCES_CSV, image_sources, image_fields)

    print(f"added_v120={len(added_v120)}")
    for item in added_v120:
        print("v120", item)
    print(f"skipped_v120={len(skipped_v120)}")
    for item in skipped_v120:
        print("skip", item)
    print(f"added_poppy={len(added_poppy)}")
    for item in added_poppy:
        print("poppy", item)


if __name__ == "__main__":
    main()
