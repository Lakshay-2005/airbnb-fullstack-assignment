import type { SearchFilters } from "@/lib/api";
import { convertAmount, formatMoney, formatMoneyCompact, niceRound, type RateTable } from "@/lib/currency";

/**
 * Top-navigation quick filters. They are stored in the URL as `?quick=<id>` and translated into
 * ordinary backend filters here, so they combine with a destination, dates, the category rail and the
 * advanced filters instead of replacing them.
 */
export type QuickFilterId = "homes" | "top-rated" | "budget";

/** Whole-home property types (the remaining types are apartments, lofts and boutique stays). */
export const WHOLE_HOME_TYPES = ["Villa", "Beach house", "Cabin", "Cottage", "Luxury home", "Mountain home"];
export const TOP_RATED_MIN = 4.8;
/** The budget tab means "under about US$150 a night", expressed in whatever currency is displayed. */
export const BUDGET_USD = 150;

/** The display currency and demo rates that give a quick filter's price threshold its meaning. */
export interface QuickContext {
  currency: string;
  rates: RateTable;
}

export function budgetThreshold({ currency, rates }: QuickContext): number {
  return niceRound(convertAmount(BUDGET_USD, "USD", currency, rates));
}

export function quickLabel(id: QuickFilterId, ctx: QuickContext, compact = false): string {
  switch (id) {
    case "homes":
      return "Homes";
    case "top-rated":
      return "Top rated";
    case "budget":
      return `Under ${(compact ? formatMoneyCompact : formatMoney)(budgetThreshold(ctx), ctx.currency)}`;
  }
}

export function quickSummary(id: QuickFilterId, ctx: QuickContext): string {
  switch (id) {
    case "homes":
      return "Entire homes";
    case "top-rated":
      return `Rated ${TOP_RATED_MIN}+`;
    case "budget":
      return `${quickLabel("budget", ctx)} a night`;
  }
}

export function parseQuick(value: string | null | undefined): QuickFilterId | undefined {
  return value === "homes" || value === "top-rated" || value === "budget" ? value : undefined;
}

/**
 * Applies a quick filter on top of the user's filters (never loosening what they already chose).
 * `filters` must already be expressed in the display currency (`ctx.currency`).
 */
export function applyQuickFilter(
  filters: SearchFilters,
  quick: QuickFilterId | undefined,
  ctx: QuickContext,
): SearchFilters {
  switch (quick) {
    case "homes": {
      const chosen = filters.property_type?.filter((type) => WHOLE_HOME_TYPES.includes(type));
      // Selected types that are not whole homes would contradict the tab; fall back to all whole homes.
      return { ...filters, property_type: chosen?.length ? chosen : WHOLE_HOME_TYPES };
    }
    case "top-rated":
      return { ...filters, min_rating: Math.max(filters.min_rating ?? 0, TOP_RATED_MIN) };
    case "budget":
      return { ...filters, max_price: Math.min(filters.max_price ?? Infinity, budgetThreshold(ctx)) };
    default:
      return filters;
  }
}
