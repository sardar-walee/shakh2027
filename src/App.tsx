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
  Bell,
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
import {
  AdminManagementPanel,
  emptyAdminManagementData,
  type AdminAction,
  type AdminManagementData,
} from "./components/AdminManagementPanel";

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

type Notification = {
  id: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, unknown>;
  is_read: boolean;
  created_at: string;
};

type DashboardOrder = {
  id: string;
  status: string;
  products_total: number;
  delivery_fee: number;
  total: number;
  merchant_amount: number;
  captain_amount: number;
  created_at: string;
};

type DashboardTransaction = {
  id: string;
  kind: string;
  direction: "credit" | "debit";
  status: "pending" | "completed" | "failed";
  amount: number;
  note: string | null;
  reference: string | null;
  created_at: string;
};

type DashboardData = {
  role: Role;
  profile: { full_name: string | null; email?: string | null; phone: string | null } | null;
  stats: {
    users: number | null;
    posts: number;
    active_posts: number;
    orders: number;
    pending_orders: number;
    completed_orders: number;
    revenue: number;
    platform_revenue: number | null;
    unread_notifications: number;
  };
  orders: DashboardOrder[];
  wallet: { balance: number; transactions: DashboardTransaction[] };
  audit_logs: Record<string, unknown>[];
};

