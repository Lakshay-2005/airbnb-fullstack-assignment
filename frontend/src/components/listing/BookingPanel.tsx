"use client";

import { ChevronDown, Star, Tag } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { RangeCalendar } from "@/components/calendar/RangeCalendar";
import { Alert } from "@/components/ui/Alert";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Counter } from "@/components/ui/Counter";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import type { ListingDetail } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatShort } from "@/lib/dates";
import { formatMoney, formatRating, plural } from "@/lib/format";
import { PriceRows } from "./PriceRows";
import type { BookingState } from "./useBooking";

interface BookingPanelProps {
  listing: ListingDetail;
  booking: BookingState;
  className?: string;
}

export function BookingPanel({ listing, booking, className }: BookingPanelProps) {
  const toast = useToast();
  const [panel, setPanel] = useState<"dates" | "guests" | null>(null);
  const [couponOpen, setCouponOpen] = useState(false);
  const { quote, coupon } = { quote: booking.quote, coupon: booking.quote?.coupon };

  const field = (open: boolean) =>
    cn("flex flex-col px-3.5 py-2.5 text-left transition hover:bg-surface", open && "bg-surface ring-2 ring-inset ring-ink");

  if (booking.isOwner) {
    return (
      <div className={cn("rounded-2xl border border-line p-6 shadow-card", className)}>
        <p className="text-xl font-semibold">{formatMoney(listing.nightly_price)} <span className="text-base font-normal text-muted">night</span></p>
        <Alert className="mt-4">This is your listing, so you can&apos;t book it. Guests see a booking card here.</Alert>
        <ButtonLink href={`/host/listings/${listing.id}/edit`} variant="secondary" className="mt-4 w-full">
          Edit listing
        </ButtonLink>
      </div>
    );
  }

  return (
    <div className={cn("rounded-2xl border border-line bg-paper p-6 shadow-card", className)}>
      <div className="flex items-baseline justify-between gap-3">
        <p>
          <span className="text-[22px] font-semibold">{formatMoney(listing.nightly_price)}</span>{" "}
          <span className="text-muted">night</span>
        </p>
        {listing.review_count > 0 && (
          <p className="flex items-center gap-1 text-sm">
            <Star className="size-3.5 fill-ink" aria-hidden="true" />
            <span className="font-semibold">{formatRating(listing.rating)}</span>
            <span className="text-muted">· {plural(listing.review_count, "review")}</span>
          </p>
        )}
      </div>

      <div className="mt-5 overflow-hidden rounded-xl border border-edge-strong">
        <div className="grid grid-cols-2 divide-x divide-edge-strong">
          <button type="button" className={field(panel === "dates")} onClick={() => setPanel(panel === "dates" ? null : "dates")} aria-expanded={panel === "dates"}>
            <span className="text-[10px] font-bold uppercase tracking-wide">Check-in</span>
            <span className={cn("text-sm", booking.checkIn ? "text-ink" : "text-muted")}>
              {booking.checkIn ? formatShort(booking.checkIn) : "Add date"}
            </span>
          </button>
          <button type="button" className={field(panel === "dates")} onClick={() => setPanel(panel === "dates" ? null : "dates")} aria-expanded={panel === "dates"}>
            <span className="text-[10px] font-bold uppercase tracking-wide">Check-out</span>
            <span className={cn("text-sm", booking.checkOut ? "text-ink" : "text-muted")}>
              {booking.checkOut ? formatShort(booking.checkOut) : "Add date"}
            </span>
          </button>
        </div>
        <button
          type="button"
          className={cn(field(panel === "guests"), "w-full flex-row items-center justify-between border-t border-edge-strong")}
          onClick={() => setPanel(panel === "guests" ? null : "guests")}
          aria-expanded={panel === "guests"}
        >
          <span className="flex flex-col">
            <span className="text-[10px] font-bold uppercase tracking-wide">Guests</span>
            <span className="text-sm">{plural(booking.guests, "guest")}</span>
          </span>
          <ChevronDown className={cn("size-4 transition", panel === "guests" && "rotate-180")} />
        </button>
      </div>

      {panel === "dates" && (
        <div className="mt-4 animate-fade-in">
          <div className="flex justify-center">
            <RangeCalendar
              months={1}
              checkIn={booking.checkIn}
              checkOut={booking.checkOut}
              unavailable={booking.unavailable}
              onInvalid={toast.error}
              onChange={(a, b) => {
                booking.setDates(a, b);
                if (a && b) setPanel(null);
              }}
            />
          </div>
          <div className="mt-2 flex justify-end gap-4 text-sm font-semibold">
            <button type="button" className="underline" onClick={() => booking.setDates(null, null)}>
              Clear dates
            </button>
            <button type="button" className="underline" onClick={() => setPanel(null)}>
              Close
            </button>
          </div>
        </div>
      )}
      {panel === "guests" && (
        <div className="mt-4 flex animate-fade-in items-center justify-between rounded-xl bg-surface p-4">
          <div>
            <p className="text-sm font-semibold">Guests</p>
            <p className="text-xs text-muted">Maximum {listing.guests_capacity}</p>
          </div>
          <Counter label="guests" value={booking.guests} min={1} max={listing.guests_capacity + 4} onChange={booking.setGuests} />
        </div>
      )}

      {booking.validationMessage && (
        <Alert tone="error" className="mt-4">
          {booking.validationMessage}
        </Alert>
      )}
      {booking.reserveError && !booking.validationMessage && (
        <Alert tone="error" className="mt-4">
          {booking.reserveError}
        </Alert>
      )}

      <Button
        size="lg"
        className="mt-4 w-full"
        disabled={!booking.canReserve}
        loading={booking.reserving}
        onClick={booking.reserve}
      >
        {booking.rangeReady ? "Reserve" : "Check availability"}
      </Button>
      {!booking.rangeReady && (
        <button
          type="button"
          onClick={() => setPanel("dates")}
          className="mt-3 w-full text-center text-sm text-muted underline"
        >
          Select your dates to see the total price
        </button>
      )}

      {booking.rangeReady && !booking.validationMessage && (
        <div className="mt-4">
          <p className="text-center text-sm text-muted">You won&apos;t be charged yet</p>
          <div className="mt-5">
            {booking.quoting && !quote ? (
              <div className="space-y-3" aria-label="Calculating price">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-4/5" />
                <Skeleton className="h-6 w-full" />
              </div>
            ) : quote?.pricing ? (
              <div className={cn("transition-opacity", booking.quoting && "opacity-50")}>
                <PriceRows pricing={quote.pricing} couponCode={coupon?.valid ? coupon.code : null} />
              </div>
            ) : null}
          </div>

          <div className="mt-5 border-t border-line pt-4">
            {!couponOpen && !booking.couponCode ? (
              <button type="button" onClick={() => setCouponOpen(true)} className="flex items-center gap-2 text-sm font-semibold underline">
                <Tag className="size-4" /> Have a coupon?
              </button>
            ) : (
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  booking.applyCoupon();
                }}
              >
                <label htmlFor="coupon" className="mb-1.5 block text-sm font-medium">
                  Coupon code
                </label>
                <div className="flex gap-2">
                  <input
                    id="coupon"
                    value={booking.couponInput}
                    onChange={(e) => booking.setCouponInput(e.target.value.toUpperCase())}
                    placeholder="e.g. WELCOME10"
                    autoComplete="off"
                    className="h-11 min-w-0 flex-1 rounded-xl border border-edge px-3.5 text-sm uppercase placeholder:normal-case focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink"
                  />
                  <Button type="submit" variant="secondary" disabled={!booking.couponInput.trim()}>
                    Apply
                  </Button>
                </div>
                {coupon && booking.couponCode && (
                  <p role="status" className={cn("mt-2 text-sm", coupon.valid ? "font-medium text-success" : "text-danger")}>
                    {coupon.message}
                    {coupon.valid && (
                      <button type="button" onClick={booking.removeCoupon} className="ml-2 font-semibold underline">
                        Remove
                      </button>
                    )}
                  </p>
                )}
              </form>
            )}
          </div>
        </div>
      )}
      <p className="mt-4 text-center text-xs text-muted">
        Free cancellation until check-in day ·{" "}
        <Link href="/trips" className="underline">
          Your trips
        </Link>
      </p>
    </div>
  );
}
