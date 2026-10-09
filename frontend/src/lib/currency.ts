/**
 * Currency presentation helpers. Pure functions with no imports, so they can be unit-tested with
 * `node --test` (see `currency.test.ts`).
 *
 * The server is the single authority for prices: listings, quotes, bookings and receipts all arrive
 * already converted and tagged with their `currency`. The exchange-rate table also comes from the
 * server (`GET /api/currencies`) and is illustrative demo data, not live financial rates. The only
 * client-side arithmetic is `convertAmount`, used to translate a guest's own *filter inputs* (a price
 * range, the "budget" quick-filter threshold) when the display currency changes. It follows the
 * server's rule (amount x rate[to] / rate[from], rounded half-up to a whole unit).
 */

export const DEFAULT_CURRENCY = "INR";

/** Display order. Must match the server's supported list (`backend/app/core/currency.py`). */
export const CURRENCY_CODES = [
  "INR", "USD", "EUR", "GBP", "AED", "CAD", "AUD", "SGD", "JPY", "THB", "IDR", "CHF", "NZD", "KRW", "MYR",
] as const;

export type CurrencyCode = (typeof CURRENCY_CODES)[number];

/** Symbols as the server formats them (receipts and coupon messages use the same table). */
export const CURRENCY_SYMBOLS: Record<CurrencyCode, string> = {
  INR: "₹", USD: "$", EUR: "€", GBP: "£", AED: "AED", CAD: "CA$", AUD: "A$", SGD: "S$", JPY: "¥",
  THB: "฿", IDR: "Rp", CHF: "CHF", NZD: "NZ$", KRW: "₩", MYR: "RM",
};

export interface CurrencyInfo {
  code: string;
  name: string;
  symbol: string;
  /** Units of this currency per 1 US dollar (demo rate), as a decimal string. */
  rate_per_usd: string;
  minor_units: number;
}

export interface CurrencyTable {
  base: string;
  default: string;
  note: string;
  currencies: CurrencyInfo[];
  country_currency: Record<string, string>;
}

export function isSupportedCurrency(value: unknown): value is CurrencyCode {
  return typeof value === "string" && (CURRENCY_CODES as readonly string[]).includes(value);
}

/** Validates a persisted/user-supplied value, falling back to the default. */
export function sanitizeCurrency(value: unknown): CurrencyCode {
  const upper = typeof value === "string" ? value.trim().toUpperCase() : value;
  return isSupportedCurrency(upper) ? upper : DEFAULT_CURRENCY;
}

export function currencySymbol(code: string): string {
  return isSupportedCurrency(code) ? CURRENCY_SYMBOLS[code] : code;
}

function group(digits: string, indian: boolean): string {
  if (!indian) return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
  if (digits.length <= 3) return digits;
  const head = digits.slice(0, -3);
  const tail = digits.slice(-3);
  return `${head.replace(/\B(?=(\d{2})+(?!\d))/g, ",")},${tail}`;
}

/**
 * Whole-unit amount with its currency symbol, e.g. ₹2,10,000 · $1,200 · ¥16,500 · CHF 340 · Rp 3,300,000.
 * Prices are whole units, so no fraction digits are shown (JPY/KRW have none by convention anyway).
 * Rupees use Indian digit grouping (lakh/crore). Identical to the server's `format_money`.
 */
export function formatMoney(amount: number, code: string): string {
  const symbol = currencySymbol(code);
  const sign = amount < 0 ? "-" : "";
  const digits = String(Math.abs(Math.round(amount)));
  const space = /^[A-Za-z]+$/.test(symbol) ? " " : "";
  return `${sign}${symbol}${space}${group(digits, code === "INR")}`;
}

/** Short form for tight spaces (nav tabs): ₹13K · ¥23K · Rp 2.4M · $150. Whole-unit amounts below 10,000 stay exact. */
export function formatMoneyCompact(amount: number, code: string): string {
  const abs = Math.abs(amount);
  if (abs < 10_000) return formatMoney(amount, code);
  const symbol = currencySymbol(code);
  const space = /^[A-Za-z]+$/.test(symbol) ? " " : "";
  const trim = (n: number) => String(Math.round(n * 10) / 10).replace(/\.0$/, "");
  const body = abs >= 1_000_000 ? `${trim(abs / 1_000_000)}M` : `${trim(abs / 1_000)}K`;
  return `${amount < 0 ? "-" : ""}${symbol}${space}${body}`;
}

/** Rounded to 2 significant figures: friendly numbers for converted filter bounds (e.g. 12,600 -> 13,000). */
export function niceRound(value: number): number {
  if (!Number.isFinite(value) || value <= 0) return 0;
  const magnitude = 10 ** Math.max(0, Math.floor(Math.log10(value)) - 1);
  return Math.round(value / magnitude) * magnitude;
}

/** Rates keyed by code -> units per 1 USD. */
export type RateTable = Record<string, number>;

export function ratesFrom(table: CurrencyTable | null | undefined): RateTable {
  const rates: RateTable = {};
  for (const c of table?.currencies ?? []) rates[c.code] = Number(c.rate_per_usd);
  return rates;
}

/** amount x rate[to] / rate[from], rounded half-up to a whole unit (the server's rule). */
export function convertAmount(amount: number, from: string, to: string, rates: RateTable): number {
  if (from === to) return amount;
  const a = rates[from];
  const b = rates[to];
  if (!a || !b) return amount;
  // Add a hair so exact .5 ties round up like Decimal's ROUND_HALF_UP, despite binary floats.
  return Math.floor((amount * b) / a + 0.5 + 1e-9);
}
