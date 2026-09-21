import React, { useMemo, useState } from "react";
import { Ban, CheckCircle2, Eye, RotateCcw, Search, UserCheck, UserX } from "lucide-react";
import type { Role } from "../App";

export type AdminUser = { id: string; full_name: string | null; phone: string | null; email: string | null; role: Role; is_active: boolean; created_at: string };
export type AdminPost = { id: string; owner_id: string | null; owner_name: string | null; title: string; category: string; price: number; status: string; payment_status: string | null; listing_fee_paid: boolean; created_at: string };
export type AdminOrder = { id: string; customer_id: string | null; captain_id: string | null; customer_name: string | null; captain_name: string | null; status: string; products_total: number; delivery_fee: number; platform_fee: number; total: number; created_at: string };
export type AdminCaptain = { id: string; full_name: string | null; phone: string | null; email: string | null; is_active: boolean; captain_kind: string | null; created_at: string };
export type AdminAuditLog = { id: string; actor_id: string | null; action: string; entity_type: string | null; entity_id: string | null; metadata: Record<string, unknown> | null; created_at: string };
export type AdminPermission = { role: Role; permission: string };
export type AdminManagementData = { users: AdminUser[]; posts: AdminPost[]; orders: AdminOrder[]; captains: AdminCaptain[]; audit_logs: AdminAuditLog[]; permissions: AdminPermission[] };
export type AdminAction = "user_active" | "captain_active" | "post_moderate" | "order_status";
export const emptyAdminManagementData: AdminManagementData = { users: [], posts: [], orders: [], captains: [], audit_logs: [], permissions: [] };

type Props = {
  role: Role;
  t: (ku: string, ar: string, en: string) => string;
  data: AdminManagementData;
  loading: boolean;
  error: string;
  onRetry: () => void;
  onAction: (action: AdminAction, id: string, value: string | boolean) => void;
};

type Section = "users" | "posts" | "orders" | "captains" | "audit" | "permissions";

