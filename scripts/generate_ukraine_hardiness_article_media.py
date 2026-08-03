from __future__ import annotations

import argparse
import csv
import gzip
import hashlib
import io
import json
import math
import statistics
import urllib.request
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont


PERIOD_START = 1991
PERIOD_END = 2020
MIN_DAYS_PER_YEAR = 250
MIN_COLD_SEASON_DAYS = 100
MIN_VALID_YEARS = 20

NCEI_BASE = "https://www.ncei.noaa.gov/pub/data/ghcn/daily"
STATIONS_URL = f"{NCEI_BASE}/ghcnd-stations.txt"
INVENTORY_URL = f"{NCEI_BASE}/ghcnd-inventory.txt"
STATION_DATA_URL = f"{NCEI_BASE}/by_station/{{station_id}}.csv.gz"
BOUNDARY_URL = (
    "https://github.com/wmgeolab/geoBoundaries/raw/9469f09/"
    "releaseData/gbOpen/UKR/ADM0/geoBoundaries-UKR-ADM0.geojson"
)

ZONE_BANDS = (
    ("3b", -37.2, -34.4),
    ("4a", -34.4, -31.7),
    ("4b", -31.7, -28.9),
    ("5a", -28.9, -26.1),
    ("5b", -26.1, -23.3),
    ("6a", -23.3, -20.6),
    ("6b", -20.6, -17.8),
    ("7a", -17.8, -15.0),
    ("7b", -15.0, -12.2),
    ("8a", -12.2, -9.4),
    ("8b", -9.4, -6.7),
    ("9a", -6.7, -3.9),
    ("9b", -3.9, -1.1),
)

ZONE_COLORS = {
    "3b": "#58508D",
    "4a": "#49689A",
    "4b": "#3F82A6",
    "5a": "#2D9C95",
    "5b": "#55A868",
    "6a": "#8BAE55",
    "6b": "#C0B94B",
    "7a": "#E0A33E",
    "7b": "#E47A37",
    "8a": "#D85A45",
    "8b": "#B9445D",
    "9a": "#9B3F72",
    "9b": "#7A3E78",
}


@dataclass(frozen=True)
class Station:
    station_id: str
    latitude: float
    longitude: float
    elevation_m: float
    name: str


@dataclass(frozen=True)
class StationResult:
    station: Station
    valid_years: int
    mean_annual_extreme_min_c: float
    zone: str


def zone_for_celsius(value: float) -> str:
    for zone, lower, upper in ZONE_BANDS:
        if lower <= value < upper:
            return zone
    if value < ZONE_BANDS[0][1]:
        return "3a_or_colder"
    return "10a_or_warmer"


def parse_station_line(line: str) -> Station:
    return Station(
        station_id=line[0:11].strip(),
        latitude=float(line[12:20]),
        longitude=float(line[21:30]),
        elevation_m=float(line[31:37]),
        name=line[41:71].strip(),
    )


def parse_inventory_line(line: str) -> tuple[str, str, int, int]:
    return line[0:11].strip(), line[31:35], int(line[36:40]), int(line[41:45])


def station_result_from_csv_gz(station: Station, payload: bytes) -> StationResult | None:
    annual_values: dict[int, list[float]] = defaultdict(list)
    cold_season_days: dict[int, int] = defaultdict(int)
    with gzip.open(io.BytesIO(payload), mode="rt", encoding="ascii", newline="") as handle:
        for row in csv.reader(handle):
            if len(row) < 6 or row[2] != "TMIN":
                continue
            year = int(row[1][0:4])
            if not PERIOD_START <= year <= PERIOD_END:
                continue
            if row[5].strip():
                continue
            value = int(row[3])
            if value == -9999:
                continue
            annual_values[year].append(value / 10.0)
            if int(row[1][4:6]) in {1, 2, 3, 11, 12}:
                cold_season_days[year] += 1

    annual_extremes = [
        min(values)
        for year, values in annual_values.items()
        if len(values) >= MIN_DAYS_PER_YEAR and cold_season_days[year] >= MIN_COLD_SEASON_DAYS
    ]
    if len(annual_extremes) < MIN_VALID_YEARS:
        return None
    mean_extreme = statistics.fmean(annual_extremes)
    return StationResult(
        station=station,
        valid_years=len(annual_extremes),
        mean_annual_extreme_min_c=mean_extreme,
        zone=zone_for_celsius(mean_extreme),
    )


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def fetch_bytes(url: str, timeout: int = 120) -> bytes:
    request = urllib.request.Request(url, headers={"User-Agent": "Flora-Aroma-editorial-research/1.0"})
    with urllib.request.urlopen(request, timeout=timeout) as response:
        return response.read()


