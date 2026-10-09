import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { Img } from "@/components/ui/Img";
import { plural } from "@/lib/format";
import type { DiscoverySection } from "@/lib/discovery";

/** Last item of every home-page row: a small photo collage that opens the full results for that row. */
export function SeeAllCard({ section }: { section: DiscoverySection }) {
  // Four distinct photos: one per listing first, then second photos of the same listings to fill the grid.
  const pool = [
    ...section.items.map((l) => l.images[1] ?? l.images[0]),
    ...section.items.map((l) => l.images[2]),
    ...section.items.map((l) => l.images[0]),
  ].filter((src): src is string => Boolean(src));
  const photos = [...new Set(pool)].slice(0, 4);
  const label = section.query ? `See all ${plural(section.total, "stay")}` : "See all stays";
  return (
    <Link
      href={section.href}
      aria-label={`${label}: ${section.title}`}
      className="group/see block rounded-card focus-visible:outline-offset-4"
    >
      <div className="relative aspect-[20/19] w-full overflow-hidden rounded-card bg-surface">
        <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 gap-0.5">
          {photos.map((src, i) => (
            <Img
              key={src + i}
              src={src}
              alt=""
              width={280}
              className="size-full transition-transform duration-500 group-hover/see:scale-105"
            />
          ))}
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/45 text-center text-white transition-colors group-hover/see:bg-black/55">
          <span className="text-lg font-semibold leading-tight drop-shadow-sm">See all</span>
          <span className="flex size-10 items-center justify-center rounded-full bg-paper text-ink shadow-md transition-transform duration-200 group-hover/see:translate-x-0.5 group-active/see:scale-95">
            <ArrowRight className="size-5" />
          </span>
        </div>
      </div>
      <p className="mt-2.5 text-[15px] font-semibold leading-snug">{label}</p>
      <p className="truncate text-sm leading-snug text-muted">{section.title}</p>
    </Link>
  );
}
