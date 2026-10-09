import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  actions?: ReactNode;
  className?: string;
}

export function EmptyState({ icon: Icon, title, description, actions, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "mx-auto flex max-w-md animate-fade-in flex-col items-center px-4 py-16 text-center",
        className,
      )}
    >
      <div className="mb-5 flex size-20 items-center justify-center rounded-full bg-surface">
        <Icon className="size-9 text-ink/70" strokeWidth={1.5} aria-hidden="true" />
      </div>
      <h2 className="text-xl font-semibold">{title}</h2>
      <p className="mt-2 text-[15px] leading-relaxed text-muted">{description}</p>
      {actions && <div className="mt-6 flex flex-wrap justify-center gap-3">{actions}</div>}
    </div>
  );
}
