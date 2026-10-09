"use client";

import { Compass, Heart, House, MessageCircle, UserRound } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useApp } from "@/context/AppProvider";
import { Modal } from "@/components/ui/Modal";
import { cn } from "@/lib/cn";
import { AccountMenuContent } from "./AccountMenu";
import { LogoMark } from "./Logo";

type TabIcon = (props: { className?: string; strokeWidth?: number }) => React.ReactNode;

/** The Airbnb symbol-only mark, used as the Trips icon exactly like the real app's tab bar. */
const TripsIcon: TabIcon = ({ className, strokeWidth }) => (
  <LogoMark className={className} strokeWidth={typeof strokeWidth === "number" ? strokeWidth + 0.4 : undefined} />
);

const TABS: { href: string; label: string; Icon: TabIcon }[] = [
  { href: "/", label: "Explore", Icon: Compass },
  { href: "/wishlist", label: "Wishlist", Icon: Heart },
  { href: "/trips", label: "Trips", Icon: TripsIcon },
  { href: "/messages", label: "Messages", Icon: MessageCircle },
  { href: "/host", label: "Host", Icon: House },
];

/** Bottom navigation for phones; hidden on pages with their own sticky CTA. */
export function MobileTabBar() {
  const pathname = usePathname();
  const { user, unreadMessages } = useApp();
  const [open, setOpen] = useState(false);

  if (/^\/(listings\/\d+|checkout)/.test(pathname) || pathname.startsWith("/host/listings")) return null;

  const tab = "flex min-h-14 flex-1 flex-col items-center justify-center gap-1 py-2 text-[11px] font-medium transition active:bg-surface";
  return (
    <>
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-40 flex border-t border-line bg-paper pb-[env(safe-area-inset-bottom)] md:hidden print:hidden"
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
              <span className="relative">
                <Icon className="size-6" strokeWidth={active ? 2.4 : 1.8} />
                {href === "/messages" && unreadMessages > 0 && (
                  <span
                    aria-label={`${unreadMessages} unread`}
                    className="absolute -right-1 -top-0.5 size-2.5 rounded-full border-2 border-paper bg-brand"
                  />
                )}
              </span>
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
