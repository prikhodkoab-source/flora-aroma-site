import assert from "node:assert/strict";
import os from "node:os";
import path from "node:path";
import { chromium } from "playwright";

const baseUrl = process.env.SITE_BASE_URL || "http://127.0.0.1:4323";
const cases = [
  ["PLANT-0032", "/plants/sosna-zvychaina-plant-0032/", "/images/plants/local/plant-0032-format-01.jpg", "/images/plants/local/plant-0032-card-01.png", null],
  ["PLANT-0091", "/plants/kotivnyk-hronovydnyi-felix-plant-0091/", "/images/plants/local/plant-0091-format-01.jpg", "/images/plants/local/plant-0091-card-01.png", [1200, 1600]],
  ["PLANT-0092", "/plants/kotivnyk-hronovydnyi-alba-plant-0092/", "/images/plants/local/plant-0092-format-01.jpg", "/images/plants/local/plant-0092-card-01.png", [1200, 1600]],
  ["PLANT-0096", "/plants/shavliia-dibrovna-rosak-nigin-plant-0096/", "/images/plants/local/plant-0096-format-01.jpg", "/images/plants/local/plant-0096-card-01.png", [1200, 1600]],
  ["PLANT-0097", "/plants/shavliia-dibrovna-blauk-nigin-plant-0097/", "/images/plants/local/plant-0097-format-01.jpg", "/images/plants/local/plant-0097-card-01.png", [1200, 1600]],
  ["PLANT-0099", "/plants/shavliia-likarska-purpurascens-plant-0099/", "/images/plants/local/plant-0099-format-01.jpg", "/images/plants/local/plant-0099-card-01.png", [1200, 1600]],
];

const browser = await chromium.launch({
  headless: true,
  executablePath: process.env.CHROME_PATH || "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe",
});
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });

try {
  for (const [plantId, route, secondImage, lastImage, expectedSecondDimensions] of cases) {
    const response = await page.goto(`${baseUrl}${route}`, { waitUntil: "networkidle" });
    assert.equal(response?.status(), 200, `${plantId}: page must return 200`);

    const thumbs = page.locator("[data-gallery-thumb]");
    assert.ok((await thumbs.count()) >= 3, `${plantId}: gallery must have at least three images`);

    await thumbs.nth(1).click();
    assert.equal(await page.locator("[data-gallery-image]").getAttribute("src"), secondImage, `${plantId}: V-120 image must be second`);
    if (expectedSecondDimensions) {
      const secondDimensions = await page.locator("[data-gallery-image]").evaluate((image) => [image.naturalWidth, image.naturalHeight]);
      assert.deepEqual(secondDimensions, expectedSecondDimensions, `${plantId}: V-120 image must preserve portrait proportions`);
      const secondScreenshot = path.join(os.tmpdir(), `flora-${plantId.toLowerCase()}-v120-second.png`);
      await page.screenshot({ path: secondScreenshot });
    }

    await thumbs.last().click();
    assert.equal(await page.locator("[data-gallery-image]").getAttribute("src"), lastImage, `${plantId}: plant card must be last`);

    const imageLoaded = await page.locator("[data-gallery-image]").evaluate((image) => image.complete && image.naturalWidth > 0 && image.naturalHeight > 0);
    assert.equal(imageLoaded, true, `${plantId}: final gallery image must load`);

    const hasOverflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    assert.equal(hasOverflow, false, `${plantId}: mobile page must not overflow horizontally`);

    const screenshot = path.join(os.tmpdir(), `flora-${plantId.toLowerCase()}-card-last.png`);
    await page.screenshot({ path: screenshot });
    console.log(`${plantId}=ok screenshot=${screenshot}`);
  }
} finally {
  await browser.close();
}
