import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, extname, join, resolve } from "node:path";

const siteRoot = process.cwd();
const projectRoot = resolve(siteRoot, "..");
const priceCsvPath = join(projectRoot, "data", "exports", "price_list_plants_uk_2026-06-06.csv");
const cardsCsvPath = join(projectRoot, "data", "normalized", "PlantCards_Gate1.csv");
const descriptionSourcesCsvPath = join(projectRoot, "data", "normalized", "PlantDescriptionSources_2026-05-31.csv");
const outputCsvPath = join(siteRoot, "data", "products.csv");
const imageSourcesCsvPath = join(siteRoot, "data", "plant-image-sources.csv");
const publicPlantImagesDir = join(siteRoot, "public", "images", "plants");

function parseCsv(text) {
  const rows = [];
  let row = [];
  let current = "";
  let quoted = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      i += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      row.push(current);
      current = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && next === "\n") {
        i += 1;
      }
      row.push(current);
      if (row.some((value) => value.length > 0)) {
        rows.push(row);
      }
      row = [];
      current = "";
    } else {
      current += char;
    }
  }

  row.push(current);
  if (row.some((value) => value.length > 0)) {
    rows.push(row);
  }

  const [headers, ...body] = rows;
  const normalizedHeaders = headers.map((header) => header.replace(/^\uFEFF/, "").trim());
  return body.map((values) => Object.fromEntries(normalizedHeaders.map((header, index) => [header, values[index] ?? ""])));
}

