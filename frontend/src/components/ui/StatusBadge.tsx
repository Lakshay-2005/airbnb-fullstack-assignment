import { cn } from "@/lib/cn";
import type { BookingStatus, ListingStatus, PaymentStatus } from "@/lib/api";

const TONES = {
  green: "bg-ok-soft text-ok-ink",
  amber: "bg-amber-soft text-amber-ink",
  red: "bg-danger-soft text-danger",
  gray: "bg-surface text-ink/80",
  blue: "bg-blue-soft text-blue-ink",
};

const LABELS: Record<string, { label: string; tone: keyof typeof TONES }> = {
  PENDING: { label: "Awaiting payment", tone: "amber" },
  CONFIRMED: { label: "Confirmed", tone: "green" },
  CANCELLED: { label: "Cancelled", tone: "red" },
  COMPLETED: { label: "Completed", tone: "gray" },
  SUCCESS: { label: "Paid", tone: "green" },
  FAILED: { label: "Payment failed", tone: "red" },
  REFUNDED: { label: "Refunded", tone: "blue" },
  ACTIVE: { label: "Active", tone: "green" },
  PAUSED: { label: "Paused", tone: "amber" },
};

export function StatusBadge({
  status,
  className,
  label,
}: {
  status: BookingStatus | PaymentStatus | ListingStatus;
  className?: string;
  label?: string;
}) {
  const meta = LABELS[status] ?? { label: status, tone: "gray" as const };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold",
        TONES[meta.tone],
        className,
      )}
    >
      {label ?? meta.label}
    </span>
  );
}
