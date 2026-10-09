"use client";

import { Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useApp } from "@/context/AppProvider";
import { Avatar } from "@/components/ui/Avatar";
import { Popover } from "@/components/ui/Popover";
import { Skeleton } from "@/components/ui/Skeleton";
import { useDismiss } from "@/hooks/useDismiss";
import { cn } from "@/lib/cn";
import { CompactCapsule } from "@/components/search/CompactCapsule";
import { SearchBar, type SearchSegment, type SegmentRequest } from "@/components/search/SearchBar";
import { CompactSearch } from "@/components/search/SearchSheet";
import { AccountMenuContent } from "./AccountMenu";
import { Logo } from "./Logo";
import { ProductTabs } from "./ProductTabs";

/** Scroll distance (px) after which the bar shows the compact capsule, and the way back (hysteresis). */
const COLLAPSE_AT = 24;
const EXPAND_AT = 10;
/** The in-page search collapses over this much scrolling (see `.hdr-expander` in globals.css). */
const COLLAPSE_RANGE = 120;

/**
 * Header design: the fixed bar always has the same compact height. On the home page the large search
 * pill and the phone tabs live in a region right under the bar whose height is a pure function of
 * `scrollY` (`--s`, set with one rAF-throttled style write, no React renders): it shrinks to nothing
 * over the first ~90px of scrolling, so the content closes up under the bar continuously, with no jump,
 * no blank band and no scroll feedback. The bar cross-fades from the quick-filter tabs to the compact
 * search capsule at a small threshold.
 *
 * Everywhere else (and on the home page once scrolled) the capsule opens the very same SearchBar
 * in a drop-down panel under the bar, so search looks and behaves identically on every route.
 */
