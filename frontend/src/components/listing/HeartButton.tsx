"use client";

import { Heart } from "lucide-react";
import { useState } from "react";
import { useApp } from "@/context/AppProvider";
import { cn } from "@/lib/cn";

interface HeartButtonProps {
  listingId: number;
  className?: string;
  /** "overlay" floats over a photo; "inline" is the labelled button on the detail page. */
  variant?: "overlay" | "inline";
}

export function HeartButton({ listingId, className, variant = "overlay" }: HeartButtonProps) {
  const { favoriteIds, toggleFavorite } = useApp();
  const saved = favoriteIds.has(listingId);
  const [popKey, setPopKey] = useState(0);

  const onClick = (event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
    setPopKey((k) => k + 1);
    void toggleFavorite(listingId);
  };

  const icon = (
    <Heart
      key={popKey}
      className={cn(
        "size-6 transition-colors",
        variant === "overlay" ? "drop-shadow-[0_1px_2px_rgba(0,0,0,0.35)]" : "size-[18px]",
        saved
          ? "fill-brand text-brand"
          : variant === "overlay"
            ? "fill-black/40 text-white"
            : "text-ink",
        popKey > 0 && "animate-heart",
      )}
    />
  );

  if (variant === "inline") {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={saved}
        className={cn(
          "inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold underline-offset-2 transition hover:bg-surface",
          className,
        )}
      >
        {icon}
        <span className="underline">{saved ? "Saved" : "Save"}</span>
      </button>
    );
  }
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={saved}
      aria-label={saved ? "Remove from wishlist" : "Save to wishlist"}
      className={cn(
        "absolute right-3 top-3 z-20 flex size-9 items-center justify-center rounded-full transition hover:scale-110 active:scale-95",
        className,
      )}
    >
      {icon}
    </button>
  );
}
