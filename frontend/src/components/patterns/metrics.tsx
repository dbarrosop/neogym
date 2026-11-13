import { Link, type LinkProps } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** A titled content card with an optional "see more" link in the header. */
export function SectionCard({
  title,
  link,
  children,
  className,
  "aria-label": ariaLabel,
}: {
  title: ReactNode;
  link?: { label: string; to: NonNullable<LinkProps["to"]>; params?: LinkProps["params"] };
  children: ReactNode;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <section
      aria-label={ariaLabel}
      className={cn("flex min-w-0 flex-col gap-4 rounded-xl border bg-card p-5", className)}
    >
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-semibold">{title}</h2>
        {link ? (
          <Link
            to={link.to}
            params={link.params as never}
            className="text-sm font-medium text-link hover:underline"
          >
            {link.label}
          </Link>
        ) : null}
      </div>
      {children}
    </section>
  );
}

export function StatTile({
  label,
  value,
  hint,
  className,
}: {
  label: ReactNode;
  value: ReactNode;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-w-0 flex-col gap-0.5 rounded-lg bg-surface-inset p-3", className)}>
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <strong className="truncate text-lg font-semibold tabular-nums">{value}</strong>
      {hint ? <span className="text-xs text-muted-foreground">{hint}</span> : null}
    </div>
  );
}

const TONE_CLASS = {
  accent: "bg-primary",
  orange: "bg-chart-2",
  neutral: "bg-chart-3",
} as const;

/** Labelled horizontal meter (e.g. protein eaten vs planned). */
export function MeterBar({
  label,
  value,
  max,
  valueLabel,
  tone = "accent",
}: {
  label: ReactNode;
  value: number;
  max: number | null;
  valueLabel: ReactNode;
  tone?: keyof typeof TONE_CLASS;
}) {
  const percent = max && max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[13px] text-muted-foreground">{label}</span>
        <span className="text-[13px] font-semibold tabular-nums">{valueLabel}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className={cn("h-full rounded-full", TONE_CLASS[tone])}
          style={{ width: `${percent}%` }}
        />
      </div>
    </div>
  );
}

/** Circular progress (e.g. kcal eaten vs planned). */
export function RingMeter({
  value,
  max,
  label,
  center,
  size = 112,
}: {
  value: number;
  max: number | null;
  label: string;
  center: ReactNode;
  size?: number;
}) {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const ratio = max && max > 0 ? Math.min(1, Math.max(0, value / max)) : 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox="0 0 104 104" role="img" aria-label={label}>
        <circle cx="52" cy="52" r={radius} fill="none" stroke="var(--muted)" strokeWidth="10" />
        <circle
          cx="52"
          cy="52"
          r={radius}
          fill="none"
          stroke="var(--primary)"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${ratio * circumference} ${circumference}`}
          transform="rotate(-90 52 52)"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">{center}</div>
    </div>
  );
}

/** Minimal trend line; values are plotted left to right in order. */
export function Sparkline({
  values,
  label,
  className,
}: {
  values: number[];
  label: string;
  className?: string;
}) {
  if (values.length < 2) {
    return null;
  }
  const width = 160;
  const height = 48;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const points = values
    .map((value, index) => {
      const x = 2 + (index * (width - 4)) / (values.length - 1);
      const y = height - 4 - ((value - min) / range) * (height - 8);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      width={width}
      height={height}
      role="img"
      aria-label={label}
      className={className}
    >
      <polyline
        points={points}
        fill="none"
        stroke="var(--chart-1)"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
