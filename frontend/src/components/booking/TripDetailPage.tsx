"use client";

import { ArrowLeft, CalendarCheck, CircleAlert, MapPin, Printer } from "lucide-react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { useState } from "react";
import { PriceRows } from "@/components/listing/PriceRows";
import { Alert } from "@/components/ui/Alert";
import { Avatar } from "@/components/ui/Avatar";
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
import { formatLong } from "@/lib/dates";
import { formatMoney, plural } from "@/lib/format";

export function TripDetailPage() {
  const { id } = useParams<{ id: string }>();
  const confirmed = useSearchParams().get("confirmed") === "1";
  const { user, ready } = useApp();
  const result = useFetch((signal) => bookingsApi.get(id, { signal }), [id, user?.id], ready);
  const [override, setOverride] = useState<Booking | null>(null);
  const booking = override ?? result.data;

  if (result.error && !booking) {
    return (
      <EmptyState
        className="py-28"
        icon={CircleAlert}
        title="We can’t show this booking"
        description={`${result.error.message} If it belongs to another demo account, switch users from the menu.`}
        actions={<ButtonLink href="/trips" variant="dark">Back to trips</ButtonLink>}
      />
    );
  }
  if (!booking) {
    return (
      <div className="container-narrow pt-10" aria-busy="true">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="mt-8 h-72 w-full rounded-2xl" />
      </div>
    );
  }
  return <TripView booking={booking} celebrate={confirmed && booking.status === "CONFIRMED"} onChange={setOverride} />;
}

