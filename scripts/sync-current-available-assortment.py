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

REMOVE_UNAVAILABLE = {"PLANT-0085", "PLANT-0087"}
ADD_AVAILABLE = {"PLANT-0035", "PLANT-0067"}


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
            return row
    raise RuntimeError(f"Missing active price for {plant_id}")


def stock_ready_qty(stock, plant_id):
    total = 0.0
    for row in stock:
        if row["plant_id"] != plant_id or row["stage"] != "ready_for_sale":
            continue
        try:
            total += float(row["available_plants_qty"] or 0)
        except ValueError:
            pass
    return total


def kyiv_winter_text(winter_hardy):
    text = (winter_hardy or "").strip().lower()
    if not text:
        return "Зимостійкість в умовах Києва потребує уточнення."
    if "annual" in text or "одноріч" in text:
        return "У Києві вирощується як однорічна культура і не зимує у відкритому ґрунті."
    digits = "".join(ch if ch.isdigit() else " " for ch in winter_hardy).split()
    if not digits:
        return "Зимостійкість в умовах Києва потребує уточнення."
    zone = int(digits[0])
    if zone <= 5:
        level = "високий" if zone <= 4 else "достатній"
        return f"Зимостійка в умовах Києва, рівень {level}."
    if zone <= 7:
        return "Не має надійної зимостійкості у відкритому ґрунті в умовах Києва; рівень низький, потрібне зимове укриття."
    return "Не зимостійка у відкритому ґрунті в умовах Києва; потрібна захищена зимівля."


def copy_local_image(source_name, target_name):
    source = LOCAL_IMAGES / source_name
    if not source.exists():
        raise RuntimeError(f"Missing local image: {source}")
    PUBLIC_LOCAL_IMAGES.mkdir(parents=True, exist_ok=True)
    target = PUBLIC_LOCAL_IMAGES / target_name
    shutil.copy2(source, target)
    return f"/images/plants/local/{target_name}", str(source)


def source_join(row, winter_row):
    names = []
    urls = []
    for key, name in [
        ("taxonomy_source", "Plants of the World Online / Kew"),
        ("horticulture_source_rhs_search", "Royal Horticultural Society"),
        ("horticulture_source_nc_state_search", "NC State Extension Gardener Plant Toolbox"),
        ("horticulture_source_mobot_search", "Missouri Botanical Garden"),
    ]:
        value = row.get(key, "").strip()
        if value:
            names.append(name)
            urls.append(value)
    if winter_row:
        if winter_row.get("source_name") and winter_row["source_name"] not in "; ".join(names):
            names.append(winter_row["source_name"])
        if winter_row.get("source_urls"):
            urls.extend([part.strip() for part in winter_row["source_urls"].split(";") if part.strip()])
    return "; ".join(dict.fromkeys(names)), "; ".join(dict.fromkeys(urls))


