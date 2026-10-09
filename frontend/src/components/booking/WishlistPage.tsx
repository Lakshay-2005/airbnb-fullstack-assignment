"use client";

import { Heart } from "lucide-react";
import { ListingCard } from "@/components/listing/ListingCard";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListingGridSkeleton } from "@/components/ui/Skeleton";
import { useApp } from "@/context/AppProvider";
import { useFetch } from "@/hooks/useFetch";
import { favoritesApi } from "@/lib/api";
import { plural } from "@/lib/format";

export function WishlistPage() {
  const { user, ready, favoriteIds } = useApp();
  const saved = useFetch((signal) => favoritesApi.list({ signal }), [user?.id], ready);
  // Un-hearting a card removes it right away, without waiting for a refetch.
  const items = (saved.data ?? []).filter((listing) => favoriteIds.has(listing.id));

  return (
    <div className="container-page pb-24 pt-8 md:pb-16">
      <h1 className="text-[28px] font-semibold md:text-[32px]">Wishlist</h1>
      {saved.data && items.length > 0 && <p className="mt-1 text-muted">{plural(items.length, "saved stay")}</p>}

      <div className="mt-8">
        {!saved.data && !saved.error && <ListingGridSkeleton count={8} />}
        {saved.error && !saved.data && (
          <EmptyState icon={Heart} title="Couldn’t load your wishlist" description={saved.error.message} />
        )}
        {saved.data && items.length === 0 && (
          <EmptyState
            icon={Heart}
            title="Create your first wishlist"
            description="As you search, tap the heart on any stay to save it here. Your list is stored on your account."
            actions={<ButtonLink href="/" variant="dark">Start exploring</ButtonLink>}
          />
        )}
        {items.length > 0 && (
          <div className="grid grid-cols-1 gap-x-6 gap-y-9 xs:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
            {items.map((listing) => (
              <ListingCard key={listing.id} listing={listing} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
