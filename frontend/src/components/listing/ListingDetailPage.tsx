"use client";

import { Bath, BedDouble, Home, Share2, Star, Users } from "lucide-react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Avatar } from "@/components/ui/Avatar";
import { Button, ButtonLink } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Modal } from "@/components/ui/Modal";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { useApp } from "@/context/AppProvider";
import { useFetch } from "@/hooks/useFetch";
import { ApiError, listingsApi, type ListingDetail } from "@/lib/api";
import { formatDateTime, formatRange } from "@/lib/dates";
import { amenityIcon } from "@/lib/icons";
import { isGuestFavourite } from "@/lib/discovery";
import { formatMoney, formatRating, plural } from "@/lib/format";
import { BookingPanel } from "./BookingPanel";
import { Gallery } from "./Gallery";
import { HeartButton } from "./HeartButton";
import { LocationMap } from "./LocationMap";
import { MessageHost } from "./MessageHost";
import { ReviewsSection } from "./ReviewsSection";
import { useBooking } from "./useBooking";

export function ListingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { user, ready } = useApp();
  const listing = useFetch((signal) => listingsApi.get(id, { signal }), [id, user?.id], ready);

  if (listing.error && !listing.data) {
    const notFound = listing.error instanceof ApiError && listing.error.status === 404;
    return (
      <EmptyState
        className="py-28"
        icon={Home}
        title={notFound ? "We couldn’t find that stay" : "Something went wrong"}
        description={
          notFound
            ? "It may have been removed by the host or the link is incorrect."
            : listing.error.message
        }
        actions={
          <>
            <ButtonLink href="/" variant="dark">
              Browse stays
            </ButtonLink>
            {!notFound && (
              <Button variant="secondary" onClick={listing.reload}>
                Try again
              </Button>
            )}
          </>
        }
      />
    );
  }
  if (!listing.data) return <DetailSkeleton />;
  return <ListingDetailView key={listing.data.id} listing={listing.data} />;
}

