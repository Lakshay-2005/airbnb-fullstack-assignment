"use client";

import { useState } from "react";
import { Check, CalendarCheck, ChevronDown, Coins, Heart, LayoutDashboard, MessageCircle, Moon, Sun } from "lucide-react";
import Link from "next/link";
import { useApp } from "@/context/AppProvider";
import { Avatar } from "@/components/ui/Avatar";
import { cn } from "@/lib/cn";
import { currencySymbol } from "@/lib/currency";
import { useCurrency } from "@/lib/currency-store";
import { setTheme, useTheme } from "@/lib/theme";
import { CurrencyList } from "./CurrencyMenu";

/** Account links plus the demo-user switcher; rendered in a popover (desktop) or sheet (mobile). */
export function AccountMenuContent({ onNavigate }: { onNavigate: () => void }) {
  const { user, demoUsers, switchUser, unreadMessages } = useApp();
  const isHost = user?.role === "HOST";
  const theme = useTheme();
  const dark = theme === "dark";
  const currency = useCurrency();
  const [currencyOpen, setCurrencyOpen] = useState(false);

  const item =
    "flex items-center gap-3 rounded-xl px-4 py-3 text-[15px] font-medium transition hover:bg-surface";

  return (
    <div className="p-2">
      {user && (
        <div className="mb-1 flex items-center gap-3 px-4 py-3">
          <Avatar name={user.name} src={user.avatar} className="size-11" />
          <div className="min-w-0">
            <p className="truncate text-[15px] font-semibold">{user.name}</p>
            <p className="truncate text-sm text-muted">
              {isHost ? "Host" : "Guest"} · {user.email}
            </p>
          </div>
        </div>
      )}
      <nav aria-label="Account">
        <Link href="/messages" onClick={onNavigate} className={item}>
          <MessageCircle className="size-5" /> Messages
          {unreadMessages > 0 && (
            <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-brand px-1.5 text-[11px] font-bold text-white">
              {unreadMessages}
            </span>
          )}
        </Link>
        <Link href="/trips" onClick={onNavigate} className={item}>
          <CalendarCheck className="size-5" /> My trips
        </Link>
        <Link href="/wishlist" onClick={onNavigate} className={item}>
          <Heart className="size-5" /> Wishlist
        </Link>
        <Link href="/host" onClick={onNavigate} className={item}>
          <LayoutDashboard className="size-5" /> {isHost ? "Host dashboard" : "Become a host"}
        </Link>
      </nav>
      <div className="mx-4 my-2 h-px bg-line" />
      {/* phones: the header has no room for the currency button, so it lives here */}
      <div className="md:hidden">
        <button
          type="button"
          aria-expanded={currencyOpen}
          onClick={() => setCurrencyOpen((o) => !o)}
          className={cn(item, "w-full")}
        >
          <Coins className="size-5" />
          Currency
          <span className="ml-auto flex items-center gap-1.5 text-sm text-muted">
            {currencySymbol(currency)} {currency}
            <ChevronDown className={cn("size-4 transition-transform duration-200", currencyOpen && "rotate-180")} />
          </span>
        </button>
        {currencyOpen && <CurrencyList className="mx-2 mb-2 animate-fade-in rounded-2xl border border-line" onPick={() => setCurrencyOpen(false)} />}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={dark}
        onClick={() => setTheme(dark ? "light" : "dark")}
        className={cn(item, "w-full")}
      >
        {dark ? <Moon className="size-5" /> : <Sun className="size-5" />}
        Dark mode
        <span
          aria-hidden="true"
          className={cn(
            "ml-auto flex h-6 w-10 items-center rounded-full p-0.5 transition-colors duration-200",
            dark ? "bg-brand" : "bg-edge",
          )}
        >
          <span
            className={cn(
              "size-5 rounded-full bg-white shadow transition-transform duration-200",
              dark && "translate-x-4",
            )}
          />
        </span>
      </button>
      <div className="mx-4 my-2 h-px bg-line" />
      <p className="px-4 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-muted">
        Demo accounts · switch instantly
      </p>
      <ul className="max-h-72 overflow-y-auto">
        {demoUsers.map((demo) => {
          const active = demo.id === user?.id;
          return (
            <li key={demo.id}>
              <button
                type="button"
                onClick={async () => {
                  if (!active) await switchUser(demo.id);
                  onNavigate();
                }}
                aria-current={active}
                className="flex w-full items-center gap-3 rounded-xl px-4 py-2.5 text-left transition hover:bg-surface"
              >
                <Avatar name={demo.name} src={demo.avatar} className="size-8" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{demo.name}</span>
                  <span className="block truncate text-xs text-muted">{demo.email}</span>
                </span>
                <span
                  className={cn(
                    "rounded-full px-2 py-0.5 text-[11px] font-semibold",
                    demo.role === "HOST" ? "bg-brand-soft text-brand-dark" : "bg-surface text-ink/70",
                  )}
                >
                  {demo.role === "HOST" ? "Host" : "Guest"}
                </span>
                {active && <Check className="size-4 text-success" aria-label="Current account" />}
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
