import { cn } from "@/lib/cn";

/** Compact looped-pin brand mark (inline SVG, drawn for this educational clone). */
export const MARK_PATH =
  "M16 22.2c-2.5-3.1-4-5.5-4-7.5a4 4 0 0 1 8 0c0 2-1.5 4.400-4 7.500Zm0 0c3.200 4 5.600 6 8 6 2.900 0 4.700-2.600 4.200-5.300-.1-.9-.5-1.800-1-2.700L19.800 5.600C18.900 3.800 17.600 2.800 16 2.800s-2.900 1-3.800 2.800L4.800 20.200c-.5.900-.9 1.800-1 2.700-.5 2.700 1.300 5.300 4.200 5.300 2.400 0 4.800-2 8-6Z";

export function LogoMark({ className, strokeWidth = 2.4 }: { className?: string; strokeWidth?: number }) {
  return (
    <svg viewBox="0 0 32 32" className={className ?? "size-8"} fill="none" aria-hidden="true">
      <path d={MARK_PATH} stroke="currentColor" strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/**
 * The lowercase "airbnb" wordmark, drawn letter by letter as rounded, geometric strokes. The signature
 * detail is the single-storey `a` (a round bowl with a straight stem on the right), like the real logotype;
 * ordinary UI typefaces draw a double-storey `a`, so text can't reproduce it. Strokes use `currentColor`,
 * so it is crisp at any pixel density and works on light and dark surfaces.
 */
export function Wordmark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 85 24"
      className={cn("h-[26px] w-auto", className)}
      fill="none"
      stroke="currentColor"
      strokeWidth="3.3"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {/* a: bowl + right stem */}
      <circle cx="7.6" cy="13.1" r="5.6" />
      <path d="M13.2 7.4v11" />
      {/* i */}
      <path d="M19.4 7.4v11" />
      <circle cx="19.4" cy="2.6" r="1.9" fill="currentColor" stroke="none" />
      {/* r */}
      <path d="M25.6 7.4v11M25.6 14c0-4.100 2.500-6.500 6-6.500" />
      {/* b */}
      <path d="M37.2 1.6v16.800" />
      <circle cx="42.8" cy="13.1" r="5.6" />
      {/* n */}
      <path d="M54.6 7.4v11M54.600 14c0-4.200 2.400-6.600 5.700-6.600 3.300 0 5.200 2.200 5.200 5.700v5.300" />
      {/* b */}
      <path d="M72.1 1.600v16.800" />
      <circle cx="77.7" cy="13.1" r="5.6" />
    </svg>
  );
}

/** Pink pin mark + the "airbnb" wordmark. The wordmark is shown from the `lg` breakpoint up (below that only the mark fits next to the tabs). */
export function Logo({ className, wordmark = true }: { className?: string; wordmark?: boolean }) {
  return (
    <span className={cn("flex items-center gap-2 text-brand", className)}>
      <LogoMark />
      {wordmark && <Wordmark className="hidden lg:block" />}
      <span className="sr-only">airbnb</span>
    </span>
  );
}
