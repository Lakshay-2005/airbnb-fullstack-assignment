import type { ListingCard } from "@/lib/api";

/** A query a row can link to ("See all"); the same rule is used here to pick and count the row's stays. */
export interface SectionQuery {
  location?: string;
  category?: string;
  min_rating?: number;
}

export interface DiscoverySection {
  id: string;
  title: string;
  subtitle: string;
  /** Stays shown in the row (each listing appears in at most one row). */
  items: ListingCard[];
  /** Everything the "See all" card leads to (the same query on the full list). */
  query: SectionQuery | null;
  href: string;
  /** How many stays match `query` in total (shown on the See all card). */
  total: number;
}

/** Same rule the card badge uses: a top rating backed by more than a couple of reviews. */
export const isGuestFavourite = (l: Pick<ListingCard, "rating" | "review_count">): boolean =>
  l.rating >= 4.9 && l.review_count >= 3;

const MIN_ROW = 3;
const MAX_ROW = 14;

const byRating = (a: ListingCard, b: ListingCard) =>
  b.rating - a.rating || b.review_count - a.review_count || a.id - b.id;
const byPopularity = (a: ListingCard, b: ListingCard) =>
  b.review_count - a.review_count || b.rating - a.rating || a.id - b.id;

/** Client-side mirror of the backend filters used by the section queries. */
export function matchesQuery(l: ListingCard, q: SectionQuery): boolean {
  if (q.category && l.category !== q.category) return false;
  if (q.min_rating && l.rating < q.min_rating) return false;
  if (q.location) {
    const haystack = `${l.title} ${l.city} ${l.country} ${l.location}`.toLowerCase();
    const terms = q.location.toLowerCase().replace(/,/g, " ").split(/\s+/).filter(Boolean);
    if (!terms.every((term) => haystack.includes(term))) return false;
  }
  return true;
}

export function queryHref(q: SectionQuery | null): string {
  if (!q) return "/?view=all";
  const params = new URLSearchParams();
  if (q.location) params.set("location", q.location);
  if (q.category) params.set("category", q.category);
  if (q.min_rating) params.set("min_rating", String(q.min_rating));
  return `/?${params.toString()}`;
}

interface Def {
  id: string;
  title: string;
  subtitle: string;
  query: SectionQuery | null;
  /** Which stays qualify (the row takes the best unused ones, in `sort` order). */
  pick: (l: ListingCard) => boolean;
  sort: (a: ListingCard, b: ListingCard) => number;
  max?: number;
}

/**
 * Turns real listings into curated carousels. Deterministic for a given list (ties break on id),
 * every listing appears in at most one row, and a row that would have fewer than three stays is
 * skipped (its stays fall through to later rows). Each row also knows the search that
 * its "See all" card opens, so the full results are the same rule applied to the whole catalogue.
 */
export function buildDiscoverySections(listings: ListingCard[]): DiscoverySection[] {
  if (!listings.length) return [];

  // Where the guest favourites are concentrated, and the two best-stocked destinations.
  const favourites = listings.filter(isGuestFavourite);
  const favCountries = new Map<string, number>();
  for (const l of favourites) favCountries.set(l.country, (favCountries.get(l.country) ?? 0) + 1);
  const favPlace = [...favCountries.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))[0]?.[0];

  // The two best-stocked other countries become "Popular homes in …" rows.
  const countryCounts = new Map<string, number>();
  for (const l of listings) countryCounts.set(l.country, (countryCounts.get(l.country) ?? 0) + 1);
  const popularPlaces = [...countryCounts.entries()]
    .filter(([country, n]) => country !== favPlace && n >= MIN_ROW)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, 2)
    .map(([country]) => country);

  const defs: Def[] = [];
  if (favPlace) {
    defs.push({
      id: "guest-favourites",
      title: `Guest favourite homes in ${favPlace}`,
      subtitle: "Rated 4.9 or higher by at least three guests",
      query: { location: favPlace, min_rating: 4.9 },
      pick: (l) => l.country === favPlace && isGuestFavourite(l),
      sort: byRating,
    });
  }
  const categoryDefs: Def[] = [
    {
      id: "amazing-views",
      title: "Stays with amazing views",
      subtitle: "Mountains, caldera and coastline from your window",
      query: { category: "amazing-views" },
      pick: (l) => l.category === "amazing-views",
      sort: byRating,
    },
    {
      id: "pools",
      title: "Homes with amazing pools",
      subtitle: "Private plunge pools and infinity edges",
      query: { category: "pools" },
      pick: (l) => l.category === "pools",
      sort: byRating,
    },
    {
      id: "cabins",
      title: "Cabins and cosy retreats",
      subtitle: "Fireplaces, forests and fresh mountain air",
      query: { category: "cabins" },
      pick: (l) => l.category === "cabins",
      sort: byRating,
    },
    {
      id: "design",
      title: "Design-led stays",
      subtitle: "Architecture and interiors worth the trip",
      query: { category: "design" },
      pick: (l) => l.category === "design",
      sort: byRating,
    },
  ];
  defs.push(...categoryDefs);
  popularPlaces.forEach((place, i) =>
    defs.push({
      id: `popular-${i}`,
      title: `Popular homes in ${place}`,
      subtitle: "Most-reviewed stays right now",
      query: { location: place },
      pick: (l) => l.country === place,
      sort: byPopularity,
    }),
  );
  defs.push(
    {
      id: "top-rated",
      title: "Discover highly rated stays",
      subtitle: "Rated 4.7 or higher by guests",
      query: { min_rating: 4.7 },
      pick: (l) => l.rating >= 4.7,
      sort: byRating,
    },
    {
      id: "more",
      title: "More stays to explore",
      subtitle: "Something for every kind of trip",
      query: null,
      pick: () => true,
      sort: (a, b) => a.id - b.id,
      max: 24,
    },
  );

  // Assign listings to rows in priority order…
  const used = new Set<number>();
  const rows = new Map<string, ListingCard[]>();
  for (const def of defs) {
    const items = listings
      .filter((l) => !used.has(l.id) && def.pick(l))
      .sort(def.sort)
      .slice(0, def.max ?? MAX_ROW);
    if (items.length < MIN_ROW) continue;
    items.forEach((l) => used.add(l.id));
    rows.set(def.id, items);
  }

  // …and show them in the order that reads best on the page.
  const display = [
    "guest-favourites",
    "popular-0",
    "amazing-views",
    "pools",
    "popular-1",
    "cabins",
    "design",
    "top-rated",
    "more",
  ];
  return display.flatMap((id) => {
    const def = defs.find((d) => d.id === id);
    const items = rows.get(id);
    if (!def || !items) return [];
    return [
      {
        id: def.id,
        title: def.title,
        subtitle: def.subtitle,
        items,
        query: def.query,
        href: queryHref(def.query),
        total: def.query ? listings.filter((l) => matchesQuery(l, def.query as SectionQuery)).length : listings.length,
      },
    ];
  });
}
