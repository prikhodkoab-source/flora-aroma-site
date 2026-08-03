# Ukraine hardiness article source note

This directory contains the reproducible data snapshot used by
`WC-CR-20260803-UKRAINE-HARDINESS-ZONES`.

## Sources

- NOAA/NCEI GHCN-Daily station metadata, TMIN inventory, and station CSV files:
  <https://www.ncei.noaa.gov/products/land-based-station/global-historical-climatology-network-daily>
- Ukraine ADM0 geometry from geoBoundaries, pinned to repository revision
  `9469f09`, licensed under ODbL 1.0.
- USDA temperature bands:
  <https://planthardiness.ars.usda.gov/pages/how-to-use-the-maps>
- WMO standard climatological normal period:
  <https://wmo.int/wmo-climatological-normals>

## Calculation

The generator selects Ukrainian GHCN-Daily stations whose TMIN inventory
overlaps at least 20 years of 1991-2020. QC-flagged and missing observations are
excluded. A station-year is accepted when it contains at least 250 valid daily
TMIN values, including at least 100 values in January-March and
November-December. A station is retained with at least 20 accepted years.

For each retained station, the coldest TMIN is selected for every accepted year.
The arithmetic mean of those annual extremes is classified into the published
USDA Celsius bands. The tracked CSV is the resulting 23-station snapshot.

## Limits

The image is a point illustration, not an official Ukrainian hardiness-zone map.
No spatial interpolation is performed, and the points do not define regional or
administrative boundaries. Incomplete station coverage, elevation, terrain,
coastal influence, urban heat, and garden microclimates require local checking.

Regenerate from the tracked snapshot:

```powershell
python scripts\generate_ukraine_hardiness_article_media.py
```

Refresh upstream station data and rebuild the snapshot:

```powershell
python scripts\generate_ukraine_hardiness_article_media.py --refresh-source-data
```
