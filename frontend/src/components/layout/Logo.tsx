import { cn } from "@/lib/cn";

/** Compact looped-pin brand mark (inline SVG, drawn for this educational clone). */
export const MARK_PATH =
  "M16 22.2c-2.5-3.1-4-5.5-4-7.5a4 4 0 0 1 8 0c0 2-1.5 4.400-4 7.500Zm0 0c3.200 4 5.600 6 8 6 2.900 0 4.700-2.600 4.200-5.300-.1-.9-.5-1.800-1-2.700L19.800 5.600C18.900 3.800 17.600 2.800 16 2.800s-2.900 1-3.800 2.800L4.800 20.200c-.5.900-.9 1.800-1 2.700-.5 2.700 1.300 5.300 4.200 5.300 2.400 0 4.800-2 8-6Z";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn("size-8", className)} fill="none" aria-hidden="true">
      <path d={MARK_PATH} stroke="currentColor" strokeWidth="2.4" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

/** Pink pin mark + the "airbnb" wordmark. */
export function Logo({ className, wordmark = true }: { className?: string; wordmark?: boolean }) {
  return (
    <span className={cn("flex items-center gap-1.5 text-brand", className)}>
      <LogoMark />
      {wordmark && (
        <span className="hidden text-[28px] font-extrabold leading-none tracking-[-0.04em] md:inline">
          airbnb
        </span>
      )}
    </span>
  );
}
