import React, { useMemo, useState } from "react";
import {
  fieldsByCategory,
  postPriceFromAttributes,
  postTitleFromAttributes,
  sectionTitles,
  type Lang,
  type PostCategory,
  type PostField,
} from "../config/postFields";
import { GpsPicker } from "./GpsPicker";
import { Plus, Upload } from "lucide-react";

export type PostDraft = {
  category: PostCategory;
  attrs: Record<string, string | number | boolean>;
  lat: number | null;
  lng: number | null;
  locationLabel: string;
  receiptUrl: string;
  imageEmoji: string;
};

type Props = {
  lang: Lang;
  t: (ku: string, ar: string, en: string) => string;
  category: PostCategory;
  onCategoryChange: (c: PostCategory) => void;
  categories: { id: PostCategory; label: string }[];
  isCarByCustomer: boolean;
  listingFee: number;
  onSubmit: (draft: PostDraft) => void;
};

function label(field: PostField, lang: Lang) {
  return field.labels[lang];
}

export function DynamicPostForm({
  lang,
  t,
  category,
  onCategoryChange,
  categories,
  isCarByCustomer,
  listingFee,
  onSubmit,
}: Props) {
  const [attrs, setAttrs] = useState<Record<string, string | number | boolean>>({});
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);
  const [locationLabel, setLocationLabel] = useState("");
  const [receiptUrl, setReceiptUrl] = useState("");
  const [emoji, setEmoji] = useState("📦");

  const fields = fieldsByCategory[category];
  const sections = useMemo(() => {
    const keys = [...new Set(fields.map((f) => f.section))];
    return keys.map((s) => ({
      id: s,
      title: sectionTitles[s]?.[lang] ?? s,
      fields: fields.filter((f) => f.section === s),
    }));
  }, [fields, lang]);

  const listingType = String(attrs.listing_type || "car");
  const visibleFields = useMemo(() => {
    if (category !== "car_dealer") return fields;
    return fields.filter((f) => {
      if (f.section === "machine" && listingType === "car") return false;
      if (f.key === "mileage_km" && listingType === "machine") return false;
      return true;
    });
  }, [category, fields, listingType]);

  function setField(key: string, value: string | number | boolean) {
    setAttrs((a) => ({ ...a, [key]: value }));
  }

  function renderField(f: PostField) {
    const val = attrs[f.key];
    if (f.type === "select" && f.options) {
      return (
        <select
          value={String(val ?? "")}
          onChange={(e) => setField(f.key, e.target.value)}
          required={f.required}
        >
          <option value="">—</option>
          {f.options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.labels[lang]}
            </option>
          ))}
        </select>
      );
    }
    if (f.type === "boolean") {
      return (
        <label className="check-row">
          <input
            type="checkbox"
            checked={Boolean(val)}
            onChange={(e) => setField(f.key, e.target.checked)}
          />
          {label(f, lang)}
        </label>
      );
    }
    if (f.type === "textarea") {
      return (
        <textarea
          rows={3}
          value={String(val ?? "")}
          onChange={(e) => setField(f.key, e.target.value)}
        />
      );
    }
    return (
      <input
        type={f.type === "number" ? "number" : f.type === "tel" ? "tel" : "text"}
        value={val === undefined || val === false ? "" : String(val)}
        onChange={(e) =>
          setField(f.key, f.type === "number" ? Number(e.target.value) : e.target.value)
        }
        required={f.required}
      />
    );
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    onSubmit({
      category,
      attrs,
      lat,
      lng,
      locationLabel,
      receiptUrl,
      imageEmoji: category === "car_dealer" ? "🚗" : emoji,
    });
  }

  const price = postPriceFromAttributes(attrs);
  const feeFromPrice = isCarByCustomer ? Math.max(listingFee, Math.round(price * 0.03)) : 0;

  return (
    <form className="panel post-form-wide" onSubmit={handleSubmit}>
      <h2>{t("پۆستی نوێ", "منشور جديد", "New post")}</h2>
      <label className="field-label">{t("کاتەگۆری", "الفئة", "Category")}</label>
      <select
        value={category}
        onChange={(e) => {
          onCategoryChange(e.target.value as PostCategory);
          setAttrs({});
        }}
      >
        {categories.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>

      {sections.map((sec) => {
        const secFields = visibleFields.filter((f) => f.section === sec.id);
        if (!secFields.length) return null;
        return (
          <div key={sec.id} className="form-section">
            <h3>{sec.title}</h3>
            <div className="field-grid">
              {secFields.map((f) =>
                f.type === "boolean" ? (
                  <div key={f.key}>{renderField(f)}</div>
                ) : (
                  <div key={f.key} className="field-wrap">
                    <label className="field-label">{label(f, lang)}</label>
                    {renderField(f)}
                  </div>
                )
              )}
            </div>
          </div>
        );
      })}

      <GpsPicker
        lat={lat}
        lng={lng}
        label={t("شوێنی GPS", "موقع GPS", "GPS location")}
        pickLabel={t("نیشانەی شوێنم", "حدد موقعي", "Use my location")}
        loadingLabel={t("چاوەڕوان بە...", "جاري التحديد...", "Locating...")}
        errorLabel={t("نەتوانرا شوێن بدۆزرێتەوە", "تعذر تحديد الموقع", "Could not get location")}
        onPick={(la, ln, hint) => {
          setLat(la);
          setLng(ln);
          setLocationLabel(hint);
        }}
      />

      {category !== "car_dealer" && (
        <>
          <label className="field-label">Emoji</label>
          <input value={emoji} onChange={(e) => setEmoji(e.target.value)} maxLength={4} />
        </>
      )}

      {isCarByCustomer && category === "car_dealer" && (
        <div className="fee-box">
          <p>
            {t(
              "پێش پۆستکردن پارەی ڕێکلام بدە (نیسبە). دوای ناردنی وێنەی وەسل، سوپەر ئەدمین پشتڕاستی دەکات.",
              "ادفع رسوم الإعلان قبل النشر. بعد إرسال صورة الوصل، يوافق المشرف.",
              "Pay listing fee before publish. After receipt upload, super admin approves."
            )}
          </p>
          <b>
            {t("بڕی پێشبینیکراو", "المبلغ التقديري", "Estimated fee")}:{" "}
            {new Intl.NumberFormat("en-US").format(feeFromPrice)} د.ع
          </b>
          <label className="field-label">
            {t("لینکی وێنەی وەسل", "رابط صورة الوصل", "Receipt image URL")}
          </label>
          <div className="receipt-row">
            <Upload size={16} />
            <input
              placeholder="https://..."
              value={receiptUrl}
              onChange={(e) => setReceiptUrl(e.target.value)}
              required
            />
          </div>
        </div>
      )}

      <p className="preview-title">
        {t("پیشاندان", "معاينة", "Preview")}: {postTitleFromAttributes(category, attrs)}
      </p>

      <button type="submit" className="primary">
        <Plus size={17} /> {t("پۆستکردن", "نشر", "Publish")}
      </button>
    </form>
  );
}
