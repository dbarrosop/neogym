interface TrendPoint {
  value: number | null;
  /** Optional timestamp in milliseconds, displayed in the user's local calendar. */
  date?: number;
}

const numberFormat = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

/** Describe the endpoint change, not a fitted trend. Points follow the chart's plotted order. */
export function describeTrend(
  points: readonly TrendPoint[],
  { label, unit }: { label: string; unit: string },
): string {
  const observed = points.filter(
    (point): point is TrendPoint & { value: number } =>
      point.value !== null &&
      Number.isFinite(point.value) &&
      (point.date === undefined || Number.isFinite(point.date)),
  );
  const first = observed[0];
  const last = observed.at(-1);
  if (!first || !last) {
    return `${label}: no observations in this period.`;
  }
  const formatPoint = (point: TrendPoint & { value: number }) => {
    const value = `${numberFormat.format(point.value)} ${unit}`;
    return point.date === undefined
      ? value
      : `${value} on ${new Date(point.date).toLocaleDateString(undefined, {
          day: "numeric",
          month: "short",
          year: "numeric",
        })}`;
  };
  if (observed.length === 1) {
    return `${label}: ${formatPoint(first)}; one observation, no trend yet.`;
  }
  const change = Number((last.value - first.value).toFixed(2));
  let direction = "unchanged overall";
  if (change !== 0) {
    direction = `${change > 0 ? "up" : "down"} ${numberFormat.format(Math.abs(change))} ${unit} overall`;
  } else if (last.value !== first.value) {
    direction = "no change at displayed precision";
  }
  return `${label}: ${formatPoint(first)} to ${formatPoint(last)}; ${direction} across ${observed.length} observations.`;
}
