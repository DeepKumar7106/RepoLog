"use client";

import { Monitor, Moon, Sun } from "lucide-react";
import { useEffect, useSyncExternalStore } from "react";
import { cn } from "@/lib/ui/format";

type Theme = "light" | "dark" | "system";

const STORAGE_KEY = "repolog-theme";
const THEME_COOKIE = "repolog-theme";
const THEME_EVENT = "repolog-theme-change";

function isTheme(value: string | null | undefined): value is Theme {
  return value === "light" || value === "dark" || value === "system";
}

function readCookieTheme(): Theme | null {
  const entry = document.cookie.split("; ").find((row) => row.startsWith(`${THEME_COOKIE}=`));

  if (!entry) {
    return null;
  }

  const value = decodeURIComponent(entry.slice(THEME_COOKIE.length + 1));
  return isTheme(value) ? value : null;
}

function readTheme(): Theme {
  try {
    const cookieTheme = readCookieTheme();

    if (cookieTheme) {
      return cookieTheme;
    }

    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isTheme(stored) ? stored : "system";
  } catch {
    return "system";
  }
}

function subscribe(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(THEME_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(THEME_EVENT, callback);
  };
}

function applyTheme(theme: Theme) {
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const dark = theme === "dark" || (theme === "system" && prefersDark);
  document.documentElement.classList.toggle("dark", dark);
  document.documentElement.classList.toggle("light", theme === "light");
}

function persistTheme(theme: Theme) {
  try {
    if (theme === "system") {
      document.cookie = `${THEME_COOKIE}=;path=/;max-age=0;samesite=lax`;
      window.localStorage.removeItem(STORAGE_KEY);
      return;
    }

    document.cookie = `${THEME_COOKIE}=${theme};path=/;max-age=31536000;samesite=lax`;
    window.localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Cookie and storage access can fail in restricted browser contexts.
  }
}

export function ThemeToggle({ className }: Readonly<{ className?: string }>) {
  const theme = useSyncExternalStore(subscribe, readTheme, () => "system" as const);

  useEffect(() => {
    applyTheme(theme);
    if (theme !== "system") {
      return;
    }
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => applyTheme("system");
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [theme]);

  function choose(next: Theme) {
    applyTheme(next);
    persistTheme(next);
    window.dispatchEvent(new Event(THEME_EVENT));
  }

  const options: Array<{ value: Theme; label: string; icon: typeof Sun }> = [
    { value: "light", label: "Light", icon: Sun },
    { value: "dark", label: "Dark", icon: Moon },
    { value: "system", label: "System", icon: Monitor },
  ];

  return (
    <div
      aria-label="Color theme"
      className={cn(
        "inline-flex items-center gap-0.5 rounded-md border border-line bg-surface p-0.5",
        className,
      )}
      role="group"
    >
      {options.map((option) => {
        const Icon = option.icon;
        const active = theme === option.value;

        return (
          <button
            aria-label={`${option.label} theme`}
            aria-pressed={active}
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:outline-none",
              active ? "bg-canvas text-primary shadow-sm" : "text-muted hover:text-primary",
            )}
            key={option.value}
            onClick={() => choose(option.value)}
            title={`${option.label} theme`}
            type="button"
          >
            <Icon aria-hidden="true" className="h-3.5 w-3.5" />
          </button>
        );
      })}
    </div>
  );
}
