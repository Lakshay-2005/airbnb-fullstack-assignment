import { formatMoney, plural } from "@/lib/format";
import type { PriceBreakdown } from "@/lib/api";

interface PriceRowsProps {
  pricing: Pick<
    PriceBreakdown,
    "nights" | "nightly_price" | "subtotal" | "cleaning_fee" | "service_fee" | "discount" | "total"
  >;
  couponCode?: string | null;
  totalLabel?: string;
}

/** The same itemised breakdown everywhere: booking card, checkout and trip details. */
export function PriceRows({ pricing, couponCode, totalLabel = "Total (USD)" }: PriceRowsProps) {
  const row = "flex items-baseline justify-between gap-4 text-[15px]";
  return (
    <dl className="space-y-3">
      <div className={row}>
        <dt className="text-ink/90">
          {formatMoney(pricing.nightly_price)} × {plural(pricing.nights, "night")}
        </dt>
        <dd className="tabular-nums">{formatMoney(pricing.subtotal)}</dd>
      </div>
      <div className={row}>
        <dt className="text-ink/90">Cleaning fee</dt>
        <dd className="tabular-nums">{formatMoney(pricing.cleaning_fee)}</dd>
      </div>
      <div className={row}>
        <dt className="text-ink/90">Service fee</dt>
        <dd className="tabular-nums">{formatMoney(pricing.service_fee)}</dd>
      </div>
      {pricing.discount > 0 && (
        <div className={`${row} text-success`}>
          <dt>Coupon{couponCode ? ` · ${couponCode}` : ""}</dt>
          <dd className="tabular-nums">−{formatMoney(pricing.discount)}</dd>
        </div>
      )}
      <div className={`${row} border-t border-line pt-4 text-base font-semibold`}>
        <dt>{totalLabel}</dt>
        <dd className="tabular-nums">{formatMoney(pricing.total)}</dd>
      </div>
    </dl>
  );
}
