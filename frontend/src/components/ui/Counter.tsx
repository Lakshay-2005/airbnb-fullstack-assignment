import { Minus, Plus } from "lucide-react";

interface CounterProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  label: string;
}

export function Counter({ value, onChange, min = 0, max = 99, label }: CounterProps) {
  const btn =
    "flex size-8 items-center justify-center rounded-full border border-faint text-ink transition hover:border-ink disabled:cursor-not-allowed disabled:border-line disabled:text-faint disabled:hover:border-line";
  return (
    <div className="flex items-center gap-4">
      <button
        type="button"
        className={btn}
        disabled={value <= min}
        onClick={() => onChange(value - 1)}
        aria-label={`Decrease ${label}`}
      >
        <Minus className="size-4" />
      </button>
      <span className="w-6 text-center text-[15px] tabular-nums" aria-live="polite">
        {value}
      </span>
      <button
        type="button"
        className={btn}
        disabled={value >= max}
        onClick={() => onChange(value + 1)}
        aria-label={`Increase ${label}`}
      >
        <Plus className="size-4" />
      </button>
    </div>
  );
}