export function AdminManagementPanel({ role, t, data, loading, error, onRetry, onAction }: Props) {
  const [section, setSection] = useState<Section>("users");
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<Record<string, unknown> | null>(null);
  const canManage = role === "admin" || role === "super_admin";
  const normalizedSearch = search.trim().toLowerCase();

  const matches = (values: unknown[]) => values.some((value) => String(value ?? "").toLowerCase().includes(normalizedSearch));
  const users = useMemo(() => data.users.filter((item) => matches([item.full_name, item.email, item.phone, item.role]) && (filter === "all" || (filter === "active" ? item.is_active : filter === "inactive" && !item.is_active) || filter === item.role)), [data.users, filter, normalizedSearch]);
  const posts = useMemo(() => data.posts.filter((item) => matches([item.title, item.category, item.owner_name, item.status]) && (filter === "all" || filter === item.status || filter === item.category)), [data.posts, filter, normalizedSearch]);
  const orders = useMemo(() => data.orders.filter((item) => matches([item.id, item.customer_name, item.captain_name, item.status]) && (filter === "all" || filter === item.status)), [data.orders, filter, normalizedSearch]);
  const captains = useMemo(() => data.captains.filter((item) => matches([item.full_name, item.email, item.phone, item.captain_kind]) && (filter === "all" || (filter === "active" ? item.is_active : filter === "inactive" && !item.is_active))), [data.captains, filter, normalizedSearch]);
  const logs = useMemo(() => data.audit_logs.filter((item) => matches([item.action, item.entity_type, item.entity_id, item.actor_id]) && (filter === "all" || filter === item.action || filter === item.entity_type)), [data.audit_logs, filter, normalizedSearch]);

  function chooseSection(next: Section) {
    setSection(next);
    setFilter("all");
    setSearch("");
    setSelected(null);
  }

  if (!canManage) return <div className="panel dashboard-error">{t("دەستگەیشتن ڕەتکرایەوە", "تم رفض الوصول", "Access denied")}</div>;
  if (loading) return <div className="panel dashboard-state">{t("بارکردنی بەڕێوەبردن...", "جار تحميل الإدارة...", "Loading management...")}</div>;
  if (error) return <div className="panel dashboard-state dashboard-error"><p>{error}</p><button type="button" className="secondary" onClick={onRetry}>{t("دووبارە هەوڵبدە", "أعد المحاولة", "Retry")}</button></div>;

  const tabs: { id: Section; label: string }[] = [
    { id: "users", label: t("بەکارهێنەران", "المستخدمون", "Users") },
    { id: "posts", label: t("پۆستەکان", "المنشورات", "Posts") },
    { id: "orders", label: t("داواکارییەکان", "الطلبات", "Orders") },
    { id: "captains", label: t("کاپتنەکان", "الكباتن", "Captains") },
    { id: "audit", label: t("تۆمارەکان", "السجلات", "Audit logs") },
  ];
  if (role === "super_admin") tabs.push({ id: "permissions", label: t("ڕۆڵ و مۆڵەت", "الأدوار والصلاحيات", "Roles & permissions") });

  return (
    <div className="panel admin-panel">
      <div className="section-head"><div><h2>{t("بەڕێوەبردنی سیستەم", "إدارة النظام", "Admin management")}</h2><p>{t("تەنها data ـی ڕاستەقینەی Supabase", "بيانات Supabase الحقيقية فقط", "Live Supabase data only")}</p></div></div>
      <div className="admin-tabs">{tabs.map((tab) => <button key={tab.id} type="button" className={section === tab.id ? "selected" : ""} onClick={() => chooseSection(tab.id)}>{tab.label}</button>)}</div>
      {section !== "permissions" && <div className="admin-toolbar"><label className="admin-search"><Search size={16} /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={t("گەڕان...", "بحث...", "Search...")} /></label><select value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">{t("هەموو", "الكل", "All")}</option>{section === "users" && <><option value="active">{t("چالاک", "نشط", "Active")}</option><option value="inactive">{t("ناچالاک", "غير نشط", "Inactive")}</option>{["customer", "admin", "captain", "restaurant", "supermarket", "fashion", "beauty", "car_dealer", "super_admin"].map((value) => <option key={value} value={value}>{value}</option>)}</>}{section === "posts" && [...new Set(["active", "pending_review", "blocked", ...data.posts.map((item) => item.category)])].map((value) => <option key={value} value={value}>{value}</option>)}{section === "orders" && ["pending", "accepted", "preparing", "out_for_delivery", "delivered", "cancelled"].map((value) => <option key={value} value={value}>{value}</option>)}{section === "captains" && <><option value="active">{t("چالاک", "نشط", "Active")}</option><option value="inactive">{t("ناچالاک", "غير نشط", "Inactive")}</option></>}{section === "audit" && [...new Set([...data.audit_logs.map((item) => item.action), ...data.audit_logs.map((item) => item.entity_type).filter((value): value is string => Boolean(value))])].map((value) => <option key={value} value={value}>{value}</option>)}</select></div>}
      {section === "users" && <UserTable items={users} t={t} onView={setSelected} onToggle={(item) => onAction("user_active", item.id, !item.is_active)} />}
      {section === "posts" && <PostTable items={posts} t={t} onView={setSelected} onModerate={(item, action) => onAction("post_moderate", item.id, action)} />}
      {section === "orders" && <OrderTable items={orders} t={t} onView={setSelected} onStatus={(item, status) => onAction("order_status", item.id, status)} />}
      {section === "captains" && <CaptainTable items={captains} t={t} onView={setSelected} onToggle={(item) => onAction("captain_active", item.id, !item.is_active)} />}
      {section === "audit" && <AuditTable items={logs} t={t} onView={setSelected} />}
      {section === "permissions" && <PermissionTable items={data.permissions} t={t} />}
      {section !== "permissions" && selected && <div className="admin-detail"><div className="section-head"><h3>{t("وردەکاری", "التفاصيل", "Details")}</h3><button type="button" className="iconbtn" onClick={() => setSelected(null)}>×</button></div><pre>{JSON.stringify(selected, null, 2)}</pre></div>}
    </div>
  );
}

function AdminEmpty({ t }: { t: Props["t"] }) { return <div className="empty-state">{t("هیچ داتایەک نییە", "لا توجد بيانات", "No data found")}</div>; }
function UserTable({ items, t, onView, onToggle }: { items: AdminUser[]; t: Props["t"]; onView: (item: Record<string, unknown>) => void; onToggle: (item: AdminUser) => void }) { return <div className="admin-list">{items.length === 0 ? <AdminEmpty t={t} /> : items.map((item) => <div className="admin-row" key={item.id}><span><b>{item.full_name || item.email || item.id.slice(0, 8)}</b><small>{item.role} · {item.is_active ? "active" : "inactive"}</small></span><div><button type="button" className="iconbtn" onClick={() => onView(item as unknown as Record<string, unknown>)} aria-label={t("بینین", "عرض", "View")}><Eye size={15} /></button><button type="button" className="secondary small" onClick={() => onToggle(item)}>{item.is_active ? <UserX size={14} /> : <UserCheck size={14} />}</button></div></div>)}</div>; }
function PostTable({ items, t, onView, onModerate }: { items: AdminPost[]; t: Props["t"]; onView: (item: Record<string, unknown>) => void; onModerate: (item: AdminPost, action: string) => void }) { return <div className="admin-list">{items.length === 0 ? <AdminEmpty t={t} /> : items.map((item) => <div className="admin-row" key={item.id}><span><b>{item.title}</b><small>{item.category} · {item.status} · {item.owner_name || item.owner_id?.slice(0, 8)}</small></span><div><button type="button" className="iconbtn" onClick={() => onView(item as unknown as Record<string, unknown>)}><Eye size={15} /></button>{item.status === "pending_review" && <button type="button" className="secondary small" onClick={() => onModerate(item, "approve")}><CheckCircle2 size={14} /></button>}{item.status === "active" && <button type="button" className="secondary small" onClick={() => onModerate(item, "block")}><Ban size={14} /></button>}{item.status === "blocked" && <button type="button" className="secondary small" onClick={() => onModerate(item, "restore")}><RotateCcw size={14} /></button>}</div></div>)}</div>; }
function OrderTable({ items, t, onView, onStatus }: { items: AdminOrder[]; t: Props["t"]; onView: (item: Record<string, unknown>) => void; onStatus: (item: AdminOrder, status: string) => void }) { return <div className="admin-list">{items.length === 0 ? <AdminEmpty t={t} /> : items.map((item) => <div className="admin-row" key={item.id}><span><b>#{item.id.slice(0, 8)} · {item.customer_name || item.customer_id?.slice(0, 8)}</b><small>{item.status} · {new Intl.NumberFormat("en-US").format(Number(item.total))} IQD</small></span><div><button type="button" className="iconbtn" onClick={() => onView(item as unknown as Record<string, unknown>)}><Eye size={15} /></button><select value={item.status} onChange={(event) => onStatus(item, event.target.value)}>{["pending", "accepted", "preparing", "out_for_delivery", "delivered", "cancelled"].map((value) => <option key={value} value={value}>{value}</option>)}</select></div></div>)}</div>; }
function CaptainTable({ items, t, onView, onToggle }: { items: AdminCaptain[]; t: Props["t"]; onView: (item: Record<string, unknown>) => void; onToggle: (item: AdminCaptain) => void }) { return <div className="admin-list">{items.length === 0 ? <AdminEmpty t={t} /> : items.map((item) => <div className="admin-row" key={item.id}><span><b>{item.full_name || item.email || item.id.slice(0, 8)}</b><small>{item.captain_kind || "captain"} · {item.is_active ? "active" : "inactive"}</small></span><div><button type="button" className="iconbtn" onClick={() => onView(item as unknown as Record<string, unknown>)}><Eye size={15} /></button><button type="button" className="secondary small" onClick={() => onToggle(item)}>{item.is_active ? <UserX size={14} /> : <UserCheck size={14} />}</button></div></div>)}</div>; }
function AuditTable({ items, t, onView }: { items: AdminAuditLog[]; t: Props["t"]; onView: (item: Record<string, unknown>) => void }) { return <div className="admin-list">{items.length === 0 ? <AdminEmpty t={t} /> : items.map((item) => <div className="admin-row" key={item.id}><span><b>{item.action}</b><small>{item.entity_type} · {new Date(item.created_at).toLocaleString()}</small></span><button type="button" className="iconbtn" onClick={() => onView(item as unknown as Record<string, unknown>)}><Eye size={15} /></button></div>)}</div>; }
function PermissionTable({ items, t }: { items: AdminPermission[]; t: Props["t"] }) { return <div className="admin-list">{items.length === 0 ? <AdminEmpty t={t} /> : items.map((item, index) => <div className="admin-row" key={`${item.role}-${item.permission}-${index}`}><span><b>{item.role}</b><small>{item.permission}</small></span></div>)}</div>; }
