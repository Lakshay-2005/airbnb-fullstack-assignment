"use client";

import { Star } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useDebounced } from "@/hooks/useDebounced";
import { listingsApi, type Meta, type SearchFilters } from "@/lib/api";
import { cn } from "@/lib/cn";
import { amenityIcon, PROPERTY_ICONS } from "@/lib/icons";
import { formatMoney } from "@/lib/format";
import { applyQuickFilter, type QuickFilterId } from "@/lib/quick-filters";
import { FILTER_KEYS } from "@/lib/search-params";

interface FiltersModalProps {
  open: boolean;
  onClose: () => void;
  /** Everything currently applied (search, category and filters). */
  filters: SearchFilters;
  /** The top-nav quick filter in effect; it is included in the live result count. */
  quick?: QuickFilterId;
  meta: Meta | null;
  onApply: (next: SearchFilters) => void;
}

const ROOM_OPTIONS = [0, 1, 2, 3, 4, 5];
const GUEST_OPTIONS = [0, 1, 2, 4, 6, 8];
const RATING_OPTIONS = [0, 4, 4.5, 4.8];

const clearedFilters = (filters: SearchFilters): SearchFilters => {
  const next = { ...filters };
  for (const key of FILTER_KEYS) delete next[key];
  return next;
};

export function FiltersModal({ open, onClose, filters, quick, meta, onApply }: FiltersModalProps) {
  const [draft, setDraft] = useState<SearchFilters>(filters);
  const [count, setCount] = useState<number | null>(null);
  const [prevOpen, setPrevOpen] = useState(open);

  // Re-seed the draft each time the modal opens so "cancel" really discards edits.
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) setDraft(filters);
  }

  const debouncedDraft = useDebounced(draft, 250);
  useEffect(() => {
    if (!open) return;
    // The API rejects min > max; the modal already explains it, so don't send that request.
    if (
      debouncedDraft.min_price !== undefined &&
      debouncedDraft.max_price !== undefined &&
      debouncedDraft.min_price > debouncedDraft.max_price
    )
      return;
    const controller = new AbortController();
    listingsApi
      .search({ ...applyQuickFilter(debouncedDraft, quick), page: 1, page_size: 1 }, { signal: controller.signal })
      .then((page) => setCount(page.total))
      .catch(() => setCount(null));
    return () => controller.abort();
  }, [open, debouncedDraft, quick]);

  const set = (patch: Partial<SearchFilters>) => setDraft((d) => ({ ...d, ...patch }));
  const toggle = (key: "property_type" | "amenities", value: string) =>
    setDraft((d) => {
      const current = d[key] ?? [];
      const next = current.includes(value) ? current.filter((v) => v !== value) : [...current, value];
      return { ...d, [key]: next.length ? next : undefined };
    });

  const sliderMax = meta ? Math.max(100, Math.ceil(meta.price_max / 50) * 50) : 1000;
  const invalidPrice =
    draft.min_price !== undefined && draft.max_price !== undefined && draft.min_price > draft.max_price;
  const lo = draft.min_price ?? 0;
  const hi = draft.max_price ?? sliderMax;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Filters"
      size="md"
      footer={
        <div className="flex items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => setDraft(clearedFilters(draft))}
            className="rounded-lg px-2 py-2 text-[15px] font-semibold underline underline-offset-2 hover:bg-surface"
          >
            Clear all
          </button>
          <Button
            size="lg"
            variant="dark"
            disabled={invalidPrice}
            onClick={() => {
              onApply({ ...draft, page: 1 });
              onClose();
            }}
          >
            {count === null ? "Show stays" : count === 0 ? "No stays match" : `Show ${count} ${count === 1 ? "stay" : "stays"}`}
          </Button>
        </div>
      }
    >
      <div className="divide-y divide-line px-6">
        <Section title="Price range" subtitle="Nightly prices before fees and taxes">
          <div className="relative mx-3 my-4 h-6">
            <div className="absolute top-1/2 h-1 w-full -translate-y-1/2 rounded-full bg-line" />
            <div
              className="absolute top-1/2 h-1 -translate-y-1/2 rounded-full bg-ink"
              style={{ left: `${(lo / sliderMax) * 100}%`, right: `${100 - (hi / sliderMax) * 100}%` }}
            />
            <input
              type="range"
              aria-label="Minimum price"
              className={cn("range-thumb", lo >= sliderMax - 20 && "z-20")}
              min={0}
              max={sliderMax}
              step={10}
              value={lo}
              onChange={(e) => {
                const value = Math.min(Number(e.target.value), hi - 10);
                set({ min_price: value <= 0 ? undefined : value });
              }}
            />
            <input
              type="range"
              aria-label="Maximum price"
              className="range-thumb"
              min={0}
              max={sliderMax}
              step={10}
              value={hi}
              onChange={(e) => {
                const value = Math.max(Number(e.target.value), lo + 10);
                set({ max_price: value >= sliderMax ? undefined : value });
              }}
            />
          </div>
          <div className="flex items-center gap-3">
            <PriceInput
              label="Minimum"
              value={draft.min_price}
              placeholder="0"
              onChange={(v) => set({ min_price: v })}
            />
            <span className="text-muted">–</span>
            <PriceInput
              label="Maximum"
              value={draft.max_price}
              placeholder={`${sliderMax}+`}
              onChange={(v) => set({ max_price: v })}
            />
          </div>
          {invalidPrice && (
            <p role="alert" className="mt-2 text-sm text-danger">
              Minimum price can&apos;t be higher than the maximum ({formatMoney(draft.max_price ?? 0)}).
            </p>
          )}
        </Section>

        <Section title="Type of place">
          <div className="flex flex-wrap gap-2">
            {(meta?.property_types ?? []).map((type) => {
              const Icon = PROPERTY_ICONS[type];
              const selected = draft.property_type?.includes(type) ?? false;
              return (
                <Chip key={type} selected={selected} onClick={() => toggle("property_type", type)}>
                  {Icon && <Icon className="size-4" />}
                  {type}
                </Chip>
              );
            })}
          </div>
        </Section>

        <Section title="Rooms and guests">
          <PillRow
            label="Guests"
            options={GUEST_OPTIONS}
            value={draft.guests ?? 0}
            onChange={(v) => set({ guests: v || undefined })}
          />
          <PillRow
            label="Bedrooms"
            options={ROOM_OPTIONS}
            value={draft.bedrooms ?? 0}
            onChange={(v) => set({ bedrooms: v || undefined })}
          />
          <PillRow
            label="Bathrooms"
            options={ROOM_OPTIONS}
            value={draft.bathrooms ?? 0}
            onChange={(v) => set({ bathrooms: v || undefined })}
          />
        </Section>

        <Section title="Guest rating">
          <div role="radiogroup" aria-label="Minimum rating" className="flex flex-wrap gap-2">
            {RATING_OPTIONS.map((rating) => (
              <Chip
                key={rating}
                role="radio"
                selected={(draft.min_rating ?? 0) === rating}
                onClick={() => set({ min_rating: rating || undefined })}
              >
                {rating === 0 ? (
                  "Any"
                ) : (
                  <>
                    <Star className="size-3.5 fill-current" /> {rating}+
                  </>
                )}
              </Chip>
            ))}
          </div>
        </Section>

        <Section title="Amenities">
          <div className="grid grid-cols-1 gap-2 xs:grid-cols-2">
            {(meta?.amenities ?? []).map((name) => {
              const Icon = amenityIcon(name);
              const selected = draft.amenities?.includes(name) ?? false;
              return (
                <label
                  key={name}
                  className={cn(
                    "flex cursor-pointer items-center gap-3 rounded-xl border px-3.5 py-3 text-sm transition hover:border-ink has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ink",
                    selected ? "border-ink bg-surface font-medium" : "border-line",
                  )}
                >
                  <input
                    type="checkbox"
                    className="sr-only"
                    checked={selected}
                    onChange={() => toggle("amenities", name)}
                  />
                  <Icon className="size-[18px] shrink-0" />
                  {name}
                </label>
              );
            })}
          </div>
        </Section>
      </div>
    </Modal>
  );
}

