import {
  type ChartColor,
  chartColor,
  type TrendSeriesStyle,
} from "@/components/charts/trend-chart-model";
import { cn } from "@/lib/utils";

/**
 * A legend key drawn like its series: a 16 × 3 line for lines and averages;
 * daily readings add a dot on a half-opacity line.
 */
export function ChartSwatch({
  color,
  style = "line",
  className,
}: {
  color: ChartColor;
  style?: TrendSeriesStyle;
  className?: string;
}) {
  const fill = chartColor(color);
  if (style === "daily") {
    return (
      <span
        aria-hidden="true"
        data-swatch="daily"
        className={cn("relative inline-block h-2 w-4 flex-none", className)}
      >
        <span
          className="absolute inset-x-0 top-[3px] h-0.5 opacity-50"
          style={{ backgroundColor: fill }}
        />
        <span
          className="absolute top-px left-[5px] size-1.5 rounded-full"
          style={{ backgroundColor: fill }}
        />
      </span>
    );
  }
  return (
    <span
      aria-hidden="true"
      data-swatch="line"
      className={cn("inline-block h-[3px] w-4 flex-none rounded-[2px]", className)}
      style={{ backgroundColor: fill }}
    />
  );
}

export interface ChartLegendItem {
  label: string;
  color: ChartColor;
  style?: TrendSeriesStyle;
}

/** The legend under a chart: one swatch per series, 13 px secondary text. */
export function ChartLegend({
  items,
  className,
}: {
  items: ChartLegendItem[];
  className?: string;
}) {
  if (items.length === 0) {
    return null;
  }
  return (
    <ul
      className={cn(
        "m-0 flex list-none flex-wrap gap-4 p-0 text-[13px] text-muted-foreground",
        className,
      )}
    >
      {items.map((item) => (
        <li
          key={`${item.color}-${item.style ?? "line"}-${item.label}`}
          className="inline-flex items-center gap-1.5"
        >
          <ChartSwatch color={item.color} style={item.style ?? "line"} />
          {item.label}
        </li>
      ))}
    </ul>
  );
}
