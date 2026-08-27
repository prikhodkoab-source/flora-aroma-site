from __future__ import annotations

import csv
import hashlib
import shutil
from io import StringIO
from pathlib import Path


SITE = Path(__file__).resolve().parents[1]
ROOT = SITE.parent
PRODUCTS = SITE / "data" / "products.csv"
IMAGE_SOURCES = SITE / "data" / "plant-image-sources.csv"

APPROVED_IMAGES = (
    {
        "plant_id": "PLANT-0091",
        "source_name": "Котівник гроновидний 'Felix' 1.jpg",
        "target_name": "plant-0091-local-01.jpg",
        "expected_sha256": "6B12C7DA3EB3B765811EC35AEA56A5D5E862D6487DEE8D1CB6C0ECF1FE3CF62A",
        "title": "Котівник гроновидний 'Felix' — основне фото",
    },
    {
        "plant_id": "PLANT-0091",
        "source_name": "Котівник гроновидний 'Felix' 3.jpg",
        "target_name": "plant-0091-local-02.jpg",
        "expected_sha256": "58780AB68875804FB3B05E86A60ACFF7ED8269D92BFD2156E4A8FF1ED4264A4E",
        "title": "Котівник гроновидний 'Felix' — додаткове фото",
    },
    {
        "plant_id": "PLANT-0092",
        "source_name": "Котівник гроновидний 'Alba' 4.jpg",
        "target_name": "plant-0092-local-01.jpg",
        "expected_sha256": "3C3834FE64F30B1B0A55BA1D36BBA8E1AC344439AA678635CA78C8FFBFC22819",
        "title": "Котівник гроновидний 'Alba' — основне фото",
    },
    {
        "plant_id": "PLANT-0092",
        "source_name": "Котівник гроновидний 'Alba' 3.jpg",
        "target_name": "plant-0092-local-02.jpg",
        "expected_sha256": "EDA75622D4ED47EF766A8E72326291B8501C73DAC5E8D189238D291AF188FF8A",
        "title": "Котівник гроновидний 'Alba' — додаткове фото",
    },
)

