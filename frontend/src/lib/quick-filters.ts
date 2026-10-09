import type { SearchFilters } from "@/lib/api";

/**
 * Top-navigation quick filters. They are stored in the URL as `?quick=<id>` and translated into
 * ordinary backend filters here, so they combine with a destination, dates, the category rail and the
 * advanced filters instead of replacing them.
 */
export type QuickFilterId = "homes" | "top-rated" | "budget";

/** Whole-home property types (the remaining types are apartments, lofts and boutique stays). */
export const WHOLE_HOME_TYPES = ["Villa", "Beach house", "Cabin", "Cottage", "Luxury home", "Mountain home"];
export const TOP_RATED_MIN = 4.8;
export const BUDGET_MAX_PRICE = 150;

export const QUICK_FILTERS: Record<QuickFilterId, { label: string; summary: string }> = {
  homes: { label: "Homes", summary: "Entire homes" },
  "top-rated": { label: "Top rated", summary: `Rated ${TOP_RATED_MIN}+` },
  budget: { label: `Under $${BUDGET_MAX_PRICE}`, summary: `Under $${BUDGET_MAX_PRICE} a night` },
};

export function parseQuick(value: string | null | undefined): QuickFilterId | undefined {
  return value && value in QUICK_FILTERS ? (value as QuickFilterId) : undefined;
}

/** Applies a quick filter on top of the user's filters (never loosening what they already chose). */
export function applyQuickFilter(filters: SearchFilters, quick: QuickFilterId | undefined): SearchFilters {
  switch (quick) {
    case "homes": {
      const chosen = filters.property_type?.filter((type) => WHOLE_HOME_TYPES.includes(type));
      // Selected types that are not whole homes would contradict the tab; fall back to all whole homes.
      return { ...filters, property_type: chosen?.length ? chosen : WHOLE_HOME_TYPES };
    }
    case "top-rated":
      return { ...filters, min_rating: Math.max(filters.min_rating ?? 0, TOP_RATED_MIN) };
    case "budget":
      return { ...filters, max_price: Math.min(filters.max_price ?? BUDGET_MAX_PRICE, BUDGET_MAX_PRICE) };
    default:
      return filters;
  }
}
