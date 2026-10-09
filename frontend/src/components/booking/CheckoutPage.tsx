"use client";

import { ArrowLeft, CalendarDays, CreditCard, ShieldCheck, Tag, TimerReset, Users } from "lucide-react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { PriceRows } from "@/components/listing/PriceRows";
import { Alert } from "@/components/ui/Alert";
import { Avatar } from "@/components/ui/Avatar";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Img } from "@/components/ui/Img";
import { Skeleton } from "@/components/ui/Skeleton";
import { useToast } from "@/components/ui/Toast";
import { useApp } from "@/context/AppProvider";
import { useFetch } from "@/hooks/useFetch";
import { ApiError, bookingsApi, errorMessage, type Booking } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatLong } from "@/lib/dates";
import { formatMoney, plural } from "@/lib/format";
import { useCurrency } from "@/lib/currency-store";

const PAYMENT_METHODS = [
  { id: "card_4242", label: "Mock card ending in 4242", hint: "Always approved" },
  { id: "card_declined", label: "Mock card ending in 0002", hint: "Simulates a declined card" },
];

const PROCESSING_DELAY_MS = 1400;

export function CheckoutPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { user, ready } = useApp();
  const result = useFetch((signal) => bookingsApi.get(id, { signal }), [id, user?.id], ready);
  const [booking, setBooking] = useState<Booking | null>(null);
  const current = booking ?? result.data;

  // Paid, cancelled or expired reservations belong on the trip page.
  useEffect(() => {
    if (current && current.status !== "PENDING") router.replace(`/trips/${current.id}`);
  }, [current, router]);

  if (result.error && !current) {
    const forbidden = result.error instanceof ApiError && [403, 404].includes(result.error.status);
    return (
      <EmptyState
        className="py-28"
        icon={CreditCard}
        title={forbidden ? "We can’t show this reservation" : "Something went wrong"}
        description={forbidden ? "It doesn’t exist or belongs to another account. Try switching demo user." : result.error.message}
        actions={<ButtonLink href="/trips" variant="dark">Go to my trips</ButtonLink>}
      />
    );
  }
  if (!current || current.status !== "PENDING") return <CheckoutSkeleton />;
  return <CheckoutView booking={current} onChange={setBooking} />;
}

