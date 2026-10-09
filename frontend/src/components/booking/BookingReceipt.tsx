import { LogoMark, Wordmark } from "@/components/layout/Logo";
import type { Booking } from "@/lib/api";
import { formatDateTime, formatLong } from "@/lib/dates";
import { formatMoney, plural } from "@/lib/format";

const PAYMENT_METHOD_LABEL: Record<string, string> = {
  card_4242: "Simulated card ending 4242",
  card_declined: "Simulated card ending 0002 (declined)",
};

const STATUS_LABEL: Record<string, string> = {
  CONFIRMED: "Confirmed",
  COMPLETED: "Completed stay",
  PENDING: "Awaiting payment",
  CANCELLED: "Cancelled",
};

const PAYMENT_STATUS_LABEL: Record<string, string> = {
  SUCCESS: "Paid (simulated)",
  PENDING: "Not paid yet",
  FAILED: "Payment failed",
  REFUNDED: "Refunded (simulated)",
};

interface BookingReceiptProps {
  booking: Booking;
  /** Guest e-mail to show: the viewer's own for a guest, the booking's for a host. */
  guestEmail?: string | null;
}

/**
 * The booking document that gets printed or saved as PDF. It is rendered on every booking page but is
 * only visible in print (`hidden print:block`); everything else in the app is hidden by `print:hidden`
 * and the `@media print` rules in globals.css. Colours are fixed (not theme tokens) so the printout is
 * always dark text on white paper, even if the guest is using dark mode.
 */