function csvValue(value) {
  const text = String(value ?? "");
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

function writeCsv(path, rows, headers) {
  const lines = [headers.join(",")];
  for (const row of rows) {
    lines.push(headers.map((header) => csvValue(row[header])).join(","));
  }
  writeFileSync(path, `${lines.join("\n")}\n`, "utf8");
}

function publicCategory(rawCategory) {
  const category = rawCategory.trim().toLowerCase();
  const map = new Map([
    ["ароматическое", "Ароматичні рослини"],
    ["декоративное", "Декоративні багаторічники"],
    ["дерево", "Дерева"],
    ["злак", "Декоративні злаки"],
    ["лекарственное", "Лікарські рослини"],
    ["лекарственное/ароматическое", "Лікарські та ароматичні рослини"],
    ["многолетник", "Декоративні багаторічники"],
    ["однолетник", "Однорічні рослини"],
    ["пряное", "Пряні рослини"],
    ["хвойное", "Хвойні рослини"]
  ]);
  return map.get(category) ?? "Рослини для саду";
}

function fallbackSummary(row) {
  const name = row.name_uk;
  const category = row.category.toLowerCase();

  if (category.includes("аромат") || category.includes("пря") || category.includes("лекар")) {
    return `${name} - рослина для ароматичних посадок, садових композицій і практичного використання. Формат постачання та готовність підтверджує оператор перед замовленням.`;
  }

  if (category.includes("дерево") || category.includes("хвой")) {
    return `${name} - саджанець для озеленення, акцентних посадок і довгострокових садових композицій. Наявність і готовність підтверджує оператор перед замовленням.`;
  }

  if (category.includes("злак")) {
    return `${name} - декоративна рослина для природних квітників, бордюрів і ландшафтних груп. Наявність і готовність підтверджує оператор перед замовленням.`;
  }

  return `${name} - декоративна рослина для саду, квітників і змішаних посадок. Наявність і готовність підтверджує оператор перед замовленням.`;
}

function hasAny(value, parts) {
  const text = String(value ?? "").toLowerCase();
  return parts.some((part) => text.includes(part.toLowerCase()));
}

function categoryKind(rawCategory, publicCategoryName) {
  const joined = `${rawCategory ?? ""} ${publicCategoryName ?? ""}`;

  if (hasAny(joined, ["хвой", "conifer"])) return "conifer";
  if (hasAny(joined, ["дерево", "tree"])) return "tree";
  if (hasAny(joined, ["Festuca", "Pennisetum", "костри", "вівсян", "пенісетум", "злак", "grass"])) return "grass";
  if (
    hasAny(joined, [
      "Ocimum",
      "Satureja",
      "Thymus",
      "Origanum",
      "Mentha",
      "Lavandula",
      "Nepeta",
      "Agastache",
      "Pycnanthemum",
      "базил",
      "чабер",
      "чебре",
      "орегано",
      "майоран",
      "м'ята",
      "м’ята",
      "лаванда",
      "котовник",
      "агастахе",
      "прян",
      "аромат",
      "aromatic"
    ])
  ) {
    return "aromatic";
  }
  if (hasAny(joined, ["лікар", "лекар", "medicinal"])) return "medicinal";
  if (hasAny(joined, ["однор", "annual"])) return "annual";

  return "perennial";
}

function winterSentence(card) {
  const value = String(card.winter_hardy ?? "").trim();
  if (!value) {
    return "Зимостійкість в умовах Києва потребує уточнення.";
  }

  const normalized = value.toLowerCase();
  if (normalized.includes("однорічник")) {
    return "У Києві вирощується як однорічна культура і не зимує у відкритому ґрунті.";
  }

  const minimumZone = Number(value.match(/\d+/)?.[0]);
  if (!Number.isFinite(minimumZone)) {
    return "Зимостійкість в умовах Києва потребує уточнення.";
  }
  if (minimumZone <= 5) {
    const level = minimumZone <= 4 ? "високий" : "достатній";
    return `Зимостійка в умовах Києва, рівень ${level}.`;
  }
  if (minimumZone <= 7) {
    return "Не має надійної зимостійкості у відкритому ґрунті в умовах Києва; рівень низький, потрібне зимове укриття.";
  }
  return "Не зимостійка у відкритому ґрунті в умовах Києва; потрібна захищена зимівля.";
}

function replacePublicWinterSentence(text, card) {
  const cleaned = String(text ?? "").trim().replace(
    /\s+(?:Зимостійкість:.*|Добре зимує в умовах Києва.*|У Києві вирощується.*|Зимівля у відкритому ґрунті.*|Не зимує у відкритому ґрунті.*|Зимостійка в умовах Києва.*|Не має надійної зимостійкості.*|Не зимостійка у відкритому ґрунті.*)$/iu,
    ""
  ).trim();
  return compactSpaces(`${cleaned} ${winterSentence(card)}`);
}

function compactSpaces(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function cleanPublicGeneratedText(value) {
  let text = String(value ?? "");
  const replacements = new Map([
    ["Довідкова основа картки:", ""],
    ["Господарське застосування:", "Застосування в саду:"],
    ["невеликі товарні партії для садових центрів і приватних садів", "ароматичні композиції для приватних садів"],
    ["невеликі товарні партії для озеленення", "садові та ландшафтні посадки"],
    ["невеликі товарні партії для роздрібного продажу", "садові посадки"],
    ["контейнерні або касетні партії для роздрібного продажу", "контейнерні посадки"],
    ["контейнерні посадки і невеликі товарні партії для роздрібного продажу", "контейнерні посадки"],
    ["Для клієнта це рослина, яку варто підбирати", "Рослину варто підбирати"],
    ["Для клієнта важливо підкреслювати", "Варто врахувати"],
    ["ключове рішення для клієнта - правильне місце", "ключове рішення - правильне місце"],
    ["У консультації потрібно пояснювати", "Важливо врахувати"],
    ["Клієнту коректно продавати рослину як", "Рослина доречна як"],
    ["для клієнтів, які шукають", "для садів, де потрібне"],
    ["Для товарної якості важливі", "Для здорового вигляду важливі"],
    ["У товарній партії важливі", "Для охайного вигляду важливі"],
    ["Для здорового вигляду важливі рівномірна партія", "Для здорового вигляду важливі рівномірний розвиток"],
    ["Для продажу важливі компактність", "Для охайного вигляду важливі компактність"],
    ["рівномірний розвиток партії", "рівномірний розвиток рослин"],
    ["невеликі декоративні партії для контейнерів", "контейнери"],
    ["Добра група для клієнтів, яким потрібен результат у поточному сезоні", "Підходить для швидкого декоративного результату в поточному сезоні"],
    ["У продажу цінна як", "Цінна як"],
    ["Для продажу важливо вказувати", "Варто врахувати"],
    [
      "Добре продається як виразна компактна культура, але потребує чесного пояснення клієнту про дренаж",
      "Добре виглядає як виразна компактна культура, але потребує добре дренованого місця"
    ],
    ["без публікації точного складського залишку", ""],
    [
      "на сайті подається лише як довідкова властивість культури, без медичних обіцянок і без рекомендацій із застосування",
      "не є основою для медичних порад"
    ]
  ]);

  for (const [from, to] of replacements) {
    text = text.replaceAll(from, to);
  }

  return compactSpaces(
    text
      .replace(/Поточний формат постачання:\s*[^.]+\.\s*/giu, "")
      .replace(/Формат постачання уточнює оператор\.\s*/giu, "")
      .replace(/Харчове (чи|або) лікарське використання[^.]+\.\s*/giu, "")
      .replace(/Харчове або лікувальне застосування[^.]+\.\s*/giu, "")
      .replace(/Харчове використання[^.]+\.\s*/giu, "")
      .replace(/Лікарське використання[^.]+\.\s*/giu, "")
      .replace(/Лікарська репутація культури[^.]+\.\s*/giu, "")
      .replace(/;?\s*харчове або\s+(?=[А-ЯA-ZІЇЄҐ])/giu, ". ")
      .replace(/\s+([,.;:])/gu, "$1")
      .replace(/([.!?]){2,}/gu, "$1")
  );
}

function sourceForPlant(row) {
  const fallback = {
    "PLANT-0088": {
      source_names: "Plants of the World Online / Kew; Royal Horticultural Society; Missouri Botanical Garden",
      source_urls:
        "https://powo.science.kew.org/taxon/urn:lsid:ipni.org:names:278095-1; https://www.rhs.org.uk/plants/search-form?query=Arabis%20caucasica; https://www.missouribotanicalgarden.org/PlantFinder/PlantFinderSearch.aspx?search=Arabis%20caucasica",
      source_confidence: "medium",
      source_note: "Species-level Arabis caucasica references; cultivar and local wintering should be checked before polished print copy."
    },
    "PLANT-0089": {
      source_names: "Royal Horticultural Society; Missouri Botanical Garden; Plants of the World Online / Kew",
      source_urls:
        "https://www.rhs.org.uk/plants/11649/ocimum-basilicum/details; https://www.rhs.org.uk/herbs/basil/grow-your-own; https://www.missouribotanicalgarden.org/PlantFinder/PlantFinderDetails.aspx?taxonid=281408; https://powo.science.kew.org/results?q=Ocimum%20basilicum",
      source_confidence: "high",
      source_note: "Basil horticulture and plant profile references; food use is described as culinary crop, not as medical advice."
    },
    "PLANT-0086": {
      source_names: "NC State Extension Gardener Plant Toolbox; Plants of the World Online / Kew; Royal Horticultural Society",
      source_urls:
        "https://plants.ces.ncsu.edu/plants/hypericum-perforatum/; https://powo.science.kew.org/results?q=Hypericum%20perforatum; https://www.rhs.org.uk/plants/search-form?query=Hypericum%20perforatum",
      source_confidence: "high",
      source_note: "Species-level St. John's wort references; medicinal reputation is not a treatment recommendation."
    },
    "PLANT-0087": {
      source_names: "Missouri Botanical Garden; Royal Horticultural Society; Plants of the World Online / Kew",
      source_urls:
        "https://www.missouribotanicalgarden.org/PlantFinder/PlantFinderDetails.aspx?kempercode=a294; https://www.rhs.org.uk/plants/search-form?query=Thymus%20serpyllum; https://powo.science.kew.org/results?q=Thymus%20serpyllum",
      source_confidence: "high",
      source_note: "Species-level creeping thyme references; ornamental groundcover use separated from culinary thyme claims."
    }
  };

  if (!row) {
    return fallback;
  }

  return {
    source_names: [row.taxonomy_source && "Plants of the World Online / Kew", row.horticulture_source_rhs_search && "Royal Horticultural Society", row.horticulture_source_nc_state_search && "NC State Extension Gardener Plant Toolbox", row.horticulture_source_mobot_search && "Missouri Botanical Garden"]
      .filter(Boolean)
      .join("; "),
    source_urls: [
      row.taxonomy_source,
      row.horticulture_source_rhs_search,
      row.horticulture_source_nc_state_search,
      row.horticulture_source_mobot_search
    ]
      .filter(Boolean)
      .join("; "),
    source_confidence: "medium",
    source_note: row.notes || "Species-level source-backed public catalog draft."
  };
}

function expandedTexts({ card, name, latinName, publicCategoryName, container, summary }) {
  const kind = categoryKind(`${card.category ?? ""} ${name} ${latinName} ${summary}`, publicCategoryName);
  const latin = latinName ? ` (${latinName})` : "";
  const base = `${name}${latin}`;
  const format = container ? `Поточний формат постачання: ${container}.` : "Формат постачання уточнює оператор.";
  const winter = winterSentence(card);
  const sourceBasis = summary ? `Довідкова основа картки: ${summary}` : "";

  const profiles = {
    aromatic: {
      ecology: compactSpaces(`${sourceBasis} ${base} добре підходить для сонячних ароматичних посадок, пряних грядок і змішаних квітників з легким рухом повітря. Найстабільніше виглядає на добре дренованому ґрунті без застою води; надмірне перезволоження знижує якість рослин і ароматичність листя. ${winter}`),
      agrotechnics: `${format} Після висадки розсаду краще адаптувати поступово: підтримувати помірний полив до вкорінення, не загущувати посадку і залишати доступ повітря до основи куща. Для щільної декоративної форми корисне легке підрізання або прибирання відцвілих пагонів; підживлення має бути помірним, без надлишку азоту.`,
      use: "Господарське застосування: ароматичні бордюри, пряні композиції, ділянки для запилювачів, невеликі товарні партії для садових центрів і приватних садів. Харчове або лікарське використання на сайті подається лише як довідкова властивість культури, без медичних обіцянок і без рекомендацій із застосування."
    },
    medicinal: {
      ecology: compactSpaces(`${sourceBasis} ${base} варто розміщувати на світлих ділянках з водопроникним ґрунтом і без тривалого застою вологи. Такі культури часто краще зберігають форму й декоративність у помірно сухих умовах, ніж у важкому перезволоженому ґрунті. ${winter}`),
      agrotechnics: `${format} Висаджувати бажано після вкорінення розсади, з помірним поливом у перший період і подальшим переходом до більш стриманого режиму. Для товарної якості важливі чиста розетка або кущ, відсутність бур'янів у контейнері, рівномірна партія і своєчасне санітарне прибирання старих пагонів.`,
      use: "Господарське застосування: декоративні та довідково лікарські колекції, сухі й сонячні квітники, природні композиції, освітні посадки. Лікарське використання не є інструкцією для лікування; клієнту коректно продавати рослину як садову культуру з відомою етноботанічною репутацією."
    },
    grass: {
      ecology: compactSpaces(`${sourceBasis} ${base} використовується як структурна рослина для сонячних або добре освітлених композицій. Декоративні злаки особливо виразні на дренованих ґрунтах, де немає застою води біля кореневої шийки. ${winter}`),
      agrotechnics: `${format} Після висадки важливо дати рослині рівномірно вкоренитися, не переливати і не загущувати посадку. Старе листя зазвичай прибирають навесні або після втрати декоративності, щоб новий приріст виглядав чисто і рівномірно.`,
      use: "Господарське застосування: бордюри, масиви, міксбордери, природні сади, акцентні плями біля доріжок і контейнерні композиції. У продажу такі рослини цінні як швидкий спосіб додати фактуру, рух і сезонний об'єм посадці."
    },
    tree: {
      ecology: compactSpaces(`${sourceBasis} ${base} є довгостроковою садовою культурою, для якої важливо одразу підібрати місце з достатнім простором для крони й кореневої системи. Ґрунт має бути структурним і водопроникним; застій води або ущільнення ґрунту погіршують приживлення. ${winter}`),
      agrotechnics: `${format} Під час висадки потрібно зберігати кореневу грудку, не заглиблювати кореневу шийку, добре пролити посадкову яму і замульчувати пристовбурову зону. У перший сезон головне завдання - рівномірна волога без заболочення та захист від механічних пошкоджень.`,
      use: "Господарське застосування: озеленення приватних садів, алейні й паркові посадки, довгострокові ландшафтні композиції, тінь або структурний акцент. Для клієнта важливо підкреслювати майбутній розмір рослини й необхідність правильного місця посадки."
    },
    conifer: {
      ecology: compactSpaces(`${sourceBasis} ${base} підходить для довготривалих хвойних композицій, акцентних груп і ділянок, де потрібна стабільна зелена структура протягом року. Найкраще розвивається на повітропроникному ґрунті без застою води; для хвойних особливо важливий дренаж і захист коренів від пересихання після посадки. ${winter}`),
      agrotechnics: `${format} Висаджувати слід із максимально збереженою кореневою грудкою, без заглиблення кореневої шийки. Перший сезон потребує регулярного, але не надмірного поливу, мульчування і контролю сонячного та вітрового стресу; формувальну обрізку проводять обережно, відповідно до виду.`,
      use: "Господарське застосування: вічнозелені акценти, хвойні групи, структурні посадки біля входів, доріжок і відкритих газонів. У продажу важливо пояснювати клієнту майбутній розмір, темп росту й вимоги до місця."
    },
    annual: {
      ecology: compactSpaces(`${sourceBasis} ${base} використовується як сезонна декоративна культура для світлих квітників, контейнерів і швидкого заповнення композицій. Для якісного цвітіння потрібні достатнє освітлення, рівномірна волога і ґрунт без застою води. ${winter}`),
      agrotechnics: `${format} Після висадки рослина потребує регулярного поливу до вкорінення, легкого підживлення в період активного росту і видалення відцвілих частин для охайного вигляду. У товарній партії важливі компактність, чисте листя і рівномірний розвиток.`,
      use: "Господарське застосування: сезонні клумби, контейнери, бордюри, швидкі кольорові акценти для приватних і комерційних об'єктів. Такі рослини зручні для клієнтів, яким потрібен помітний декоративний ефект у поточному сезоні."
    },
    perennial: {
      ecology: compactSpaces(`${sourceBasis} ${base} підходить для змішаних квітників, бордюрів і природних садових композицій. Для стабільного росту важливі відповідне освітлення, водопроникний ґрунт і відсутність тривалого застою води. ${winter}`),
      agrotechnics: `${format} Після висадки потрібно підтримати вкорінення помірним поливом, не загущувати рослини і стежити за чистотою посадки. Санітарне прибирання старих пагонів, легке мульчування і помірне живлення допомагають зберігати декоративність протягом сезону.`,
      use: "Господарське застосування: квітники, бордюри, міксбордери, природні посадки, невеликі товарні партії для озеленення. Для клієнта це рослина, яку варто підбирати не тільки за виглядом, а й за умовами ділянки та бажаною роллю в композиції."
    }
  };

  const selected = profiles[kind] ?? profiles.perennial;
  const ecology = cleanPublicGeneratedText(selected.ecology);
  const agrotechnics = cleanPublicGeneratedText(selected.agrotechnics);
  const use = cleanPublicGeneratedText(selected.use);
  return {
    ecology_text: ecology,
    agrotechnics_text: agrotechnics,
    use_text: use,
    full_description: cleanPublicGeneratedText(`${ecology} ${agrotechnics} ${use}`),
    content_status: "source_backed_species_draft"
  };
}

function imagePathFor(card, externalSource) {
  const sourcePath = card.primary_photo_path;
  if (!sourcePath || card.photo_status !== "client_safe" || !existsSync(sourcePath)) {
    return externalSource?.image_path ?? "";
  }

  mkdirSync(publicPlantImagesDir, { recursive: true });
  const ext = extname(sourcePath).toLowerCase() || ".jpg";
  const targetName = `${card.plant_id.toLowerCase()}${ext}`;
  const targetPath = join(publicPlantImagesDir, targetName);
  copyFileSync(sourcePath, targetPath);
  return `/images/plants/${targetName}`;
}

const priceRows = parseCsv(readFileSync(priceCsvPath, "utf8"));
const cardRows = parseCsv(readFileSync(cardsCsvPath, "utf8"));
const cardsByPlantId = new Map(cardRows.map((row) => [row.plant_id, row]));
const descriptionSourceRows = existsSync(descriptionSourcesCsvPath)
  ? parseCsv(readFileSync(descriptionSourcesCsvPath, "utf8"))
  : [];
const sourcesByPlantId = new Map(descriptionSourceRows.map((row) => [row.plant_id, row]));
const externalImageRows = existsSync(imageSourcesCsvPath) ? parseCsv(readFileSync(imageSourcesCsvPath, "utf8")) : [];
const externalImagesByPlantId = new Map(externalImageRows.map((row) => [row.plant_id, row]));

const products = priceRows.map((priceRow) => {
  const card = cardsByPlantId.get(priceRow.plant_id) ?? {};
  const externalImage = externalImagesByPlantId.get(priceRow.plant_id);
  const category = publicCategory(card.category ?? "");
  const summary = replacePublicWinterSentence(
    card.client_description || fallbackSummary({ name_uk: priceRow["Українська назва"], category }),
    card
  );
  const source = sourceForPlant(sourcesByPlantId.get(priceRow.plant_id))[priceRow.plant_id] ?? sourceForPlant(sourcesByPlantId.get(priceRow.plant_id));
  const expanded = expandedTexts({
    card,
    name: priceRow["Українська назва"],
    latinName: priceRow["Латинська назва"],
    publicCategoryName: category,
    container: priceRow["Горщик / касета"],
    summary
  });
  const seoTitle = `${priceRow["Українська назва"]} - саджанці Flora & Aroma`;
  const seoDescription = `${priceRow["Українська назва"]} (${priceRow["Латинська назва"]}). ${priceRow["Горщик / касета"]}. Ціна ${priceRow["Ціна"].replace(" UAH/шт.", "")} UAH/шт. Наявність підтверджує оператор.`;

  return {
    plant_id: priceRow.plant_id,
    name_uk: priceRow["Українська назва"],
    latin_name: priceRow["Латинська назва"],
    category,
    container: priceRow["Горщик / касета"],
    price_uah: priceRow["Ціна"].replace(/\D+/g, ""),
    unit: "шт.",
    availability_status: "ready_for_sale",
    summary,
    ecology_text: expanded.ecology_text,
    agrotechnics_text: expanded.agrotechnics_text,
    use_text: expanded.use_text,
    full_description: expanded.full_description,
    content_status: expanded.content_status,
    source_names: source.source_names,
    source_urls: source.source_urls,
    source_confidence: source.source_confidence,
    source_note: source.source_note,
    seo_title: seoTitle,
    seo_description: seoDescription,
    image_path: imagePathFor(card, externalImage)
  };
});

writeCsv(outputCsvPath, products, [
  "plant_id",
  "name_uk",
  "latin_name",
  "category",
  "container",
  "price_uah",
  "unit",
  "availability_status",
  "summary",
  "ecology_text",
  "agrotechnics_text",
  "use_text",
  "full_description",
  "content_status",
  "source_names",
  "source_urls",
  "source_confidence",
  "source_note",
  "seo_title",
  "seo_description",
  "image_path"
]);

const imageCount = products.filter((product) => product.image_path).length;
console.log(`Generated ${products.length} products with ${imageCount} public images.`);
