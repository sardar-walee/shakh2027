export type Lang = "ku" | "ar" | "en";

export type FieldType =
  | "text"
  | "number"
  | "select"
  | "textarea"
  | "tel"
  | "boolean";

export type PostField = {
  key: string;
  type: FieldType;
  section: string;
  labels: Record<Lang, string>;
  options?: { value: string; labels: Record<Lang, string> }[];
  required?: boolean;
  placeholder?: Record<Lang, string>;
};

export type PostCategory =
  | "restaurant"
  | "supermarket"
  | "fashion"
  | "beauty"
  | "car_dealer";

const L = (ku: string, ar: string, en: string) => ({ ku, ar, en });

export const sectionTitles: Record<string, Record<Lang, string>> = {
  basic: L("زانیاری سەرەکی", "المعلومات الأساسية", "Basic info"),
  specs: L("تایبەتمەندییەکان", "المواصفات", "Specifications"),
  machine: L("تایبەتمەندیی تەکنیکی", "مواصفات تقنية", "Technical specs"),
  condition: L("دۆخ", "الحالة", "Condition"),
  sale: L("فرۆشتن", "البيع", "Sale options"),
  seller: L("فرۆشیار", "البائع", "Seller"),
};

const conditionOpts = [
  { value: "excellent", labels: L("زۆر باش", "ممتاز", "Excellent") },
  { value: "good", labels: L("باش", "جيد", "Good") },
  { value: "fair", labels: L("مامناوەند", "متوسط", "Fair") },
  { value: "needs_repair", labels: L("پێویستی چاککردنەوە", "يحتاج إصلاح", "Needs repair") },
];

const audienceOpts = [
  { value: "men", labels: L("پیاو", "رجال", "Men") },
  { value: "women", labels: L("ئافرەت", "نساء", "Women") },
  { value: "children", labels: L("منداڵ", "أطفال", "Children") },
];

const fuelOpts = [
  { value: "petrol", labels: L("بەنزین", "بنزين", "Petrol") },
  { value: "diesel", labels: L("دیزڵ", "ديزل", "Diesel") },
  { value: "electric", labels: L("کارەبا", "كهرباء", "Electric") },
  { value: "hybrid", labels: L("هایبرید", "هجين", "Hybrid") },
];

const listingTypeOpts = [
  { value: "car", labels: L("ئۆتۆمبێل", "سيارة", "Car") },
  { value: "machine", labels: L("مەکینە / گێر", "آلة / معدات", "Machine / gear") },
  { value: "parts", labels: L("پارچە", "قطع", "Parts") },
];

function carFields(): PostField[] {
  return [
    { key: "listing_type", type: "select", section: "basic", labels: L("جۆری ڕێکلام", "نوع الإعلان", "Listing type"), options: listingTypeOpts, required: true },
    { key: "title", type: "text", section: "basic", labels: L("ناونیشان", "العنوان", "Title"), required: true },
    { key: "brand", type: "text", section: "basic", labels: L("براند", "الماركة", "Brand"), required: true },
    { key: "model", type: "text", section: "basic", labels: L("مۆدێل", "الموديل", "Model"), required: true },
    { key: "year", type: "number", section: "basic", labels: L("ساڵ", "السنة", "Year") },
    { key: "mileage_km", type: "number", section: "basic", labels: L("ماوەی ڕۆیشتن (km)", "المسافة (كم)", "Mileage (km)") },
    { key: "price", type: "number", section: "basic", labels: L("نرخ (د.ع)", "السعر", "Price (IQD)"), required: true },
    { key: "location", type: "text", section: "basic", labels: L("شوێن", "الموقع", "Location") },
    { key: "phone", type: "tel", section: "basic", labels: L("ژمارەی مۆبایل", "الهاتف", "Phone"), required: true },
    { key: "whatsapp", type: "tel", section: "basic", labels: L("واتساپ", "واتساب", "WhatsApp") },
    { key: "fuel", type: "select", section: "specs", labels: L("سووتەمەنی", "الوقود", "Fuel"), options: fuelOpts },
    { key: "transmission", type: "select", section: "specs", labels: L("گێربۆکس", "ناقل الحركة", "Transmission"), options: [
      { value: "auto", labels: L("ئۆتۆماتیک", "أوتوماتيك", "Automatic") },
      { value: "manual", labels: L("دەستی", "يدوي", "Manual") },
    ]},
    { key: "engine_cc", type: "number", section: "specs", labels: L("قەبارەی مووتۆر", "سعة المحرك", "Engine (cc)") },
    { key: "color", type: "text", section: "specs", labels: L("ڕەنگ", "اللون", "Color") },
    { key: "body_type", type: "text", section: "specs", labels: L("جۆری بۆدی", "نوع الهيكل", "Body type") },
    { key: "drive_type", type: "select", section: "specs", labels: L("پێش/دوو/چوار", "الدفع", "Drive"), options: [
      { value: "fwd", labels: L("پێش", "أمامي", "FWD") },
      { value: "rwd", labels: L("دوو", "خلفي", "RWD") },
      { value: "awd", labels: L("چوار", "رباعي", "AWD") },
    ]},
    { key: "power_hp", type: "number", section: "machine", labels: L("توان (HP)", "القوة", "Power (HP)") },
    { key: "voltage", type: "text", section: "machine", labels: L("Voltage", "Voltage", "Voltage") },
    { key: "capacity", type: "text", section: "machine", labels: L("Capacity", "السعة", "Capacity") },
    { key: "rpm", type: "number", section: "machine", labels: L("RPM", "RPM", "RPM") },
    { key: "weight_kg", type: "number", section: "machine", labels: L("کێش (kg)", "الوزن", "Weight (kg)") },
    { key: "dimensions", type: "text", section: "machine", labels: L("قەبارە", "الأبعاد", "Dimensions") },
    { key: "origin_country", type: "text", section: "machine", labels: L("وڵاتی بەرهەم", "بلد المنشأ", "Country of origin") },
    { key: "serial_number", type: "text", section: "machine", labels: L("ژمارەی زنجیرە", "الرقم التسلسلي", "Serial number") },
    { key: "hours_used", type: "number", section: "machine", labels: L("کاتژمێری بەکارهێنان", "ساعات التشغيل", "Hours used") },
    { key: "warranty", type: "text", section: "machine", labels: L("گەرەنتی", "الضمان", "Warranty") },
    { key: "condition", type: "select", section: "condition", labels: L("دۆخ", "الحالة", "Condition"), options: conditionOpts },
    { key: "negotiable", type: "boolean", section: "sale", labels: L("نرخی گفتوگۆ", "قابل للتفاوض", "Negotiable") },
    { key: "exchange", type: "boolean", section: "sale", labels: L("گۆڕینەوە", "مقايضة", "Exchange") },
    { key: "delivery_available", type: "boolean", section: "sale", labels: L("گەیاندن", "توصيل", "Delivery") },
    { key: "installation", type: "boolean", section: "sale", labels: L("دامەزراندن", "تركيب", "Installation") },
    { key: "spare_parts", type: "boolean", section: "sale", labels: L("پارچەی یەدەگ", "قطع غيار", "Spare parts") },
    { key: "seller_name", type: "text", section: "seller", labels: L("ناوی فرۆشیار", "اسم البائع", "Seller name") },
    { key: "seller_type", type: "select", section: "seller", labels: L("جۆری فرۆشیار", "نوع البائع", "Seller type"), options: [
      { value: "individual", labels: L("تاکەکەس", "فرد", "Individual") },
      { value: "company", labels: L("کۆمپانیا", "شركة", "Company") },
    ]},
    { key: "description", type: "textarea", section: "basic", labels: L("وەسف", "الوصف", "Description") },
  ];
}

