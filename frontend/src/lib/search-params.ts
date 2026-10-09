import type { SearchFilters } from "./api";

const num = (value: string | null): number | undefined => {
  if (value === null || value === "") return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
};

const list = (value: string | null): string[] | undefined => {
  const items = value ? value.split(",").filter(Boolean) : [];
  return items.length ? items : undefined;
};

/** URL query string -> typed filters. The URL is the single source of truth for a search. */
export function filtersFromParams(params: URLSearchParams): SearchFilters {
  return {
    location: params.get("location") || undefined,
    check_in: params.get("check_in") || undefined,
    check_out: params.get("check_out") || undefined,
    guests: num(params.get("guests")),
    min_price: num(params.get("min_price")),
    max_price: num(params.get("max_price")),
    property_type: list(params.get("property_type")),
    category: params.get("category") || undefined,
    amenities: list(params.get("amenities")),
    min_rating: num(params.get("min_rating")),
    bedrooms: num(params.get("bedrooms")),
    bathrooms: num(params.get("bathrooms")),
    sort: params.get("sort") || undefined,
    page: num(params.get("page")),
  };
}

/** Typed filters -> query string (empty values omitted, so URLs stay shareable and short). */
export function filtersToParams(filters: SearchFilters): URLSearchParams {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === "") continue;
    if (Array.isArray(value)) {
      if (value.length) params.set(key, value.join(","));
    } else if (key === "page" && value === 1) {
      continue;
    } else {
      params.set(key, String(value));
    }
  }
  return params;
}

/** How many filter options (excluding search + category) are currently applied. */
export function activeFilterCount(f: SearchFilters): number {
  let count = 0;
  if (f.min_price !== undefined || f.max_price !== undefined) count += 1;
  count += f.property_type?.length ?? 0;
  count += f.amenities?.length ?? 0;
  if (f.bedrooms) count += 1;
  if (f.bathrooms) count += 1;
  if (f.min_rating) count += 1;
  return count;
}

export const FILTER_KEYS: (keyof SearchFilters)[] = [
  "min_price",
  "max_price",
  "property_type",
  "amenities",
  "min_rating",
  "bedrooms",
  "bathrooms",
];