function TripView({ booking, celebrate, onChange }: { booking: Booking; celebrate: boolean; onChange: (b: Booking) => void }) {
  const toast = useToast();
  const { listing } = booking;
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const isHostView = booking.guest_email !== null;

  const cancel = async () => {
    setCancelling(true);
    try {
      onChange(await bookingsApi.cancel(booking.id));
      toast.success("Booking cancelled.");
      setCancelOpen(false);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setCancelling(false);
    }
  };

  return (
    <div className="container-narrow pb-24 pt-8 md:pb-16">
      <Link href="/trips" className="mb-6 inline-flex items-center gap-2 text-sm font-semibold hover:underline">
        <ArrowLeft className="size-4" /> All trips
      </Link>

      {celebrate && (
        <div className="mb-10 flex flex-col items-center rounded-3xl bg-gradient-to-b from-ok-soft to-paper px-6 py-10 text-center">
          <div className="animate-ring flex size-20 items-center justify-center rounded-full bg-success">
            <svg viewBox="0 0 24 24" className="size-10" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path className="anim-check" d="M5 12.5 10 17.5 19 7" />
            </svg>
          </div>
          <h1 className="mt-5 text-[28px] font-semibold md:text-[34px]">Your trip is booked!</h1>
          <p className="mt-2 max-w-md text-muted">
            Payment received. We&apos;ve reserved {listing.title} for you — {plural(booking.nights, "night")} in {listing.city}.
          </p>
          <p className="mt-4 rounded-full bg-paper px-4 py-2 text-sm shadow-sm">
            Booking reference <strong className="font-semibold tracking-wide">{booking.reference}</strong>
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <ButtonLink href="/trips" variant="dark">Go to my trips</ButtonLink>
            <ButtonLink href="/" variant="secondary">Keep exploring</ButtonLink>
          </div>
        </div>
      )}

      <div className="grid gap-12 lg:grid-cols-[minmax(0,1fr)_400px]">
        <div>
          {!celebrate && (
            <div className="mb-6">
              <div className="flex flex-wrap items-center gap-3">
                <h1 className="text-[28px] font-semibold md:text-[32px]">{isHostView ? "Reservation" : "Your booking"}</h1>
                <StatusBadge status={booking.status} />
              </div>
              <p className="mt-1 text-muted">Reference {booking.reference}</p>
            </div>
          )}

          {booking.status === "PENDING" && (
            <Alert tone="info" className="mb-6">
              This reservation is awaiting payment. <Link href={`/checkout/${booking.id}`} className="font-semibold underline">Complete payment</Link> before the hold expires.
            </Alert>
          )}
          {booking.status === "CANCELLED" && (
            <Alert tone="error" className="mb-6">
              This booking was cancelled
              {booking.payment?.status === "REFUNDED" ? ` and ${formatMoney(booking.total)} was refunded.` : "."} The dates are open for other guests.
            </Alert>
          )}

          <div className="overflow-hidden rounded-2xl border border-line">
            <Link href={`/listings/${listing.id}`} className="flex flex-col gap-5 p-5 transition hover:bg-surface/60 sm:flex-row">
              <Img src={listing.image} alt={listing.title} width={500} className="aspect-[4/3] w-full rounded-xl sm:h-28 sm:w-40" />
              <div>
                <p className="text-sm text-muted">{listing.property_type}</p>
                <p className="text-lg font-semibold">{listing.title}</p>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-muted"><MapPin className="size-3.5" />{listing.location}</p>
              </div>
            </Link>
            <dl className="grid divide-y divide-line border-t border-line sm:grid-cols-2 sm:divide-x sm:divide-y-0">
              <div className="p-5">
                <dt className="text-sm text-muted">Check-in</dt>
                <dd className="font-medium">{formatLong(booking.check_in)}</dd>
                <dd className="text-sm text-muted">After 3:00 PM</dd>
              </div>
              <div className="p-5">
                <dt className="text-sm text-muted">Check-out</dt>
                <dd className="font-medium">{formatLong(booking.check_out)}</dd>
                <dd className="text-sm text-muted">Before 11:00 AM</dd>
              </div>
            </dl>
            <dl className="grid divide-y divide-line border-t border-line sm:grid-cols-2 sm:divide-x sm:divide-y-0">
              <div className="p-5">
                <dt className="text-sm text-muted">Guests</dt>
                <dd className="font-medium">{plural(booking.guests, "guest")} · {plural(booking.nights, "night")}</dd>
              </div>
              <div className="p-5">
                <dt className="text-sm text-muted">{isHostView ? "Guest" : "Host"}</dt>
                <dd className="mt-1 flex items-center gap-3">
                  <Avatar name={isHostView ? booking.guest.name : listing.host.name} src={isHostView ? booking.guest.avatar : listing.host.avatar} className="size-8" />
                  <span>
                    <span className="block font-medium">{isHostView ? booking.guest.name : listing.host.name}</span>
                    {isHostView && <span className="block text-sm text-muted">{booking.guest_email}</span>}
                  </span>
                </dd>
              </div>
            </dl>
          </div>

          <div className="mt-6 flex flex-wrap gap-3">
            <ButtonLink href={`/listings/${listing.id}`} variant="secondary">View listing</ButtonLink>
            {booking.can_review && <ButtonLink href={`/listings/${listing.id}#reviews`} variant="secondary">Write a review</ButtonLink>}
            <Button variant="ghost" icon={<Printer className="size-4" />} onClick={() => window.print()}>Print</Button>
            {booking.can_cancel && <Button variant="danger" onClick={() => setCancelOpen(true)}>Cancel booking</Button>}
          </div>
          {booking.can_cancel && (
            <p className="mt-3 text-sm text-muted">Free cancellation until the day of check-in, with a full refund.</p>
          )}
        </div>

        <aside>
          <div className="rounded-2xl border border-line p-6">
            <h2 className="mb-5 text-[22px] font-semibold">Price details</h2>
            <PriceRows
              pricing={{ ...booking, nightly_price: Math.round(booking.subtotal / booking.nights) }}
              couponCode={booking.coupon_code}
              totalLabel={booking.payment?.status === "REFUNDED" ? "Total (refunded)" : "Total (USD)"}
            />
            {booking.payment && (
              <div className="mt-5 flex items-center justify-between border-t border-line pt-4 text-sm">
                <span className="flex items-center gap-2 text-muted"><CalendarCheck className="size-4" /> Payment</span>
                <StatusBadge status={booking.payment.status} />
              </div>
            )}
          </div>
        </aside>
      </div>

      <ConfirmDialog open={cancelOpen} title="Cancel this trip?" confirmLabel="Yes, cancel trip" loading={cancelling} onConfirm={cancel} onClose={() => setCancelOpen(false)}>
        You&apos;ll receive a full refund of {formatMoney(booking.total)} and the dates will open up for other guests.
      </ConfirmDialog>
    </div>
  );
}
