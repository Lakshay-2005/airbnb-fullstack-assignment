"use client";

import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import Link from "next/link";
import { useRef, useState } from "react";
import { formatMoney, formatRating, plural } from "@/lib/format";
import { cn } from "@/lib/cn";
import { isGuestFavourite } from "@/lib/discovery";
import type { ListingCard as Listing } from "@/lib/api";
import { Img } from "@/components/ui/Img";
import { HeartButton } from "./HeartButton";

interface ListingCardProps {
  listing: Listing;
  /** Query string carrying the current search so the detail page can prefill dates/guests. */
  carryQuery?: string;
  priority?: boolean;
}

const MAX_CARD_IMAGES = 5;

/** Photo-forward card: swipeable photos, one line of place + rating, the title, then the price. */
export function ListingCard({ listing, carryQuery, priority }: ListingCardProps) {
  const images = listing.images.slice(0, MAX_CARD_IMAGES);
  const scroller = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const href = `/listings/${listing.id}${carryQuery ? `?${carryQuery}` : ""}`;
  const favourite = isGuestFavourite(listing);

  const go = (event: React.MouseEvent, direction: -1 | 1) => {
    event.preventDefault();
    event.stopPropagation();
    const el = scroller.current;
    if (el) el.scrollBy({ left: direction * el.clientWidth, behavior: "smooth" });
  };

  const arrow =
    "absolute top-1/2 z-20 hidden size-7 -translate-y-1/2 items-center justify-center rounded-full bg-paper/95 text-ink shadow-md transition duration-150 hover:scale-105 hover:bg-paper active:scale-95 md:flex md:opacity-0 md:group-hover/card:opacity-100 md:group-focus-within/card:opacity-100";

  return (
    <article className="group/card relative">
      <div className="relative">
        <Link
          href={href}
          draggable={false}
          aria-label={`${listing.title}, ${listing.city}, ${listing.country}`}
          className="block overflow-hidden rounded-card bg-surface active:opacity-95"
        >
          <div
            ref={scroller}
            onScroll={(event) => {
              const el = event.currentTarget;
              setIndex(Math.round(el.scrollLeft / el.clientWidth));
            }}
            className="no-scrollbar flex aspect-[20/19] w-full snap-x snap-mandatory overflow-x-auto"
          >
            {images.map((src, i) => (
              <Img
                key={src}
                src={src}
                alt={i === 0 ? `${listing.title} in ${listing.city}` : `${listing.title}, photo ${i + 1}`}
                width={560}
                priority={priority && i === 0}
                draggable={false}
                className="aspect-[20/19] min-w-full snap-center"
              />
            ))}
            {images.length === 0 && <Img src={null} alt={listing.title} className="aspect-[20/19] min-w-full" />}
          </div>
        </Link>

        {favourite && (
          <span className="pointer-events-none absolute left-2.5 top-2.5 z-10 rounded-full bg-paper px-2.5 py-1 text-xs font-semibold leading-none shadow-[0_1px_4px_rgb(0_0_0/0.18)]">
            Guest favourite
          </span>
        )}
        <HeartButton listingId={listing.id} />

        {images.length > 1 && (
          <>
            {index > 0 && (
              <button type="button" aria-label="Previous photo" onClick={(event) => go(event, -1)} className={cn(arrow, "left-2")}>
                <ChevronLeft className="size-4" />
              </button>
            )}
            {index < images.length - 1 && (
              <button type="button" aria-label="Next photo" onClick={(event) => go(event, 1)} className={cn(arrow, "right-2")}>
                <ChevronRight className="size-4" />
              </button>
            )}
            <div className="pointer-events-none absolute inset-x-0 bottom-2.5 z-10 flex justify-center gap-1">
              {images.map((src, i) => (
                <span
                  key={src}
                  className={cn(
                    "size-1.5 rounded-full bg-paper shadow-[0_0_2px_rgb(0_0_0/0.3)] transition-all duration-200",
                    i === index ? "scale-110 opacity-100" : "opacity-60",
                  )}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <Link href={href} draggable={false} className="mt-2.5 block rounded-md">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate text-[15px] font-semibold leading-snug">
            {listing.property_type} in {listing.city}
          </h3>
          <span className="flex shrink-0 items-center gap-1 text-sm leading-snug">
            {listing.review_count > 0 ? (
              <>
                <Star className="size-3 fill-ink" aria-hidden="true" />
                <span className="sr-only">Rated</span>
                {formatRating(listing.rating)}
                <span className="sr-only">out of 5</span>
              </>
            ) : (
              <span className="font-medium">New</span>
            )}
          </span>
        </div>
        <p className="truncate text-sm leading-snug text-muted">{listing.title}</p>
        <p className="mt-1 text-[15px] leading-snug">
          {listing.stay ? (
            <>
              <span className="font-semibold">{formatMoney(listing.stay.total)}</span>
              <span className="text-muted"> total · {plural(listing.stay.nights, "night")}</span>
            </>
          ) : (
            <>
              <span className="font-semibold">{formatMoney(listing.nightly_price)}</span>
              <span className="text-muted"> night</span>
            </>
          )}
        </p>
      </Link>
    </article>
  );
}