function Section({ title, subtitle, children }: { title: string; subtitle?: string; children: ReactNode }) {
  return (
    <section className="py-7">
      <h3 className="text-lg font-semibold">{title}</h3>
      {subtitle && <p className="mt-0.5 text-sm text-muted">{subtitle}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </section>
  );
}

function Chip({
  selected,
  onClick,
  children,
  role,
}: {
  selected: boolean;
  onClick: () => void;
  children: ReactNode;
  role?: string;
}) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={role ? selected : undefined}
      aria-pressed={role ? undefined : selected}
      onClick={onClick}
      className={cn(
        "inline-flex h-10 items-center justify-center gap-1.5 rounded-full border px-4 text-sm transition hover:border-ink",
        selected ? "border-ink bg-ink font-medium text-on-ink hover:bg-ink" : "border-edge",
      )}
    >
      {children}
    </button>
  );
}

function PillRow({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: number[];
  value: number;
  onChange: (value: number) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-[15px]">{label}</p>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
        {options.map((option) => (
          <Chip key={option} role="radio" selected={value === option} onClick={() => onChange(option)}>
            {option === 0 ? "Any" : `${option}+`}
          </Chip>
        ))}
      </div>
    </div>
  );
}

function PriceInput({
  label,
  value,
  placeholder,
  onChange,
}: {
  label: string;
  value: number | undefined;
  placeholder: string;
  onChange: (value: number | undefined) => void;
}) {
  const id = `price-${label.toLowerCase()}`;
  return (
    <div className="flex-1 rounded-xl border border-edge px-3.5 py-2 focus-within:border-ink focus-within:ring-1 focus-within:ring-ink">
      <label htmlFor={id} className="block text-xs text-muted">
        {label}
      </label>
      <div className="flex items-center gap-1">
        <span aria-hidden="true">$</span>
        <input
          id={id}
          inputMode="numeric"
          value={value ?? ""}
          placeholder={placeholder}
          onChange={(e) => {
            const digits = e.target.value.replace(/\D/g, "");
            onChange(digits ? Number(digits) : undefined);
          }}
          className="w-full bg-transparent text-[15px] focus:outline-none"
        />
      </div>
    </div>
  );
}
