import csv
import shutil
from pathlib import Path


SITE_ROOT = Path(__file__).resolve().parents[1]
PROJECT_ROOT = SITE_ROOT.parent
NORMALIZED = PROJECT_ROOT / "data" / "normalized"
LOCAL_IMAGES = PROJECT_ROOT / "Изображения"
PRODUCTS_CSV = SITE_ROOT / "data" / "products.csv"
IMAGE_SOURCES_CSV = SITE_ROOT / "data" / "plant-image-sources.csv"
PUBLIC_LOCAL_IMAGES = SITE_ROOT / "public" / "images" / "plants" / "local"

POPPY_ID = "PLANT-0057"
FORMAT_KEYWORDS = (
    "v-120",
    "v 120",
    "p9",
    "p11",
    "р9",
    "р11",
    "горщик",
    "горш",
    "касет",
    "касс",
    "hiko",
)


def read_csv(path):
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        return list(csv.DictReader(handle))


def write_csv(path, rows, fieldnames):
    with path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(handle, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(rows)


def first_active_price(prices, plant_id):
    for row in prices:
        if row["plant_id"] == plant_id and row["status"] == "active" and row["price_per_plant"].strip():
            return row["price_per_plant"].strip()
    raise RuntimeError(f"Missing active price for {plant_id}")


def copy_image(source, target_name):
    if not source.exists():
        raise RuntimeError(f"Missing local image: {source}")
    PUBLIC_LOCAL_IMAGES.mkdir(parents=True, exist_ok=True)
    target = PUBLIC_LOCAL_IMAGES / target_name
    shutil.copy2(source, target)
    return f"/images/plants/local/{target_name}"


def split_images(value):
    return [part.strip() for part in (value or "").replace("|", ";").split(";") if part.strip()]


def join_images(paths):
    deduped = []
    for path in paths:
        if path and path not in deduped:
            deduped.append(path)
    return "; ".join(deduped)


def is_format_photo_text(value):
    text = (value or "").lower()
    return any(keyword in text for keyword in FORMAT_KEYWORDS)


def kyiv_winter_text(winter_hardy):
    text = (winter_hardy or "").lower()
    if "3" in text or "4" in text or "5" in text:
        return "Зимостійка в умовах Києва, рівень високий."
    return "Зимостійкість в умовах Києва потребує уточнення."


def source_join(desc_row, winter_row):
    names = []
    urls = []
    for key, name in [
        ("taxonomy_source", "Plants of the World Online / Kew"),
        ("horticulture_source_rhs_search", "Royal Horticultural Society"),
        ("horticulture_source_nc_state_search", "NC State Extension Gardener Plant Toolbox"),
        ("horticulture_source_mobot_search", "Missouri Botanical Garden"),
    ]:
        value = desc_row.get(key, "").strip()
        if value:
            names.append(name)
            urls.append(value)
    if winter_row:
        if winter_row.get("source_name"):
            names.append(winter_row["source_name"])
        if winter_row.get("source_urls"):
            urls.extend(part.strip() for part in winter_row["source_urls"].split(";") if part.strip())
    return "; ".join(dict.fromkeys(names)), "; ".join(dict.fromkeys(urls))


def image_source_row(plant_id, image_path, source_path, title, reviewed_status):
    return {
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
        "reviewed_status": reviewed_status,
    }


def build_poppy_row(product_fields):
    plants = {row["plant_id"]: row for row in read_csv(NORMALIZED / "Plants.csv")}
    cards = {row["plant_id"]: row for row in read_csv(NORMALIZED / "PlantCards_Gate1.csv")}
    prices = read_csv(NORMALIZED / "PriceHistory.csv")
    desc_sources = {
        row["plant_id"]: row for row in read_csv(NORMALIZED / "PlantDescriptionSources_2026-05-31.csv")
    }
    winter_sources = {
        row["plant_id"]: row for row in read_csv(NORMALIZED / "PlantWinterHardinessSources_2026-06-07.csv")
    }

    plant = plants[POPPY_ID]
    card = cards[POPPY_ID]
    price = first_active_price(prices, POPPY_ID)
    winter = kyiv_winter_text(card.get("winter_hardy") or plant.get("winter_hardy"))
    source_names, source_urls = source_join(desc_sources.get(POPPY_ID, {}), winter_sources.get(POPPY_ID))
    summary = (
        "Декоративний багаторічний мак із великими червоними квітками для сонячних квітників, "
        "натуралістичних посадок і яскравих сезонних акцентів. Після цвітіння надземна частина може "
        f"втрачати декоративність, тому його краще поєднувати з пізнішими багаторічниками. {winter}"
    )
    ecology = (
        "Papaver orientale найкраще росте на відкритому сонці, у легкому або середньому добре "
        "дренованому грунті без застою води. Рослина формує прикореневу розетку і виразні квітконоси, "
        "після весняно-літнього цвітіння може переходити у період спокою, тому в композиціях потребує "
        f"сусідів, які закривають порожнє місце пізніше в сезоні. {winter}"
    )
    agro = (
        "Висаджують без заглиблення кореневої шийки, після посадки підтримують помірну вологість до "
        "вкорінення. Надалі культура не любить перезволоження і важкі замоклі грунти. Для охайного "
        "вигляду після цвітіння прибирають відцвілі квітконоси, а пересадки дорослих рослин краще "
        "уникати без потреби."
    )
    use = (
        "Господарське застосування: весняно-літній акцент у квітниках, природних посадках, міксбордерах "
        "і сонячних декоративних групах. Добре працює як помітна багаторічна культура для клієнтів, які "
        "шукають виразне цвітіння без публікації точного складського залишку."
    )
    image_paths = [
        copy_image(LOCAL_IMAGES / "Мак східний червоний.jpg", "plant-0057-local-01.jpg"),
        copy_image(LOCAL_IMAGES / "Мак східний червоний V-120.jpg", "plant-0057-local-format-01.jpg"),
    ]
    row = {
        "plant_id": POPPY_ID,
        "name_uk": plant["name_uk"],
        "latin_name": plant["latin_name"],
        "category": "Декоративні багаторічники",
        "container": "Касета Hiko V-120ss",
        "price_uah": price,
        "unit": "шт.",
        "availability_status": "ready_for_sale",
        "summary": summary,
        "ecology_text": ecology,
        "agrotechnics_text": agro,
        "use_text": use,
        "full_description": f"{ecology} {agro} {use}",
        "content_status": "source_backed_species_draft",
        "source_names": source_names,
        "source_urls": source_urls,
        "source_confidence": winter_sources.get(POPPY_ID, {}).get("confidence", "high"),
        "source_note": desc_sources.get(POPPY_ID, {}).get("notes", ""),
        "seo_title": f"{plant['name_uk']} - саджанці Flora & Aroma",
        "seo_description": (
            f"{plant['name_uk']} ({plant['latin_name']}). Касета Hiko V-120ss. "
            f"Ціна {price} UAH/шт. Наявність підтверджує оператор."
        ),
        "image_path": join_images(image_paths),
        "sun_exposure": "full_sun",
        "moisture": "dry;medium",
        "height_cm_min": "45",
        "height_cm_max": "90",
        "flowering_months": "05;06",
        "flower_color": "red",
        "winter_hardiness": card.get("winter_hardy") or plant.get("winter_hardy"),
        "use_cases": "ornamental;border;naturalistic",
        "spacing_cm": "40-60",
        "selection_tags": "sunny_site;low_maintenance;border_plants",
        "variant_containers": "Касета Hiko V-120ss",
        "variant_prices_uah": price,
        "variant_units": "шт.",
        "variant_labels": f"Касета Hiko V-120ss — {price} UAH/шт.",
        "price_rule": "",
    }
    return {field: row.get(field, "") for field in product_fields}, [
        image_source_row(
            POPPY_ID,
            image_paths[0],
            LOCAL_IMAGES / "Мак східний червоний.jpg",
            "Мак східний червоний",
            "operator_selected_for_storefront",
        ),
        image_source_row(
            POPPY_ID,
            image_paths[1],
            LOCAL_IMAGES / "Мак східний червоний V-120.jpg",
            "Мак східний червоний у касеті Hiko V-120ss",
            "container_photo_not_primary",
        ),
    ]


def add_format_gallery_photos(products, image_sources):
    photos = read_csv(NORMALIZED / "Photos.csv")
    product_by_id = {row["plant_id"]: row for row in products}
    existing_source_files = {
        row.get("source_file_url", "").strip() for row in image_sources if row.get("source_file_url", "").strip()
    }
    added = []

    counters = {}
    for row in products:
        counters[row["plant_id"]] = sum(
            1 for path in split_images(row.get("image_path")) if "-format-" in Path(path).name
        )

    for photo in photos:
        plant_id = photo.get("plant_id")
        if plant_id not in product_by_id:
            continue
        text = " ".join(
            [
                photo.get("file_name", ""),
                photo.get("file_path", ""),
                photo.get("original_file_path", ""),
                photo.get("photo_type", ""),
                photo.get("notes", ""),
            ]
        )
        if not is_format_photo_text(text):
            continue
        source = Path(photo.get("file_path") or photo.get("original_file_path") or "")
        if not source.exists() or source.suffix.lower() not in {".jpg", ".jpeg", ".png", ".webp"}:
            continue
        if str(source) in existing_source_files:
            continue

        counters[plant_id] += 1
        target_name = f"{plant_id.lower()}-format-{counters[plant_id]:02d}{source.suffix.lower()}"
        image_path = copy_image(source, target_name)
        paths = split_images(product_by_id[plant_id].get("image_path"))
        if image_path not in paths:
            paths.append(image_path)
            product_by_id[plant_id]["image_path"] = join_images(paths)
        image_sources.append(
            image_source_row(
                plant_id,
                image_path,
                source,
                f"{product_by_id[plant_id]['name_uk']} - формат вирощування",
                "container_photo_not_primary",
            )
        )
        existing_source_files.add(str(source))
        added.append((plant_id, product_by_id[plant_id]["name_uk"], source.name))

    return added


def reorder_container_photos(products, image_sources):
    container_blocked = {
        row["image_path"] for row in image_sources if row.get("reviewed_status") == "container_photo_not_primary"
    }
    for product in products:
        paths = split_images(product.get("image_path"))
        normal = [path for path in paths if path not in container_blocked and not is_format_photo_text(path)]
        container = [path for path in paths if path in container_blocked or is_format_photo_text(path)]
        product["image_path"] = join_images(normal + container)


def main():
    products = read_csv(PRODUCTS_CSV)
    product_fields = list(products[0].keys())
    image_sources = read_csv(IMAGE_SOURCES_CSV)
    image_fields = list(image_sources[0].keys())

    products = [row for row in products if row["plant_id"] != POPPY_ID]
    image_sources = [row for row in image_sources if row["plant_id"] != POPPY_ID]

    poppy_row, poppy_sources = build_poppy_row(product_fields)
    products.append(poppy_row)
    image_sources.extend(poppy_sources)

    added_format_photos = add_format_gallery_photos(products, image_sources)
    reorder_container_photos(products, image_sources)
    products.sort(key=lambda row: row["name_uk"].lower())

    write_csv(PRODUCTS_CSV, products, product_fields)
    write_csv(IMAGE_SOURCES_CSV, image_sources, image_fields)

    print(f"products={len(products)}")
    print(f"added_product={POPPY_ID}")
    print(f"added_format_photos={len(added_format_photos)}")
    for item in added_format_photos:
        print("format_photo:", item[0], item[1], item[2])


if __name__ == "__main__":
    main()
