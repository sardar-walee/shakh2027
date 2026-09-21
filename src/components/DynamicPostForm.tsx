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
import { supabase } from "../lib/supabase";
import { uploadImage } from "../lib/storage";

type ImageDraft = { file: File; previewUrl: string };

export type PostDraft = {
  category: PostCategory;
  attrs: Record<string, string | number | boolean>;
  lat: number | null;
  lng: number | null;
  locationLabel: string;
  receiptUrl: string;
  paymentReference: string;
  images: string[];
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
  onSubmit: (draft: PostDraft) => Promise<void> | void;
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
  const [paymentReference, setPaymentReference] = useState("");
  const [imageDrafts, setImageDrafts] = useState<ImageDraft[]>([]);
  const [imageError, setImageError] = useState("");
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
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

  function addImages(e: React.ChangeEvent<HTMLInputElement>) {
    setImageError("");
    const files = Array.from(e.target.files ?? []);
    const accepted = files.filter((file) => {
      if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
        setImageError(t("تەنها JPG، PNG یان WebP", "يسمح فقط JPG أو PNG أو WebP", "Only JPG, PNG, or WebP images are allowed"));
        return false;
      }
      if (file.size > 5 * 1024 * 1024) {
        setImageError(t("قەبارەی وێنە نابێت لە 5MB زیاتر بێت", "حجم الصورة يجب ألا يتجاوز 5MB", "Each image must be 5MB or smaller"));
        return false;
      }
      return true;
    });
    const remaining = Math.max(0, 8 - imageDrafts.length);
    setImageDrafts((items) => [...items, ...accepted.slice(0, remaining).map((file) => ({ file, previewUrl: URL.createObjectURL(file) }))]);
    e.target.value = "";
  }

  function removeImage(index: number) {
    setImageDrafts((items) => {
      URL.revokeObjectURL(items[index].previewUrl);
      return items.filter((_, itemIndex) => itemIndex !== index);
    });
  }

  function moveImage(index: number, direction: -1 | 1) {
    setImageDrafts((items) => {
      const target = index + direction;
      if (target < 0 || target >= items.length) return items;
      const next = [...items];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setImageError("");
    setSubmitting(true);
    try {
      const uploadedImages: string[] = [];
      if (imageDrafts.length > 0) {
        const user = (await supabase?.auth.getUser())?.data.user;
        if (!user) throw new Error("authentication_required");
        for (const [index, image] of imageDrafts.entries()) {
          const uploaded = await uploadImage(image.file, user.id, (percent) => {
            setUploadProgress(Math.round(((index + percent / 100) / imageDrafts.length) * 100));
          });
          uploadedImages.push(uploaded.publicUrl);
        }
      }
      await onSubmit({
        category,
        attrs,
        lat,
        lng,
        locationLabel,
        receiptUrl,
        paymentReference,
        images: uploadedImages,
        imageEmoji: category === "car_dealer" ? "🚗" : emoji,
      });
    } catch {
      setImageError(t("نەتوانرا وێنەکان upload بکرێن", "تعذر رفع الصور", "Images could not be uploaded"));
    } finally {
      setSubmitting(false);
      setUploadProgress(null);
    }
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

      <div className="image-upload-section">
        <label className="field-label">{t("وێنەکان", "الصور", "Images")}</label>
        <input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={addImages} disabled={submitting} />
        <small>{t("تا 8 وێنە، هەر یەکێک تا 5MB", "حتى 8 صور، 5MB لكل صورة", "Up to 8 images, 5MB each")}</small>
        {imageError && <p className="form-err">{imageError}</p>}
        {uploadProgress !== null && <progress className="upload-progress" value={uploadProgress} max={100}>{uploadProgress}%</progress>}
        {imageDrafts.length > 0 && (
          <div className="image-draft-grid">
            {imageDrafts.map((image, index) => (
              <div className="image-draft" key={image.previewUrl}>
                <img src={image.previewUrl} alt={image.file.name} />
                <div>
                  <button type="button" onClick={() => moveImage(index, -1)} disabled={index === 0}>↑</button>
                  <button type="button" onClick={() => moveImage(index, 1)} disabled={index === imageDrafts.length - 1}>↓</button>
                  <button type="button" onClick={() => removeImage(index)}>{t("سڕینەوە", "حذف", "Remove")}</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

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
          <label className="field-label">
            {t("ژمارەی سەرچاوەی پارەدان", "مرجع الدفع", "Payment reference")}
          </label>
          <input
            value={paymentReference}
            onChange={(e) => setPaymentReference(e.target.value)}
            placeholder={t("ژمارەی سەرچاوە", "رقم المرجع", "Provider reference")}
            required
            minLength={4}
            maxLength={200}
          />
        </div>
      )}

      <p className="preview-title">
        {t("پیشاندان", "معاينة", "Preview")}: {postTitleFromAttributes(category, attrs)}
      </p>

      <button type="submit" className="primary" disabled={submitting}>
        <Plus size={17} /> {t("پۆستکردن", "نشر", "Publish")}
      </button>
    </form>
  );
}