const emptyDashboardData: DashboardData = {
  role: "customer",
  profile: null,
  stats: { users: null, posts: 0, active_posts: 0, orders: 0, pending_orders: 0, completed_orders: 0, revenue: 0, platform_revenue: null, unread_notifications: 0 },
  orders: [],
  wallet: { balance: 0, transactions: [] },
  audit_logs: [],
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

export default function App() {
  const [lang, setLang] = useState<Lang>("ku");
  const [tab, setTab] = useState("home");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [cart, setCart] = useState<DisplayPost[]>([]);
  const [posts, setPosts] = useState<DisplayPost[]>([]);
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
  const [checkoutBusy, setCheckoutBusy] = useState(false);
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [dashboardData, setDashboardData] = useState<DashboardData>(emptyDashboardData);
  const [dashboardLoading, setDashboardLoading] = useState(false);
  const [dashboardError, setDashboardError] = useState("");
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [notificationsError, setNotificationsError] = useState("");
  const [notificationFilter, setNotificationFilter] = useState<"all" | "unread" | "read">("all");
  const [selectedNotification, setSelectedNotification] = useState<Notification | null>(null);
  const [showNotificationDropdown, setShowNotificationDropdown] = useState(false);
  const [adminData, setAdminData] = useState<AdminManagementData>(emptyAdminManagementData);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState("");

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
    setSessionUserId(data.session?.user.id ?? null);
    if (data.session?.user.id) {
      const { data: prof } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.session.user.id)
        .maybeSingle();
      if (prof?.role) setProfileRole(prof.role as Role);
    }
  }, []);

  const loadNotifications = useCallback(async () => {
    if (!supabase || !sessionUserId) {
      setNotifications([]);
      setNotificationsError("");
      return;
    }
    setNotificationsLoading(true);
    setNotificationsError("");
    const { data, error } = await supabase
      .from("notifications")
      .select("id,type,title,message,data,is_read,created_at")
      .eq("user_id", sessionUserId)
      .order("created_at", { ascending: false })
      .limit(50);
    setNotificationsLoading(false);
    if (error || !data) {
      setNotificationsError(t("ئاگادارییەکان بار نەکران", "تعذر تحميل الإشعارات", "Could not load notifications"));
      return;
    }
    setNotifications(data as Notification[]);
  }, [sessionUserId, lang]);

  const loadDashboard = useCallback(async () => {
    if (!supabase || !sessionUserId) {
      setDashboardData(emptyDashboardData);
      setDashboardError("");
      return;
    }
    setDashboardLoading(true);
    setDashboardError("");
    const [dashboardResult, walletResult] = await Promise.all([
      supabase.rpc("get_dashboard_data"),
      supabase.rpc("get_wallet_summary"),
    ]);
    setDashboardLoading(false);
    if (dashboardResult.error || walletResult.error || !dashboardResult.data || !walletResult.data) {
      setDashboardData(emptyDashboardData);
      setDashboardError(t("داتای داشبۆرد بار نەکرا", "تعذر تحميل بيانات لوحة التحكم", "Could not load dashboard data"));
      return;
    }
    const dashboard = dashboardResult.data as DashboardData;
    const wallet = walletResult.data as DashboardData["wallet"];
    setDashboardData({ ...dashboard, wallet });
  }, [sessionUserId, lang]);

  const loadAdminData = useCallback(async () => {
    if (!supabase || !sessionUserId || (role !== "admin" && role !== "super_admin")) {
      setAdminData(emptyAdminManagementData);
      setAdminError("");
      return;
    }
    setAdminLoading(true);
    setAdminError("");
    const { data, error } = await supabase.rpc("get_admin_management_data");
    setAdminLoading(false);
    if (error || !data) {
      setAdminData(emptyAdminManagementData);
      setAdminError(t("داتای بەڕێوەبردن بار نەکرا", "تعذر تحميل بيانات الإدارة", "Could not load management data"));
      return;
    }
    setAdminData(data as AdminManagementData);
  }, [sessionUserId, role, lang]);

  const loadPosts = useCallback(async () => {
    if (!supabase) return;
    const { data, error } = await supabase
      .from("posts")
      .select("*")
      .in("status", ["active", "pending_review", "pending_payment"]);
    if (error || !data) {
      setPosts([]);
      setNotice(t("نەتوانرا پۆستەکان بار بکرێن", "تعذر تحميل المنشورات", "Could not load posts"));
      return;
    }
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
        images: (Array.isArray(p.images) ? (p.images as unknown[]) : []).filter((image: unknown): image is string => typeof image === "string"),
        lat: p.lat,
        lng: p.lng,
        locationLabel: p.location_label,
        contactPhone: p.contact_phone,
      }))
    );
  }, [lang]);

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
    const client = supabase;
    if (!client) return;
    const { data: sub } = client.auth.onAuthStateChange(() => {
      refreshSession();
      loadPosts();
    });
    const channel = client
      .channel("public-posts-feed")
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, () => loadPosts())
      .subscribe();
    return () => {
      sub.subscription.unsubscribe();
      void client.removeChannel(channel);
    };
  }, [refreshSession, loadPosts, loadSettings]);

  useEffect(() => {
    loadNotifications();
    const client = supabase;
    if (!client || !sessionUserId) return;
    const channel = client
      .channel(`user-notifications-${sessionUserId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${sessionUserId}` },
        () => loadNotifications()
      )
      .subscribe();
    return () => {
      void client.removeChannel(channel);
    };
  }, [loadNotifications, sessionUserId]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    void loadAdminData();
  }, [loadAdminData]);

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
    const status = isCustomerCar ? "pending_payment" : "active";

    if (isCustomerCar && (!draft.receiptUrl || !draft.paymentReference)) {
      setNotice(t("وێنەی وەسل و ژمارەی سەرچاوە پێویستن", "صورة الوصل ومرجع الدفع مطلوبان", "Receipt and payment reference are required"));
      return;
    }
    if (isCustomerCar && (!supabase || !sessionEmail)) {
      setNotice(t("پشتڕاستکردنەوەی پارەدان پێویستی بە Supabase هەیە", "التحقق من الدفع يتطلب Supabase", "Payment verification requires Supabase"));
      return;
    }

    if (supabase && sessionEmail) {
      const user = (await supabase.auth.getUser()).data.user;
      if (!user) return;
      const { data: insertedPost, error } = await supabase.from("posts").insert({
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
        images: draft.images,
        image_url: draft.images[0] || null,
        receipt_url: draft.receiptUrl || null,
        listing_fee: isCustomerCar ? listingFee : 0,
        listing_fee_paid: false,
        payment_status: isCustomerCar ? "pending" : "not_required",
      }).select("id").single();
      if (error) {
        setNotice(t("پۆست دروست نەکرا", "تعذر إنشاء المنشور", "Could not create the post"));
        return;
      }
      if (isCustomerCar && insertedPost) {
        const { data: verification, error: verificationError } = await supabase.functions.invoke("verify-car-listing-payment", {
          body: { postId: insertedPost.id, paymentReference: draft.paymentReference },
        });
        if (verificationError || verification?.verified !== true) {
          setNotice(t("پارەدان پشتڕاست نەکرایەوە", "تعذر التحقق من الدفع", "Payment could not be verified"));
          await loadPosts();
          return;
        }
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
          images: draft.images,
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

  async function performAdminAction(action: AdminAction, id: string, value: string | boolean) {
    if (!supabase || (role !== "admin" && role !== "super_admin")) return;
    const confirmation = action === "post_moderate" && value === "block"
      ? t("ئەم پۆستە block بکرێت؟", "هل تريد حظر هذا المنشور؟", "Block this post?")
      : action === "user_active" || action === "captain_active"
        ? t("دۆخی چالاکی بگۆڕدرێت؟", "هل تريد تغيير حالة النشاط؟", "Change active status?")
        : "";
    if (confirmation && !window.confirm(confirmation)) return;
    const rpc = action === "user_active"
      ? supabase.rpc("admin_set_user_active", { p_user_id: id, p_is_active: value })
      : action === "captain_active"
        ? supabase.rpc("admin_set_captain_active", { p_captain_id: id, p_is_active: value })
        : action === "post_moderate"
          ? supabase.rpc("admin_moderate_post", { p_post_id: id, p_action: value })
          : supabase.rpc("admin_set_order_status", { p_order_id: id, p_status: value });
    const { error } = await rpc;
    if (error) {
      setNotice(t("کردارەکە سەرکەوتوو نەبوو", "تعذر تنفيذ العملية", "Action failed"));
      return;
    }
    await Promise.all([loadAdminData(), loadPosts(), loadDashboard()]);
    setNotice(t("کردارەکە جێبەجێ کرا", "تم تنفيذ العملية", "Action completed"));
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

  async function checkout() {
    if (!supabase || !sessionEmail) {
      setNotice(t("بۆ داواکاری پێویستە بچیتە ژوورەوە", "يجب تسجيل الدخول للطلب", "Sign in to place an order"));
      setTab("account");
      return;
    }
    if (cart.length === 0 || cart.some((post) => typeof post.id !== "string")) {
      setNotice(t("ئەم پۆستانە لە داتابەیس نیین", "هذه المنشورات غير متاحة", "These posts are not available for checkout"));
      return;
    }
    setCheckoutBusy(true);
    const { data, error } = await supabase.rpc("create_cash_order", {
      p_items: cart.map((post) => ({ post_id: post.id, quantity: 1 })),
      p_delivery_fee: deliveryFee,
      p_address: customerGps ? `${customerGps.lat}, ${customerGps.lng}` : null,
      p_customer_lat: customerGps?.lat ?? null,
      p_customer_lng: customerGps?.lng ?? null,
      p_distance_km: deliveryKm,
    });
    setCheckoutBusy(false);
    if (error || !data) {
      setNotice(t("داواکاری نەکرا", "تعذر إنشاء الطلب", "Could not create the order"));
      return;
    }
    setCart([]);
    setNotice(t("داواکارییەکەت تۆمار کرا", "تم إنشاء الطلب", "Order placed successfully"));
    setTab("dashboard");
  }

  async function markNotificationRead(id: string) {
    if (!supabase) return;
    const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", id);
    if (!error) {
      setNotifications((items) => items.map((item) => (item.id === id ? { ...item, is_read: true } : item)));
      setSelectedNotification((item) => (item?.id === id ? { ...item, is_read: true } : item));
    }
  }

  async function markAllNotificationsRead() {
    if (!supabase || !sessionUserId) return;
    const { error } = await supabase.from("notifications").update({ is_read: true }).eq("user_id", sessionUserId).eq("is_read", false);
    if (!error) setNotifications((items) => items.map((item) => ({ ...item, is_read: true })));
  }

  async function deleteNotification(id: string) {
    if (!supabase) return;
    const { error } = await supabase.from("notifications").delete().eq("id", id);
    if (!error) setNotifications((items) => items.filter((item) => item.id !== id));
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
    if (role !== "admin" && role !== "super_admin") {
      setNotice(t("تەنها ئەدمین دەتوانێت کاپتن دروست بکات", "المشرف فقط يستطيع إنشاء كابتن", "Only admins can create captains"));
      return;
    }
    const { data, error } = await supabase.functions.invoke("create-captain", {
      body: {
        email: captainForm.email,
        password: captainForm.password,
        fullName: captainForm.fullName,
        phone: captainForm.phone,
        kind: captainForm.kind,
      },
    });
    if (error) {
      setNotice(t("دروستکردنی کاپتن سەرکەوتوو نەبوو", "تعذر إنشاء الكابتن", "Captain creation failed"));
      return;
    }
    if (!data?.success) {
      setNotice(t("دروستکردنی کاپتن سەرکەوتوو نەبوو", "تعذر إنشاء الكابتن", "Captain creation failed"));
      return;
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
          <button
            type="button"
            className="iconbtn notification-button"
            onClick={() => setShowNotificationDropdown((open) => !open)}
            aria-label={t("ئاگادارییەکان", "الإشعارات", "Notifications")}
          >
            <Bell size={19} />
            {notifications.some((item) => !item.is_read) && <span className="notification-count">{notifications.filter((item) => !item.is_read).length}</span>}
          </button>
          {showNotificationDropdown && (
            <NotificationDropdown
              notifications={notifications.slice(0, 5)}
              loading={notificationsLoading}
              error={notificationsError}
              t={t}
              onSelect={(item) => {
                setSelectedNotification(item);
                setShowNotificationDropdown(false);
                setTab("notifications");
                if (!item.is_read) void markNotificationRead(item.id);
              }}
              onViewAll={() => {
                setShowNotificationDropdown(false);
                setTab("notifications");
              }}
            />
          )}
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
          {(role === "admin" || role === "super_admin") && (
            <button type="button" onClick={() => setTab("captains")}>
              <Bike />
              {t("کاپتن", "كابتن", "Captains")}
            </button>
          )}
          {(role === "admin" || role === "super_admin") && (
            <button type="button" onClick={() => setTab("admin-management")}>
              <ShieldCheck />
              {t("بەڕێوەبردنی سیستەم", "إدارة النظام", "Admin management")}
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
            <CartPanel
              cart={cart}
              setCart={setCart}
              money={money}
              t={t}
              deliveryFee={deliveryFee}
              onCheckout={checkout}
              checkoutBusy={checkoutBusy}
            />
          )}

          {tab === "notifications" && (
            <NotificationPanel
              notifications={notifications}
              loading={notificationsLoading}
              error={notificationsError}
              filter={notificationFilter}
              selectedNotification={selectedNotification}
              onFilterChange={setNotificationFilter}
              onRetry={() => void loadNotifications()}
              onSelect={setSelectedNotification}
              t={t}
              onMarkRead={markNotificationRead}
              onMarkAllRead={markAllNotificationsRead}
              onDelete={deleteNotification}
            />
          )}

          {tab === "wallet" && (
            <WalletPanel
              money={money}
              t={t}
              data={dashboardData}
              loading={dashboardLoading}
              error={dashboardError}
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
              data={dashboardData}
              loading={dashboardLoading}
              error={dashboardError}
              notificationCount={notifications.filter((item) => !item.is_read).length}
            />
          )}

          {tab === "admin-management" && (
            <AdminManagementPanel
              role={role}
              t={t}
              data={adminData}
              loading={adminLoading}
              error={adminError}
              onRetry={() => void loadAdminData()}
              onAction={performAdminAction}
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

function NotificationDropdown({
  notifications,
  loading,
  error,
  t,
  onSelect,
  onViewAll,
}: {
  notifications: Notification[];
  loading: boolean;
  error: string;
  t: (ku: string, ar: string, en: string) => string;
  onSelect: (notification: Notification) => void;
  onViewAll: () => void;
}) {
  return (
    <div className="notification-dropdown">
      <div className="notification-dropdown-head">
        <b>{t("نوێترین ئاگادارییەکان", "أحدث الإشعارات", "Latest notifications")}</b>
        <button type="button" className="text-button" onClick={onViewAll}>
          {t("هەموو", "الكل", "View all")}
        </button>
      </div>
      {loading ? (
        <p className="notification-state">{t("بارکردن...", "جار التحميل...", "Loading...")}</p>
      ) : error ? (
        <p className="notification-state notification-error">{error}</p>
      ) : notifications.length === 0 ? (
        <p className="notification-state">{t("هیچ ئاگادارییەک نییە", "لا توجد إشعارات", "No notifications yet")}</p>
      ) : (
        <div className="notification-dropdown-list">
          {notifications.map((item) => (
            <button key={item.id} type="button" className={`notification-preview ${item.is_read ? "read" : "unread"}`} onClick={() => onSelect(item)}>
              <span>
                <b>{item.title}</b>
                <small>{item.message}</small>
              </span>
              {!item.is_read && <i aria-label={t("نوێ", "جديد", "Unread")} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function NotificationPanel({
  notifications,
  loading,
  error,
  filter,
  selectedNotification,
  onFilterChange,
  onRetry,
  onSelect,
  t,
  onMarkRead,
  onMarkAllRead,
  onDelete,
}: {
  notifications: Notification[];
  loading: boolean;
  error: string;
  filter: "all" | "unread" | "read";
  selectedNotification: Notification | null;
  onFilterChange: (filter: "all" | "unread" | "read") => void;
  onRetry: () => void;
  onSelect: (notification: Notification | null) => void;
  t: (ku: string, ar: string, en: string) => string;
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onDelete: (id: string) => void;
}) {
  const filteredNotifications = notifications.filter((item) =>
    filter === "all" ? true : filter === "unread" ? !item.is_read : item.is_read
  );

  return (
    <div className="panel notifications-panel">
      <div className="section-head">
        <div>
          <h2>{t("ئاگادارییەکان", "الإشعارات", "Notifications")}</h2>
          <p>{t("نوێترین ئاگادارییەکانی هەژمارەکەت", "أحدث إشعارات حسابك", "Your latest account notifications")}</p>
        </div>
        {notifications.some((item) => !item.is_read) && (
          <button type="button" className="secondary" onClick={onMarkAllRead}>
            {t("هەمووی بخوێنەوە", "تحديد الكل كمقروء", "Mark all read")}
          </button>
        )}
      </div>
      <div className="notification-filters" role="group" aria-label={t("جۆری ئاگاداری", "نوع الإشعارات", "Notification filter")}>
        {(["all", "unread", "read"] as const).map((value) => (
          <button key={value} type="button" className={filter === value ? "selected" : ""} onClick={() => onFilterChange(value)}>
            {value === "all" ? t("هەموو", "الكل", "All") : value === "unread" ? t("نەخوێندراوە", "غير مقروء", "Unread") : t("خوێندراوە", "مقروء", "Read")}
          </button>
        ))}
      </div>
      {loading ? (
        <div className="notification-state">{t("بارکردنی ئاگادارییەکان...", "جار تحميل الإشعارات...", "Loading notifications...")}</div>
      ) : error ? (
        <div className="notification-state notification-error">
          <p>{error}</p>
          <button type="button" className="secondary" onClick={onRetry}>{t("دووبارە هەوڵبدە", "أعد المحاولة", "Retry")}</button>
        </div>
      ) : filteredNotifications.length === 0 ? (
        <div className="empty-state">{t("هیچ ئاگادارییەک نییە", "لا توجد إشعارات", "No notifications yet")}</div>
      ) : (
        <div className="notification-list">
          {filteredNotifications.map((item) => (
            <article key={item.id} className={`notification-item ${item.is_read ? "read" : "unread"}`}>
              <div>
                <button type="button" className="notification-detail-trigger" onClick={() => onSelect(item)}><b>{item.title}</b></button>
                <p>{item.message}</p>
                <small>{new Date(item.created_at).toLocaleString()}</small>
              </div>
              <div className="notification-actions">
                {!item.is_read && (
                  <button type="button" className="secondary small" onClick={() => onMarkRead(item.id)}>
                    {t("خوێندرایەوە", "تمت القراءة", "Read")}
                  </button>
                )}
                <button type="button" className="iconbtn" onClick={() => onDelete(item.id)} aria-label={t("سڕینەوە", "حذف", "Delete")}>
                  <Trash2 size={15} />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}
      {selectedNotification && (
        <div className="notification-detail">
          <div className="section-head">
            <h3>{selectedNotification.title}</h3>
            <button type="button" className="iconbtn" onClick={() => onSelect(null)} aria-label={t("داخستن", "إغلاق", "Close")}><X size={16} /></button>
          </div>
          <p>{selectedNotification.message}</p>
          <small>{new Date(selectedNotification.created_at).toLocaleString()}</small>
          {Object.keys(selectedNotification.data).length > 0 && <pre>{JSON.stringify(selectedNotification.data, null, 2)}</pre>}
        </div>
      )}
    </div>
  );
}

function CartPanel({
  cart,
  setCart,
  money,
  t,
  deliveryFee,
  onCheckout,
  checkoutBusy,
}: {
  cart: DisplayPost[];
  setCart: React.Dispatch<React.SetStateAction<DisplayPost[]>>;
  money: (n: number) => string;
  t: (a: string, b: string, c: string) => string;
  deliveryFee: number;
  onCheckout: () => void;
  checkoutBusy: boolean;
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
          <button type="button" className="primary" onClick={onCheckout} disabled={checkoutBusy}>
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
  data,
  loading,
  error,
}: {
  money: (n: number) => string;
  t: (a: string, b: string, c: string) => string;
  data: DashboardData;
  loading: boolean;
  error: string;
}) {
  return (
    <div className="panel">
      <h2>{t("پارە", "المحفظة", "Wallet")}</h2>
      {loading ? (
        <div className="dashboard-state">{t("بارکردن...", "جار التحميل...", "Loading...")}</div>
      ) : error ? (
        <div className="dashboard-state dashboard-error">{error}</div>
      ) : (
        <>
          <div className="walletbig">
            {money(Number(data.wallet.balance))}
            <small>{t("باڵانسی ڕاستەقینە", "الرصيد الحالي", "Current balance")}</small>
          </div>
          <h3>{t("مامەڵەکان", "المعاملات", "Transactions")}</h3>
          {data.wallet.transactions.length === 0 ? (
            <div className="empty-state">{t("هیچ مامەڵەیەک نییە", "لا توجد معاملات", "No transactions yet")}</div>
          ) : (
            data.wallet.transactions.map((transaction) => (
              <div className="cartrow" key={transaction.id}>
                <span>
                  {transaction.note || transaction.kind}
                  <small>{transaction.status} · {transaction.reference || new Date(transaction.created_at).toLocaleString()}</small>
                </span>
                <b className={transaction.direction === "debit" ? "wallet-debit" : "wallet-credit"}>
                  {transaction.direction === "debit" ? "-" : "+"}{money(Number(transaction.amount))}
                </b>
              </div>
            ))
          )}
        </>
      )}
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
  data,
  loading,
  error,
  notificationCount,
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
  data: DashboardData;
  loading: boolean;
  error: string;
  notificationCount: number;
}) {
  const storeLat = 33.3152;
  const storeLng = 44.3661;
  useEffect(() => {
    if (customerGps) {
      setDeliveryKm(distanceKm(customerGps.lat, customerGps.lng, storeLat, storeLng));
    }
  }, [customerGps, setDeliveryKm]);

  if (loading) {
    return <div className="panel dashboard-state">{t("بارکردنی داشبۆرد...", "جار تحميل لوحة التحكم...", "Loading dashboard...")}</div>;
  }

  if (error) {
    return <div className="panel dashboard-state dashboard-error">{error}</div>;
  }

  return (
    <div className="panel">
      <h2>{t("داشبۆرد", "لوحة التحكم", "Dashboard")}</h2>
      <div className="dashboard-profile">
        <b>{data.profile?.full_name || t("بێ ناو", "بدون اسم", "Unnamed profile")}</b>
        <span>{data.profile?.phone || t("ژمارەی مۆبایل نییە", "لا يوجد هاتف", "No phone")}</span>
      </div>
      <div className="stats">
        {data.stats.users !== null && <DashboardStat icon={<UserRound />} value={data.stats.users} label={t("بەکارهێنەران", "المستخدمون", "Users")} />}
        <DashboardStat icon={<Package />} value={data.stats.posts} label={t("پۆستەکان", "المنشورات", "Posts")} />
        <DashboardStat icon={<Bike />} value={data.stats.orders} label={t("داواکارییەکان", "الطلبات", "Orders")} />
        <DashboardStat icon={<Wallet />} value={moneyValue(data.stats.revenue)} label={t("داهات", "الإيرادات", "Revenue")} />
        <DashboardStat icon={<Package />} value={data.stats.pending_orders} label={t("چاوەڕوان", "قيد الانتظار", "Pending")} />
        <DashboardStat icon={<CheckCircle2 />} value={data.stats.completed_orders} label={t("تەواوکراو", "مكتملة", "Completed")} />
        {notificationCount > 0 && <DashboardStat icon={<Bell />} value={notificationCount} label={t("ئاگادارییە نەخوێندراوەکان", "الإشعارات غير المقروءة", "Unread notifications")} />}
        {role === "super_admin" && data.stats.platform_revenue !== null && <DashboardStat icon={<Wallet />} value={moneyValue(data.stats.platform_revenue)} label={t("داهاتی پلاتفۆرم", "إيرادات المنصة", "Platform revenue")} />}
      </div>

      <div className="dashboard-section">
        <h3>{t("داواکارییە نوێکان", "الطلبات الأخيرة", "Recent orders")}</h3>
        {data.orders.length === 0 ? (
          <div className="empty-state">{t("هیچ داواکارییەک نییە", "لا توجد طلبات", "No orders yet")}</div>
        ) : (
          data.orders.slice(0, 10).map((order) => (
            <div className="cartrow" key={order.id}>
              <span>#{order.id.slice(0, 8)}<small>{order.status}</small></span>
              <b>{moneyValue(Number(order.total))}</b>
            </div>
          ))
        )}
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

      {role === "super_admin" && (
        <div className="dashboard-section">
          <h3>{t("تۆمارەکانی سیستەم", "سجل النظام", "Audit logs")}</h3>
          {data.audit_logs.length === 0 ? (
            <div className="empty-state">{t("هیچ تۆمارێک نییە", "لا توجد سجلات", "No audit logs yet")}</div>
          ) : (
            data.audit_logs.slice(0, 10).map((log, index) => <pre className="audit-row" key={String(log.id ?? index)}>{JSON.stringify(log)}</pre>)
          )}
        </div>
      )}
    </div>
  );
}

function moneyValue(value: number) {
  return new Intl.NumberFormat("en-US").format(value) + " د.ع";
}

function DashboardStat({ icon, value, label }: { icon: React.ReactNode; value: number | string; label: string }) {
  return (
    <div>
      {icon}
      <b>{value}</b>
      <span>{label}</span>
    </div>
  );
}
