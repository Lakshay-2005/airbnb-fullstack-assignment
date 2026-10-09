"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { initials } from "@/lib/format";

interface AvatarProps {
  name: string;
  src?: string | null;
  className?: string;
}

export function Avatar({ name, src, className }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const base = cn("inline-block size-10 shrink-0 rounded-full object-cover", className);
  if (!src || failed) {
    return (
      <span
        aria-label={name}
        className={cn(base, "inline-flex items-center justify-center bg-ink text-xs font-semibold text-on-ink")}
      >
        {initials(name)}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- tiny remote avatar
    <img src={src} alt={name} className={base} onError={() => setFailed(true)} loading="lazy" />
  );
}
