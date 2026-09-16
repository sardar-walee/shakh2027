import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ShoppingCart,
  Search,
  UserRound,
  Bike,
  Store,
  Utensils,
  Shirt,
  Sparkles,
  CarFront,
  ShieldCheck,
  Trash2,
  LayoutDashboard,
  Wallet,
  Package,
  Languages,
  Menu,
  X,
  CheckCircle2,
} from "lucide-react";
import { supabase, supabaseConfigured } from "./lib/supabase";
import { deliveryFeeFromKm, distanceKm } from "./lib/geo";
import {
  postPriceFromAttributes,
  postTitleFromAttributes,
  type PostCategory,
} from "./config/postFields";
import { AuthPanel } from "./components/AuthPanel";
import { DynamicPostForm, type PostDraft } from "./components/DynamicPostForm";
import { PostDetailView, type DisplayPost } from "./components/PostDetailView";
import { GpsPicker } from "./components/GpsPicker";

export type Role =
  | "super_admin"
  | "admin"
  | "captain"
  | "restaurant"
  | "supermarket"
  | "fashion"
  | "beauty"
  | "car_dealer"
  | "customer";

type Lang = "ku" | "ar" | "en";

type PlatformSettings = {
  captainPlatformPercent: number;
  captainSharePercent: number;
  carListingFeeMin: number;
  defaultDeliveryFee: number;
  deliveryFeePerKm: number;
  platformCommissionPercent: number;
};

const defaultSettings: PlatformSettings = {
  captainPlatformPercent: 30,
  captainSharePercent: 70,
  carListingFeeMin: 25000,
  defaultDeliveryFee: 5000,
  deliveryFeePerKm: 500,
  platformCommissionPercent: 5,
};

const roleMeta: { id: Role; ku: string; ar: string; en: string; icon: React.ReactNode }[] = [
  { id: "restaurant", ku: "چێشتخانە", ar: "مطعم", en: "Restaurant", icon: <Utensils /> },
  { id: "supermarket", ku: "سوپەرمارکێت", ar: "سوبرماركت", en: "Supermarket", icon: <Store /> },
  { id: "fashion", ku: "جل و بەرگ", ar: "أزياء", en: "Fashion", icon: <Shirt /> },
  { id: "beauty", ku: "جوانکاری", ar: "تجميل", en: "Beauty", icon: <Sparkles /> },
  { id: "car_dealer", ku: "ئۆتۆمبێل", ar: "سيارات", en: "Cars", icon: <CarFront /> },
  { id: "captain", ku: "گەیاندن", ar: "توصيل", en: "Delivery", icon: <Bike /> },
];

const merchantRoles: Role[] = ["restaurant", "supermarket", "fashion", "beauty", "car_dealer"];

const seedPosts: DisplayPost[] = [
  {
    id: 1,
    category: "supermarket",
    title: "سەبەتەی خێزانی",
    price: 35000,
    emoji: "🛒",
    owner: "سوپەرمارکێتی شاخ",
    status: "active",
    attributes: { product_name: "سەبەتەی خێزانی", category_name: "خۆراک", price: 35000 },
  },
  {
    id: 2,
    category: "car_dealer",
    title: "Toyota Corolla 2018",
    price: 18500000,
    emoji: "🚗",
    owner: "کڕیار",
    status: "active",
    attributes: {
      listing_type: "car",
      brand: "Toyota",
      model: "Corolla",
      year: 2018,
      price: 18500000,
      fuel: "petrol",
      transmission: "auto",
      condition: "good",
    },
  },
];

