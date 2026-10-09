"use client";

import { ImageOff } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/cn";
import { sizedImage } from "@/lib/format";

interface ImgProps {
  src: string | null | undefined;
  alt: string;
  width?: number;
  className?: string;
  priority?: boolean;
  draggable?: boolean;
}

/** Image with a shimmer placeholder while loading and a graceful fallback if it fails. */
export function Img({ src, alt, width = 800, className, priority = false, draggable }: ImgProps) {
  const [state, setState] = useState<"loading" | "loaded" | "error">("loading");
  const [prevSrc, setPrevSrc] = useState(src);
  if (src !== prevSrc) {
    setPrevSrc(src);
    setState("loading");
  }

  if (!src || state === "error") {
    return (
      <div
        role="img"
        aria-label={alt}
        className={cn("flex items-center justify-center bg-surface text-faint", className)}
      >
        <ImageOff className="size-6" aria-hidden="true" />
      </div>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element -- remote host photos; handled by this wrapper
    <img
      src={sizedImage(src, width)}
      alt={alt}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
      draggable={draggable}
      onLoad={() => setState("loaded")}
      onError={() => setState("error")}
      className={cn(
        "bg-surface object-cover transition-opacity duration-300",
        state === "loaded" ? "opacity-100" : "opacity-0",
        className,
      )}
    />
  );
}
