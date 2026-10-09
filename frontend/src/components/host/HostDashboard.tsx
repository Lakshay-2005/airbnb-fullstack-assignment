"use client";

import { CalendarRange, Eye, Home, KeyRound, Pencil, Plus, Trash2, Wallet } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Alert } from "@/components/ui/Alert";
import { Avatar } from "@/components/ui/Avatar";
import { Button, ButtonLink } from "@/components/ui/Button";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Img } from "@/components/ui/Img";
import { Skeleton } from "@/components/ui/Skeleton";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { useToast } from "@/components/ui/Toast";
import { useApp } from "@/context/AppProvider";
import { useFetch } from "@/hooks/useFetch";
import { errorMessage, hostApi, type HostListing } from "@/lib/api";
import { cn } from "@/lib/cn";
import { formatRange } from "@/lib/dates";
import { useCurrency } from "@/lib/currency-store";
import { formatMoney, plural } from "@/lib/format";

type Tab = "listings" | "reservations";

export function HostDashboard() {
  const { user, ready, demoUsers, switchUser } = useApp();
  const isHost = user?.role === "HOST";

  if (!ready) return <DashboardSkeleton />;
  if (!isHost) {
    const demoHost = demoUsers.find((u) => u.email === "host@example.com") ?? demoUsers.find((u) => u.role === "HOST");
    return (
      <EmptyState
        className="py-24"
        icon={KeyRound}
        title="Hosting needs a host account"
        description="You're browsing as a guest. Switch to the demo host to create and manage listings and see reservations."
        actions={
          <>
            {demoHost && <Button variant="dark" size="lg" onClick={() => switchUser(demoHost.id)}>Switch to {demoHost.name} (host)</Button>}
            <ButtonLink href="/" variant="secondary" size="lg">Back to exploring</ButtonLink>
          </>
        }
      />
    );
  }
  return <DashboardView key={user.id} hostName={user.name} />;
}

