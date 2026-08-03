from __future__ import annotations

import csv
import datetime as dt
import gzip
import importlib.util
import io
import json
import sys
import tempfile
from pathlib import Path

from PIL import Image


SCRIPT = Path(__file__).with_name("generate_ukraine_hardiness_article_media.py")
SPEC = importlib.util.spec_from_file_location("hardiness_media", SCRIPT)
assert SPEC and SPEC.loader
MODULE = importlib.util.module_from_spec(SPEC)
sys.modules[SPEC.name] = MODULE
SPEC.loader.exec_module(MODULE)


def csv_payload(rows: list[tuple[str, str, int, str]]) -> bytes:
    buffer = io.StringIO(newline="")
    writer = csv.writer(buffer, lineterminator="\n")
    for date, element, value, q_flag in rows:
        writer.writerow(["UPM00000001", date, element, value, "", q_flag, "S", ""])
    return gzip.compress(buffer.getvalue().encode("ascii"))


assert MODULE.zone_for_celsius(-34.4) == "4a"
assert MODULE.zone_for_celsius(-31.8) == "4a"
assert MODULE.zone_for_celsius(-31.7) == "4b"
assert MODULE.zone_for_celsius(-23.3) == "6a"
assert MODULE.zone_for_celsius(-17.8) == "7a"
assert MODULE.zone_for_celsius(-6.7) == "9a"

station_line = "UPM00033345  50.4000   30.5330  166.0    KYIV                          0"
station = MODULE.parse_station_line(station_line)
assert station.station_id == "UPM00033345"
assert station.name == "KYIV"

rows = []
for year in range(MODULE.PERIOD_START, MODULE.PERIOD_START + MODULE.MIN_VALID_YEARS):
    start = dt.date(year, 1, 1)
    dates = [start + dt.timedelta(days=offset) for offset in range((dt.date(year + 1, 1, 1) - start).days)]
    cold_dates = [date for date in dates if date.month in {1, 2, 3, 11, 12}]
    warm_dates = [date for date in dates if date.month not in {1, 2, 3, 11, 12}]
    selected_dates = cold_dates[: MODULE.MIN_COLD_SEASON_DAYS] + warm_dates[
        : MODULE.MIN_DAYS_PER_YEAR - MODULE.MIN_COLD_SEASON_DAYS
    ]
    for date in selected_dates:
        rows.append((date.strftime("%Y%m%d"), "TMIN", -200 - (year % 3), ""))
rows.append((f"{MODULE.PERIOD_START}0101", "TMIN", -999, "X"))
result = MODULE.station_result_from_csv_gz(station, csv_payload(rows))
assert result is not None
assert result.valid_years == MODULE.MIN_VALID_YEARS
assert result.zone == "6b"

incomplete_rows = rows[: MODULE.MIN_DAYS_PER_YEAR - 1]
assert MODULE.station_result_from_csv_gz(station, csv_payload(incomplete_rows)) is None

polygon = {"type": "Polygon", "coordinates": [[[22, 44], [40, 44], [40, 52], [22, 52], [22, 44]]]}
assert MODULE.geometry_polygons(polygon) == [polygon["coordinates"]]
multi_polygon = {"type": "MultiPolygon", "coordinates": [polygon["coordinates"], polygon["coordinates"]]}
assert MODULE.geometry_polygons(multi_polygon) == multi_polygon["coordinates"]

with tempfile.TemporaryDirectory() as temp_dir:
    output_dir = Path(temp_dir)
    boundary_path = output_dir / "boundary.geojson"
    boundary_path.write_text(
        json.dumps({"features": [{"geometry": polygon}]}),
        encoding="utf-8",
    )
    sample = MODULE.StationResult(station=station, valid_years=20, mean_annual_extreme_min_c=-20.0, zone="6b")
    expected_sizes = {
        "map-mobile.png": (1200, 1600),
        "scale-mobile.png": (1200, 1600),
        "guide-mobile.png": (1200, 2050),
    }
    MODULE.draw_station_map_mobile([sample], boundary_path, output_dir / "map-mobile.png")
    MODULE.draw_zone_scale_mobile(output_dir / "scale-mobile.png")
    MODULE.draw_decision_guide_mobile(output_dir / "guide-mobile.png")
    for filename, expected_size in expected_sizes.items():
        with Image.open(output_dir / filename) as generated:
            assert generated.size == expected_size

print("ukraine hardiness article media tests passed")
