type DescriptionTemplate = {
  trUse: string;
  enUse: string;
  trType: string;
  enType: string;
  trFocus: string;
  enFocus: string;
};

type GenerateDescriptionInput = {
  titleTr: string;
  titleEn: string;
  fallbackTitle: string;
  location: string;
  year: string;
  categories: string[];
};

const templates: Record<string, DescriptionTemplate> = {
  "Lüks Villa": {
    trUse: "özel yaşam ihtiyaçlarına yönelik geliştirilen",
    enUse: "developed for private residential living",
    trType: "lüks villa tasarımı",
    enType: "luxury villa design",
    trFocus: "zarif malzeme seçimi, mahremiyet dengesi ve rafine yaşam kurgusuyla",
    enFocus: "elegant material selection, privacy balance, and a refined living sequence",
  },
  "İdari Bina": {
    trUse: "kurumsal kullanım ihtiyaçlarına yönelik geliştirilen",
    enUse: "developed for institutional and administrative use",
    trType: "idari bina tasarımı",
    enType: "administrative building design",
    trFocus: "işlevsel plan kurgusu, temsil gücü ve yalın mekansal organizasyonuyla",
    enFocus: "functional planning, a strong representative character, and clear spatial organization",
  },
  "Cephe Tasarımı": {
    trUse: "çağdaş cephe dili odağında ele alınan",
    enUse: "shaped around a contemporary facade language",
    trType: "cephe tasarımı",
    enType: "facade design",
    trFocus: "cephe dili, malzeme dengesi ve güçlü mimari kimliğiyle",
    enFocus: "facade rhythm, material balance, and a strong architectural identity",
  },
  "Örnek Daire": {
    trUse: "satış ve sunum deneyimini güçlendirmek için hazırlanan",
    enUse: "created to strengthen the sales and presentation experience",
    trType: "örnek daire tasarımı",
    enType: "show flat design",
    trFocus: "sıcak atmosferi, seçkin detayları ve kullanıcıyı içine alan mekan kurgusuyla",
    enFocus: "a warm atmosphere, refined details, and an immersive spatial narrative",
  },
  Otel: {
    trUse: "konaklama deneyimini rafine etmek amacıyla geliştirilen",
    enUse: "developed to refine the hospitality experience",
    trType: "otel tasarımı",
    enType: "hotel design",
    trFocus: "karşılama etkisi, konfor dengesi ve zamansız malzeme diliyle",
    enFocus: "arrival impact, comfort balance, and a timeless material language",
  },
  Ofis: {
    trUse: "verimli ve prestijli çalışma ortamları için geliştirilen",
    enUse: "developed for efficient and prestigious work environments",
    trType: "ofis tasarımı",
    enType: "office design",
    trFocus: "çalışma akışı, akustik konfor ve kurumsal kimlikle uyumlu detaylarıyla",
    enFocus: "workflow clarity, acoustic comfort, and details aligned with corporate identity",
  },
  "Restoran / Cafe": {
    trUse: "misafir deneyimini ve marka atmosferini güçlendirmek için tasarlanan",
    enUse: "designed to enhance guest experience and brand atmosphere",
    trType: "restoran / cafe tasarımı",
    enType: "restaurant / cafe design",
    trFocus: "ambiyans, oturma kurgusu ve dikkat çekici malzeme kompozisyonuyla",
    enFocus: "ambience, seating strategy, and a distinctive material composition",
  },
  Konut: {
    trUse: "günlük yaşam konforunu yükseltmek için geliştirilen",
    enUse: "developed to elevate everyday residential comfort",
    trType: "konut tasarımı",
    enType: "residential design",
    trFocus: "sade plan kurgusu, sıcak malzeme geçişleri ve dengeli yaşam alanlarıyla",
    enFocus: "clear planning, warm material transitions, and balanced living areas",
  },
  "Ticari Alan": {
    trUse: "marka algısını ve kullanıcı deneyimini güçlendirmek için geliştirilen",
    enUse: "developed to strengthen brand perception and user experience",
    trType: "ticari alan tasarımı",
    enType: "commercial space design",
    trFocus: "dolaşım netliği, vitrin etkisi ve güçlü mekansal kimliğiyle",
    enFocus: "clear circulation, display impact, and a strong spatial identity",
  },
  "İç Mekan": {
    trUse: "iç mekanda atmosfer, konfor ve detay kalitesini öne çıkaran",
    enUse: "focused on atmosphere, comfort, and detail quality within the interior",
    trType: "iç mekan tasarımı",
    enType: "interior design",
    trFocus: "malzeme dengesi, ışık kullanımı ve rafine detay çözümüyle",
    enFocus: "material balance, considered lighting, and refined detailing",
  },
  "Dış Mekan": {
    trUse: "yapının çevresiyle kurduğu ilişkiyi güçlendirmek üzere tasarlanan",
    enUse: "designed to strengthen the relationship between the building and its surroundings",
    trType: "dış mekan tasarımı",
    enType: "exterior design",
    trFocus: "kütle algısı, dış mekan akışı ve dayanıklı malzeme diliyle",
    enFocus: "volume perception, exterior flow, and a durable material language",
  },
  Peyzaj: {
    trUse: "açık alan deneyimini mimari bütünlüğün parçası olarak ele alan",
    enUse: "developed as an architectural extension of the outdoor experience",
    trType: "peyzaj tasarımı",
    enType: "landscape design",
    trFocus: "bitkisel doku, sert zemin dengesi ve sakin açık alan kurgusuyla",
    enFocus: "planting texture, hardscape balance, and a calm outdoor composition",
  },
  Diğer: {
    trUse: "projenin ihtiyaçlarına özel geliştirilen",
    enUse: "developed around the specific needs of the project",
    trType: "mimari konsept çalışması",
    enType: "architectural concept study",
    trFocus: "malzeme dengesi, oran ve zamansız görsel anlatımıyla",
    enFocus: "material balance, proportion, and timeless visual expression",
  },
};

