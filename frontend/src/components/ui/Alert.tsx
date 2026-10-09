import { AlertCircle, CheckCircle2, Info } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

const TONES = {
  error: { box: "bg-danger-soft text-danger-ink", Icon: AlertCircle },
  success: { box: "bg-ok-soft text-ok-ink", Icon: CheckCircle2 },
  info: { box: "bg-surface text-ink", Icon: Info },
};

export function Alert({
  tone = "info",
  children,
  className,
}: {
  tone?: keyof typeof TONES;
  children: ReactNode;
  className?: string;
}) {
  const { box, Icon } = TONES[tone];
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={cn("flex items-start gap-3 rounded-2xl px-4 py-3 text-sm leading-snug", box, className)}
    >
      <Icon className="mt-0.5 size-4.5 shrink-0" aria-hidden="true" />
      <div>{children}</div>
    </div>
  );
}
