"""Generate the public PDF from the same approved prices as product cards."""
from __future__ import annotations

import csv
import os
import tempfile
from datetime import date
from decimal import Decimal
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Image, LongTable, Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle


ROOT = Path(__file__).resolve().parents[1]
PRODUCTS = ROOT / "data/products.csv"
OUTPUT_PDF = ROOT / "public/downloads/flora-aroma-price.pdf"
VOLUMES = {"V-120": "0,12", "V-265": "0,265", "P9": "0,4", "P10": "0,5", "P11": "0,6", "P12": "0,7", "P13": "1", "P15": "1,5", "P18": "2,4", "P19": "3", "P23": "5"}


def split_values(value):
    return [part.strip() for part in value.split(";") if part.strip()]


def read_price_rows():
    with PRODUCTS.open(encoding="utf-8-sig", newline="") as stream:
        products = list(csv.DictReader(stream))
    rows, seen = [], set()
    for product in products:
        ids = split_values(product["variant_ids"])
        codes = split_values(product["variant_format_codes"])
        prices = split_values(product["variant_prices_uah"])
        if not ids or not (len(ids) == len(codes) == len(prices)):
            raise ValueError(f"variant_mismatch:{product['plant_id']}")
        for variant, code, price in zip(ids, codes, prices):
            if variant in seen or code not in VOLUMES:
                raise ValueError(f"duplicate_variant_or_unknown_volume:{variant}")
            value = Decimal(price)
            if not value.is_finite() or value <= 0:
                raise ValueError(f"invalid_price:{variant}")
            seen.add(variant)
            rows.append({"variant_id": variant, "plant_id": product["plant_id"], "name_uk": product["name_uk"], "latin_name": product["latin_name"], "volume": VOLUMES[code] + " л", "price": format(value.normalize(), "f").replace(".", ",")})
    return sorted(rows, key=lambda row: (row["name_uk"], Decimal(row["volume"].split()[0].replace(",", "."))))


def register_fonts():
    candidates = [Path(os.environ.get("WINDIR", "C:/Windows")) / "Fonts", Path("/usr/share/fonts/truetype/msttcorefonts")]
    for folder in candidates:
        regular, bold = folder / "arial.ttf", folder / "arialbd.ttf"
        if regular.exists() and bold.exists():
            pdfmetrics.registerFont(TTFont("PriceText", str(regular)))
            pdfmetrics.registerFont(TTFont("PriceBold", str(bold)))
            return
    dejavu = Path("/usr/share/fonts/truetype/dejavu")
    pdfmetrics.registerFont(TTFont("PriceText", str(dejavu / "DejaVuSans.ttf")))
    pdfmetrics.registerFont(TTFont("PriceBold", str(dejavu / "DejaVuSans-Bold.ttf")))


def build_pdf(rows, target):
    register_fonts()
    body = ParagraphStyle("PriceBody", fontName="PriceText", fontSize=9, leading=12, textColor=colors.HexColor("#23382e"))
    small = ParagraphStyle("PriceSmall", parent=body, fontSize=8, leading=11, textColor=colors.HexColor("#55675d"))
    title = ParagraphStyle("PriceTitle", parent=body, fontName="PriceBold", fontSize=22, leading=27, textColor=colors.HexColor("#1f5d42"))
    doc = SimpleDocTemplate(str(target), pagesize=A4, rightMargin=30, leftMargin=30, topMargin=26, bottomMargin=42, title="Flora & Aroma - прайс рослин", author="Flora & Aroma")
    story = []
    heading = [Paragraph("FLORA &amp; AROMA", title), Paragraph("Актуальний асортимент рослин", body), Spacer(1, 5), Paragraph(f"{date.today():%d.%m.%Y} | flora-aroma.com.ua | +380 50 027 28 82", small)]
    logo = ROOT / "public/images/logo.png"
    if logo.exists():
        header = Table([[Image(str(logo), width=65, height=65, kind="proportional"), heading]], colWidths=[78, 457])
        header.setStyle(TableStyle([("VALIGN", (0, 0), (-1, -1), "MIDDLE"), ("LEFTPADDING", (0, 0), (-1, -1), 0)]))
        story.append(header)
    else:
        story.extend(heading)
    story.append(Spacer(1, 16))
    data = [["Рослина", "Латинська назва", "Об'єм", "Ціна, грн/шт."]]
    for row in rows:
        data.append([Paragraph(escape(row["name_uk"]), body), Paragraph(escape(row["latin_name"]), small), row["volume"], row["price"]])
    table = LongTable(data, colWidths=[216, 175, 61, 83], repeatRows=1, hAlign="LEFT")
    table.setStyle(TableStyle([
        ("FONTNAME", (0, 0), (-1, 0), "PriceBold"), ("FONTNAME", (0, 1), (-1, -1), "PriceText"),
        ("FONTSIZE", (0, 0), (-1, -1), 9), ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#23382e")),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#ddeedf")),
        ("LINEBELOW", (0, 0), (-1, 0), 0.8, colors.HexColor("#7d9f89")),
        ("LINEBELOW", (0, 1), (-1, -1), 0.3, colors.HexColor("#d8e4dc")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"), ("ALIGN", (2, 0), (-1, -1), "RIGHT"),
        ("TOPPADDING", (0, 0), (-1, -1), 7), ("BOTTOMPADDING", (0, 0), (-1, -1), 7),
    ]))
    story.append(table)

    def footer(canvas, _doc):
        canvas.setFont("PriceText", 8)
        canvas.setFillColor(colors.HexColor("#55675d"))
        canvas.drawString(30, 24, "Наявність і можливість резерву підтверджує оператор.")
        canvas.drawRightString(A4[0] - 30, 24, str(_doc.page))

    doc.build(story, onFirstPage=footer, onLaterPages=footer)


def main():
    rows = read_price_rows()
    OUTPUT_PDF.parent.mkdir(parents=True, exist_ok=True)
    with tempfile.TemporaryDirectory(prefix="flora-price-") as temp:
        pending = Path(temp) / "price.pdf"
        build_pdf(rows, pending)
        OUTPUT_PDF.write_bytes(pending.read_bytes())
    print(f"price_rows={len(rows)} output={OUTPUT_PDF}")


if __name__ == "__main__":
    main()
