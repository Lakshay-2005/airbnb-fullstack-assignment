"use client";

import { CalendarX2, Luggage, MapPin } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Img } from "@/components/ui/Img";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/Toast";
import { useApp } from "@/context/AppProvider";
import { useFetch } from "@/hooks/useFetch";
import { bookingsApi, errorMessage, type Booking } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatRange, todayISO } from "@/lib/dates";
import { formatMoney, plural } from "@/lib/format";

type Tab = "upcoming" | "past" | "cancelled";

const TABS: { id: Tab; label: string }[] = [
  { id: "upcoming", label: "Upcoming" },
  { id: "past", label: "Past" },
  { id: "cancelled", label: "Cancelled" },
];

function bucketOf(booking: Booking): Tab {
  if (booking.status === "CANCELLED") return "cancelled";
  if (booking.status === "COMPLETED" || booking.check_out < todayISO()) return "past";
  return "upcoming";
}

export function TripsPage() {
  const { user, ready } = useApp();
  const toast = useToast();
  const trips = useFetch((signal) => bookingsApi.list({ signal }), [user?.id], ready);
  const [tab, setTab] = useState<Tab>("upcoming");
  const [toCancel, setToCancel] = useState<Booking | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const grouped = useMemo(() => {
    const groups: Record<Tab, Booking[]> = { upcoming: [], past: [], cancelled: [] };
    for (const booking of trips.data ?? []) groups[bucketOf(booking)].push(booking);
    groups.upcoming.sort((a, b) => a.check_in.localeCompare(b.check_in));
    return groups;
  }, [trips.data]);

  const confirmCancel = async () => {
    if (!toCancel) return;
    setCancelling(true);
    try {
      await bookingsApi.cancel(toCancel.id);
      toast.success("Booking cancelled. Your refund is on its way.");
      setToCancel(null);
      trips.reload();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setCancelling(false);
    }
  };

  const items = grouped[tab];

  return (
    <div className="container-narrow pb-24 pt-8 md:pb-16">
      <h1 className="text-[28px] font-semibold md:text-[32px]">Trips</h1>
      <p className="mt-1 text-muted">Everything you&apos;ve booked as {user?.name ?? "a guest"}.</p>

      <div role="tablist" aria-label="Trip groups" className="mt-6 flex gap-2 border-b border-line">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              "-mb-px flex items-center gap-2 border-b-2 px-4 pb-3 pt-2 text-[15px] font-medium transition",
              tab === id ? "border-ink text-ink" : "border-transparent text-muted hover:text-ink",
            )}
          >
            {label}
            {trips.data && (
              <span className="rounded-full bg-surface px-2 py-0.5 text-xs">{grouped[id].length}</span>
            )}
          </button>
        ))}
      </div>

      <div className="mt-8">
        {!trips.data && !trips.error && (
          <div className="space-y-5" aria-busy="true" aria-label="Loading trips">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex gap-5 rounded-2xl border border-line p-4">
                <Skeleton className="size-28 shrink-0 rounded-xl sm:h-36 sm:w-48" />
                <div className="flex-1 space-y-3 py-1">
                  <Skeleton className="h-5 w-2/3" />
                  <Skeleton className="h-4 w-1/3" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </div>
            ))}
          </div>
        )}
        {trips.error && !trips.data && (
          <EmptyState icon={CalendarX2} title="Couldn’t load your trips" description={trips.error.message} actions={<Button onClick={trips.reload}>Try again</Button>} />
        )}

        {trips.data && items.length === 0 && (
          <EmptyState
            icon={Luggage}
            title={tab === "upcoming" ? "No trips booked… yet!" : tab === "past" ? "No past trips" : "No cancelled trips"}
            description={
              tab === "upcoming"
                ? "Time to dust off your bags and start planning your next adventure."
                : tab === "past"
                  ? "Completed stays will show up here, where you can leave a review."
                  : "Cancelled reservations appear here for your records."
            }
            actions={tab === "upcoming" && <ButtonLink href="/" variant="dark">Start searching</ButtonLink>}
          />
        )}

        {trips.data && items.length > 0 && (
          <ul className="space-y-5">
            {items.map((booking) => (
              <TripCard key={booking.id} booking={booking} onCancel={() => setToCancel(booking)} />
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(toCancel)}
        title="Cancel this trip?"
        confirmLabel="Yes, cancel trip"
        loading={cancelling}
        onConfirm={confirmCancel}
        onClose={() => setToCancel(null)}
      >
        {toCancel && (
          <>
            You&apos;re cancelling <strong>{toCancel.listing.title}</strong> ({formatRange(toCancel.check_in, toCancel.check_out)}).
            {toCancel.payment?.status === "SUCCESS"
              ? ` You'll get a full refund of ${formatMoney(toCancel.total)} and the dates will open up again.`
              : " The dates will open up again."}
          </>
        )}
      </ConfirmDialog>
    </div>
  );
}

function TripCard({ booking, onCancel }: { booking: Booking; onCancel: () => void }) {
  const { listing } = booking;
  const pending = booking.status === "PENDING";
  return (
    <li className="flex flex-col gap-5 rounded-2xl border border-line p-4 transition hover:shadow-card sm:flex-row sm:p-5">
      <Link href={`/trips/${booking.id}`} className="block shrink-0 overflow-hidden rounded-xl sm:w-52" tabIndex={-1} aria-hidden="true">
        <Img src={listing.image} alt="" width={500} className="aspect-[4/3] size-full sm:aspect-auto sm:h-36" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={booking.status} />
          <span className="text-xs text-muted">Ref {booking.reference}</span>
        </div>
        <Link href={`/trips/${booking.id}`} className="mt-2 line-clamp-1 text-lg font-semibold hover:underline">
          {listing.title}
        </Link>
        <p className="mt-0.5 flex items-center gap-1.5 text-sm text-muted">
          <MapPin className="size-3.5" /> {listing.city}, {listing.country} · Hosted by {listing.host.name}
        </p>
        <p className="mt-3 text-[15px]">
          <span className="font-medium">{formatRange(booking.check_in, booking.check_out)}</span>
          <span className="text-muted"> · {plural(booking.nights, "night")} · {plural(booking.guests, "guest")}</span>
        </p>
        <p className="mt-1 font-semibold">{formatMoney(booking.total)}</p>
        <div className="mt-4 flex flex-wrap gap-2 sm:mt-auto sm:pt-4">
          {pending ? (
            <ButtonLink size="sm" href={`/checkout/${booking.id}`}>Complete payment</ButtonLink>
          ) : (
            <ButtonLink size="sm" variant="secondary" href={`/trips/${booking.id}`}>View booking</ButtonLink>
          )}
          <ButtonLink size="sm" variant="ghost" href={`/listings/${listing.id}`}>View listing</ButtonLink>
          {booking.can_review && (
            <ButtonLink size="sm" variant="ghost" href={`/listings/${listing.id}#reviews`}>Write a review</ButtonLink>
          )}
          {booking.can_cancel && (
            <Button size="sm" variant="danger" onClick={onCancel} className="sm:ml-auto">Cancel</Button>
          )}
        </div>
      </div>
    </li>
  );
}
