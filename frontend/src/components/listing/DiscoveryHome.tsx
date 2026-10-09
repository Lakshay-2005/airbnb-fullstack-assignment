"use client";

import { RefreshCcw } from "lucide-react";
import Link from "next/link";
import { useMemo } from "react";
import { Alert } from "@/components/ui/Alert";
import { Button, buttonClasses } from "@/components/ui/Button";
import { CarouselSkeleton } from "@/components/ui/Skeleton";
import { useApp } from "@/context/AppProvider";
import { useFetch } from "@/hooks/useFetch";
import { listingsApi } from "@/lib/api";
import { buildDiscoverySections } from "@/lib/discovery";
import { Carousel } from "./Carousel";
import { ListingCard } from "./ListingCard";
import { SeeAllCard } from "./SeeAllCard";

/** Everything the curated page is drawn from: one request, sections derived client-side. */
const POOL_SIZE = 48;

/** Default home page when nothing has been searched: horizontal, themed rows of real listings. */
export function DiscoveryHome() {
  const { ready } = useApp();
  const pool = useFetch(
    (signal) => listingsApi.search({ page_size: POOL_SIZE }, { signal }),
    [],
    ready,
  );
  const data = pool.data;
  const sections = useMemo(() => (data ? buildDiscoverySections(data.items) : []), [data]);

  if (pool.error && !data) {
    return (
      <div className="mx-auto max-w-lg py-12">
        <Alert tone="error">{pool.error.message}</Alert>
        <div className="mt-4 flex justify-center">
          <Button variant="secondary" icon={<RefreshCcw className="size-4" />} onClick={pool.reload}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <>
        <CarouselSkeleton />
        <CarouselSkeleton />
      </>
    );
  }

  return (
    <>
      {sections.map((section, sectionIndex) => (
        <Carousel key={section.id} title={section.title} subtitle={section.subtitle} href={section.href}>
          {section.items.map((listing, index) => (
            <div key={listing.id} className="carousel-item">
              <ListingCard listing={listing} priority={sectionIndex === 0 && index < 6} />
            </div>
          ))}
          <div className="carousel-item">
            <SeeAllCard section={section} />
          </div>
        </Carousel>
      ))}
      <div className="flex flex-col items-center gap-3 py-10 text-center">
        <p className="text-sm text-muted">Looking for something specific? Use search and filters above.</p>
        <Link href="/?view=all" className={buttonClasses("dark", "lg")}>
          Show all {data.total} stays
        </Link>
      </div>
    </>
  );
}