function ListingDetailView({ listing }: { listing: ListingDetail }) {
  const toast = useToast();
  const params = useSearchParams();
  const { user } = useApp();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [amenitiesOpen, setAmenitiesOpen] = useState(false);
  const [descriptionOpen, setDescriptionOpen] = useState(false);

  const booking = useBooking(listing, {
    checkIn: params.get("check_in"),
    checkOut: params.get("check_out"),
    guests: Number(params.get("guests")) || undefined,
  });

  const isOwner = user?.id === listing.host.id;
  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: listing.title, url });
      else {
        await navigator.clipboard.writeText(url);
        toast.success("Link copied to clipboard");
      }
    } catch {
      /* share sheet dismissed */
    }
  };

  const paused = listing.status === "PAUSED";
  const descriptionLong = listing.description.length > 320;
  const visibleAmenities = listing.amenities.slice(0, 8);

  return (
    <div className="container-narrow pb-28 pt-6 md:pb-16 md:pt-8">
      {isOwner && (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-brand-soft px-5 py-3.5 text-sm">
          <p>
            <strong>You&apos;re viewing your own listing</strong>
            {paused && " — it's paused and hidden from search."}
          </p>
          <div className="flex gap-2">
            <ButtonLink size="sm" variant="secondary" href={`/host/listings/${listing.id}/edit`}>
              Edit
            </ButtonLink>
            <ButtonLink size="sm" variant="dark" href="/host">
              Dashboard
            </ButtonLink>
          </div>
        </div>
      )}

      <nav aria-label="Breadcrumb" className="mb-3 hidden text-sm text-muted md:block">
        <Link href="/" className="hover:text-ink hover:underline">Stays</Link>
        {" / "}
        <Link href={`/?location=${encodeURIComponent(listing.city)}`} className="hover:text-ink hover:underline">
          {listing.city}
        </Link>
      </nav>

      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold md:text-[28px] md:leading-9">{listing.title}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-2 text-sm">
            {listing.review_count > 0 && (
              <a href="#reviews" className="flex items-center gap-1 font-semibold underline-offset-2 hover:underline">
                <Star className="size-3.5 fill-ink" aria-hidden="true" />
                {formatRating(listing.rating)} · {plural(listing.review_count, "review")}
              </a>
            )}
            {listing.review_count > 0 && <span aria-hidden="true">·</span>}
            <span className="font-semibold">{listing.location}</span>
          </p>
        </div>
        <div className="hidden shrink-0 items-center md:flex">
          <button
            type="button"
            onClick={share}
            className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold underline transition hover:bg-surface"
          >
            <Share2 className="size-[18px]" /> Share
          </button>
          <HeartButton listingId={listing.id} variant="inline" />
        </div>
      </div>

      <Gallery images={listing.images} title={listing.title} />
      <div className="mt-3 flex justify-end gap-1 md:hidden">
        <button type="button" onClick={share} className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold underline">
          <Share2 className="size-[18px]" /> Share
        </button>
        <HeartButton listingId={listing.id} variant="inline" />
      </div>

      <div className="mt-6 grid gap-12 lg:grid-cols-[minmax(0,1fr)_380px] xl:gap-20">
        <div className="min-w-0 divide-y divide-line">
          <section className="pb-8">
            <h2 className="text-[22px] font-semibold">
              {listing.property_type} in {listing.city}, {listing.country}
            </h2>
            <ul className="mt-2 flex flex-wrap gap-x-2 text-[15px] text-muted">
              <li>{plural(listing.guests_capacity, "guest")}</li>
              <li>· {plural(listing.bedrooms, "bedroom")}</li>
              <li>· {plural(listing.beds, "bed")}</li>
              <li>· {plural(listing.bathrooms, "bathroom")}</li>
            </ul>
            <div className="mt-6 flex flex-wrap items-center gap-4">
              <Avatar name={listing.host.name} src={listing.host.avatar} className="size-12" />
              <div className="min-w-0 flex-1">
                <p className="font-semibold">Hosted by {listing.host.name}</p>
                <p className="text-sm text-muted">
                  {plural(listing.host_listing_count, "listing")}
                  {listing.host.created_at && ` · Hosting since ${formatDateTime(listing.host.created_at).split(", ")[1]}`}
                </p>
              </div>
              <MessageHost listing={listing} />
            </div>
          </section>

          {isGuestFavourite(listing) && (
            <section className="py-6">
              <div className="flex items-center gap-4 rounded-2xl border border-line px-5 py-4">
                <Star className="size-7 shrink-0 fill-brand text-brand" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">Guest favourite</p>
                  <p className="text-sm text-muted">
                    One of the most loved stays here, rated {formatRating(listing.rating)} from{" "}
                    {plural(listing.review_count, "review")}.
                  </p>
                </div>
              </div>
            </section>
          )}

          <section className="grid gap-5 py-8 sm:grid-cols-3">
            {[
              { Icon: Users, title: "Room for the group", body: `Sleeps up to ${listing.guests_capacity} guests.` },
              { Icon: BedDouble, title: "Comfortable sleep", body: `${plural(listing.bedrooms, "bedroom")} and ${plural(listing.beds, "bed")}.` },
              { Icon: Bath, title: "Private bathrooms", body: `${plural(listing.bathrooms, "bathroom")} for your stay.` },
            ].map(({ Icon, title, body }) => (
              <div key={title} className="flex gap-4 sm:block">
                <Icon className="size-6 shrink-0 sm:mb-3" strokeWidth={1.6} />
                <div>
                  <p className="font-semibold">{title}</p>
                  <p className="text-sm text-muted">{body}</p>
                </div>
              </div>
            ))}
          </section>

          <section className="py-8">
            <h2 className="mb-4 text-[22px] font-semibold">About this place</h2>
            <p className={`whitespace-pre-line leading-relaxed text-ink/90 ${descriptionLong ? "line-clamp-4" : ""}`}>
              {listing.description}
            </p>
            {descriptionLong && (
              <button type="button" onClick={() => setDescriptionOpen(true)} className="mt-3 font-semibold underline">
                Show more
              </button>
            )}
          </section>

          <section className="py-8">
            <h2 className="mb-6 text-[22px] font-semibold">What this place offers</h2>
            <ul className="grid gap-4 sm:grid-cols-2">
              {visibleAmenities.map((name) => {
                const Icon = amenityIcon(name);
                return (
                  <li key={name} className="flex items-center gap-4 text-[15px]">
                    <Icon className="size-6" strokeWidth={1.5} />
                    {name}
                  </li>
                );
              })}
            </ul>
            {listing.amenities.length > visibleAmenities.length && (
              <Button variant="secondary" size="lg" className="mt-8" onClick={() => setAmenitiesOpen(true)}>
                Show all {listing.amenities.length} amenities
              </Button>
            )}
            {listing.amenities.length === 0 && <p className="text-muted">The host hasn&apos;t listed amenities yet.</p>}
          </section>

          <section className="py-8">
            <h2 className="mb-1 text-[22px] font-semibold">Where you&apos;ll be</h2>
            <p className="mb-5 text-[15px] text-muted">{listing.location}</p>
            <LocationMap latitude={listing.latitude} longitude={listing.longitude} label={listing.location} />
          </section>

          <ReviewsSection listing={listing} />
        </div>

        <aside className="hidden lg:block">
          <div className="sticky top-28">
            <BookingPanel listing={listing} booking={booking} />
          </div>
        </aside>
      </div>

      {/* phones & tablets: sticky reserve bar that opens the booking sheet */}
      {!isOwner && (
        <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-4 border-t border-line bg-paper px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:hidden">
          <div className="min-w-0">
            {booking.quote?.pricing ? (
              <>
                <p className="text-base font-semibold">
                  {formatMoney(booking.quote.pricing.total, booking.quote.pricing.currency)} <span className="font-normal text-muted">total</span>
                </p>
                <p className="truncate text-sm text-muted underline">
                  {formatRange(booking.checkIn!, booking.checkOut!)}
                </p>
              </>
            ) : (
              <>
                <p className="text-base font-semibold">
                  {formatMoney(listing.nightly_price, listing.currency)} <span className="font-normal text-muted">night</span>
                </p>
                <p className="text-sm text-muted">Add dates for prices</p>
              </>
            )}
          </div>
          <Button size="lg" onClick={() => setSheetOpen(true)}>
            {booking.rangeReady ? "Reserve" : "Check availability"}
          </Button>
        </div>
      )}
      {isOwner && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-paper p-3 lg:hidden">
          <ButtonLink href={`/host/listings/${listing.id}/edit`} variant="dark" className="w-full">
            Edit this listing
          </ButtonLink>
        </div>
      )}

      <Modal open={sheetOpen} onClose={() => setSheetOpen(false)} title="Your trip" size="sm">
        <div className="p-4">
          <BookingPanel listing={listing} booking={booking} className="border-0 p-2 shadow-none" />
        </div>
      </Modal>

      <Modal open={amenitiesOpen} onClose={() => setAmenitiesOpen(false)} title="What this place offers" size="md">
        <ul className="divide-y divide-line px-6">
          {listing.amenities.map((name) => {
            const Icon = amenityIcon(name);
            return (
              <li key={name} className="flex items-center gap-4 py-4 text-[15px]">
                <Icon className="size-6" strokeWidth={1.5} />
                {name}
              </li>
            );
          })}
        </ul>
      </Modal>

      <Modal open={descriptionOpen} onClose={() => setDescriptionOpen(false)} title="About this place" size="md">
        <p className="whitespace-pre-line p-6 leading-relaxed">{listing.description}</p>
      </Modal>
    </div>
  );
}

function DetailSkeleton() {
  return (
    <div className="container-narrow pt-8" aria-busy="true" aria-label="Loading listing">
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="mt-3 h-4 w-1/3" />
      <Skeleton className="mt-6 aspect-[4/3] w-full rounded-2xl md:aspect-auto md:h-[440px]" />
      <div className="mt-8 grid gap-12 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <Skeleton className="h-6 w-1/2" />
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-4/5" />
        </div>
        <Skeleton className="hidden h-96 rounded-2xl lg:block" />
      </div>
    </div>
  );
}
