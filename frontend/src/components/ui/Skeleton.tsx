import { cn } from "@/lib/cn";

export function Skeleton({ className }: { className?: string }) {
  return <div aria-hidden="true" className={cn("skeleton", className)} />;
}

export function ListingCardSkeleton() {
  return (
    <div aria-hidden="true">
      <Skeleton className="aspect-[20/19] w-full rounded-card" />
      <div className="mt-3 space-y-2">
        <Skeleton className="h-4 w-3/5" />
        <Skeleton className="h-3.5 w-2/5" />
        <Skeleton className="h-4 w-1/3" />
      </div>
    </div>
  );
}

export function ListingGridSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 gap-x-6 gap-y-9 xs:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
      {Array.from({ length: count }, (_, i) => (
        <ListingCardSkeleton key={i} />
      ))}
    </div>
  );
}

/** Placeholder for a titled carousel while the curated sections load. */
export function CarouselSkeleton() {
  return (
    <div aria-hidden="true" className="py-4 md:py-5">
      <Skeleton className="mb-1 h-6 w-64 max-w-full" />
      <Skeleton className="mb-4 h-4 w-48 max-w-full" />
      <div className="carousel overflow-hidden">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="carousel-item">
            <ListingCardSkeleton />
          </div>
        ))}
      </div>
    </div>
  );
}
