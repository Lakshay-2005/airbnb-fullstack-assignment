import { formatMoney, plural } from "@/lib/format";
import type { PriceBreakdown } from "@/lib/api";

interface PriceRowsProps {
  pricing: Pick<
    PriceBreakdown,
    "nights" | "nightly_price" | "subtotal" | "cleaning_fee" | "service_fee" | "discount" | "total" | "currency"
  >;
  couponCode?: string | null;
  totalLabel?: string;
}

/** The same itemised breakdown everywhere: booking card, checkout and trip details. */
export function PriceRows({ pricing, couponCode, totalLabel }: PriceRowsProps) {
  const label = totalLabel ?? `Total (${pricing.currency})`;
  const row = "flex items-baseline justify-between gap-4 text-[15px]";
  return (
    <dl className="space-y-3">
      <div className={row}>
        <dt className="text-ink/90">
          {formatMoney(pricing.nightly_price, pricing.currency)} × {plural(pricing.nights, "night")}
        </dt>
        <dd className="tabular-nums">{formatMoney(pricing.subtotal, pricing.currency)}</dd>
      </div>
      <div className={row}>
        <dt className="text-ink/90">Cleaning fee</dt>
        <dd className="tabular-nums">{formatMoney(pricing.cleaning_fee, pricing.currency)}</dd>
      </div>
      <div className={row}>
        <dt className="text-ink/90">Service fee</dt>
        <dd className="tabular-nums">{formatMoney(pricing.service_fee, pricing.currency)}</dd>
      </div>
      {pricing.discount > 0 && (
        <div className={`${row} text-success`}>
          <dt>Coupon{couponCode ? ` · ${couponCode}` : ""}</dt>
          <dd className="tabular-nums">−{formatMoney(pricing.discount, pricing.currency)}</dd>
        </div>
      )}
      <div className={`${row} border-t border-line pt-4 text-base font-semibold`}>
        <dt>{label}</dt>
        <dd className="tabular-nums">{formatMoney(pricing.total, pricing.currency)}</dd>
      </div>
    </dl>
  );
}