export function BookingReceipt({ booking, guestEmail }: BookingReceiptProps) {
  const { listing, payment } = booking;
  const money = (amount: number) => formatMoney(amount, booking.currency);
  const nightly = Math.round(booking.subtotal / booking.nights);
  const email = guestEmail ?? booking.guest_email;
  const amountLabel =
    booking.status === "CANCELLED"
      ? payment?.status === "REFUNDED"
        ? "Amount refunded"
        : "Amount (not charged)"
      : payment?.status === "SUCCESS"
        ? "Amount paid"
        : "Amount due";

  const row = "flex items-baseline justify-between gap-6 py-1.5 text-[13px]";
  const label = "text-[11px] font-semibold uppercase tracking-wider text-neutral-500";

  return (
    <article
      id="booking-receipt"
      aria-label={`Booking receipt ${booking.reference}`}
      className="receipt hidden bg-white text-black print:block"
    >
      <header className="flex items-start justify-between border-b-2 border-black pb-4">
        <div className="flex items-center gap-2 text-[#ff385c]">
          <LogoMark className="size-9" />
          <Wordmark className="h-8" />
          <span className="sr-only">airbnb</span>
        </div>
        <div className="text-right">
          <p className="text-lg font-bold">Booking receipt</p>
          <p className="text-[12px] text-neutral-600">Airbnb Clone · educational demo</p>
        </div>
      </header>

      <section className="mt-5 grid grid-cols-[1fr_auto] items-end gap-6 break-inside-avoid">
        <div>
          <p className={label}>Booking reference</p>
          <p className="text-[28px] font-bold tracking-wide">{booking.reference}</p>
        </div>
        <div className="text-right">
          <p className={label}>Status</p>
          <p className="text-lg font-bold">{STATUS_LABEL[booking.status] ?? booking.status}</p>
          <p className="text-[12px] text-neutral-600">Booked on {formatDateTime(booking.created_at)}</p>
        </div>
      </section>

      <section className="mt-5 flex gap-5 border-t border-neutral-300 pt-5 break-inside-avoid">
        {listing.image && (
          // eslint-disable-next-line @next/next/no-img-element -- plain img so the photo prints reliably
          <img
            src={listing.image}
            alt=""
            className="h-[34mm] w-[46mm] shrink-0 rounded-lg object-cover"
          />
        )}
        <div className="min-w-0">
          <p className={label}>{listing.property_type}</p>
          <p className="text-[20px] font-bold leading-snug">{listing.title}</p>
          <p className="mt-1 text-[13px] text-neutral-700">{listing.location}</p>
          <p className="mt-2 text-[13px]">
            Hosted by <strong>{listing.host.name}</strong>
          </p>
        </div>
      </section>

      <section className="mt-5 grid grid-cols-4 gap-4 border-y border-neutral-300 py-4 break-inside-avoid">
        <div>
          <p className={label}>Check-in</p>
          <p className="text-[14px] font-semibold">{formatLong(booking.check_in)}</p>
          <p className="text-[12px] text-neutral-600">After 3:00 PM</p>
        </div>
        <div>
          <p className={label}>Check-out</p>
          <p className="text-[14px] font-semibold">{formatLong(booking.check_out)}</p>
          <p className="text-[12px] text-neutral-600">Before 11:00 AM</p>
        </div>
        <div>
          <p className={label}>Nights</p>
          <p className="text-[14px] font-semibold">{plural(booking.nights, "night")}</p>
        </div>
        <div>
          <p className={label}>Guests</p>
          <p className="text-[14px] font-semibold">{plural(booking.guests, "guest")}</p>
        </div>
      </section>

      <section className="mt-5 grid grid-cols-2 gap-8 break-inside-avoid">
        <div>
          <p className={label}>Guest</p>
          <p className="text-[14px] font-semibold">{booking.guest.name}</p>
          {email && <p className="text-[13px] text-neutral-700">{email}</p>}
        </div>
        <div>
          <p className={label}>Payment</p>
          <p className="text-[14px] font-semibold">
            {payment?.method ? (PAYMENT_METHOD_LABEL[payment.method] ?? payment.method) : "Simulated payment"}
          </p>
          <p className="text-[13px] text-neutral-700">
            {payment ? (PAYMENT_STATUS_LABEL[payment.status] ?? payment.status) : "—"}
          </p>
        </div>
      </section>

      <section className="mt-6 break-inside-avoid">
        <p className={label}>Price breakdown ({booking.currency})</p>
        <dl className="mt-2 divide-y divide-neutral-200 border-y border-neutral-300">
          <div className={row}>
            <dt>
              {money(nightly)} × {plural(booking.nights, "night")}
            </dt>
            <dd className="tabular-nums">{money(booking.subtotal)}</dd>
          </div>
          <div className={row}>
            <dt>Cleaning fee</dt>
            <dd className="tabular-nums">{money(booking.cleaning_fee)}</dd>
          </div>
          <div className={row}>
            <dt>Service fee</dt>
            <dd className="tabular-nums">{money(booking.service_fee)}</dd>
          </div>
          {booking.discount > 0 && (
            <div className={row}>
              <dt>Coupon discount{booking.coupon_code ? ` (${booking.coupon_code})` : ""}</dt>
              <dd className="tabular-nums">−{money(booking.discount)}</dd>
            </div>
          )}
          <div className={`${row} text-[15px] font-bold`}>
            <dt>Total ({booking.currency})</dt>
            <dd className="tabular-nums">{money(booking.total)}</dd>
          </div>
        </dl>
        <p className="mt-3 flex items-baseline justify-between rounded-md bg-neutral-100 px-4 py-3 text-[15px] font-bold">
          <span>{amountLabel}</span>
          <span className="tabular-nums">
            {money(payment?.amount ?? booking.total)} {booking.currency}
          </span>
        </p>
      </section>

      <footer className="mt-8 border-t border-neutral-300 pt-4 text-[11px] leading-relaxed text-neutral-600 break-inside-avoid">
        <p>
          This is a demonstration document from an independent educational project, not affiliated with or endorsed by Airbnb,
          Inc. Payment is simulated: no card was charged and no money moved.
        </p>
        <p className="mt-1">
          Amounts are in {booking.currency}, the currency this booking was made in. Any currency conversion used illustrative
          demo exchange rates, not live financial rates.
        </p>
        <p className="mt-1">Printed {formatDateTime(new Date().toISOString())}.</p>
      </footer>
    </article>
  );
}
