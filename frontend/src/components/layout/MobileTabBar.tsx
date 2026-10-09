"use client";

import { CalendarCheck, Compass, Heart, House, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useApp } from "@/context/AppProvider";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/cn";
import { AccountMenuContent } from "./AccountMenu";

const TABS = [
  { href: "/", label: "Explore", Icon: Compass },
  { href: "/wishlist", label: "Wishlist", Icon: Heart },
  { href: "/trips", label: "Trips", Icon: CalendarCheck },
  { href: "/host", label: "Host", Icon: House },
];

/** Bottom navigation for phones; hidden on pages with their own sticky CTA. */
export function MobileTabBar() {
  const pathname = usePathname();
  const { user } = useApp();
  const [open, setOpen] = useState(false);

  if (/^\/(listings\/\d+|checkout)/.test(pathname) || pathname.startsWith("/host/listings")) return null;

  const tab = "flex flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition";
  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-paper pb-[env(safe-area-inset-bottom)] md:hidden"
      >
        {TABS.map(({ href, label, Icon }) => {
          const active = href === "/" ? pathname === "/" : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(tab, active ? "text-brand" : "text-muted")}
            >
              <Icon className="size-6" strokeWidth={active ? 2.4 : 1.8} />
              {label}
            </Link>
          );
        })}
        <button type="button" onClick={() => setOpen(true)} className={cn(tab, "text-muted")}>
          <UserRound className="size-6" strokeWidth={1.8} />
          {user ? user.name.split(" ")[0] : "Profile"}
        </button>
      </nav>
      <Modal open={open} onClose={() => setOpen(false)} title="Your account" size="sm">
        <AccountMenuContent onNavigate={() => setOpen(false)} />
      </Modal>
    </>
  );
}
