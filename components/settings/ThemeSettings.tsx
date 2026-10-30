"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";
const OPTIONS = [
  { value: "light", label: "Light", icon: Sun },
  { value: "dark", label: "Dark", icon: Moon },
  { value: "system", label: "System", icon: Monitor },
] as const;

export function ThemeSettings() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  return (
    <div role="radiogroup" aria-label="Colour theme" className="grid grid-cols-3 gap-3 sm:max-w-md">
      {OPTIONS.map(({ value, label, icon: Icon }) => {
        const active = mounted && theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => setTheme(value)}
            className={cn(
              "flex flex-col items-center gap-2 rounded-xl border px-3 py-4 text-sm font-medium transition-colors",
              active ? "border-primary bg-primary/10" : "border-border hover:bg-surface-2",
            )}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
            {label}
          </button>
        );
      })}
    </div>
  );
}