export const fieldsByCategory: Record<PostCategory, PostField[]> = {
  restaurant: [
    { key: "dish_name", type: "text", section: "basic", labels: L("ناوی خواردن", "اسم الطبق", "Dish name"), required: true },
    { key: "price", type: "number", section: "basic", labels: L("نرخ", "السعر", "Price"), required: true },
    { key: "description", type: "textarea", section: "basic", labels: L("وەسف", "الوصف", "Description") },
    { key: "phone", type: "tel", section: "basic", labels: L("ژمارەی پەیوەندی", "الهاتف", "Phone") },
  ],
  supermarket: [
    { key: "product_name", type: "text", section: "basic", labels: L("ناوی کالا", "اسم المنتج", "Product name"), required: true },
    { key: "category_name", type: "text", section: "basic", labels: L("کاتەگۆری", "الفئة", "Category"), required: true },
    { key: "price", type: "number", section: "basic", labels: L("نرخ", "السعر", "Price"), required: true },
    { key: "unit", type: "text", section: "basic", labels: L("یەکە", "الوحدة", "Unit") },
    { key: "description", type: "textarea", section: "basic", labels: L("وەسف", "الوصف", "Description") },
  ],
  fashion: [
    { key: "category_name", type: "text", section: "basic", labels: L("کاتەگۆری", "الفئة", "Category"), required: true },
    { key: "product_name", type: "text", section: "basic", labels: L("ناو", "الاسم", "Name"), required: true },
    { key: "product_type", type: "text", section: "basic", labels: L("جۆر", "النوع", "Type"), required: true },
    { key: "price", type: "number", section: "basic", labels: L("نرخ", "السعر", "Price"), required: true },
    { key: "size", type: "text", section: "basic", labels: L("قەبارە", "المقاس", "Size") },
    { key: "audience", type: "select", section: "basic", labels: L(" بۆ کەس", "الفئة", "For"), options: audienceOpts, required: true },
    { key: "description", type: "textarea", section: "basic", labels: L("وەسف", "الوصف", "Description") },
  ],
  beauty: [
    { key: "product_name", type: "text", section: "basic", labels: L("ناو", "الاسم", "Name"), required: true },
    { key: "product_type", type: "text", section: "basic", labels: L("جۆر", "النوع", "Type"), required: true },
    { key: "price", type: "number", section: "basic", labels: L("نرخ", "السعر", "Price"), required: true },
    { key: "description", type: "textarea", section: "basic", labels: L("وەسف", "الوصف", "Description") },
  ],
  car_dealer: carFields(),
};

export function postTitleFromAttributes(
  category: PostCategory,
  attrs: Record<string, string | number | boolean>
): string {
  if (category === "car_dealer") {
    const t = attrs.title as string;
    if (t) return t;
    return [attrs.brand, attrs.model, attrs.year].filter(Boolean).join(" ") || "ئۆتۆمبێل";
  }
  if (category === "supermarket") return String(attrs.product_name || "");
  if (category === "fashion") return String(attrs.product_name || "");
  if (category === "beauty") return String(attrs.product_name || "");
  if (category === "restaurant") return String(attrs.dish_name || "");
  return "پۆست";
}

export function postPriceFromAttributes(
  attrs: Record<string, string | number | boolean>
): number {
  const p = attrs.price;
  return typeof p === "number" ? p : Number(p) || 0;
}