function DashboardView({ hostName }: { hostName: string }) {
  const toast = useToast();
  const [tab, setTab] = useState<Tab>("listings");
  const listings = useFetch((signal) => hostApi.listings({ signal }), []);
  const bookings = useFetch((signal) => hostApi.bookings({ signal }), []);
  const [toDelete, setToDelete] = useState<HostListing | null>(null);
  const [deleting, setDeleting] = useState(false);

  const currency = useCurrency();
  const items = listings.data ?? [];
  const received = bookings.data ?? [];
  const upcoming = received.filter((b) => b.status === "CONFIRMED" && b.check_out > new Date().toISOString().slice(0, 10));
  const earnings = items.reduce((sum, l) => sum + l.earnings, 0);

  const remove = async () => {
    if (!toDelete) return;
    setDeleting(true);
    try {
      await hostApi.remove(toDelete.id);
      toast.success(`“${toDelete.title}” was deleted.`);
      setToDelete(null);
      listings.reload();
      bookings.reload();
    } catch (error) {
      toast.error(errorMessage(error));
      setToDelete(null);
    } finally {
      setDeleting(false);
    }
  };

  const stats = [
    { label: "Listings", value: listings.data ? String(items.length) : null, Icon: Home },
    { label: "Reservations", value: bookings.data ? String(received.filter((b) => b.status !== "CANCELLED").length) : null, Icon: CalendarRange },
    { label: "Upcoming stays", value: bookings.data ? String(upcoming.length) : null, Icon: Eye },
    { label: "Earnings", value: listings.data ? formatMoney(earnings, items[0]?.currency ?? currency) : null, Icon: Wallet },
  ];

  return (
    <div className="container-page pb-24 pt-8 md:pb-16">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[28px] font-semibold md:text-[32px]">Host dashboard</h1>
          <p className="mt-1 text-muted">Welcome back, {hostName.split(" ")[0]}. Here&apos;s how your stays are doing.</p>
        </div>
        <ButtonLink href="/host/listings/new" size="lg" icon={<Plus className="size-5" />}>
          Create listing
        </ButtonLink>
      </div>

      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(({ label, value, Icon }) => (
          <div key={label} className="rounded-2xl border border-line p-5">
            <Icon className="size-5 text-muted" strokeWidth={1.6} />
            {value === null ? <Skeleton className="mt-3 h-8 w-20" /> : <p className="mt-3 text-[28px] font-semibold leading-none">{value}</p>}
            <p className="mt-2 text-sm text-muted">{label}</p>
          </div>
        ))}
      </div>

      <div role="tablist" aria-label="Host sections" className="mt-10 flex gap-2 border-b border-line">
        {([["listings", "Your listings"], ["reservations", "Reservations received"]] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn("-mb-px border-b-2 px-4 pb-3 pt-2 text-[15px] font-medium transition", tab === id ? "border-ink" : "border-transparent text-muted hover:text-ink")}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mt-6">
        {tab === "listings" && (
          <>
            {listings.error && !listings.data && <Alert tone="error">{listings.error.message}</Alert>}
            {!listings.data && !listings.error && <RowsSkeleton />}
            {listings.data && items.length === 0 && (
              <EmptyState
                icon={Home}
                title="No listings yet"
                description="Share your space with travellers. Add photos, set your price and you're live in a few minutes."
                actions={<ButtonLink href="/host/listings/new" variant="dark">Create your first listing</ButtonLink>}
              />
            )}
            {items.length > 0 && (
              <ul className="space-y-4">
                {items.map((listing) => (
                  <li key={listing.id} className="flex flex-col gap-4 rounded-2xl border border-line p-4 sm:flex-row sm:items-center">
                    <Link href={`/listings/${listing.id}`} className="block shrink-0 overflow-hidden rounded-xl sm:w-44" aria-hidden="true" tabIndex={-1}>
                      <Img src={listing.images[0]} alt="" width={400} className="aspect-[16/10] size-full" />
                    </Link>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <StatusBadge status={listing.status} />
                        <span className="text-sm text-muted">{listing.property_type}</span>
                      </div>
                      <Link href={`/listings/${listing.id}`} className="mt-1.5 block truncate text-lg font-semibold hover:underline">{listing.title}</Link>
                      <p className="truncate text-sm text-muted">{listing.city}, {listing.country}</p>
                      <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-sm">
                        <span><strong>{formatMoney(listing.nightly_price, listing.currency)}</strong> / night</span>
                        <span>{plural(listing.booking_count, "booking")}</span>
                        <span className="text-muted">{listing.upcoming_booking_count} upcoming</span>
                        <span className="text-muted">{formatMoney(listing.earnings, listing.currency)} earned</span>
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-2">
                      <ButtonLink size="sm" variant="secondary" href={`/listings/${listing.id}`} icon={<Eye className="size-4" />}>View</ButtonLink>
                      <ButtonLink size="sm" variant="secondary" href={`/host/listings/${listing.id}/edit`} icon={<Pencil className="size-4" />}>Edit</ButtonLink>
                      <Button size="sm" variant="danger" onClick={() => setToDelete(listing)} aria-label={`Delete ${listing.title}`} icon={<Trash2 className="size-4" />}>
                        <span className="sr-only sm:not-sr-only">Delete</span>
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}

        {tab === "reservations" && (
          <>
            {bookings.error && !bookings.data && <Alert tone="error">{bookings.error.message}</Alert>}
            {!bookings.data && !bookings.error && <RowsSkeleton />}
            {bookings.data && received.length === 0 && (
              <EmptyState icon={CalendarRange} title="No reservations yet" description="When guests book your listings, their reservations appear here with dates and payout amounts." />
            )}
            {received.length > 0 && (
              <div className="overflow-x-auto rounded-2xl border border-line">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead className="bg-surface text-xs uppercase tracking-wide text-muted">
                    <tr>
                      {["Guest", "Listing", "Dates", "Guests", "Amount", "Status"].map((h) => (
                        <th key={h} scope="col" className="px-4 py-3 font-semibold">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {received.map((b) => (
                      <tr key={b.id} className="transition hover:bg-surface/60">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar name={b.guest.name} src={b.guest.avatar} className="size-8" />
                            <div>
                              <p className="font-medium">{b.guest.name}</p>
                              <p className="text-xs text-muted">{b.guest_email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="max-w-56 px-4 py-3"><Link href={`/trips/${b.id}`} className="line-clamp-2 hover:underline">{b.listing.title}</Link></td>
                        <td className="whitespace-nowrap px-4 py-3">{formatRange(b.check_in, b.check_out)}<span className="block text-xs text-muted">{plural(b.nights, "night")}</span></td>
                        <td className="px-4 py-3">{b.guests}</td>
                        <td className="whitespace-nowrap px-4 py-3 font-medium">{formatMoney(b.total, b.currency)}</td>
                        <td className="px-4 py-3"><StatusBadge status={b.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      <ConfirmDialog open={Boolean(toDelete)} title="Delete this listing?" confirmLabel="Delete listing" cancelLabel="Keep listing" loading={deleting} onConfirm={remove} onClose={() => setToDelete(null)}>
        <strong>{toDelete?.title}</strong> will be removed from search and wishlists. Past bookings stay in guests&apos; trip history. This can&apos;t be undone.
      </ConfirmDialog>
    </div>
  );
}

function RowsSkeleton() {
  return (
    <div className="space-y-4" aria-busy="true" aria-label="Loading">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex gap-4 rounded-2xl border border-line p-4">
          <Skeleton className="h-24 w-36 shrink-0 rounded-xl" />
          <div className="flex-1 space-y-3 py-1">
            <Skeleton className="h-5 w-1/2" />
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="container-page pt-10" aria-busy="true">
      <Skeleton className="h-9 w-64" />
      <div className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-2xl" />)}
      </div>
      <div className="mt-10"><RowsSkeleton /></div>
    </div>
  );
}
