"use client";

import { Lock } from "lucide-react";
import { useParams } from "next/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Skeleton } from "@/components/ui/Skeleton";
import { useApp } from "@/context/AppProvider";
import { useFetch } from "@/hooks/useFetch";
import { ApiError, listingsApi } from "@/lib/api";
import { ListingForm } from "./ListingForm";

export function EditListing() {
  const { id } = useParams<{ id: string }>();
  const { user, ready } = useApp();
  const listing = useFetch((signal) => listingsApi.get(id, { signal }), [id, user?.id], ready);

  if (!ready || (!listing.data && !listing.error)) {
    return (
      <div className="container-narrow max-w-3xl pt-10" aria-busy="true">
        <Skeleton className="h-9 w-56" />
        <Skeleton className="mt-8 h-12 w-full" />
        <Skeleton className="mt-4 h-40 w-full" />
      </div>
    );
  }
  if (listing.error) {
    const notFound = listing.error instanceof ApiError && listing.error.status === 404;
    return (
      <EmptyState className="py-24" icon={Lock} title={notFound ? "Listing not found" : "Couldn’t load listing"} description={listing.error.message} actions={<ButtonLink href="/host" variant="dark">Back to dashboard</ButtonLink>} />
    );
  }
  const data = listing.data!;
  if (user?.id !== data.host.id) {
    return (
      <EmptyState
        className="py-24"
        icon={Lock}
        title="You don’t own this listing"
        description="Only the host who created a listing can edit it. Switch to the owner’s demo account to make changes."
        actions={<ButtonLink href="/host" variant="dark">Back to dashboard</ButtonLink>}
      />
    );
  }
  return <ListingForm key={`${data.id}-${data.updated_at}`} listing={data} />;
}
