"use client";

import { ArrowLeft, RefreshCcw, SearchX } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { CategoryBar } from "@/components/filters/CategoryBar";
import { FiltersModal } from "@/components/filters/FiltersModal";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListingGridSkeleton } from "@/components/ui/Skeleton";
import { useApp } from "@/context/AppProvider";
import { useFetch } from "@/hooks/useFetch";
import { listingsApi, type SearchFilters } from "@/lib/api";
import { formatRange } from "@/lib/dates";
import { cn } from "@/lib/cn";
import { plural } from "@/lib/format";
import { convertAmount, niceRound } from "@/lib/currency";
import { useCurrency } from "@/lib/currency-store";
import { applyQuickFilter, parseQuick, quickLabel, quickSummary } from "@/lib/quick-filters";
import { activeFilterCount, filtersFromParams, filtersToParams } from "@/lib/search-params";
import { DiscoveryHome } from "./DiscoveryHome";
import { ListingCard } from "./ListingCard";
import { Pagination } from "./Pagination";

const PAGE_SIZE = 12;

const SORT_OPTIONS = [
  { value: "recommended", label: "Recommended" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "rating", label: "Top rated" },
  { value: "newest", label: "Newest" },
];

export function ExplorePage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const { ready, rates, currencyTable } = useApp();
  const currency = useCurrency();
  const [filtersOpen, setFiltersOpen] = useState(false);

  const paramsKey = params.toString();
  const filters = useMemo(() => filtersFromParams(new URLSearchParams(paramsKey)), [paramsKey]);
  const page = filters.page ?? 1;
  // "?view=all" is the plain, paginated list of every stay; anything else in the URL is a real search.
  const viewAll = params.get("view") === "all";
  // "?quick=" is the top-navigation quick filter; it is applied on top of the user's own filters.
  const quick = parseQuick(params.get("quick"));
  const quickCtx = useMemo(() => ({ currency, rates }), [currency, rates]);
  // Price bounds in the URL remember the currency they were chosen in (?cur=); show and search them in
  // the display currency, so "₹5,000" is never compared as "$5,000" after the guest switches currency.
  const displayFilters = useMemo<SearchFilters>(() => {
    const from = filters.price_currency;
    const convert = (value?: number) =>
      value === undefined || !from || from === currency ? value : niceRound(convertAmount(value, from, currency, rates));
    return { ...filters, min_price: convert(filters.min_price), max_price: convert(filters.max_price), price_currency: undefined };
  }, [filters, currency, rates]);
  const effective = useMemo(() => applyQuickFilter(displayFilters, quick, quickCtx), [displayFilters, quick, quickCtx]);
  // Conversion needs the rate table whenever a price bound or the budget tab is involved.
  const ratesReady = currencyTable !== null || (!quick && filters.price_currency === undefined);
  const searching = [...new URLSearchParams(paramsKey).keys()].some((key) => key !== "view");
  const browsing = !viewAll && !searching;

  const meta = useFetch((signal) => listingsApi.meta({ signal }), []);
  const results = useFetch(
    (signal) => listingsApi.search({ ...effective, page, page_size: PAGE_SIZE }, { signal }),
    [paramsKey],
    ready && !browsing && (ratesReady || (quick !== "budget" && !filters.price_currency)),
  );

  const navigate = useCallback(
    (next: SearchFilters, scroll = false) => {
      const nextParams = filtersToParams(next);
      if (viewAll) nextParams.set("view", "all");
      if (quick) nextParams.set("quick", quick);
      const query = nextParams.toString();
      router.push(query ? `${pathname}?${query}` : pathname, { scroll });
    },
    [router, pathname, viewAll, quick],
  );
  /** Any change to the criteria sends the guest back to page 1. */
  const update = (patch: Partial<SearchFilters>) => navigate({ ...filters, ...patch, page: 1 });

  const clearAll = () => router.push(pathname);
  const clearQuick = () => {
    const next = new URLSearchParams(paramsKey);
    next.delete("quick");
    next.delete("page");
    const query = next.toString();
    router.push(query ? `${pathname}?${query}` : pathname, { scroll: false });
  };
  const clearFilters = () =>
    navigate({
      location: filters.location,
      check_in: filters.check_in,
      check_out: filters.check_out,
      guests: filters.guests,
      category: filters.category,
    });

  const filterCount = activeFilterCount(filters);
  const data = results.data;
  const carryQuery = useMemo(() => {
    const carry = new URLSearchParams();
    for (const key of ["check_in", "check_out", "guests"]) {
      const value = params.get(key);
      if (value) carry.set(key, value);
    }
    return carry.toString();
  }, [params]);

  const headline = (() => {
    if (!data) return "Finding stays…";
    const where = filters.location ? ` in ${filters.location}` : "";
    const category = meta.data?.categories.find((c) => c.id === filters.category)?.label;
    return `${plural(data.total, "stay")}${where}${category && !where ? ` · ${category}` : ""}`;
  })();

  const subline = [
    filters.check_in && filters.check_out ? formatRange(filters.check_in, filters.check_out) : null,
    filters.guests ? plural(filters.guests, "guest") : null,
    quick ? quickSummary(quick, quickCtx) : null,
    filterCount ? plural(filterCount, "filter") + " applied" : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <>
      <CategoryBar
        categories={meta.data?.categories}
        selected={filters.category}
        onSelect={(category) => update({ category })}
        filterCount={filterCount}
        onOpenFilters={() => setFiltersOpen(true)}
      />

      {browsing ? (
        <div className="container-page pb-6 pt-2">
          <DiscoveryHome />
        </div>
      ) : (
        <div className="container-page pb-6 pt-6">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div aria-live="polite">
              {viewAll && !searching && (
                <Link
                  href="/"
                  className="mb-1 inline-flex items-center gap-1 text-sm font-medium text-muted underline-offset-2 hover:text-ink hover:underline"
                >
                  <ArrowLeft className="size-3.5" /> Back to highlights
                </Link>
              )}
              <h1 className="text-xl font-semibold md:text-2xl">{headline}</h1>
              {subline && <p className="mt-0.5 text-sm text-muted">{subline}</p>}
            </div>
            <div className="flex items-center gap-2">
              <label htmlFor="sort" className="sr-only">
                Sort stays
              </label>
              <select
                id="sort"
                value={filters.sort ?? "recommended"}
                onChange={(e) =>
                  update({ sort: e.target.value === "recommended" ? undefined : e.target.value })
                }
                className="h-10 rounded-xl border border-edge bg-paper px-3 text-sm font-medium hover:border-ink focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink"
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {results.error && !data && (
            <div className="mx-auto max-w-lg py-10">
              <Alert tone="error">{results.error.message}</Alert>
              <div className="mt-4 flex justify-center">
                <Button variant="secondary" icon={<RefreshCcw className="size-4" />} onClick={results.reload}>
                  Try again
                </Button>
              </div>
            </div>
          )}

          {!data && !results.error && <ListingGridSkeleton count={PAGE_SIZE} />}

          {data && data.items.length === 0 && (
            <EmptyState
              icon={SearchX}
              title="No exact matches"
              description="Try changing or removing some of your filters, or search a different destination or dates."
              actions={
                <>
                  {filterCount > 0 && (
                    <Button variant="dark" onClick={clearFilters}>
                      Remove filters
                    </Button>
                  )}
                  {quick && (
                    <Button variant={filterCount > 0 ? "secondary" : "dark"} onClick={clearQuick}>
                      Remove “{quickLabel(quick, quickCtx)}”
                    </Button>
                  )}
                  <Button variant="secondary" onClick={clearAll}>
                    Clear search
                  </Button>
                </>
              }
            />
          )}

          {data && data.items.length > 0 && (
            <div className={cn("transition-opacity duration-200", results.loading && "opacity-60")}>
              <div className="grid grid-cols-1 gap-x-6 gap-y-9 xs:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6">
                {data.items.map((listing, index) => (
                  <ListingCard
                    key={listing.id}
                    listing={listing}
                    carryQuery={carryQuery}
                    priority={index < 4}
                  />
                ))}
              </div>
              <Pagination
                page={data.page}
                totalPages={data.total_pages}
                total={data.total}
                pageSize={data.page_size}
                onChange={(next) => {
                  navigate({ ...filters, page: next });
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
              />
            </div>
          )}
        </div>
      )}

      <FiltersModal
        open={filtersOpen}
        onClose={() => setFiltersOpen(false)}
        filters={displayFilters}
        transform={(draft) => applyQuickFilter(draft, quick, quickCtx)}
        meta={meta.data}
        onApply={(next) => navigate(next)}
      />
    </>
  );
}
