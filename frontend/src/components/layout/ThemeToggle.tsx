"use client";

import { Moon, Sun } from "lucide-react";
import { cn } from "@/lib/cn";
import { setTheme, useTheme } from "@/lib/theme";

/** Light/dark switch shown next to the avatar. */
export function ThemeToggle({ className }: { className?: string }) {
  const dark = useTheme() === "dark";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={dark}
      aria-label="Dark mode"
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      onClick={() => setTheme(dark ? "light" : "dark")}
      className={cn(
        "flex size-10 items-center justify-center rounded-full transition duration-150 hover:bg-black/5 active:scale-95 dark:hover:bg-white/10",
        className,
      )}
    >
      {dark ? <Moon className="size-[18px]" /> : <Sun className="size-[18px]" />}
    </button>
  );
}
