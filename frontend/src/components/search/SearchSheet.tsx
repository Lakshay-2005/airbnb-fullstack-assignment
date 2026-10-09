"use client";

import { Search } from "lucide-react";
import { Suspense, useState, type ReactNode } from "react";
import { RangeCalendar } from "@/components/calendar/RangeCalendar";
import { Button } from "@/components/ui/Button";
import { Modal } from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { cn } from "@/lib/cn";
import { formatRange } from "@/lib/dates";
import { DestinationList, GuestsPicker, type SearchValues, summaryOf } from "./parts";
import { useSearch, useSearchDraft } from "./useSearch";

type Section = "where" | "when" | "who";

/** Compact search pill that opens a full search form in a sheet (mobile, tablet, detail pages). */
export function CompactSearch({ className }: { className?: string }) {
  return (
    <Suspense fallback={<div className="skeleton h-12 w-full rounded-full" aria-hidden="true" />}>
      <CompactSearchInner className={className} />
    </Suspense>
  );
}

function CompactSearchInner({ className }: { className?: string }) {
  const { initial, submit, paramsKey } = useSearch();
  const [open, setOpen] = useState(false);
  const summary = summaryOf(initial);
  const when =
    initial.check_in && initial.check_out ? formatRange(initial.check_in, initial.check_out) : summary.when;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open search"
        className={cn(
          "flex h-12 w-full items-center gap-3 rounded-full border border-line bg-paper px-2 text-left shadow-search transition hover:shadow-card",
          className,
        )}
      >
        <span className="ml-1 flex size-8 shrink-0 items-center justify-center rounded-full bg-brand text-white">
          <Search className="size-4" strokeWidth={2.5} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-semibold leading-tight">{summary.where}</span>
          <span className="block truncate text-xs leading-tight text-muted">
            {when} · {summary.who}
          </span>
        </span>
      </button>
      <SearchSheet
        key={paramsKey}
        open={open}
        onClose={() => setOpen(false)}
        initial={initial}
        onSubmit={(values) => {
          setOpen(false);
          submit(values);
        }}
      />
    </>
  );
}

export function SearchSheet({
  open,
  onClose,
  initial,
  onSubmit,
}: {
  open: boolean;
  onClose: () => void;
  initial: SearchValues;
  onSubmit: (values: SearchValues) => void;
}) {
  const toast = useToast();
  const { values, patch, reset } = useSearchDraft(initial);
  const [section, setSection] = useState<Section>("where");

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Search stays"
      size="md"
      footer={
        <div className="flex items-center justify-between">
          <button type="button" onClick={reset} className="text-sm font-semibold underline">
            Clear all
          </button>
          <Button size="lg" icon={<Search className="size-4" strokeWidth={2.5} />} onClick={() => onSubmit(values)}>
            Search
          </Button>
        </div>
      }
    >
      <div className="space-y-3 bg-surface p-4 sm:p-5">
        <Row current={section} onSelect={setSection} id="where" title="Where to?" value={values.location || "Anywhere"}>
          <div className="px-4">
            <input
              autoFocus
              value={values.location}
              onChange={(e) => patch({ location: e.target.value })}
              placeholder="Search destinations"
              aria-label="Destination"
              className="h-12 w-full rounded-xl border border-edge px-4 text-[15px] focus:border-ink focus:outline-none focus:ring-1 focus:ring-ink"
            />
          </div>
          <DestinationList
            query={values.location}
            onPick={(d) => {
              patch({ location: d.city });
              setSection("when");
            }}
          />
        </Row>
        <Row
          current={section}
          onSelect={setSection}
          id="when"
          title="When?"
          value={values.check_in && values.check_out ? formatRange(values.check_in, values.check_out) : "Add dates"}
        >
          <div className="flex justify-center overflow-x-auto px-3">
            <RangeCalendar
              months={1}
              checkIn={values.check_in}
              checkOut={values.check_out}
              onInvalid={toast.error}
              onChange={(check_in, check_out) => {
                patch({ check_in, check_out });
                if (check_in && check_out) setSection("who");
              }}
            />
          </div>
        </Row>
        <Row current={section} onSelect={setSection} id="who" title="Who?" value={summaryOf(values).who}>
          <GuestsPicker guests={values.guests} onChange={(guests) => patch({ guests })} />
        </Row>
      </div>
    </Modal>
  );
}

function Row({
  id,
  current,
  onSelect,
  title,
  value,
  children,
}: {
  id: Section;
  current: Section;
  onSelect: (id: Section) => void;
  title: string;
  value: string;
  children: ReactNode;
}) {
  const open = current === id;
  return (
    <section className="rounded-3xl border border-line bg-paper shadow-sm">
      <button
        type="button"
        onClick={() => onSelect(id)}
        aria-expanded={open}
        className={cn("flex w-full items-center justify-between px-6 text-left", open ? "h-14 pt-2" : "h-16")}
      >
        <span className={cn("font-semibold", open ? "text-xl" : "text-sm text-muted")}>{title}</span>
        {!open && <span className="truncate pl-4 text-sm font-semibold">{value}</span>}
      </button>
      {open && <div className="animate-fade-in pb-4">{children}</div>}
    </section>
  );
}
