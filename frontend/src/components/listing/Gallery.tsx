"use client";

import { ChevronLeft, ChevronRight, Grid2x2, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Img } from "@/components/ui/Img";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/cn";

interface GalleryProps {
  images: string[];
  title: string;
}

/** Asymmetric photo grid on desktop, swipeable carousel on phones, plus a full-screen viewer. */
export function Gallery({ images, title }: GalleryProps) {
  const [viewer, setViewer] = useState<number | null>(null);
  const open = (index: number) => () => setViewer(index);
  const alt = (i: number) => `${title}, photo ${i + 1} of ${images.length}`;
  const extra = images.slice(1, 5);

  return (
    <>
      {/* phones */}
      <MobileCarousel images={images} alt={alt} onOpen={(i) => setViewer(i)} />

      {/* tablets and desktops */}
      <div className="relative hidden overflow-hidden rounded-2xl md:block">
        <div
          className={cn(
            "grid h-[320px] gap-2 lg:h-[440px]",
            extra.length === 0 ? "grid-cols-1" : "grid-cols-4 grid-rows-2",
          )}
        >
          <button
            type="button"
            onClick={open(0)}
            aria-label="Open photo 1 in the viewer"
            className={cn(
              "group relative overflow-hidden",
              extra.length === 0 ? "" : extra.length === 1 ? "col-span-2 row-span-2" : "col-span-2 row-span-2",
            )}
          >
            <Img
              src={images[0]}
              alt={alt(0)}
              width={1200}
              priority
              className="size-full transition duration-500 group-hover:scale-[1.03] group-hover:brightness-95"
            />
          </button>
          {extra.length === 1 && (
            <button type="button" onClick={open(1)} aria-label="Open photo 2" className="group col-span-2 row-span-2 overflow-hidden">
              <Img src={extra[0]} alt={alt(1)} width={800} className="size-full transition duration-500 group-hover:scale-[1.03] group-hover:brightness-95" />
            </button>
          )}
          {extra.length > 1 &&
            extra.map((src, i) => (
              <button
                key={src}
                type="button"
                onClick={open(i + 1)}
                aria-label={`Open photo ${i + 2}`}
                className={cn(
                  "group overflow-hidden",
                  extra.length === 2 && "col-span-2",
                  extra.length === 3 && i === 2 && "col-span-2",
                )}
              >
                <Img
                  src={src}
                  alt={alt(i + 1)}
                  width={640}
                  className="size-full transition duration-500 group-hover:scale-[1.03] group-hover:brightness-95"
                />
              </button>
            ))}
        </div>
        {images.length > 1 && (
          <button
            type="button"
            onClick={open(0)}
            className="absolute bottom-4 right-4 flex items-center gap-2 rounded-lg border border-ink bg-paper px-4 py-2 text-sm font-semibold shadow-sm transition hover:bg-surface active:scale-95"
          >
            <Grid2x2 className="size-4" />
            Show all photos
          </button>
        )}
      </div>

      <Lightbox images={images} alt={alt} index={viewer} onIndex={setViewer} />
    </>
  );
}

function MobileCarousel({
  images,
  alt,
  onOpen,
}: {
  images: string[];
  alt: (i: number) => string;
  onOpen: (index: number) => void;
}) {
  const [index, setIndex] = useState(0);
  return (
    <div className="relative -mx-4 sm:-mx-10 md:hidden">
      <div
        className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto"
        onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
      >
        {images.map((src, i) => (
          <button
            key={src}
            type="button"
            onClick={() => onOpen(i)}
            aria-label={`Open photo ${i + 1} in the viewer`}
            className="aspect-[4/3] min-w-full snap-center"
          >
            <Img src={src} alt={alt(i)} width={900} priority={i === 0} className="size-full" />
          </button>
        ))}
      </div>
      <span className="pointer-events-none absolute bottom-3 right-3 rounded-lg bg-black/70 px-2.5 py-1 text-xs font-medium text-white">
        {index + 1} / {images.length}
      </span>
    </div>
  );
}

function Lightbox({
  images,
  alt,
  index,
  onIndex,
}: {
  images: string[];
  alt: (i: number) => string;
  index: number | null;
  onIndex: (index: number | null) => void;
}) {
  const open = index !== null;
  // Remember the last photo so the exit animation doesn't flash a different image.
  const [shown, setShown] = useState(0);
  if (index !== null && index !== shown) setShown(index);
  const current = shown;

  const step = useCallback(
    (delta: number) => onIndex((((shown + delta) % images.length) + images.length) % images.length),
    [images.length, onIndex, shown],
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "ArrowRight") step(1);
      if (event.key === "ArrowLeft") step(-1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, step]);

  const nav =
    "absolute top-1/2 z-10 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white backdrop-blur transition hover:bg-white/25 active:scale-95";

  return (
    <Modal
      open={open}
      onClose={() => onIndex(null)}
      title="Photo viewer"
      size="full"
      hideHeader
      className="h-dvh max-h-none! rounded-none! bg-black text-white"
    >
      <div className="flex h-full flex-col">
        <div className="flex shrink-0 items-center justify-between px-4 py-3">
          <button
            type="button"
            onClick={() => onIndex(null)}
            aria-label="Close photo viewer"
            className="flex size-10 items-center justify-center rounded-full transition hover:bg-white/15"
          >
            <X className="size-5" />
          </button>
          <p className="text-sm font-medium" aria-live="polite">
            {current + 1} / {images.length}
          </p>
          <span className="size-10" />
        </div>
        <div className="relative min-h-0 flex-1">
          {images.length > 1 && (
            <>
              <button type="button" onClick={() => step(-1)} aria-label="Previous photo" className={cn(nav, "left-3 md:left-6")}>
                <ChevronLeft className="size-6" />
              </button>
              <button type="button" onClick={() => step(1)} aria-label="Next photo" className={cn(nav, "right-3 md:right-6")}>
                <ChevronRight className="size-6" />
              </button>
            </>
          )}
          <Img
            key={current}
            src={images[current]}
            alt={alt(current)}
            width={1600}
            className="mx-auto size-full max-w-[1200px] animate-fade-in !bg-transparent object-contain px-2 md:px-16"
          />
        </div>
        <div className="no-scrollbar flex shrink-0 justify-start gap-2 overflow-x-auto px-4 py-4 md:justify-center">
          {images.map((src, i) => (
            <button
              key={src}
              type="button"
              onClick={() => onIndex(i)}
              aria-label={`Go to photo ${i + 1}`}
              aria-current={i === current}
              className={cn(
                "h-14 w-20 shrink-0 overflow-hidden rounded-lg border-2 transition",
                i === current ? "border-white" : "border-transparent opacity-60 hover:opacity-100",
              )}
            >
              <Img src={src} alt="" width={160} className="size-full" />
            </button>
          ))}
        </div>
      </div>
    </Modal>
  );
}
