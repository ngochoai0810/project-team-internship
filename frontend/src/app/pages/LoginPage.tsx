import { useState, type FormEvent } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  ShieldCheck,
  ArrowRight,
  Loader2, // Equivalent to CircleNotch
  Lock,
  Mail
} from "lucide-react";
import { motion, useReducedMotion } from "motion/react";
import { useAuth } from "../auth/AuthContext";
import { BackendApiError } from "../services/backendApi";

export function LoginPage() {
  const { t } = useTranslation("auth");
  const { user, login } = useAuth();
  const location = useLocation();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const reduceMotion = useReducedMotion();

  if (user) {
    const target = (location.state as { from?: string } | null)?.from ?? "/";
    return <Navigate to={target} replace />;
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);
    try {
      await login(email, password);
    } catch (caughtError) {
      if (caughtError instanceof BackendApiError && caughtError.status === 401) {
        setError(t("login.invalidCredentials"));
      } else if (caughtError instanceof Error && caughtError.message.trim() !== "") {
        setError(caughtError.message);
      } else {
        setError(t("login.invalidCredentials"));
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const entry = reduceMotion
    ? { initial: false, animate: undefined }
    : {
        initial: { opacity: 0, y: 12, filter: "blur(8px)" },
        animate: { opacity: 1, y: 0, filter: "blur(0px)" },
        transition: { duration: 0.7, ease: [0.16, 1, 0.3, 1] as const },
      };

  return (
    <main className="relative grid min-h-dvh w-full place-items-center overflow-hidden bg-canvas px-4 py-10 text-text-primary">
      {/* Atmospheric backdrop: two soft mesh orbs + hairline grid. Pointer-events-none, fixed inside viewport. */}
      <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-32 -left-32 h-[420px] w-[420px] rounded-full opacity-60 blur-3xl"
          style={{ background: "radial-gradient(circle at 30% 30%, rgba(16,185,129,0.22), transparent 60%)" }}
        />
        <div
          className="absolute -bottom-40 -right-32 h-[480px] w-[480px] rounded-full opacity-50 blur-3xl"
          style={{ background: "radial-gradient(circle at 70% 70%, rgba(250,204,21,0.14), transparent 65%)" }}
        />
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage:
              "linear-gradient(to right, color-mix(in srgb, var(--color-text-tertiary) 35%, transparent) 1px, transparent 1px), linear-gradient(to bottom, color-mix(in srgb, var(--color-text-tertiary) 35%, transparent) 1px, transparent 1px)",
            backgroundSize: "56px 56px",
            maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
            WebkitMaskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
          }}
        />
      </div>

      {/* Double-Bezel card: outer shell + inner core, concentric radii. */}
      <motion.section
        {...entry}
        className="relative z-10 w-full max-w-[420px]"
      >
        <div className="rounded-[28px] border border-(--theme-subtle-border) bg-(--theme-subtle-bg) p-[1.5px] shadow-[0_30px_120px_-62px_var(--theme-shadow)] backdrop-blur-2xl">
          <div
            className="rounded-[26px] border border-white/5 p-7 sm:p-8"
            style={{
              background:
                "linear-gradient(180deg, color-mix(in srgb, var(--color-elevated) 94%, transparent) 0%, color-mix(in srgb, var(--color-surface) 94%, transparent) 100%)",
              boxShadow: "inset 0 1px 0 var(--theme-subtle-border)",
            }}
          >
            {/* Header: brand mark + eyebrow + title + subtitle. No section-number eyebrow. */}
            <header className="flex flex-col gap-4">
              <div className="flex items-center justify-between">
                <div
                  className="flex h-11 w-11 items-center justify-center rounded-2xl border border-emerald-500/25 text-emerald-300"
                  style={{
                    background:
                      "linear-gradient(180deg, rgba(16,185,129,0.18), rgba(16,185,129,0.06))",
                    boxShadow:
                      "inset 0 1px 0 rgba(255,255,255,0.08), 0 8px 24px -8px rgba(16,185,129,0.35)",
                  }}
                >
                  <ShieldCheck size={22} strokeWidth={1.5} />
                </div>
                <span
                  className="rounded-full border border-white/8 bg-white/2 px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.2em] text-zinc-500"
                >
                  {t("login.badge")}
                </span>
              </div>

              <div className="grid gap-1.5">
                <h1 className="text-[22px] font-semibold leading-tight tracking-tight text-text-primary">
                  {t("login.title")}
                </h1>
                <p className="max-w-[34ch] text-[13px] leading-relaxed text-text-secondary">
                  {t("login.description")}
                </p>
              </div>
            </header>

            <form onSubmit={onSubmit} className="mt-7 grid gap-4">
              {/* Email field: nested input architecture with leading icon. */}
              <label className="grid gap-1.5">
                <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-text-tertiary">
                  {t("login.emailLabel")}
                </span>
                <span
                  className="field-surface group flex h-11 items-center gap-2 px-3 transition-colors duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:border-white/[0.14]"
                >
                  <Mail
                    size={16}
                    strokeWidth={1.7}
                    className="text-zinc-500 transition-colors duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-focus-within:text-emerald-300"
                  />
                  <input
                    type="email"
                    autoComplete="email"
                    inputMode="email"
                    placeholder={t("login.emailPlaceholder")}
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    className="w-full bg-transparent text-[13px] text-text-primary placeholder:text-zinc-600 outline-none"
                  />
                </span>
              </label>

              {/* Password field: same nested input architecture. */}
              <label className="grid gap-1.5">
                <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-text-tertiary">
                  {t("login.passwordLabel")}
                </span>
                <span
                  className="field-surface group flex h-11 items-center gap-2 px-3 transition-colors duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:border-white/[0.14]"
                >
                  <Lock
                    size={16}
                    strokeWidth={1.7}
                    className="text-zinc-500 transition-colors duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-focus-within:text-emerald-300"
                  />
                  <input
                    type="password"
                    autoComplete="current-password"
                    placeholder={t("login.passwordPlaceholder")}
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    required
                    className="w-full bg-transparent text-[13px] text-text-primary placeholder:text-zinc-600 outline-none"
                  />
                </span>
              </label>

              {/* Error: clear, inline. WCAG AA contrast against card surface. */}
              {error ? (
                <p
                  role="alert"
                  className="flex items-center gap-2 rounded-lg border border-rose-500/20 bg-rose-500/8 px-3 py-2 text-[12px] text-rose-300"
                >
                  <span
                    aria-hidden
                    className="inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-rose-400"
                  />
                  {error}
                </p>
              ) : null}

              {/* Primary CTA: button-in-button trailing icon, tactile press, cubic-bezier. */}
              <button
                type="submit"
                disabled={isSubmitting}
                className="group relative mt-1 flex h-11 items-center justify-between rounded-xl border border-emerald-400/30 bg-emerald-500 px-4 text-[13px] font-semibold text-zinc-950 shadow-[0_12px_30px_-12px_rgba(16,185,129,0.55)] transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] hover:bg-emerald-400 hover:border-emerald-300/60 hover:shadow-[0_18px_40px_-12px_rgba(16,185,129,0.7)] active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-emerald-500"
              >
                <span className="inline-flex items-center gap-2">
                  {isSubmitting ? (
                    <Loader2 size={16} className="animate-spin" strokeWidth={2} />
                  ) : null}
                  {isSubmitting ? t("login.submitting") : t("login.submit")}
                </span>
                {!isSubmitting ? (
                  <span
                    aria-hidden
                    className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-950/15 transition-transform duration-500 ease-[cubic-bezier(0.32,0.72,0,1)] group-hover:translate-x-0.5 group-hover:-translate-y-px"
                  >
                    <ArrowRight size={12} strokeWidth={2} />
                  </span>
                ) : null}
              </button>
            </form>

            {/* Footer: legal-style helper line, no marketing fluff, no version stamp. */}
            <footer className="mt-7 flex items-center justify-between border-t border-white/6 pt-5">
              <span className="font-mono-num text-[10.5px] uppercase tracking-[0.18em] text-text-tertiary">
                {t("login.restrictedAccess")}
              </span>
              <span className="text-[11px] text-text-tertiary">
                {t("login.help")}
              </span>
            </footer>
          </div>
        </div>
      </motion.section>
    </main>
  );
}
