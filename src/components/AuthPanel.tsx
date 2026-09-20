import React, { useState } from "react";
import { supabase } from "../lib/supabase";
import { LogIn, UserPlus, KeyRound } from "lucide-react";

type Mode = "login" | "signup" | "reset" | "update";

type Props = {
  t: (ku: string, ar: string, en: string) => string;
  onSuccess: () => void;
  email: string | null;
  onSignOut: () => void;
};

export function AuthPanel({ t, onSuccess, email, onSignOut }: Props) {
  const [mode, setMode] = useState<Mode>("login");
  const [form, setForm] = useState({
    email: "",
    password: "",
    fullName: "",
    phone: "",
  });
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr("");
    setMsg("");
    if (!supabase) {
      setErr(t("Supabase ڕێکنەخراوە", "Supabase غير مُعد", "Supabase not configured"));
      return;
    }
    setBusy(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email: form.email,
          password: form.password,
        });
        if (error) throw error;
        onSuccess();
      } else if (mode === "signup") {
        if (form.password !== confirmPassword) {
          throw new Error(t("وشەی نهێنییەکان یەکسان نین", "كلمتا المرور غير متطابقتين", "Passwords must match"));
        }
        const { error } = await supabase.auth.signUp({
          email: form.email,
          password: form.password,
          options: {
            data: { full_name: form.fullName, phone: form.phone, role: "customer" },
          },
        });
        if (error) throw error;
        setMsg(
          t(
            "هەژمار دروست کرا — ئیمەیڵەکەت بپشکنە",
            "تم إنشاء الحساب — تحقق من بريدك",
            "Account created — check your email"
          )
        );
      } else if (mode === "reset") {
        const { error } = await supabase.auth.resetPasswordForEmail(form.email, {
          redirectTo: `${window.location.origin}/?reset=1`,
        });
        if (error) throw error;
        setMsg(
          t(
            "لینکی گەڕاندنەوەی ووشەی نهێنی نێردرا",
            "تم إرسال رابط إعادة تعيين كلمة المرور",
            "Password reset link sent"
          )
        );
      } else {
        if (form.password.length < 8 || form.password !== confirmPassword) {
          throw new Error(t("وشەی نهێنییەکان یەکسان نین", "كلمتا المرور غير متطابقتين", "Passwords must match and be at least 8 characters"));
        }
        const { error } = await supabase.auth.updateUser({ password: form.password });
        if (error) throw error;
        setMsg(t("وشەی نهێنی نوێ کرایەوە", "تم تحديث كلمة المرور", "Password updated"));
      }
    } catch (ex: unknown) {
      setErr(ex instanceof Error ? ex.message : String(ex));
    } finally {
      setBusy(false);
    }
  }

  if (email && mode !== "update") {
    return (
      <div className="auth-panel compact">
        <p>
          {t("چوونەژوورەوە:", "مسجل:", "Signed in:")} <b>{email}</b>
        </p>
        <button type="button" className="secondary" onClick={onSignOut}>
          {t("چوونەدەرەوە", "تسجيل خروج", "Sign out")}
        </button>
        <button type="button" className="secondary" onClick={() => setMode("update")}>
          {t("گۆڕینی ووشەی نهێنی", "تغيير كلمة المرور", "Change password")}
        </button>
      </div>
    );
  }

  return (
    <div className="auth-panel">
      <div className="auth-tabs">
        <button type="button" className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>
          <LogIn size={16} /> {t("چوونەژوورەوە", "دخول", "Login")}
        </button>
        <button type="button" className={mode === "signup" ? "active" : ""} onClick={() => setMode("signup")}>
          <UserPlus size={16} /> {t("دروستکردنی هەژمار", "إنشاء حساب", "Sign up")}
        </button>
        <button type="button" className={mode === "reset" ? "active" : ""} onClick={() => setMode("reset")}>
          <KeyRound size={16} /> {t("گەڕاندنەوەی ووشەی نهێنی", "استعادة كلمة المرور", "Reset password")}
        </button>
        {email && (
          <button type="button" className={mode === "update" ? "active" : ""} onClick={() => setMode("update")}>
            <KeyRound size={16} /> {t("گۆڕینی ووشە", "تغيير كلمة المرور", "Change password")}
          </button>
        )}
      </div>
      <form className="form auth-form" onSubmit={submit}>
        {mode === "signup" && (
          <>
            <label>{t("ناوی تەواو", "الاسم الكامل", "Full name")}</label>
            <input
              value={form.fullName}
              onChange={(e) => setForm({ ...form, fullName: e.target.value })}
              required
            />
            <label>{t("ژمارەی مۆبایل", "الهاتف", "Phone")}</label>
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
            />
          </>
        )}
        <label>{t("ئیمەیڵ", "البريد", "Email")}</label>
        <input
          type="email"
          value={form.email}
          onChange={(e) => setForm({ ...form, email: e.target.value })}
          required
        />
        {mode !== "reset" && (
          <>
            <label>{t("وشەی نهێنی", "كلمة المرور", "Password")}</label>
            <input
              type="password"
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              required
              minLength={6}
            />
          </>
        )}
        {mode === "update" && (
          <>
            <label>{t("دووبارە ووشەی نهێنی", "تأكيد كلمة المرور", "Confirm password")}</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={8} />
          </>
        )}
        {mode === "signup" && (
          <>
            <label>{t("دووبارە ووشەی نهێنی", "تأكيد كلمة المرور", "Confirm password")}</label>
            <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} required minLength={6} />
            <label className="check-row">
              <input type="checkbox" required />
              {t("مەرجەکانم قبووڵە", "أوافق على الشروط", "I accept the terms")}
            </label>
          </>
        )}
        {err && <p className="form-err">{err}</p>}
        {msg && <p className="form-ok">{msg}</p>}
        <button type="submit" className="primary" disabled={busy}>
          {mode === "login"
            ? t("چوونەژوورەوە", "دخول", "Login")
            : mode === "signup"
              ? t("دروستکردن", "إنشاء", "Create account")
              : mode === "reset"
                ? t("ناردن", "إرسال", "Send link")
                : t("گۆڕین", "تحديث", "Update password")}
        </button>
      </form>
    </div>
  );
}