export function generateProjectDescriptions(input: GenerateDescriptionInput) {
  const selectedTemplates = getSelectedTemplates(input.categories);
  const primaryTemplate = selectedTemplates[0];
  const titleTr = input.titleTr || input.fallbackTitle || input.titleEn || "Bu proje";
  const titleEn = input.titleEn || input.fallbackTitle || input.titleTr || "This project";
  const trContext = formatContext(input.location, input.year, "tr");
  const enContext = formatContext(input.location, input.year, "en");

  return {
    tr: `${titleTr}, ${trContext}${joinUnique(selectedTemplates.map((template) => template.trUse), "tr")}; ${joinUnique(
      selectedTemplates.map((template) => template.trFocus),
      "tr",
      "focus",
    )} öne çıkan bir ${primaryTemplate.trType}dır.`,
    en: `${titleEn} is ${enContext}${joinUnique(selectedTemplates.map((template) => template.enUse), "en")}; a refined ${primaryTemplate.enType} distinguished by ${joinUnique(
      selectedTemplates.map((template) => template.enFocus),
      "en",
      "focus",
    )}.`,
  };
}

function getSelectedTemplates(categories: string[]) {
  const selected = categories.map((category) => templates[category]).filter(Boolean);
  return selected.length ? selected : [templates.Diğer];
}

function formatContext(location: string, year: string, language: "tr" | "en") {
  if (language === "tr") {
    const locationText = location ? `${location}'te ` : "";
    const yearText = year ? `${year} yılında ` : "";
    return `${locationText}${yearText}`;
  }

  if (location && year) return `a ${year} project in ${location} `;
  if (location) return `a project in ${location} `;
  if (year) return `a ${year} project `;
  return "";
}

function joinUnique(items: string[], language: "tr" | "en", mode: "phrase" | "focus" = "phrase") {
  const uniqueItems = Array.from(new Set(items));

  if (uniqueItems.length <= 1) return uniqueItems[0] ?? "";
  if (mode === "focus") return uniqueItems.join(", ");
  if (uniqueItems.length === 2) return `${uniqueItems[0]} ${language === "tr" ? "ve" : "and"} ${uniqueItems[1]}`;

  return `${uniqueItems.slice(0, -1).join(", ")} ${language === "tr" ? "ve" : "and"} ${uniqueItems[uniqueItems.length - 1]}`;
}