PRODUCT_ROWS = (
    {
        "plant_id": "PLANT-0091",
        "name_uk": "Котівник гроновидний 'Felix'",
        "latin_name": "Nepeta racemosa 'Felix'",
        "category": "Декоративні багаторічники",
        "container": "CASSETTE-HIKO-V120SS",
        "price_uah": "35",
        "unit": "шт.",
        "availability_status": "contact_us",
        "summary": (
            "Низькорослий багаторічний котівник із глибокими лілово-синіми квітками "
            "та сизо-сірим ароматним листям. Формує рівномірний компактний "
            "столоноутворювальний покрив, рясно цвіте до заморозків і приваблює бджіл."
        ),
        "ecology_text": "Сонце або півтінь; сухий, добре дренований ґрунт середньої родючості.",
        "agrotechnics_text": (
            "Після висадки контролювати вологість до вкорінення; надалі полив "
            "коригувати за умовами ділянки. Фактичну готовність рослин підтверджує оператор."
        ),
        "use_text": (
            "Ґрунтопокривні посадки, передній план квітників, медоносні композиції "
            "та квітучі контейнери."
        ),
        "full_description": (
            "Котівник гроновидний 'Felix' (Nepeta racemosa 'Felix') — низькорослий "
            "багаторічний сорт із глибокими лілово-синіми квітками та сизо-сірим "
            "ароматним листям. Формує рівномірний компактний столоноутворювальний "
            "покрив заввишки близько 25 см, рясно квітує від травня до жовтня та "
            "приваблює бджіл. Найкраще розвивається на сонці або в півтіні, у сухому, "
            "добре дренованому ґрунті середньої родючості й не переносить тривалого "
            "застою води. Після висадки потребує контролю вологості до вкорінення; "
            "надалі полив коригують за умовами ділянки. Підходить для ґрунтопокривних "
            "посадок, переднього плану квітників, медоносних композицій і квітучих "
            "контейнерів. Зимостійка в більшості регіонів України за умови дренованого "
            "ґрунту (USDA 3–8)."
        ),
        "content_status": "operator_approved",
        "source_names": "Jelitto Perennial Seeds; Royal Horticultural Society",
        "source_urls": (
            "https://www.jelitto.com/Seed/Perennials/NEPETA%2Bracemosa%2BFelix%2BPortion%2Bs.html; "
            "https://www.rhs.org.uk/plants/360438/nepeta-racemosa-felix/details"
        ),
        "source_confidence": "high",
        "source_note": (
            "Official Jelitto cultivar page checked for cultivar traits and USDA zone; "
            "exact RHS cultivar profile checked for full sun / partial shade; operator "
            "approved page copy on 2026-08-24."
        ),
        "seo_title": "Котівник гроновидний Felix — саджанці Flora & Aroma",
        "seo_description": "Котівник гроновидний Felix у контейнері 0,12 л. Ціна 35 грн; наявність підтверджує оператор.",
        "image_path": "/images/plants/local/plant-0091-local-01.jpg; /images/plants/local/plant-0091-format-01.jpg; /images/plants/local/plant-0091-local-02.jpg; /images/plants/local/plant-0091-card-01.png",
        "sun_exposure": "full_sun;part_sun",
        "moisture": "dry",
        "height_cm_min": "25",
        "height_cm_max": "25",
        "flowering_months": "05;06;07;08;09;10",
        "flower_color": "lilac;blue",
        "winter_hardiness": "USDA 3-8",
        "use_cases": "groundcover;pollinator;container",
        "spacing_cm": "",
        "selection_tags": "aromatic_garden;pollinator_plants;drought_tolerant;low_maintenance",
        "variant_containers": "CASSETTE-HIKO-V120SS",
        "variant_prices_uah": "35",
        "variant_units": "шт.",
        "variant_labels": "0,12 л — 35 UAH/шт.",
        "price_rule": "product_variants_pricehistory",
        "variant_ids": "VAR-PLANT-0091-V120",
        "variant_container_type_ids": "CASSETTE-HIKO-V120SS",
        "variant_format_codes": "V-120",
    },
    {
        "plant_id": "PLANT-0092",
        "name_uk": "Котівник гроновидний 'Alba'",
        "latin_name": "Nepeta racemosa 'Alba'",
        "category": "Декоративні багаторічники",
        "container": "CASSETTE-HIKO-V120SS",
        "price_uah": "40",
        "unit": "шт.",
        "availability_status": "contact_us",
        "summary": (
            "Багаторічний столоноутворювальний котівник із чисто-білими квітками. "
            "Формує ґрунтопокривні посадки, цвіте у перший рік і є кормовою рослиною для бджіл."
        ),
        "ecology_text": "Сонце або півтінь; сухий, добре дренований ґрунт.",
        "agrotechnics_text": (
            "Після висадки контролювати вологість до вкорінення; надалі полив "
            "коригувати за умовами ділянки. Фактичну готовність рослин підтверджує оператор."
        ),
        "use_text": (
            "Світлі ґрунтопокривні композиції, передній план квітників і медоносні посадки."
        ),
        "full_description": (
            "Котівник гроновидний 'Alba' (Nepeta racemosa 'Alba') — багаторічний "
            "столоноутворювальний сорт із чисто-білими квітками. Формує невисокий "
            "ґрунтопокривний масив заввишки близько 30 см, може зацвісти у перший рік "
            "вирощування, квітує від травня до вересня та є кормовою рослиною для бджіл. "
            "Найкраще розвивається на сонці або в півтіні, у сухому, добре дренованому "
            "ґрунті й не переносить тривалого застою води. Після висадки потребує "
            "контролю вологості до вкорінення; надалі полив коригують за умовами "
            "ділянки. Підходить для світлих ґрунтопокривних композицій, переднього "
            "плану квітників і медоносних посадок. Зимостійка в більшості регіонів "
            "України за умови дренованого ґрунту (USDA 3–8)."
        ),
        "content_status": "operator_approved",
        "source_names": "Jelitto Perennial Seeds; Royal Horticultural Society",
        "source_urls": (
            "https://www.jelitto.com/Seed/Perennials/NEPETA%2Bracemosa%2BAlba%2BPortion%2Bs.html; "
            "https://www.rhs.org.uk/plants/129199/nepeta-racemosa-alba/details"
        ),
        "source_confidence": "high",
        "source_note": (
            "Official Jelitto cultivar page checked for cultivar traits and USDA zone; "
            "exact RHS cultivar profile checked for full sun / partial shade; operator "
            "approved page copy on 2026-08-24."
        ),
        "seo_title": "Котівник гроновидний Alba — саджанці Flora & Aroma",
        "seo_description": "Котівник гроновидний Alba з білими квітками у контейнері 0,12 л. Ціна 40 грн.",
        "image_path": "/images/plants/local/plant-0092-local-01.jpg; /images/plants/local/plant-0092-format-01.jpg; /images/plants/local/plant-0092-local-02.jpg; /images/plants/local/plant-0092-card-01.png",
        "sun_exposure": "full_sun;part_sun",
        "moisture": "dry",
        "height_cm_min": "30",
        "height_cm_max": "30",
        "flowering_months": "05;06;07;08;09",
        "flower_color": "white",
        "winter_hardiness": "USDA 3-8",
        "use_cases": "groundcover;pollinator",
        "spacing_cm": "",
        "selection_tags": "pollinator_plants;drought_tolerant;low_maintenance",
        "variant_containers": "CASSETTE-HIKO-V120SS",
        "variant_prices_uah": "40",
        "variant_units": "шт.",
        "variant_labels": "0,12 л — 40 UAH/шт.",
        "price_rule": "product_variants_pricehistory",
        "variant_ids": "VAR-PLANT-0092-V120",
        "variant_container_type_ids": "CASSETTE-HIKO-V120SS",
        "variant_format_codes": "V-120",
    },
)


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest().upper()


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


