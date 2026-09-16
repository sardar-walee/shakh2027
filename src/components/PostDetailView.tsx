import React, { useMemo } from "react";
import {
  fieldsByCategory,
  sectionTitles,
  type Lang,
  type PostCategory,
} from "../config/postFields";
import { X, MapPin, Phone } from "lucide-react";

export type DisplayPost = {
  id: string | number;
  category: PostCategory;
  title: string;
  price: number;
  emoji: string;
  owner: string;
  status: string;
  attributes: Record<string, string | number | boolean>;
  lat?: number | null;
  lng?: number | null;
  locationLabel?: string;
  contactPhone?: string;
};

type Props = {
  post: DisplayPost;
  lang: Lang;
  t: (ku: string, ar: string, en: string) => string;
  money: (n: number) => string;
  onClose: () => void;
};

function formatVal(v: string | number | boolean, lang: Lang, fieldKey: string, category: PostCategory) {
  if (typeof v === "boolean") {
    return v ? (lang === "ku" ? "بەڵێ" : lang === "ar" ? "نعم" : "Yes") : lang === "ku" ? "نەخێر" : lang === "ar" ? "لا" : "No";
  }
  const field = fieldsByCategory[category].find((f) => f.key === fieldKey);
  if (field?.type === "select" && field.options) {
    const opt = field.options.find((o) => o.value === String(v));
    if (opt) return opt.labels[lang];
  }
  return String(v);
}

export function PostDetailView({ post, lang, t, money, onClose }: Props) {
  const sections = useMemo(() => {
    const defs = fieldsByCategory[post.category];
    const keys = [...new Set(defs.map((f) => f.section))];
    return keys
      .map((s) => ({
        id: s,
        title: sectionTitles[s]?.[lang] ?? s,
        rows: defs
          .filter((f) => f.section === s)
          .map((f) => ({
            label: f.labels[lang],
            key: f.key,
            value: post.attributes[f.key],
          }))
          .filter((r) => r.value !== undefined && r.value !== "" && r.value !== false),
      }))
      .filter((s) => s.rows.length > 0);
  }, [post, lang]);

  return (
    <div className="detail-overlay" onClick={onClose}>
      <article className="detail-panel" onClick={(e) => e.stopPropagation()}>
        <button type="button" className="detail-close" onClick={onClose}>
          <X />
        </button>
        <div className="detail-hero">{post.emoji}</div>
        <h2>{post.title}</h2>
        <div className="detail-price">{money(post.price)}</div>
        <p className="detail-owner">{post.owner}</p>
        {post.status !== "active" && (
          <span className="detail-status">{post.status}</span>
        )}

        {(post.lat != null && post.lng != null) || post.locationLabel ? (
          <div className="detail-map">
            <MapPin size={16} />
            {post.locationLabel || `${post.lat?.toFixed(5)}, ${post.lng?.toFixed(5)}`}
            {post.lat != null && post.lng != null && (
              <a href={`https://www.google.com/maps?q=${post.lat},${post.lng}`} target="_blank" rel="noreferrer">
                {t("کردنەوەی نەخشە", "فتح الخريطة", "Open map")}
              </a>
            )}
          </div>
        ) : null}

        {post.contactPhone && (
          <div className="detail-phone">
            <Phone size={16} /> {post.contactPhone}
          </div>
        )}

        {sections.map((sec) => (
          <div key={sec.id} className="detail-section">
            <h3>{sec.title}</h3>
            <dl className="spec-list">
              {sec.rows.map((r) => (
                <div key={r.key} className="spec-row">
                  <dt>{r.label}</dt>
                  <dd>{formatVal(r.value as string | number | boolean, lang, r.key, post.category)}</dd>
                </div>
              ))}
            </dl>
          </div>
        ))}

        <button type="button" className="primary full" onClick={onClose}>
          {t("داخستن", "إغلاق", "Close")}
        </button>
      </article>
    </div>
  );
}