function CheckoutView({ booking, onChange }: { booking: Booking; onChange: (b: Booking) => void }) {
  const router = useRouter();
  const toast = useToast();
  const { user } = useApp();
  const displayCurrency = useCurrency();
  const [method, setMethod] = useState(PAYMENT_METHODS[0].id);
  const [paying, setPaying] = useState(false);
  const [payError, setPayError] = useState<string | null>(null);
  const [couponInput, setCouponInput] = useState(booking.coupon_code ?? "");
  const [couponBusy, setCouponBusy] = useState(false);
  const [couponError, setCouponError] = useState<string | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelling, setCancelling] = useState(false);
  const secondsLeft = useCountdown(booking.hold_expires_at);
  const expired = secondsLeft !== null && secondsLeft <= 0;

  const applyCoupon = async (code: string | null) => {
    setCouponBusy(true);
    setCouponError(null);
    try {
      const updated = await bookingsApi.setCoupon(booking.id, code);
      onChange(updated);
      if (code) toast.success(`Coupon ${updated.coupon_code} applied: you save ${formatMoney(updated.discount, updated.currency)}.`);
      else setCouponInput("");
    } catch (error) {
      setCouponError(errorMessage(error).replace("Invalid coupon: ", ""));
    } finally {
      setCouponBusy(false);
    }
  };

  const pay = async () => {
    setPaying(true);
    setPayError(null);
    await new Promise((resolve) => setTimeout(resolve, PROCESSING_DELAY_MS)); // feel of a real gateway
    try {
      const paid = await bookingsApi.pay(booking.id, method);
      toast.clear();
      router.push(`/trips/${paid.id}?confirmed=1`);
    } catch (error) {
      const message = errorMessage(error);
      setPayError(message);
      toast.error(message);
      if (error instanceof ApiError && error.code !== "payment_failed") {
        // reservation is no longer payable (expired/cancelled): show its real state
        router.replace(`/trips/${booking.id}`);
        return;
      }
      try {
        onChange(await bookingsApi.get(booking.id));
      } catch {
        /* keep the last known state */
      }
      setPaying(false);
    }
  };

  const cancel = async () => {
    setCancelling(true);
    try {
      await bookingsApi.cancel(booking.id);
      toast.info("Reservation cancelled. Your dates were released.");
      router.replace(`/listings/${booking.listing.id}`);
    } catch (error) {
      toast.error(errorMessage(error));
      setCancelling(false);
      setCancelOpen(false);
    }
  };

  const failed = booking.payment?.status === "FAILED" && !expired;

  return (
    <div className="container-narrow pb-16 pt-8">
      <Link href={`/listings/${booking.listing.id}`} className="mb-6 inline-flex items-center gap-2 text-sm font-semibold hover:underline">
        <ArrowLeft className="size-4" /> Back to listing
      </Link>
      <h1 className="text-[28px] font-semibold md:text-[32px]">Confirm and pay</h1>

      <div className="mt-8 grid gap-12 lg:grid-cols-[minmax(0,1fr)_420px] xl:gap-20">
        <div className="space-y-10">
          {secondsLeft !== null && (
            <div
              className={cn(
                "flex items-center gap-3 rounded-2xl px-5 py-4 text-sm",
                expired ? "bg-danger-soft text-danger-ink" : secondsLeft < 120 ? "bg-amber-soft text-amber-ink" : "bg-surface",
              )}
              role="timer"
            >
              <TimerReset className="size-5 shrink-0" />
              {expired ? (
                <p>Your hold expired and the dates were released. <Link href={`/listings/${booking.listing.id}`} className="font-semibold underline">Start a new booking</Link>.</p>
              ) : (
                <p>
                  We&apos;re holding these dates for you for{" "}
                  <strong className="tabular-nums">{formatCountdown(secondsLeft)}</strong>.
                </p>
              )}
            </div>
          )}

          <section aria-labelledby="trip-h">
            <h2 id="trip-h" className="mb-4 text-[22px] font-semibold">Your trip</h2>
            <dl className="divide-y divide-line rounded-2xl border border-line">
              <div className="flex items-center gap-4 p-5">
                <CalendarDays className="size-5 shrink-0" />
                <div>
                  <dt className="text-sm text-muted">Dates</dt>
                  <dd className="font-medium">{formatLong(booking.check_in)} → {formatLong(booking.check_out)}</dd>
                  <dd className="text-sm text-muted">{plural(booking.nights, "night")}</dd>
                </div>
              </div>
              <div className="flex items-center gap-4 p-5">
                <Users className="size-5 shrink-0" />
                <div>
                  <dt className="text-sm text-muted">Guests</dt>
                  <dd className="font-medium">{plural(booking.guests, "guest")}</dd>
                </div>
              </div>
              {user && (
                <div className="flex items-center gap-4 p-5">
                  <Avatar name={user.name} src={user.avatar} className="size-8" />
                  <div>
                    <dt className="text-sm text-muted">Guest details</dt>
                    <dd className="font-medium">{user.name}</dd>
                    <dd className="text-sm text-muted">{user.email}</dd>
                  </div>
                </div>
              )}
            </dl>
          </section>

          <section aria-labelledby="coupon-h">
            <h2 id="coupon-h" className="mb-4 text-[22px] font-semibold">Coupon</h2>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                if (couponInput.trim()) void applyCoupon(couponInput.trim());
              }}
            >
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Tag className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" />
                  <input
                    aria-label="Coupon code"
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                    placeholder="Enter a code, e.g. WELCOME10"
                    disabled={couponBusy || paying || expired}
                    className="h-12 w-full rounded-xl border border-edge pl-10 pr-3 text-[15px] placeholder:text-faint focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink disabled:bg-surface"
                  />
                </div>
                <Button type="submit" variant="secondary" size="lg" loading={couponBusy} disabled={!couponInput.trim() || paying || expired}>
                  Apply
                </Button>
              </div>
              {couponError && <p role="alert" className="mt-2 text-sm text-danger">{couponError}</p>}
              {booking.coupon_code && !couponError && (
                <p role="status" className="mt-2 text-sm font-medium text-success">
                  {booking.coupon_code} applied — you save {formatMoney(booking.discount, booking.currency)}.{" "}
                  <button type="button" onClick={() => void applyCoupon(null)} className="font-semibold underline">Remove</button>
                </p>
              )}
            </form>
          </section>

          <section aria-labelledby="pay-h">
            <h2 id="pay-h" className="mb-1 text-[22px] font-semibold">Pay with</h2>
            <p className="mb-4 text-sm text-muted">This is a simulated checkout — no real card is charged and no card details are collected.</p>
            <div role="radiogroup" aria-label="Payment method" className="space-y-3">
              {PAYMENT_METHODS.map((option) => (
                <label
                  key={option.id}
                  className={cn(
                    "flex cursor-pointer items-center gap-4 rounded-2xl border p-4 transition has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink",
                    method === option.id ? "border-ink bg-surface ring-1 ring-ink" : "border-line hover:border-ink",
                  )}
                >
                  <input type="radio" name="payment" className="sr-only" checked={method === option.id} onChange={() => setMethod(option.id)} />
                  <CreditCard className="size-6 shrink-0" strokeWidth={1.5} />
                  <span className="flex-1">
                    <span className="block font-medium">{option.label}</span>
                    <span className="block text-sm text-muted">{option.hint}</span>
                  </span>
                  <span className={cn("flex size-5 items-center justify-center rounded-full border-2", method === option.id ? "border-ink" : "border-faint")}>
                    {method === option.id && <span className="size-2.5 rounded-full bg-ink" />}
                  </span>
                </label>
              ))}
            </div>
            {(payError || failed) && (
              <Alert tone="error" className="mt-4">
                {payError ?? booking.payment?.failure_reason ?? "Your last payment attempt failed."} Your booking is still
                pending — choose another card and try again.
              </Alert>
            )}
          </section>

          <div className="space-y-3">
            <Button size="lg" className="w-full md:w-auto md:min-w-72" onClick={pay} loading={paying} disabled={expired || couponBusy}>
              {paying ? "Processing payment…" : `Pay and reserve · ${formatMoney(booking.total, booking.currency)}`}
            </Button>
            <p className="flex items-center gap-2 text-sm text-muted">
              <ShieldCheck className="size-4" /> By continuing you agree to the free-cancellation policy: cancel any time before check-in for a full refund.
            </p>
            <button type="button" onClick={() => setCancelOpen(true)} disabled={paying} className="text-sm font-semibold underline disabled:opacity-40">
              Cancel this reservation
            </button>
          </div>
        </div>

        <aside>
          <div className="sticky top-28 rounded-2xl border border-line p-6 shadow-card">
            <div className="flex gap-4 border-b border-line pb-5">
              <Img src={booking.listing.image} alt={booking.listing.title} width={300} className="size-28 shrink-0 rounded-xl" />
              <div className="min-w-0">
                <p className="text-xs text-muted">{booking.listing.property_type}</p>
                <p className="line-clamp-2 font-medium">{booking.listing.title}</p>
                <p className="mt-1 text-sm text-muted">{booking.listing.city}, {booking.listing.country}</p>
                <p className="mt-1 flex items-center gap-1.5 text-sm text-muted">
                  <Avatar name={booking.listing.host.name} src={booking.listing.host.avatar} className="size-5" />
                  Hosted by {booking.listing.host.name}
                </p>
              </div>
            </div>
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 border-b border-line py-5 text-sm">
              <div>
                <dt className="text-muted">Check-in</dt>
                <dd className="font-medium">{formatLong(booking.check_in)}</dd>
              </div>
              <div>
                <dt className="text-muted">Check-out</dt>
                <dd className="font-medium">{formatLong(booking.check_out)}</dd>
              </div>
              <div>
                <dt className="text-muted">Stay</dt>
                <dd className="font-medium">{plural(booking.nights, "night")} · {plural(booking.guests, "guest")}</dd>
              </div>
              <div>
                <dt className="text-muted">Payment</dt>
                <dd className="font-medium">{booking.payment?.status === "FAILED" ? "Declined, retry" : "Not paid yet"}</dd>
              </div>
            </dl>
            <h2 className="my-5 text-[22px] font-semibold">Price details</h2>
            <PriceRows
              pricing={{ ...booking, nightly_price: Math.round(booking.subtotal / booking.nights) }}
              couponCode={booking.coupon_code}
            />
            <p className="mt-4 text-xs text-muted">Reference {booking.reference}</p>
            <p className="mt-1 text-xs text-muted">
              This reservation is priced in {booking.currency}
              {displayCurrency !== booking.currency && ` (you are browsing in ${displayCurrency}; a booking keeps the currency it was made in)`}
              . Mock payment: no money is charged.
            </p>
          </div>
        </aside>
      </div>

      <ConfirmDialog
        open={cancelOpen}
        title="Cancel this reservation?"
        confirmLabel="Cancel reservation"
        loading={cancelling}
        onConfirm={cancel}
        onClose={() => setCancelOpen(false)}
      >
        Your dates will be released immediately and you won&apos;t be charged.
      </ConfirmDialog>
    </div>
  );
}

function useCountdown(expiresAt: string | null): number | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!expiresAt) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [expiresAt]);
  if (!expiresAt) return null;
  const target = new Date(expiresAt.endsWith("Z") ? expiresAt : `${expiresAt}Z`).getTime();
  return Math.max(0, Math.round((target - now) / 1000));
}

const formatCountdown = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function CheckoutSkeleton() {
  return (
    <div className="container-narrow pt-12" aria-busy="true" aria-label="Loading checkout">
      <Skeleton className="h-9 w-64" />
      <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_420px]">
        <div className="space-y-6">
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-48 w-full rounded-2xl" />
          <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
        <Skeleton className="h-96 rounded-2xl" />
      </div>
    </div>
  );
}