def main() -> None:
    product_fields, products = read_csv(PRODUCTS)
    source_fields, image_sources = read_csv(IMAGE_SOURCES)

    products = [
        row
        for row in products
        if row.get("plant_id") not in {"PLANT-0014", "PLANT-0091", "PLANT-0092"}
    ]
    for row in PRODUCT_ROWS:
        products.append({field: row.get(field, "") for field in product_fields})

    target_paths = set()
    for image in APPROVED_IMAGES:
        source = ROOT / "Изображения" / image["source_name"]
        target = SITE / "public" / "images" / "plants" / "local" / image["target_name"]
        if not source.exists():
            raise RuntimeError(f"missing_source_image:{source}")
        actual_hash = sha256(source)
        if actual_hash != image["expected_sha256"]:
            raise RuntimeError(f"source_image_hash_changed:{image['source_name']}:{actual_hash}")
        target.parent.mkdir(parents=True, exist_ok=True)
        if not target.exists() or sha256(target) != actual_hash:
            shutil.copy2(source, target)

        public_path = f"/images/plants/local/{image['target_name']}"
        target_paths.add(public_path)
        relative_source = f"Изображения/{image['source_name']}"
        image_sources = [row for row in image_sources if row.get("image_path") != public_path]
        image_sources.append(
            {
                "plant_id": image["plant_id"],
                "image_path": public_path,
                "source": "Local Flora image folder",
                "source_page": relative_source,
                "source_file_url": relative_source,
                "downloaded_file_url": "",
                "title": image["title"],
                "author": "Flora & Aroma local file",
                "license": "operator_approved_repository_site",
                "license_url": "",
                "reviewed_status": "operator_approved_for_storefront_2026-08-24",
            }
        )

    if len({row["plant_id"] for row in products}) != len(products):
        raise RuntimeError("duplicate_product_plant_id")
    if len(products) != 45:
        raise RuntimeError(f"unexpected_product_count:{len(products)}")
    if any(row["plant_id"] == "PLANT-0014" for row in products):
        raise RuntimeError("catnip_still_public")

    changed_products = write_csv(PRODUCTS, product_fields, products)
    changed_sources = write_csv(IMAGE_SOURCES, source_fields, image_sources)
    print(f"PRODUCTS_CHANGED={'yes' if changed_products else 'no'}")
    print(f"IMAGE_SOURCES_CHANGED={'yes' if changed_sources else 'no'}")
    print("PUBLIC_PRODUCT_COUNT=45")
    print("ADDED=PLANT-0091,PLANT-0092")
    print("HIDDEN=PLANT-0014")
    print("COPIED_IMAGES=" + ",".join(sorted(target_paths)))


if __name__ == "__main__":
    main()
