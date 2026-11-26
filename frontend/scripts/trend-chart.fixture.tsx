// Run in a subprocess so browser globals cannot leak into other tests.
import assert from "node:assert/strict";
import { Window as TestWindow } from "happy-dom";
import { act } from "react";

const dom = new TestWindow({ url: "http://localhost" });
const window = dom as unknown as typeof globalThis.window;
Object.assign(globalThis, {
  window,
  document: window.document,
  navigator: window.navigator,
  HTMLElement: window.HTMLElement,
  Node: window.Node,
  ResizeObserver: window.ResizeObserver,
  requestAnimationFrame: window.requestAnimationFrame.bind(window),
  cancelAnimationFrame: window.cancelAnimationFrame.bind(window),
  IS_REACT_ACT_ENVIRONMENT: true,
});

const { createRoot } = await import("react-dom/client");
const { ResponsiveContainer } = await import("recharts");
const { TrendChart } = await import("@/components/charts/trend-chart");
type TrendChartProps = import("@/components/charts/trend-chart").TrendChartProps;
const { metricFormat } = await import("@/lib/metric-format");

const container = document.createElement("div");
document.body.append(container);
const root = createRoot(container);
const locale = "en-GB";

async function settle(action: () => unknown = () => undefined) {
  await act(async () => {
    await action();
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}
async function render(props: TrendChartProps) {
  await settle(() =>
    root.render(
      <ResponsiveContainer width={640} height={240}>
        <TrendChart key={props.title} {...props} />
      </ResponsiveContainer>,
    ),
  );
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (container.querySelector(".recharts-line-curve")) {
      return;
    }
    // biome-ignore lint/performance/noAwaitInLoops: Let Recharts resolve dimensions and state.
    await settle();
  }
  throw new Error(`Timed out waiting for the chart: ${container.innerHTML.slice(0, 400)}`);
}
function all(selector: string) {
  return [...container.querySelectorAll(selector)];
}
function one(selector: string) {
  const element = container.querySelector(selector);
  assert(element, `Missing ${selector}`);
  return element;
}
/** The [x, y] vertices of a Recharts line path ("M1,2L3,4…"). */
function vertices(path: Element) {
  const d = path.getAttribute("d") ?? "";
  return [...d.matchAll(/(-?[\d.]+),(-?[\d.]+)/g)].map((match) => [
    Number(match[1]),
    Number(match[2]),
  ]);
}
function layer(style: string) {
  return one(`.trend-chart-line-${style}`);
}
const day = (value: number) => `2026-11-${String(value).padStart(2, "0")}`;

try {
  // 1. Consumed: daily readings under the 7-day average, today partial.
  const consumed = [
    { date: day(6), value: 2_140 },
    { date: day(7), value: 2_584 },
    // 8 and 9 November: nothing logged; the lines join across them.
    { date: day(10), value: 2_310 },
    { date: day(11), value: 2_386 },
  ];
  const average = [
    { date: day(6), value: 2_140 },
    { date: day(7), value: 2_362 },
    { date: day(10), value: 2_345 },
    { date: day(11), value: 2_355 },
  ];
  await render({
    title: "Calories consumed per day and 7-day average",
    domain: { start: day(6), end: day(12) },
    locale,
    series: [
      {
        id: "daily",
        name: "Daily",
        color: "chart-1",
        style: "daily",
        points: [...consumed, { date: day(12), value: 1_461, partial: true }],
        format: metricFormat.kcal,
      },
      {
        id: "avg",
        name: "7-day avg",
        color: "chart-1",
        style: "average",
        points: average,
        format: metricFormat.kcal,
      },
    ],
  });
  const chart = one('svg[role="application"]');
  assert.equal(
    chart.getAttribute("aria-label"),
    "Calories consumed per day and 7-day average, 6 Nov to 11 Nov. Daily: lowest 2,140 kcal, " +
      "highest 2,584 kcal, average 2,355 kcal, latest 2,386 kcal on 11 Nov. 7-day avg: lowest " +
      "2,140 kcal, highest 2,362 kcal, latest 2,355 kcal on 11 Nov. Today so far: 1,461 kcal.",
  );
  assert.equal(chart.getAttribute("tabindex"), "0", "Keep Recharts keyboard accessibility");
  assert.equal(chart.closest('[role="img"]'), null, "Do not hide the interactive SVG");

  const dailyCurve = layer("daily").querySelector(".recharts-line-curve");
  assert(dailyCurve);
  assert.equal(dailyCurve.getAttribute("stroke"), "var(--color-chart-1)");
  assert.equal(dailyCurve.getAttribute("stroke-width"), "1.5");
  assert.equal(dailyCurve.getAttribute("stroke-opacity"), "0.5");
  const dailyDots = all("circle.trend-chart-dot-daily");
  assert.equal(dailyDots.length, consumed.length, "A dot on every complete reading");
  for (const dot of dailyDots) {
    assert.equal(dot.getAttribute("r"), "2.5");
    assert.equal(dot.getAttribute("fill"), "var(--color-chart-1)");
  }
  // Missing days are joined: one straight path through every reading.
  assert.equal(vertices(dailyCurve).length, consumed.length);

  const averageCurve = layer("average").querySelector(".recharts-line-curve");
  assert(averageCurve);
  assert.equal(averageCurve.getAttribute("stroke-width"), "2.5");
  assert.equal(all("circle.trend-chart-dot-average").length, 0);

  const partialCurve = one(".trend-chart-partial .recharts-line-curve");
  assert.equal(partialCurve.getAttribute("stroke-dasharray"), "3 3");
  assert.equal(partialCurve.getAttribute("stroke-width"), "1.5");
  assert.equal(partialCurve.getAttribute("stroke-opacity"), "0.7");
  const openDots = all(".trend-chart-open-dot");
  assert.equal(openDots.length, 1, "One open dot for today");
  const openDot = openDots[0];
  assert(openDot);
  assert.equal(openDot.getAttribute("fill"), "var(--color-card)");
  assert.equal(openDot.getAttribute("stroke"), "var(--color-chart-1)");
  const openX = Number(openDot.getAttribute("cx"));
  const [dashStart, dashEnd] = vertices(partialCurve);
  const lastDaily = vertices(dailyCurve).at(-1);
  assert.deepEqual(dashStart, lastDaily, "The dashed segment starts at the last full day");
  assert.equal(dashEnd?.[0], openX);
  const averageEnd = vertices(averageCurve).at(-1)?.[0] ?? Number.POSITIVE_INFINITY;
  assert(averageEnd < openX, "The 7-day average stops before the partial day");

  const ticks = all(".recharts-yAxis-tick-labels text").map((tick) => tick.textContent);
  assert.deepEqual(ticks, ["1,000", "2,000", "3,000"], "Rounded labels include today");
  const dates = all(".recharts-xAxis-tick-labels text").map((text) => text.textContent);
  assert.deepEqual(dates, ["6 Nov", "9 Nov", "12 Nov"]);
  assert.equal(
    container.querySelector("ul")?.textContent,
    "Daily7-day avg",
    "Legend: Daily / 7-day avg",
  );
  assert.equal(all('[data-swatch="daily"]').length, 1);

  await settle(() => chart.dispatchEvent(new window.FocusEvent("focusin", { bubbles: true })));
  const tooltip = one(".recharts-tooltip-wrapper") as HTMLElement;
  assert.equal(tooltip.style.visibility, "visible");
  assert(tooltip.textContent?.includes("Fri 6 Nov"), tooltip.textContent ?? "");
  assert(tooltip.textContent?.includes("Daily2,140 kcal"), tooltip.textContent ?? "");
  for (let step = 0; step < 4; step += 1) {
    // biome-ignore lint/performance/noAwaitInLoops: Walk the keyboard cursor to today.
    await settle(() =>
      chart.dispatchEvent(
        new window.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
      ),
    );
  }
  assert(tooltip.textContent?.includes("Thu 12 Nov · so far"), tooltip.textContent ?? "");
  assert(tooltip.textContent?.includes("Daily1,461 kcal"), tooltip.textContent ?? "");

  // 2. Net: orange by metric, zero kept, one series reads inline.
  await render({
    title: "Net calories per day",
    locale,
    axes: { left: { includeZero: true } },
    series: [
      {
        id: "net",
        name: "Net",
        color: "chart-2",
        points: [
          { date: day(9), value: -500 },
          { date: day(10), value: -200 },
          { date: day(11), value: -600 },
        ],
        format: metricFormat.netKcal,
      },
    ],
  });
  assert.equal(
    one(".trend-chart-line-line .recharts-line-curve").getAttribute("stroke"),
    "var(--color-chart-2)",
  );
  assert.equal(all(".trend-chart-open-dot").length, 0);
  assert.deepEqual(
    all(".recharts-yAxis-tick-labels text").map((tick) => tick.textContent),
    ["−1,000", "−500", "0"],
  );
  assert.equal(
    one('svg[role="application"]').getAttribute("aria-label"),
    "Net calories per day, 9 Nov to 11 Nov: lowest −600 kcal, highest −200 kcal, " +
      "average −433 kcal, latest −600 kcal on 11 Nov.",
  );

  // 3. Exercise volume and Est. 1RM on start-aligned left and right axes.
  const sessions = ["2026-10-08", "2026-10-15", "2026-10-22", "2026-10-29", "2026-11-05", day(12)];
  const volume = [3_500, 3_000, 2_800, 3_100, 4_000, 2_660];
  const estimate = [166.7, 169, 173.3, 175.5, 180, 172.7];
  await render({
    title: "Romanian Deadlift volume and estimated one-rep max",
    period: "session",
    xScale: "index",
    locale,
    height: 220,
    series: [
      {
        id: "volume",
        name: "Volume",
        legendLabel: "Volume (kg)",
        color: "chart-1",
        points: sessions.map((date, index) => ({ date, value: volume[index] ?? 0 })),
        format: metricFormat.volume,
      },
      {
        id: "e1rm",
        name: "Est. 1RM",
        legendLabel: "Est. 1RM (kg)",
        color: "chart-2",
        axis: "right",
        points: sessions.map((date, index) => ({ date, value: estimate[index] ?? 0 })),
        format: metricFormat.estimatedOneRepMax,
      },
    ],
  });
  const curves = all(".trend-chart-line-line .recharts-line-curve");
  assert.deepEqual(
    curves.map((curve) => curve.getAttribute("stroke")),
    ["var(--color-chart-1)", "var(--color-chart-2)"],
  );
  const [volumeStart, estimateStart] = curves.map((curve) => vertices(curve)[0]);
  assert(volumeStart && estimateStart);
  assert(Math.abs((volumeStart[1] ?? 0) - (estimateStart[1] ?? 0)) < 0.01, "Both start level");
  assert.equal(all(".recharts-yAxis-tick-labels").length, 2, "Left and right labels");
  const labels = one('svg[role="application"]').getAttribute("aria-label") ?? "";
  assert(
    labels.endsWith(
      "Volume on the left axis, Est. 1RM on the right; both lines start at the same height.",
    ),
    labels,
  );
  assert.equal(container.querySelector("ul")?.textContent, "Volume (kg)Est. 1RM (kg)");
  assert.deepEqual(
    all(".recharts-xAxis-tick-labels text").map((text) => text.textContent),
    ["8 Oct", "22 Oct", "12 Nov"],
  );

  // Two observations on one date get two keyboard stops and their own readings.
  await render({
    title: "Same-day session volumes",
    period: "session",
    xScale: "index",
    locale,
    series: [
      {
        id: "volume",
        name: "Volume",
        color: "chart-1",
        points: [
          {
            date: day(12),
            value: 200,
            session: { id: "later", startedAt: new Date(2026, 10, 12, 16).getTime() },
          },
          {
            date: day(12),
            value: 100,
            session: { id: "earlier", startedAt: new Date(2026, 10, 12, 8).getTime() },
          },
        ],
        format: metricFormat.volume,
      },
    ],
  });
  const sameDay = one('svg[role="application"]');
  const dots = all("circle.trend-chart-dot-line");
  assert.equal(dots.length, 2);
  assert.notEqual(dots[0]?.getAttribute("cx"), dots[1]?.getAttribute("cx"));
  await settle(() => sameDay.dispatchEvent(new window.FocusEvent("focusin", { bubbles: true })));
  const sameDayTooltip = one(".recharts-tooltip-wrapper");
  assert(
    sameDayTooltip.textContent?.includes("Thu 12 Nov · 08:00"),
    sameDayTooltip.textContent ?? "Missing same-day tooltip",
  );
  assert(sameDayTooltip.textContent?.includes("Volume100 kg"));
  assert(!sameDayTooltip.textContent?.includes("Volume200 kg"));
  await settle(() =>
    sameDay.dispatchEvent(
      new window.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    ),
  );
  assert(sameDayTooltip.textContent?.includes("Thu 12 Nov · 16:00"));
  assert(sameDayTooltip.textContent?.includes("Volume200 kg"));

  // 4. Weekly volume, dense daily history and baseline-only minis.
  const dense = Array.from({ length: 40 }, (_, index) => ({
    date: new Date(Date.UTC(2026, 9, 1 + index)).toISOString().slice(0, 10),
    value: 8 + (index % 4),
  }));
  await render({
    title: "Side delts weighted sets",
    yAxis: "baseline",
    xTicks: "none",
    legend: false,
    axes: { left: { includeZero: true } },
    locale,
    series: [
      { id: "sets", name: "Sets", color: "chart-1", points: dense, format: metricFormat.sets },
    ],
  });
  const denseDots = all("circle.trend-chart-dot-line");
  assert.equal(denseDots.length, 40);
  assert(
    denseDots.every((dot) => dot.getAttribute("r") === "1.8"),
    "Smaller dots past 31",
  );
  assert.equal(all(".recharts-yAxis-tick-labels text").length, 0);
  assert.equal(all(".recharts-cartesian-grid-horizontal line").length, 1, "Baseline only");
  assert.equal(container.querySelector("ul"), null);
} finally {
  act(() => root.unmount());
  await dom.happyDOM.close();
}
console.info(
  "Trend charts colour by metric, dot every reading, dash the partial period to an open dot, align dual axes and speak their summaries.",
);