def cached_fetch(url: str, path: Path) -> bytes:
    if path.exists():
        return path.read_bytes()
    payload = fetch_bytes(url)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_bytes(payload)
    return payload


def refresh_station_snapshot(source_dir: Path, cache_dir: Path) -> list[StationResult]:
    stations_text = cached_fetch(STATIONS_URL, cache_dir / "ghcnd-stations.txt").decode("latin-1")
    inventory_text = cached_fetch(INVENTORY_URL, cache_dir / "ghcnd-inventory.txt").decode("ascii")

    stations = {
        station.station_id: station
        for line in stations_text.splitlines()
        if line.startswith("UP")
        for station in [parse_station_line(line)]
    }
    eligible_ids = {
        station_id
        for line in inventory_text.splitlines()
        if line.startswith("UP")
        for station_id, element, first_year, last_year in [parse_inventory_line(line)]
        if element == "TMIN"
        and min(last_year, PERIOD_END) - max(first_year, PERIOD_START) + 1 >= MIN_VALID_YEARS
    }

    station_payloads: dict[str, bytes] = {}
    with ThreadPoolExecutor(max_workers=8) as executor:
        futures = {
            executor.submit(
                cached_fetch,
                STATION_DATA_URL.format(station_id=station_id),
                cache_dir / "stations" / f"{station_id}.csv.gz",
            ): station_id
            for station_id in sorted(eligible_ids & stations.keys())
        }
        for future in as_completed(futures):
            station_payloads[futures[future]] = future.result()

    results = []
    for station_id, payload in station_payloads.items():
        result = station_result_from_csv_gz(stations[station_id], payload)
        if result is not None:
            results.append(result)
    results.sort(key=lambda item: (item.station.latitude, item.station.longitude, item.station.station_id))

    source_dir.mkdir(parents=True, exist_ok=True)
    snapshot_path = source_dir / "ukraine-hardiness-ghcnd-1991-2020.csv"
    with snapshot_path.open("w", encoding="utf-8", newline="") as handle:
        writer = csv.DictWriter(
            handle,
            fieldnames=[
                "station_id",
                "station_name",
                "latitude",
                "longitude",
                "elevation_m",
                "valid_years",
                "mean_annual_extreme_min_c",
                "usda_zone",
                "period",
                "data_source",
                "calculation_note",
            ],
            lineterminator="\n",
        )
        writer.writeheader()
        for item in results:
            writer.writerow(
                {
                    "station_id": item.station.station_id,
                    "station_name": item.station.name,
                    "latitude": f"{item.station.latitude:.4f}",
                    "longitude": f"{item.station.longitude:.4f}",
                    "elevation_m": f"{item.station.elevation_m:.1f}",
                    "valid_years": item.valid_years,
                    "mean_annual_extreme_min_c": f"{item.mean_annual_extreme_min_c:.2f}",
                    "usda_zone": item.zone,
                    "period": f"{PERIOD_START}-{PERIOD_END}",
                    "data_source": "NOAA/NCEI GHCN-Daily",
                    "calculation_note": (
                        f"mean of annual TMIN extremes; QC-flagged values excluded; "
                        f">={MIN_DAYS_PER_YEAR} valid days/year including "
                        f">={MIN_COLD_SEASON_DAYS} days in Jan-Mar and Nov-Dec; "
                        f">={MIN_VALID_YEARS} valid years"
                    ),
                }
            )

    boundary_path = source_dir / "geoBoundaries-UKR-ADM0.geojson"
    cached_fetch(BOUNDARY_URL, boundary_path)
    metadata = {
        "generated_from": {
            "ghcnd_stations": STATIONS_URL,
            "ghcnd_inventory": INVENTORY_URL,
            "ghcnd_station_template": STATION_DATA_URL,
            "ukraine_boundary": BOUNDARY_URL,
        },
        "period": f"{PERIOD_START}-{PERIOD_END}",
        "station_count": len(results),
        "minimum_days_per_year": MIN_DAYS_PER_YEAR,
        "minimum_cold_season_days": MIN_COLD_SEASON_DAYS,
        "minimum_valid_years": MIN_VALID_YEARS,
        "snapshot_sha256": sha256(snapshot_path),
        "boundary_sha256": sha256(boundary_path),
        "publication_note": (
            "Point observations only. No interpolation was used; the illustration is not an official Ukrainian "
            "hardiness-zone map and cannot replace local station records or site observation."
        ),
    }
    (source_dir / "ukraine-hardiness-source-metadata.json").write_text(
        json.dumps(metadata, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    return results


def read_station_snapshot(path: Path) -> list[StationResult]:
    results = []
    with path.open("r", encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            station = Station(
                station_id=row["station_id"],
                latitude=float(row["latitude"]),
                longitude=float(row["longitude"]),
                elevation_m=float(row["elevation_m"]),
                name=row["station_name"],
            )
            results.append(
                StationResult(
                    station=station,
                    valid_years=int(row["valid_years"]),
                    mean_annual_extreme_min_c=float(row["mean_annual_extreme_min_c"]),
                    zone=row["usda_zone"],
                )
            )
    return results


def font(size: int, bold: bool = False) -> ImageFont.FreeTypeFont:
    filename = "arialbd.ttf" if bold else "arial.ttf"
    return ImageFont.truetype(str(Path("C:/Windows/Fonts") / filename), size=size)


def wrapped_lines(draw: ImageDraw.ImageDraw, text: str, target_width: int, text_font: ImageFont.FreeTypeFont) -> list[str]:
    words = text.split()
    lines: list[str] = []
    current = ""
    for word in words:
        candidate = f"{current} {word}".strip()
        if current and draw.textbbox((0, 0), candidate, font=text_font)[2] > target_width:
            lines.append(current)
            current = word
        else:
            current = candidate
    if current:
        lines.append(current)
    return lines


def draw_wrapped(
    draw: ImageDraw.ImageDraw,
    xy: tuple[int, int],
    text: str,
    target_width: int,
    text_font: ImageFont.FreeTypeFont,
    fill: str,
    spacing: int = 8,
) -> int:
    x, y = xy
    line_height = text_font.size + spacing
    for line in wrapped_lines(draw, text, target_width, text_font):
        draw.text((x, y), line, font=text_font, fill=fill)
        y += line_height
    return y


def geometry_polygons(geometry: dict) -> list[list[list[list[float]]]]:
    if geometry["type"] == "Polygon":
        return [geometry["coordinates"]]
    if geometry["type"] == "MultiPolygon":
        return geometry["coordinates"]
    raise ValueError(f"Unsupported geometry type: {geometry['type']}")


def draw_station_map(results: list[StationResult], boundary_path: Path, output_path: Path) -> None:
    width, height = 1800, 1200
    image = Image.new("RGB", (width, height), "#F4F1EA")
    draw = ImageDraw.Draw(image)
    draw.text((90, 58), "Зони морозостійкості за даними метеостанцій", font=font(54, True), fill="#173D32")
    draw.text(
        (92, 126),
        "Україна, 1991–2020 · середній річний екстремум мінімальної температури",
        font=font(29),
        fill="#4A514C",
    )

    geo = json.loads(boundary_path.read_text(encoding="utf-8"))
    geometry = geo["features"][0]["geometry"]
    polygons = geometry_polygons(geometry)
    all_points = [point for polygon in polygons for ring in polygon for point in ring]
    min_lon = min(point[0] for point in all_points)
    max_lon = max(point[0] for point in all_points)
    min_lat = min(point[1] for point in all_points)
    max_lat = max(point[1] for point in all_points)
    map_left, map_top, map_right, map_bottom = 100, 220, 1370, 1010
    longitude_factor = max(math.cos(math.radians((min_lat + max_lat) / 2)), 0.65)
    lon_scale = (map_right - map_left) / ((max_lon - min_lon) * longitude_factor)
    lat_scale = (map_bottom - map_top) / (max_lat - min_lat)
    scale = min(lon_scale, lat_scale)
    map_width = (max_lon - min_lon) * longitude_factor * scale
    map_height = (max_lat - min_lat) * scale
    offset_x = map_left + ((map_right - map_left) - map_width) / 2
    offset_y = map_top + ((map_bottom - map_top) - map_height) / 2

    def project(lon: float, lat: float) -> tuple[float, float]:
        x = offset_x + (lon - min_lon) * longitude_factor * scale
        y = offset_y + (max_lat - lat) * scale
        return x, y

    for polygon in polygons:
        for ring_index, ring in enumerate(polygon):
            points = [project(point[0], point[1]) for point in ring]
            fill = "#FFFFFF" if ring_index == 0 else "#F4F1EA"
            draw.polygon(points, fill=fill)
            draw.line(points + [points[0]], fill="#31594B", width=3, joint="curve")

    for result in results:
        x, y = project(result.station.longitude, result.station.latitude)
        color = ZONE_COLORS.get(result.zone, "#4E5651")
        radius = 9
        draw.ellipse((x - radius, y - radius, x + radius, y + radius), fill=color, outline="#FFFFFF", width=2)

    legend_x, legend_y = 1425, 245
    draw.text((legend_x, legend_y), "USDA-зона", font=font(31, True), fill="#173D32")
    present_zones = [zone for zone, _, _ in ZONE_BANDS if any(item.zone == zone for item in results)]
    for index, zone in enumerate(present_zones):
        y = legend_y + 58 + index * 54
        draw.ellipse((legend_x, y + 3, legend_x + 28, y + 31), fill=ZONE_COLORS[zone])
        band = next(item for item in ZONE_BANDS if item[0] == zone)
        draw.text((legend_x + 45, y), f"{zone}: {band[1]:.1f}…{band[2]:.1f} °C", font=font(25), fill="#303733")

    zone_counts = defaultdict(int)
    for item in results:
        zone_counts[item.zone] += 1
    count_text = " · ".join(f"{zone}: {zone_counts[zone]}" for zone in present_zones)
    draw.text((100, 1040), f"Станцій у вибірці: {len(results)}  |  {count_text}", font=font(24, True), fill="#303733")
    footer = (
        "Розрахунок Flora & Aroma за GHCN-Daily (NOAA/NCEI). Точки — станції, а не суцільні межі зон; "
        "значення з QC-прапорцями виключено. Межа: geoBoundaries, ODbL 1.0."
    )
    draw_wrapped(draw, (100, 1082), footer, 1600, font(21), "#59615C", spacing=5)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    image.save(output_path, optimize=True)


def draw_station_map_mobile(results: list[StationResult], boundary_path: Path, output_path: Path) -> None:
    width, height = 1200, 1600
    image = Image.new("RGB", (width, height), "#F4F1EA")
    draw = ImageDraw.Draw(image)
    draw.text((60, 48), "Зони морозостійкості за даними станцій", font=font(50, True), fill="#173D32")
    draw.text(
        (62, 112),
        "Україна, 1991–2020 · середній річний екстремум мінімальної температури",
        font=font(32),
        fill="#4A514C",
    )

    geo = json.loads(boundary_path.read_text(encoding="utf-8"))
    geometry = geo["features"][0]["geometry"]
    polygons = geometry_polygons(geometry)
    all_points = [point for polygon in polygons for ring in polygon for point in ring]
    min_lon = min(point[0] for point in all_points)
    max_lon = max(point[0] for point in all_points)
    min_lat = min(point[1] for point in all_points)
    max_lat = max(point[1] for point in all_points)
    map_left, map_top, map_right, map_bottom = 60, 205, 1140, 865
    longitude_factor = max(math.cos(math.radians((min_lat + max_lat) / 2)), 0.65)
    scale = min(
        (map_right - map_left) / ((max_lon - min_lon) * longitude_factor),
        (map_bottom - map_top) / (max_lat - min_lat),
    )
    map_width = (max_lon - min_lon) * longitude_factor * scale
    map_height = (max_lat - min_lat) * scale
    offset_x = map_left + ((map_right - map_left) - map_width) / 2
    offset_y = map_top + ((map_bottom - map_top) - map_height) / 2

    def project(lon: float, lat: float) -> tuple[float, float]:
        return (
            offset_x + (lon - min_lon) * longitude_factor * scale,
            offset_y + (max_lat - lat) * scale,
        )

    for polygon in polygons:
        for ring_index, ring in enumerate(polygon):
            points = [project(point[0], point[1]) for point in ring]
            draw.polygon(points, fill="#FFFFFF" if ring_index == 0 else "#F4F1EA")
            draw.line(points + [points[0]], fill="#31594B", width=3, joint="curve")

    for result in results:
        x, y = project(result.station.longitude, result.station.latitude)
        radius = 10
        draw.ellipse(
            (x - radius, y - radius, x + radius, y + radius),
            fill=ZONE_COLORS.get(result.zone, "#4E5651"),
            outline="#FFFFFF",
            width=2,
        )

    present_zones = [zone for zone, _, _ in ZONE_BANDS if any(item.zone == zone for item in results)]
    draw.text((62, 920), "USDA-зони у вибірці", font=font(45, True), fill="#173D32")
    for index, zone in enumerate(present_zones):
        column = index % 2
        row = index // 2
        x = 65 + column * 560
        y = 990 + row * 82
        band = next(item for item in ZONE_BANDS if item[0] == zone)
        draw.ellipse((x, y + 5, x + 36, y + 41), fill=ZONE_COLORS[zone])
        draw.text((x + 54, y), f"{zone}: {band[1]:.1f}…{band[2]:.1f} °C", font=font(40), fill="#303733")

    zone_counts = defaultdict(int)
    for item in results:
        zone_counts[item.zone] += 1
    count_text = " · ".join(f"{zone}: {zone_counts[zone]}" for zone in present_zones)
    draw.text((62, 1260), f"Станцій у вибірці: {len(results)}", font=font(40, True), fill="#303733")
    draw_wrapped(draw, (62, 1320), count_text, 1080, font(37), "#303733", spacing=7)
    footer = (
        "Розрахунок Flora & Aroma за GHCN-Daily (NOAA/NCEI). Точки — станції, а не суцільні межі зон; "
        "значення з QC-прапорцями виключено. Межа: geoBoundaries, ODbL 1.0."
    )
    draw_wrapped(draw, (62, 1415), footer, 1080, font(32), "#59615C", spacing=7)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    image.save(output_path, optimize=True)


def draw_zone_scale(output_path: Path) -> None:
    width, height = 1600, 1160
    image = Image.new("RGB", (width, height), "#F7F5EF")
    draw = ImageDraw.Draw(image)
    draw.text((90, 60), "Що означає номер USDA-зони", font=font(54, True), fill="#173D32")
    draw.text(
        (92, 130),
        "Діапазон середнього річного екстремуму мінімальної температури, а не рекорд усіх часів",
        font=font(27),
        fill="#4A514C",
    )
    draw.rounded_rectangle((90, 205, 1510, 1080), radius=8, fill="#FFFFFF", outline="#D7D9D3", width=2)
    columns = [("Зона", 130), ("Температура, °C", 330), ("Як читати", 750)]
    for label, x in columns:
        draw.text((x, 235), label, font=font(27, True), fill="#173D32")
    rows = [band for band in ZONE_BANDS if band[0] not in {"3b", "9b"}]
    row_top = 295
    row_height = 67
    for index, (zone, lower, upper) in enumerate(rows):
        y = row_top + index * row_height
        if index % 2 == 0:
            draw.rectangle((105, y - 5, 1495, y + row_height - 5), fill="#F8F9F6")
        draw.rounded_rectangle((130, y + 6, 245, y + 51), radius=6, fill=ZONE_COLORS[zone])
        draw.text((168, y + 10), zone, font=font(25, True), fill="#FFFFFF")
        draw.text((330, y + 10), f"від {lower:.1f} до {upper:.1f}", font=font(25), fill="#303733")
        interpretation = "холодніша половина" if zone.endswith("a") else "тепліша половина"
        draw.text((750, y + 10), interpretation, font=font(25), fill="#303733")
    draw.text(
        (120, 1031),
        "Крок повної зони — 5,6 °C; підзони a і b ділять його навпіл приблизно по 2,8 °C.",
        font=font(23),
        fill="#59615C",
    )
    output_path.parent.mkdir(parents=True, exist_ok=True)
    image.save(output_path, optimize=True)


def draw_zone_scale_mobile(output_path: Path) -> None:
    width, height = 1200, 1600
    image = Image.new("RGB", (width, height), "#F7F5EF")
    draw = ImageDraw.Draw(image)
    draw.text((60, 48), "Що означає номер USDA-зони", font=font(56, True), fill="#173D32")
    draw_wrapped(
        draw,
        (62, 112),
        "Середній річний екстремум мінімальної температури, а не рекорд усіх часів",
        1080,
        font(37),
        "#4A514C",
        spacing=6,
    )
    draw.rounded_rectangle((55, 220, 1145, 1535), radius=8, fill="#FFFFFF", outline="#D7D9D3", width=2)
    draw.text((95, 250), "Зона", font=font(40, True), fill="#173D32")
    draw.text((340, 250), "Температура, °C", font=font(40, True), fill="#173D32")
    draw.text((790, 250), "Підзона", font=font(40, True), fill="#173D32")
    rows = [band for band in ZONE_BANDS if band[0] not in {"3b", "9b"}]
    row_top = 315
    row_height = 103
    for index, (zone, lower, upper) in enumerate(rows):
        y = row_top + index * row_height
        if index % 2 == 0:
            draw.rectangle((75, y - 8, 1125, y + row_height - 8), fill="#F8F9F6")
        draw.rounded_rectangle((95, y + 10, 260, y + 75), radius=6, fill=ZONE_COLORS[zone])
        draw.text((145, y + 14), zone, font=font(43, True), fill="#FFFFFF")
        draw.text((340, y + 18), f"{lower:.1f}…{upper:.1f}", font=font(40), fill="#303733")
        interpretation = "холодніша" if zone.endswith("a") else "тепліша"
        draw.text((790, y + 18), interpretation, font=font(40), fill="#303733")
    draw_wrapped(
        draw,
        (85, 1460),
        "Повна зона — 5,6 °C; підзони a і b ділять її приблизно по 2,8 °C.",
        1030,
        font(34),
        "#59615C",
        spacing=5,
    )
    output_path.parent.mkdir(parents=True, exist_ok=True)
    image.save(output_path, optimize=True)


def draw_decision_guide(output_path: Path) -> None:
    width, height = 1800, 1080
    image = Image.new("RGB", (width, height), "#F4F1EA")
    draw = ImageDraw.Draw(image)
    draw.text((90, 55), "П’ять перевірок перед купівлею багаторічника", font=font(53, True), fill="#173D32")
    draw.text(
        (92, 125),
        "Номер зони — лише перший фільтр. Надійне рішення складається з п’яти частин.",
        font=font(29),
        fill="#4A514C",
    )
    blocks = [
        ("1", "Зона", "Знайдіть середній зимовий екстремум і залиште запас для рідкісної хвилі холоду.", "#49689A"),
        ("2", "Мікроклімат", "Перевірте висоту, схил, морозну улоговину, стіну, вітер і сніговий покрив.", "#2D9C95"),
        ("3", "Ґрунт узимку", "Холод разом із перезволоженням часто небезпечніший, ніж сама температура.", "#8BAE55"),
        ("4", "Конкретна рослина", "Звіряйте вид і сорт, вік саджанця, стан коренів та умови вирощування.", "#E0A33E"),
        ("5", "План захисту", "Для межової рослини передбачте мульчу, укриття, захищене місце або контейнер.", "#D85A45"),
    ]
    card_width = 308
    gap = 30
    left = 90
    top = 235
    for index, (number, title, body, color) in enumerate(blocks):
        x = left + index * (card_width + gap)
        draw.rounded_rectangle((x, top, x + card_width, 835), radius=8, fill="#FFFFFF", outline="#D8D8D2", width=2)
        draw.ellipse((x + 90, top + 45, x + 218, top + 173), fill=color)
        number_bbox = draw.textbbox((0, 0), number, font=font(59, True))
        draw.text(
            (x + 154 - (number_bbox[2] - number_bbox[0]) / 2, top + 73),
            number,
            font=font(59, True),
            fill="#FFFFFF",
        )
        title_bbox = draw.textbbox((0, 0), title, font=font(30, True))
        draw.text((x + (card_width - (title_bbox[2] - title_bbox[0])) / 2, top + 215), title, font=font(30, True), fill="#173D32")
        draw_wrapped(draw, (x + 30, top + 285), body, card_width - 60, font(25), "#3C443F", spacing=10)
    draw.rounded_rectangle((180, 900, 1620, 1005), radius=8, fill="#173D32")
    final_text = "Практичне правило: для відповідальної посадки обирайте рослину з запасом щонайменше в одну підзону."
    final_bbox = draw.textbbox((0, 0), final_text, font=font(28, True))
    draw.text((900 - (final_bbox[2] - final_bbox[0]) / 2, 936), final_text, font=font(28, True), fill="#FFFFFF")
    output_path.parent.mkdir(parents=True, exist_ok=True)
    image.save(output_path, optimize=True)


def draw_decision_guide_mobile(output_path: Path) -> None:
    width, height = 1200, 2050
    image = Image.new("RGB", (width, height), "#F4F1EA")
    draw = ImageDraw.Draw(image)
    draw.text((60, 48), "П’ять перевірок перед купівлею", font=font(57, True), fill="#173D32")
    draw_wrapped(
        draw,
        (62, 112),
        "Номер зони — лише перший фільтр. Надійне рішення складається з п’яти частин.",
        1080,
        font(39),
        "#4A514C",
        spacing=6,
    )
    blocks = [
        ("1", "Зона", "Знайдіть середній зимовий екстремум і залиште запас для рідкісної хвилі холоду.", "#49689A"),
        ("2", "Мікроклімат", "Перевірте висоту, схил, морозну улоговину, стіну, вітер і сніговий покрив.", "#2D9C95"),
        ("3", "Ґрунт узимку", "Холод разом із перезволоженням часто небезпечніший, ніж сама температура.", "#8BAE55"),
        ("4", "Конкретна рослина", "Звіряйте вид і сорт, вік саджанця, стан коренів та умови вирощування.", "#E0A33E"),
        ("5", "План захисту", "Для межової рослини передбачте мульчу, укриття, захищене місце або контейнер.", "#D85A45"),
    ]
    top = 225
    card_height = 300
    for index, (number, title, body, color) in enumerate(blocks):
        y = top + index * (card_height + 22)
        draw.rounded_rectangle((60, y, 1140, y + card_height), radius=8, fill="#FFFFFF", outline="#D8D8D2", width=2)
        draw.ellipse((95, y + 85, 225, y + 215), fill=color)
        number_bbox = draw.textbbox((0, 0), number, font=font(59, True))
        draw.text((160 - (number_bbox[2] - number_bbox[0]) / 2, y + 113), number, font=font(59, True), fill="#FFFFFF")
        draw.text((275, y + 35), title, font=font(46, True), fill="#173D32")
        draw_wrapped(draw, (275, y + 105), body, 810, font(42), "#3C443F", spacing=10)
    draw.rounded_rectangle((60, 1865, 1140, 1995), radius=8, fill="#173D32")
    draw_wrapped(
        draw,
        (95, 1888),
        "Практичне правило: обирайте рослину із запасом щонайменше в одну підзону.",
        1010,
        font(38, True),
        "#FFFFFF",
        spacing=5,
    )
    output_path.parent.mkdir(parents=True, exist_ok=True)
    image.save(output_path, optimize=True)


def main() -> int:
    parser = argparse.ArgumentParser(description="Generate source-backed media for the Ukraine hardiness article")
    parser.add_argument("--refresh-source-data", action="store_true")
    parser.add_argument("--source-dir", type=Path, default=Path("data/publication-sources/ukraine-hardiness"))
    parser.add_argument("--cache-dir", type=Path, default=Path("tmp/ukraine-hardiness-ghcnd"))
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=Path("public/images/publications/ukraine-hardiness-zones"),
    )
    args = parser.parse_args()

    snapshot_path = args.source_dir / "ukraine-hardiness-ghcnd-1991-2020.csv"
    boundary_path = args.source_dir / "geoBoundaries-UKR-ADM0.geojson"
    if args.refresh_source_data:
        results = refresh_station_snapshot(args.source_dir, args.cache_dir)
    else:
        if not snapshot_path.exists() or not boundary_path.exists():
            raise SystemExit("source snapshot missing; run with --refresh-source-data")
        results = read_station_snapshot(snapshot_path)

    if not results:
        raise SystemExit("no eligible station results")
    draw_station_map(results, boundary_path, args.output_dir / "02-ghcnd-station-zones.png")
    draw_station_map_mobile(results, boundary_path, args.output_dir / "02-ghcnd-station-zones-mobile.png")
    draw_zone_scale(args.output_dir / "03-usda-zone-scale.png")
    draw_zone_scale_mobile(args.output_dir / "03-usda-zone-scale-mobile.png")
    draw_decision_guide(args.output_dir / "05-five-checks.png")
    draw_decision_guide_mobile(args.output_dir / "05-five-checks-mobile.png")
    print(f"station_count={len(results)}")
    print(f"zones={','.join(sorted({item.zone for item in results}))}")
    print(f"snapshot={snapshot_path}")
    print(f"output_dir={args.output_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