export function Header() {
  const { user, ready, unreadMessages } = useApp();
  const pathname = usePathname();
  const isHome = pathname === "/";
  const isHost = user?.role === "HOST";
  const [menuOpen, setMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [request, setRequest] = useState<SegmentRequest | null>(null);
  const peeking = request !== null;
  const ref = useRef<HTMLElement>(null);
  const regionRef = useRef<HTMLDivElement>(null);

  // One rAF-throttled listener: a style write while the region is collapsing, state only on threshold crossings.
  useEffect(() => {
    let frame = 0;
    let lastS = -1;
    const measure = () => {
      frame = 0;
      const y = window.scrollY;
      const s = Math.min(Math.round(y), COLLAPSE_RANGE);
      if (s !== lastS) {
        lastS = s;
        regionRef.current?.style.setProperty("--s", String(s));
      }
      setScrolled((was) => (was ? y > EXPAND_AT : y > COLLAPSE_AT));
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(measure);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (frame) cancelAnimationFrame(frame);
    };
  }, []);

  // Scrolling, navigating or clicking elsewhere closes the drop-down search.
  useEffect(() => {
    if (!peeking) return;
    const onScroll = () => setRequest(null);
    // Ignore the scroll caused by focusing the destination field.
    const timer = window.setTimeout(() => window.addEventListener("scroll", onScroll, { passive: true, once: true }), 250);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener("scroll", onScroll);
    };
  }, [peeking]);
  const closePeek = useCallback(() => setRequest(null), []);
  useDismiss(ref, peeking, closePeek);
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setRequest(null);
  }

  // The big in-page pill is only used while the page is at the top of the home route.
  const pillInPage = isHome && !scrolled;
  const showTabs = pillInPage || peeking;
  const openSegment = (segment: SearchSegment) =>
    setRequest((current) => ({ segment, token: (current?.token ?? 0) + 1 }));

  const menuTrigger = (
    <div className="flex items-center gap-2">
      {ready && user ? (
        <Avatar name={user.name} src={user.avatar} className="size-10 ring-1 ring-line" />
      ) : (
        <Skeleton className="size-10 rounded-full" />
      )}
      <button
        type="button"
        onClick={() => setMenuOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={menuOpen}
        aria-label="Account menu"
        className={cn(
          "relative flex size-10 items-center justify-center rounded-full border border-line bg-paper transition duration-150 hover:bg-surface hover:shadow-search active:scale-95",
          menuOpen && "bg-surface shadow-search",
        )}
      >
        <Menu className="size-[18px]" />
        {unreadMessages > 0 && (
          <span
            aria-label={`${unreadMessages} unread messages`}
            className="absolute -right-0.5 -top-0.5 size-3 rounded-full border-2 border-paper bg-brand"
          />
        )}
      </button>
    </div>
  );

  return (
    <>
      <header
        ref={ref}
        className={cn(
          "fixed inset-x-0 top-0 z-40 bg-canvas transition-shadow duration-200",
          peeking || scrolled || !isHome
            ? "shadow-[0_1px_0_#e6e6e6,0_6px_16px_rgb(0_0_0/0.04)]"
            : "shadow-[0_1px_0_transparent]",
        )}
      >
        {/* ---------- md+ : brand | tabs or capsule | host + account ---------- */}
        <div className="container-page hidden h-20 grid-cols-[1fr_auto_1fr] items-center gap-4 md:grid">
          <Link href="/" aria-label="airbnb — home" className="justify-self-start rounded-lg">
            <Logo />
          </Link>

          <div className="grid items-center justify-items-center [&>*]:[grid-area:1/1]">
            <div
              inert={!showTabs}
              className={cn(
                "transition-[opacity,transform] duration-200 ease-out",
                showTabs ? "opacity-100" : "pointer-events-none -translate-y-1 opacity-0",
              )}
            >
              <ProductTabs />
            </div>
            <div
              inert={showTabs}
              className={cn(
                "transition-[opacity,transform] duration-200 ease-out",
                showTabs ? "pointer-events-none translate-y-1 opacity-0" : "opacity-100",
              )}
            >
              <CompactCapsule onOpen={openSegment} />
            </div>
          </div>

          <div className="flex items-center justify-self-end">
            <Link
              href="/host"
              className="mr-2 hidden whitespace-nowrap rounded-full px-4 py-2.5 text-sm font-semibold transition-colors hover:bg-black/5 lg:block"
            >
              {isHost ? "Host dashboard" : "Become a host"}
            </Link>
            <Popover
              open={menuOpen}
              onClose={() => setMenuOpen(false)}
              align="right"
              panelClassName="w-[320px]"
              trigger={menuTrigger}
            >
              <AccountMenuContent onNavigate={() => setMenuOpen(false)} />
            </Popover>
          </div>
        </div>

        {/* drop-down search: the same SearchBar, opened from the capsule on any route */}
        {peeking && (
          <div className="hidden animate-drop-in border-t border-line bg-canvas pb-6 pt-2 shadow-[0_12px_24px_rgb(0_0_0/0.08)] md:block">
            <div className="container-page">
              <SearchBar request={request} />
            </div>
          </div>
        )}

        {/* ---------- phones: the search pill opens the search sheet ---------- */}
        <div className="px-4 pb-2.5 pt-3 md:hidden">
          <CompactSearch />
        </div>
      </header>

      {/* Reserves the bar's height; on the home page it also holds the big pill / phone tabs, which scroll away with the page. */}
      <div ref={regionRef} className="relative z-[35] bg-canvas">
        <div aria-hidden="true" className="h-[70px] md:h-20" />
        {isHome && (
          <>
            <div className="hdr-expander relative hidden md:block">
              <div
                inert={!pillInPage}
                className={cn("hdr-fade container-page absolute inset-x-0 bottom-6", !pillInPage && "pointer-events-none")}
              >
                <SearchBar />
              </div>
            </div>
            <div className="hdr-expander-sm relative flex items-end justify-center overflow-hidden px-4 md:hidden">
              <div inert={scrolled} className="hdr-fade">
                <ProductTabs compact />
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
