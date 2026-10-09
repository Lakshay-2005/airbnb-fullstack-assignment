"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";

interface CarouselProps {
  title: string;
  subtitle?: string;
  /** Makes the heading a link to the full list. */
  href?: string;
  children: ReactNode;
  className?: string;
}

/** Titled horizontal scroller. Children should be wrapped in `.carousel-item`. */
export function Carousel({ title, subtitle, href, children, className }: CarouselProps) {
  const track = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ start: true, end: true });

  const measure = useCallback(() => {
    const el = track.current;
    if (!el) return;
    setEdges({
      start: el.scrollLeft <= 2,
      end: el.scrollLeft + el.clientWidth >= el.scrollWidth - 2,
    });
  }, []);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const frame = requestAnimationFrame(measure);
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [measure, children]);

  const scroll = (direction: -1 | 1) => {
    const el = track.current;
    if (el) el.scrollBy({ left: direction * el.clientWidth * 0.85, behavior: "smooth" });
  };

  const arrow = (disabled: boolean) =>
    cn(
      "flex size-8 items-center justify-center rounded-full border border-line bg-paper text-ink shadow-sm transition duration-150",
      disabled ? "cursor-not-allowed opacity-40" : "hover:scale-105 hover:shadow-md active:scale-95",
    );

  const heading = (
    <h2 className="flex items-center gap-1 text-xl font-semibold tracking-tight md:text-[22px]">
      {title}
      {href && (
        <ChevronRight className="mt-0.5 size-5 shrink-0 transition-transform group-hover/title:translate-x-0.5" />
      )}
    </h2>
  );

  return (
    <section aria-label={title} className={cn("py-4 md:py-5", className)}>
      <div className="mb-3 flex items-end justify-between gap-4 md:mb-4">
        <div className="min-w-0">
          {href ? (
            <Link href={href} className="group/title inline-block rounded-md">
              {heading}
            </Link>
          ) : (
            heading
          )}
          {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
        </div>
        <div className="hidden shrink-0 gap-2 md:flex">
          <button
            type="button"
            aria-label={`Scroll ${title} left`}
            disabled={edges.start}
            onClick={() => scroll(-1)}
            className={arrow(edges.start)}
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            aria-label={`Scroll ${title} right`}
            disabled={edges.end}
            onClick={() => scroll(1)}
            className={arrow(edges.end)}
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      </div>
      <div ref={track} onScroll={measure} className="carousel">
        {children}
      </div>
    </section>
  );
}