export default function App() {
  const [lang, setLang] = useState<Lang>("ku");
  const [tab, setTab] = useState("home");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [cart, setCart] = useState<DisplayPost[]>([]);
  const [posts, setPosts] = useState<DisplayPost[]>(seedPosts);
  const [showMenu, setShowMenu] = useState(false);
  const [notice, setNotice] = useState("");
  const [detail, setDetail] = useState<DisplayPost | null>(null);
  const [postCategory, setPostCategory] = useState<PostCategory>("restaurant");

  const [sessionEmail, setSessionEmail] = useState<string | null>(null);
  const [profileRole, setProfileRole] = useState<Role>("customer");
  const [demoRole, setDemoRole] = useState<Role>("customer");
  const role = supabaseConfigured ? profileRole : demoRole;

  const [settings, setSettings] = useState<PlatformSettings>(defaultSettings);
  const [customerGps, setCustomerGps] = useState<{ lat: number; lng: number } | null>(null);
  const [deliveryKm, setDeliveryKm] = useState<number | null>(null);

  const [captainForm, setCaptainForm] = useState({
    email: "",
    password: "",
    fullName: "",
    phone: "",
    kind: "merchant" as "merchant" | "shakh",
  });

  const t = (ku: string, ar: string, en: string) => (lang === "ku" ? ku : lang === "ar" ? ar : en);
  const money = (n: number) => new Intl.NumberFormat("en-US").format(n) + " د.ع";

  const refreshSession = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.auth.getSession();
    const email = data.session?.user.email ?? null;
    setSessionEmail(email);
    if (data.session?.user.id) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.session.user.id)
        .maybeSingle();
      if (prof?.role) setProfileRole(prof.role as Role);
    }
  }, []);

  const loadPosts = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .in("status", ["active", "pending_review", "pending_payment"]);
    if (error || !data) return;
    setPosts(
      data.map((p) => ({
        id: p.id,
        category: p.category as PostCategory,
        title: p.title,
        price: Number(p.price),
        emoji: p.category === "car_dealer" ? "🚗" : "📦",
        owner: String(p.owner_id ?? "").slice(0, 8),
        status: p.status,
        attributes: (p.attributes ?? {}) as Record<string, string | number | boolean>,
        lat: p.lat,
        lng: p.lng,
        locationLabel: p.location_label,
        contactPhone: p.contact_phone,
      }))
    );
  }, []);

  const loadSettings = useCallback(async () => {
    if (!supabase) return;
    const { data } = await supabase.from("platform_settings").select("*").eq("id", true).maybeSingle();
    if (!data) return;
    setSettings({
      captainPlatformPercent: Number(data.captain_platform_percent ?? 30),
      captainSharePercent: Number(data.captain_share_percent ?? 70),
      carListingFeeMin: Number(data.car_listing_fee_min ?? 25000),
      defaultDeliveryFee: Number(data.default_delivery_fee ?? 5000),
      deliveryFeePerKm: Number(data.delivery_fee_per_km ?? 500),
      platformCommissionPercent: Number(data.platform_commission_percent ?? 5),
    });
  }, []);

  useEffect(() => {
    refreshSession();
    loadPosts();
    loadSettings();
    if (!supabase) return;
    const { data: sub } = supabase.auth.onAuthStateChange(() => {
      refreshSession();
      loadPosts();
    });
    return () => sub.subscription.unsubscribe();
  }, [refreshSession, loadPosts, loadSettings]);

  const visible = useMemo(
    () =>
      posts.filter(
        (p) =>
          (category === "all" || p.category === category) &&
          `${p.title} ${p.owner}`.toLowerCase().includes(search.toLowerCase()) &&
          (p.status === "active" || role === "super_admin")
      ),
    [posts, category, search, role]
  );

  const canPostMerchant = merchantRoles.includes(role);
  const canPostCarAsCustomer = role === "customer";
  const canPost = canPostMerchant || canPostCarAsCustomer;
  const pendingReview = posts.filter((p) => p.status === "pending_review");

  const postCategories = roleMeta
    .filter((r) => r.id !== "captain")
    .map((r) => ({ id: r.id as PostCategory, label: t(r.ku, r.ar, r.en) }));

  async function handlePostSubmit(draft: PostDraft) {
    const title = postTitleFromAttributes(draft.category, draft.attrs);
    const price = postPriceFromAttributes(draft.attrs);
    const isCustomerCar = role === "customer" && draft.category === "car_dealer";
    const listingFee = Math.max(
      settings.carListingFeeMin,
      Math.round(price * (settings.platformCommissionPercent / 100))
    );
    const status = isCustomerCar ? "pending_review" : "active";

    if (isCustomerCar && !draft.receiptUrl) {
      setNotice(t("وێنەی وەسل پێویستە", "صورة الوصل مطلوبة", "Receipt required"));
      return;
    }

    if (supabase && sessionEmail) {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return;
      const { error } = await supabase.from("posts").insert({
        owner_id: user.id,
        category: draft.category,
        title,
        description: String(draft.attrs.description ?? ""),
        price,
        status,
        attributes: draft.attrs,
        lat: draft.lat,
        lng: draft.lng,
        location_label: draft.locationLabel,
        contact_phone: String(draft.attrs.phone ?? ""),
        receipt_url: draft.receiptUrl || null,
        listing_fee: isCustomerCar ? listingFee : 0,
        listing_fee_paid: isCustomerCar,
      });
      if (error) {
        setNotice(error.message);
        return;
      }
      await loadPosts();
    } else {
      setPosts((p) => [
        ...p,
        {
          id: Date.now(),
          category: draft.category,
          title,
          price,
          emoji: draft.imageEmoji,
          owner: role,
          status,
          attributes: draft.attrs,
          lat: draft.lat,
          lng: draft.lng,
          locationLabel: draft.locationLabel,
          contactPhone: String(draft.attrs.phone ?? ""),
        },
      ]);
    }
    setNotice(
      isCustomerCar
        ? t("پۆست نێردرا بۆ پشتڕاستکردنەوە", "أُرسل للمراجعة", "Sent for admin review")
        : t("پۆستەکە زیاد کرا", "تم النشر", "Published")
    );
    setTab("home");
  }

  async function approvePost(id: string | number) {
    if (supabase && typeof id === "string") {
      const user = (await supabase.auth.getUser()).data.user;
      await supabase
        .from("posts")
        .update({ status: "active", verified_at: new Date().toISOString(), verified_by: user?.id })
        .eq("id", id);
      await loadPosts();
    } else {
      setPosts((ps) => ps.map((p) => (p.id === id ? { ...p, status: "active" } : p)));
    }
    setNotice(t("پۆست پەسەند کرا", "تمت الموافقة", "Approved"));
  }

  async function saveCommission() {
    if (supabase && role === "super_admin") {
      await supabase
        .from("platform_settings")
        .update({
          captain_platform_percent: settings.captainPlatformPercent,
          captain_share_percent: settings.captainSharePercent,
          platform_commission_percent: settings.platformCommissionPercent,
          default_delivery_fee: settings.defaultDeliveryFee,
          delivery_fee_per_km: settings.deliveryFeePerKm,
          car_listing_fee_min: settings.carListingFeeMin,
          updated_at: new Date().toISOString(),
        })
        .eq("id", true);
    }
    setNotice(t("ڕێکخستنەکان پاشەکەوت کران", "تم الحفظ", "Settings saved"));
  }

  async function createCaptain(e: React.FormEvent) {
    e.preventDefault();
    if (!supabase) {
      setNotice(t("تەنها لەگەڵ Supabase", "يتطلب Supabase", "Requires Supabase"));
      return;
    }
    if (captainForm.kind === "shakh" && role !== "super_admin") {
      setNotice(t("تەنها سوپەر ئەدمین", "للمشرف فقط", "Super admin only"));
      return;
    }
    if (captainForm.kind === "merchant" && !merchantRoles.includes(role)) {
      setNotice(t("تەنها دوکاندار", "للتاجر فقط", "Merchants only"));
      return;
    }
    setNotice(
      t(
        "لە پرۆداکشن: Edge Function بۆ دروستکردنی کاپتن بەکاربهێنە (ئەم فۆرمە ئیمەیڵ/وشەی نهێنی دەنێرێت).",
        "في الإنتاج: استخدم Edge Function لإنشاء الكابتن.",
        "In production use an Edge Function to create captain accounts."
      )
    );
    const { data, error } = await supabase.auth.signUp({
      email: captainForm.email,
      password: captainForm.password,
      options: {
        data: {
          full_name: captainForm.fullName,
          phone: captainForm.phone,
          role: "captain",
          captain_kind: captainForm.kind,
        },
      },
    });
    if (error) {
      setNotice(error.message);
      return;
    }
    if (data.user) {
      await supabase.from("profiles").upsert({
        id: data.user.id,
        full_name: captainForm.fullName,
        phone: captainForm.phone,
        role: "captain",
        captain_kind: captainForm.kind,
        captain_owner_id: captainForm.kind === "merchant" ? (await supabase.auth.getUser()).data.user?.id : null,
      });
    }
    setCaptainForm({ email: "", password: "", fullName: "", phone: "", kind: "merchant" });
    setNotice(t("داواکاری کاپتن دروست کرا", "تم إنشاء الكابتن", "Captain created"));
  }

  const deliveryFee =
    deliveryKm != null
      ? deliveryFeeFromKm(deliveryKm, settings.defaultDeliveryFee, settings.deliveryFeePerKm)
      : settings.defaultDeliveryFee;

  const captainPlatform = Math.round(deliveryFee * (settings.captainPlatformPercent / 100));
  const captainKeep = deliveryFee - captainPlatform;

  return (
    <div className="app">
      <header className="topbar">
        <button type="button" className="iconbtn mobile" onClick={() => setShowMenu(!showMenu)}>
          {showMenu ? <X /> : <Menu />}
        </button>
        <div
          className="brand"
          onClick={() => {
            setTab("home");
            setCategory("all");
          }}
        >
          <div className="brandmark">S</div>
          <div>
            <b>
              SHAKH <span>SUPER</span>
            </b>
            <small>daim-post.online</small>
          </div>
        </div>
        <div className="search">
          <Search size={18} />
          <input
            placeholder={t(
              "گەڕان بۆ کالا، ئۆتۆمبێل، مەکینە...",
              "ابحث عن منتج أو سيارة...",
              "Search products, cars, machines..."
            )}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="actions">
          <button
            type="button"
            className="lang"
            onClick={() => setLang(lang === "ku" ? "ar" : lang === "ar" ? "en" : "ku")}
          >
            <Languages size={17} />
            {lang.toUpperCase()}
          </button>
          <button type="button" className="cart" onClick={() => setTab("cart")}>
            <ShoppingCart size={19} />
            <span>{cart.length}</span>
          </button>
          <button type="button" className="avatar" onClick={() => setTab("account")}>
            <UserRound size={19} />
          </button>
        </div>
      </header>

      <div className={"layout " + (showMenu ? "open" : "")}>
        <aside className="sidebar">
          <div className="side-title">{t("بەشەکان", "الأقسام", "Categories")}</div>
          <button
            type="button"
            className={category === "all" ? "active" : ""}
            onClick={() => {
              setCategory("all");
              setTab("home");
            }}
          >
            <LayoutDashboard />
            {t("هەموو بەشەکان", "كل الأقسام", "All")}
          </button>
          {roleMeta.map((r) => (
            <button
              type="button"
              key={r.id}
              className={category === r.id ? "active" : ""}
              onClick={() => {
                setCategory(r.id);
                setTab("home");
                setShowMenu(false);
              }}
            >
              {r.icon}
              <span>{t(r.ku, r.ar, r.en)}</span>
            </button>
          ))}
          <div className="side-title">{t("بەڕێوەبردن", "الإدارة", "Management")}</div>
          <button type="button" onClick={() => setTab("dashboard")}>
            <ShieldCheck />
            {t("داشبۆرد", "لوحة التحكم", "Dashboard")}
          </button>
          <button type="button" onClick={() => setTab("wallet")}>
            <Wallet />
            {t("پارە", "المحفظة", "Wallet")}
          </button>
          {canPost && (
            <button type="button" onClick={() => setTab("post")}>
              {t("پۆستی نوێ", "منشور جديد", "New post")}
            </button>
          )}
          {(merchantRoles.includes(role) || role === "super_admin") && (
            <button type="button" onClick={() => setTab("captains")}>
              <Bike />
              {t("کاپتن", "كابتن", "Captains")}
            </button>
          )}
        </aside>

        <main className="main">
          <section className="hero">
            <div>
              <div className="eyebrow">daim-post.online</div>
              <h1>{t("بازاڕی دیجیتاڵی شاخ", "سوق شاخ الرقمي", "Shakh marketplace")}</h1>
              <p>
                {t(
                  "فۆڕمی زانیاری بە Label، GPS، گەیاندن بە دووری، و پۆستی ئۆتۆمبێل وەک IQ Cars.",
                  "نماذج ببيانات واضحة، GPS، ورسوم حسب المسافة.",
                  "Labeled forms, GPS, distance-based delivery, IQ Cars-style listings."
                )}
              </p>
            </div>
            <div className="hero-art">
              🛍️
              <div>🚗 ⚙️ 👕 💄</div>
            </div>
          </section>

          {notice && (
            <div className="notice">
              {notice}
              <button type="button" onClick={() => setNotice("")}>
                ×
              </button>
            </div>
          )}

          {!supabaseConfigured && (
            <div className="notice warn">
              {t(
                "Supabase لە .env دانەنراوە — دێمۆی ناوخۆیی.",
                "Supabase غير مُعد — وضع تجريبي.",
                "Supabase not configured — local demo mode."
              )}
            </div>
          )}

          {tab === "account" && (
            <div className="panel">
              <h2>{t("هەژمار", "الحساب", "Account")}</h2>
              <AuthPanel
                t={t}
                email={sessionEmail}
                onSuccess={refreshSession}
                onSignOut={async () => {
                  await supabase?.auth.signOut();
                  setSessionEmail(null);
                  setProfileRole("customer");
                }}
              />
              {!supabaseConfigured && (
                <>
                  <label>{t("ڕۆڵی تاقیکردنەوە", "دور تجريبي", "Demo role")}</label>
                  <select value={demoRole} onChange={(e) => setDemoRole(e.target.value as Role)}>
                    {["super_admin", "admin", "captain", ...merchantRoles, "customer"].map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </>
              )}
              <GpsPicker
                lat={customerGps?.lat ?? null}
                lng={customerGps?.lng ?? null}
                label={t("شوێنی گەیاندن (کڕیار)", "موقع التوصيل", "Delivery GPS")}
                pickLabel={t("نیشانەی شوێنی گەیاندن", "حدد موقع التوصيل", "Set delivery location")}
                loadingLabel={t("...", "...", "...")}
                errorLabel={t("هەڵە", "خطأ", "Error")}
                onPick={(lat, lng) => setCustomerGps({ lat, lng })}
              />
            </div>
          )}

          {tab === "post" && canPost && (
            <DynamicPostForm
              lang={lang}
              t={t}
              category={postCategory}
              onCategoryChange={setPostCategory}
              categories={
                canPostCarAsCustomer && !canPostMerchant
                  ? [{ id: "car_dealer", label: t("ئۆتۆمبێل", "سيارات", "Cars") }]
                  : postCategories
              }
              isCarByCustomer={canPostCarAsCustomer && !canPostMerchant}
              listingFee={settings.carListingFeeMin}
              onSubmit={handlePostSubmit}
            />
          )}

          {tab === "cart" && (
            <CartPanel cart={cart} setCart={setCart} money={money} t={t} deliveryFee={deliveryFee} />
          )}

          {tab === "wallet" && (
            <WalletPanel
              money={money}
              t={t}
              settings={settings}
              deliveryFee={deliveryFee}
              captainPlatform={captainPlatform}
              captainKeep={captainKeep}
            />
          )}

          {tab === "captains" && (
            <div className="panel">
              <h2>{t("دروستکردنی کاپتن", "إنشاء كابتن", "Create captain")}</h2>
              <form className="form" onSubmit={createCaptain}>
                <label>{t("جۆر", "النوع", "Type")}</label>
                <select
                  value={captainForm.kind}
                  onChange={(e) =>
                    setCaptainForm({ ...captainForm, kind: e.target.value as "merchant" | "shakh" })
                  }
                >
                  <option value="merchant">{t("کاپتنی دوکان", "كابتن تاجر", "Merchant captain")}</option>
                  {role === "super_admin" && (
                    <option value="shakh">{t("کاپتنی شاخ", "كابتن شاخ", "Shakh captain")}</option>
                  )}
                </select>
                <input
                  placeholder={t("ناو", "الاسم", "Name")}
                  value={captainForm.fullName}
                  onChange={(e) => setCaptainForm({ ...captainForm, fullName: e.target.value })}
                  required
                />
                <input
                  placeholder={t("ئیمەیڵ", "Email", "Email")}
                  type="email"
                  value={captainForm.email}
                  onChange={(e) => setCaptainForm({ ...captainForm, email: e.target.value })}
                  required
                />
                <input
                  placeholder={t("وشەی نهێنی", "Password", "Password")}
                  type="password"
                  value={captainForm.password}
                  onChange={(e) => setCaptainForm({ ...captainForm, password: e.target.value })}
                  required
                />
                <input
                  placeholder={t("مۆبایل", "Phone", "Phone")}
                  value={captainForm.phone}
                  onChange={(e) => setCaptainForm({ ...captainForm, phone: e.target.value })}
                />
                <button type="submit" className="primary">
                  {t("دروستکردن", "إنشاء", "Create")}
                </button>
              </form>
            </div>
          )}

          {tab === "dashboard" && (
            <DashboardPanel
              t={t}
              role={role}
              posts={posts}
              pendingReview={pendingReview}
              onApprove={approvePost}
              settings={settings}
              setSettings={setSettings}
              onSaveSettings={saveCommission}
              deliveryKm={deliveryKm}
              setDeliveryKm={setDeliveryKm}
              customerGps={customerGps}
            />
          )}

          {tab === "home" && (
            <>
              <div className="section-head">
                <div>
                  <h2>{t("پۆستەکان", "المنشورات", "Posts")}</h2>
                  <p>{t("کلیک بکە بۆ بینینی هەموو Label ـەکان", "اضغط لعرض التفاصيل", "Tap for full specs")}</p>
                </div>
              </div>
              <div className="chips">
                <button
                  type="button"
                  className={category === "all" ? "selected" : ""}
                  onClick={() => setCategory("all")}
                >
                  {t("هەموو", "الكل", "All")}
                </button>
                {roleMeta.map((r) => (
                  <button
                    type="button"
                    className={category === r.id ? "selected" : ""}
                    key={r.id}
                    onClick={() => setCategory(r.id)}
                  >
                    {t(r.ku, r.ar, r.en)}
                  </button>
                ))}
              </div>
              <div className="grid">
                {visible.map((p) => (
                  <article
                    className="card card-click"
                    key={p.id}
                    onClick={() => setDetail(p)}
                    onKeyDown={(e) => e.key === "Enter" && setDetail(p)}
                    role="button"
                    tabIndex={0}
                  >
                    <div className="product-image">
                      {p.emoji}
                      <span className="badge">
                        {p.category === "car_dealer"
                          ? t("ئۆتۆمبێل", "سيارة", "Car")
                          : t("بەردەستە", "متوفر", "Available")}
                      </span>
                    </div>
                    <div className="card-body">
                      <small>{p.owner}</small>
                      <h3>{p.title}</h3>
                      <div className="price">{money(p.price)}</div>
                      <button
                        type="button"
                        className="add"
                        onClick={(e) => {
                          e.stopPropagation();
                          setCart((c) => [...c, p]);
                          setNotice(t("زیادکرا بۆ سەبەتە", "أُضيف للسلة", "Added to cart"));
                        }}
                      >
                        {t("سەبەتە", "سلة", "Cart")}
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </>
          )}
        </main>
      </div>

      {detail && (
        <PostDetailView post={detail} lang={lang} t={t} money={money} onClose={() => setDetail(null)} />
      )}

      <footer>
        {t("© شاخ سوپەر — daim-post.online", "© شاخ — daim-post.online", "© Shakh — daim-post.online")}{" "}
        <span>کوردی · عربي · English</span>
      </footer>
    </div>
  );
}

function CartPanel({
  cart,
  setCart,
  money,
  t,
  deliveryFee,
}: {
  cart: DisplayPost[];
  setCart: React.Dispatch<React.SetStateAction<DisplayPost[]>>;
  money: (n: number) => string;
  t: (a: string, b: string, c: string) => string;
  deliveryFee: number;
}) {
  const total = cart.reduce((s, p) => s + p.price, 0) + deliveryFee;
  return (
    <div className="panel">
      <h2>{t("سەبەتە", "السلة", "Cart")}</h2>
      {cart.length === 0 ? (
        <p>{t("بەتاڵە", "فارغة", "Empty")}</p>
      ) : (
        <>
          {cart.map((p, i) => (
            <div className="cartrow" key={i}>
              <span>
                {p.emoji} {p.title}
              </span>
              <b>{money(p.price)}</b>
              <button type="button" onClick={() => setCart((c) => c.filter((_, j) => j !== i))}>
                <Trash2 size={16} />
              </button>
            </div>
          ))}
          <div className="cartrow">
            <span>{t("کرێی گەیاندن (دووری)", "رسوم التوصيل", "Delivery (distance)")}</span>
            <b>{money(deliveryFee)}</b>
          </div>
          <div className="total">
            {t("کۆ", "المجموع", "Total")} <b>{money(total)}</b>
          </div>
          <button type="button" className="primary">
            {t("کاش لە گەیاندن", "دفع عند الاستلام", "Cash on delivery")}
          </button>
        </>
      )}
    </div>
  );
}

function WalletPanel({
  money,
  t,
  settings,
  deliveryFee,
  captainPlatform,
  captainKeep,
}: {
  money: (n: number) => string;
  t: (a: string, b: string, c: string) => string;
  settings: PlatformSettings;
  deliveryFee: number;
  captainPlatform: number;
  captainKeep: number;
}) {
  return (
    <div className="panel">
      <h2>{t("پارە و دابەشکردن", "المحفظة", "Wallet & splits")}</h2>
      <div className="walletbig">
        {money(1250000)}
        <small>{t("نموونە", "تجريبي", "Demo balance")}</small>
      </div>
      <div className="cartrow">
        <span>{t("کرێی گەیاندن", "رسوم التوصيل", "Delivery fee")}</span>
        <b>{money(deliveryFee)}</b>
      </div>
      <div className="cartrow">
        <span>
          {t("بەشی شاخ لە گەیاندن", "حصة المنصة", "Platform share")} ({settings.captainPlatformPercent}%)
        </span>
        <b>{money(captainPlatform)}</b>
      </div>
      <div className="cartrow">
        <span>
          {t("بەشی کاپتن", "حصة الكابتن", "Captain share")} ({settings.captainSharePercent}%)
        </span>
        <b>{money(captainKeep)}</b>
      </div>
      <div className="cartrow">
        <span>{t("نیسبەی دوکاندار", "عمولة التاجر", "Merchant commission")}</span>
        <b>{settings.platformCommissionPercent}%</b>
      </div>
    </div>
  );
}

function DashboardPanel({
  t,
  role,
  posts,
  pendingReview,
  onApprove,
  settings,
  setSettings,
  onSaveSettings,
  deliveryKm,
  setDeliveryKm,
  customerGps,
}: {
  t: (a: string, b: string, c: string) => string;
  role: Role;
  posts: DisplayPost[];
  pendingReview: DisplayPost[];
  onApprove: (id: string | number) => void;
  settings: PlatformSettings;
  setSettings: React.Dispatch<React.SetStateAction<PlatformSettings>>;
  onSaveSettings: () => void;
  deliveryKm: number | null;
  setDeliveryKm: (n: number | null) => void;
  customerGps: { lat: number; lng: number } | null;
}) {
  const storeLat = 33.3152;
  const storeLng = 44.3661;
  useEffect(() => {
    if (customerGps) {
      setDeliveryKm(distanceKm(customerGps.lat, customerGps.lng, storeLat, storeLng));
    }
  }, [customerGps, setDeliveryKm]);

  return (
    <div className="panel">
      <h2>{t("داشبۆرد", "لوحة التحكم", "Dashboard")}</h2>
      <div className="stats">
        <div>
          <Package />
          <b>{posts.length}</b>
          <span>{t("پۆست", "منشورات", "Posts")}</span>
        </div>
        <div>
          <Bike />
          <b>{deliveryKm != null ? deliveryKm.toFixed(1) + " km" : "—"}</b>
          <span>{t("دووری گەیاندن", "مسافة التوصيل", "Delivery distance")}</span>
        </div>
        <div>
          <Wallet />
          <b>
            {settings.captainPlatformPercent}/{settings.captainSharePercent}
          </b>
          <span>{t("شاخ/کاپتن %", "منصة/كابتن", "Platform/captain %")}</span>
        </div>
      </div>

      {role === "super_admin" && pendingReview.length > 0 && (
        <div className="review-box">
          <h3>{t("پۆستی چاوەڕوان (وەسل)", "منشورات بانتظار الموافقة", "Pending receipt review")}</h3>
          {pendingReview.map((p) => (
            <div className="cartrow" key={p.id}>
              <span>
                {p.emoji} {p.title}
              </span>
              <button type="button" className="primary small" onClick={() => onApprove(p.id)}>
                <CheckCircle2 size={16} /> {t("پەسەند", "موافقة", "Approve")}
              </button>
            </div>
          ))}
        </div>
      )}

      {role === "super_admin" && (
        <div className="form-section">
          <h3>{t("ڕێکخستنی کۆمسیۆن", "إعدادات العمولة", "Commission settings")}</h3>
          <div className="field-grid">
            <label>
              {t("شاخ لە گەیاندن %", "منصة %", "Platform %")}
              <input
                type="number"
                value={settings.captainPlatformPercent}
                onChange={(e) =>
                  setSettings((s) => ({
                    ...s,
                    captainPlatformPercent: Number(e.target.value),
                    captainSharePercent: 100 - Number(e.target.value),
                  }))
                }
              />
            </label>
            <label>
              {t("نیسبەی دوکاندار %", "عمولة التاجر %", "Merchant %")}
              <input
                type="number"
                value={settings.platformCommissionPercent}
                onChange={(e) =>
                  setSettings((s) => ({ ...s, platformCommissionPercent: Number(e.target.value) }))
                }
              />
            </label>
            <label>
              {t("کەمترین کرێی پۆستی ئۆتۆ", "حد أدنى لإعلان السيارة", "Min car listing fee")}
              <input
                type="number"
                value={settings.carListingFeeMin}
                onChange={(e) => setSettings((s) => ({ ...s, carListingFeeMin: Number(e.target.value) }))}
              />
            </label>
            <label>
              {t("کرێ بۆ هەر km", "لكل كم", "Fee per km")}
              <input
                type="number"
                value={settings.deliveryFeePerKm}
                onChange={(e) => setSettings((s) => ({ ...s, deliveryFeePerKm: Number(e.target.value) }))}
              />
            </label>
          </div>
          <button type="button" className="primary" onClick={onSaveSettings}>
            {t("پاشەکەوت", "حفظ", "Save")}
          </button>
        </div>
      )}
    </div>
  );
}