def product_rows():
    plants = {row["plant_id"]: row for row in read_csv(NORMALIZED / "Plants.csv")}
    cards = {row["plant_id"]: row for row in read_csv(NORMALIZED / "PlantCards_Gate1.csv")}
    prices = read_csv(NORMALIZED / "PriceHistory.csv")
    stock = read_csv(NORMALIZED / "Stock_draft.csv")
    desc_sources = {row["plant_id"]: row for row in read_csv(NORMALIZED / "PlantDescriptionSources_2026-05-31.csv")}
    winter_sources = {row["plant_id"]: row for row in read_csv(NORMALIZED / "PlantWinterHardinessSources_2026-06-07.csv")}

    templates = {
        "PLANT-0035": {
            "category": "Декоративні багаторічники",
            "container": "Касета Hiko V-120ss",
            "summary": "Компактна розеткова багаторічна рослина з яскравим цвітінням для контейнерів, рокаріїв і альпінаріїв. Потребує дуже доброго дренажу та захисту від зимового перезволоження.",
            "ecology": "Lewisia cotyledon походить із умов, де ключовими для культури є сонце, повітропроникний мінеральний субстрат і відсутність застою води біля кореневої шийки. У саду найкраще працює в рокаріях, піднятих грядках, контейнерах і альпінаріях, де можна контролювати дренаж.",
            "agro": "Після висаджування підтримують помірну вологість тільки до вкорінення, далі полив має бути стриманим. Рослину не варто заглиблювати, а посадкове місце бажано робити з кам’янистим або піщаним дренажним шаром. Узимку головний ризик не мороз, а надлишкова волога.",
            "use": "Господарське застосування: невеликі декоративні партії для контейнерів, альпінаріїв, кам’янистих садів, переднього плану квітника і подарункових рослин. Добре продається як виразна компактна культура, але потребує чесного пояснення клієнту про дренаж.",
            "sun_exposure": "full_sun;part_sun",
            "moisture": "dry;medium",
            "height_cm_min": "10",
            "height_cm_max": "25",
            "flowering_months": "05;06;07;08",
            "flower_color": "mixed",
            "use_cases": "rock_garden;container;border;dry_site",
            "spacing_cm": "20-25",
            "selection_tags": "drought_tolerant;border_plants;low_maintenance",
            "images": [
                ("Левізія Elise mix 1.jpg", "plant-0035-local-01.jpg", "needs_operator_visual_review"),
                ("Левізія Elise mix 2.jpg", "plant-0035-local-02.jpg", "needs_operator_visual_review"),
                ("Левізія Elise mix 3.jpg", "plant-0035-local-03.jpg", "needs_operator_visual_review"),
                ("Левізія Elise mix.webp", "plant-0035-local-04.webp", "needs_operator_visual_review"),
            ],
        },
        "PLANT-0067": {
            "category": "Лікарські рослини",
            "container": "Касета Hiko V-120ss",
            "summary": "Ароматична багаторічна рослина з сріблясто-сірим листям і характерним гірким ароматом. Підходить для сухих сонячних ділянок, ароматичних посадок і натуралістичних квітників.",
            "ecology": "Artemisia absinthium добре переносить сонячні, сухіші та добре дреновані місця. Сіре опушене листя допомагає рослині витримувати спеку і короткочасну нестачу вологи, а на надто родючих або перезволожених ґрунтах кущ може втрачати щільність.",
            "agro": "Після висаджування полив потрібен до вкорінення, надалі культура краще реагує на помірно сухий режим, ніж на постійну вологу. Для охайності куща доречне легке формування та санітарне прибирання старих пагонів. Надмірне азотне живлення не бажане.",
            "use": "Господарське застосування: ароматичні й лікарські колекції, сріблястий акцент у сухих квітниках, натуралістичні композиції та посадки для сонячних місць. Лікарське використання згадується лише як довідкова властивість культури, без медичних рекомендацій.",
            "sun_exposure": "full_sun",
            "moisture": "dry;medium",
            "height_cm_min": "60",
            "height_cm_max": "100",
            "flowering_months": "07;08;09",
            "flower_color": "yellow",
            "use_cases": "medicinal;aromatic;dry_site;naturalistic",
            "spacing_cm": "45-60",
            "selection_tags": "aromatic_garden;drought_tolerant;low_maintenance",
            "images": [
                ("Полин гіркий фото 2026-06-29.jpg", "plant-0067-local-01.jpg", "operator_selected_for_storefront"),
                ("Полин гіркий фото додаткове 2026-06-29.jpg", "plant-0067-local-02.jpg", "operator_selected_for_storefront"),
            ],
        },
    }

    rows = {}
    image_source_rows = []
    for plant_id, template in templates.items():
        plant = plants[plant_id]
        card = cards[plant_id]
        price = first_active_price(prices, plant_id)
        if stock_ready_qty(stock, plant_id) <= 0:
            raise RuntimeError(f"{plant_id} is not currently available in Stock_draft.csv")

        image_paths = []
        for source_name, target_name, reviewed_status in template["images"]:
            public_path, source_path = copy_local_image(source_name, target_name)
            image_paths.append(public_path)
            image_source_rows.append(
                {
                    "plant_id": plant_id,
                    "image_path": public_path,
                    "source": "Local Flora image folder",
                    "source_page": source_path,
                    "source_file_url": source_path,
                    "downloaded_file_url": "",
                    "title": plant["name_uk"],
                    "author": "Flora & Aroma local file",
                    "license": "local_review_needed",
                    "license_url": "",
                    "reviewed_status": reviewed_status,
                }
            )

        source_names, source_urls = source_join(desc_sources.get(plant_id, {}), winter_sources.get(plant_id))
        winter = kyiv_winter_text(card["winter_hardy"] or plant["winter_hardy"])
        summary = f"{template['summary']} {winter}"
        ecology = f"{template['ecology']} {winter}"
        full_description = f"{ecology} {template['agro']} {template['use']}"
        price_uah = price["price_per_plant"].strip()

        rows[plant_id] = {
            "plant_id": plant_id,
            "name_uk": plant["name_uk"],
            "latin_name": plant["latin_name"],
            "category": template["category"],
            "container": template["container"],
            "price_uah": price_uah,
            "unit": "шт.",
            "availability_status": "ready_for_sale",
            "summary": summary,
            "ecology_text": ecology,
            "agrotechnics_text": template["agro"],
            "use_text": template["use"],
            "full_description": full_description,
            "content_status": "source_backed_species_draft" if plant_id == "PLANT-0035" else "source_backed_operator_approved",
            "source_names": source_names,
            "source_urls": source_urls,
            "source_confidence": winter_sources.get(plant_id, {}).get("confidence", "medium"),
            "source_note": desc_sources.get(plant_id, {}).get("notes", ""),
            "seo_title": f"{plant['name_uk']} - саджанці Flora & Aroma",
            "seo_description": f"{plant['name_uk']} ({plant['latin_name']}). {template['container']}. Ціна {price_uah} UAH/шт. Наявність підтверджує оператор.",
            "image_path": "; ".join(image_paths),
            "sun_exposure": template["sun_exposure"],
            "moisture": template["moisture"],
            "height_cm_min": template["height_cm_min"],
            "height_cm_max": template["height_cm_max"],
            "flowering_months": template["flowering_months"],
            "flower_color": template["flower_color"],
            "winter_hardiness": card["winter_hardy"] or plant["winter_hardy"],
            "use_cases": template["use_cases"],
            "spacing_cm": template["spacing_cm"],
            "selection_tags": template["selection_tags"],
            "variant_containers": template["container"],
            "variant_prices_uah": price_uah,
            "variant_units": "шт.",
            "variant_labels": f"{template['container']} — {price_uah} UAH/шт.",
            "price_rule": "",
        }

    return rows, image_source_rows


def main():
    products = read_csv(PRODUCTS_CSV)
    product_fields = list(products[0].keys())
    additions, image_additions = product_rows()

    kept = [row for row in products if row["plant_id"] not in REMOVE_UNAVAILABLE and row["plant_id"] not in ADD_AVAILABLE]
    kept.extend(additions[plant_id] for plant_id in sorted(ADD_AVAILABLE))
    kept.sort(key=lambda row: row["name_uk"].lower())
    write_csv(PRODUCTS_CSV, kept, product_fields)

    image_sources = read_csv(IMAGE_SOURCES_CSV)
    image_fields = list(image_sources[0].keys())
    replaced = ADD_AVAILABLE | REMOVE_UNAVAILABLE
    image_sources = [row for row in image_sources if row["plant_id"] not in replaced]
    image_sources.extend(image_additions)
    write_csv(IMAGE_SOURCES_CSV, image_sources, image_fields)

    print("Updated public assortment:")
    print("removed:", ", ".join(sorted(REMOVE_UNAVAILABLE)))
    print("added:", ", ".join(sorted(ADD_AVAILABLE)))
    print("products:", len(kept))


if __name__ == "__main__":
    main()
