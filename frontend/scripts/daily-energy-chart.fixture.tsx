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
const { EnergyTrendSummary, averageOutLabel } = await import("@/components/daily-energy-chart");
const { buildEnergyTrend } = await import("@/lib/energy-trend");
const { formatChartDate } = await import("@/lib/metric-format");

const today = "2026-06-05";
// Nullable components: a missing value is no reading on the chart but counts
// as zero in "Average out", so resting + active = out.
const rows = [
  { energyOn: "2026-06-01", activeKcal: 350, restingKcal: "1800" },
  { energyOn: "2026-06-02", activeKcal: null, restingKcal: 1750 },
  { energyOn: "2026-06-03", activeKcal: "500", restingKcal: null },
  { energyOn: "2026-06-04", activeKcal: 10, restingKcal: 1850 },
  { energyOn: today, activeKcal: 230, restingKcal: 700 },
];
const domain = { start: "2026-06-01", end: today };
const trend = buildEnergyTrend(rows, { today, ...domain });

const container = document.createElement("div");
document.body.append(container);
const root = createRoot(container);

async function settle(action: () => unknown = () => undefined) {
  await act(async () => {
    await action();
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}
function all(selector: string) {
  return [...container.querySelectorAll(selector)];
}
function one(selector: string) {
  const result = container.querySelector(selector);
  assert(result, `Missing ${selector}`);
  return result;
}
function text(selector: string) {
  return all(selector).map((element) => element.textContent?.trim());
}

try {
  // The outer, fixed-size container supplies chart dimensions without a layout engine.
  await settle(() =>
    root.render(
      <ResponsiveContainer width={640} height={320}>
        <EnergyTrendSummary trend={trend} domain={domain} periodControl={null} />
      </ResponsiveContainer>,
    ),
  );
  for (let attempt = 0; attempt < 50 && !container.querySelector(".recharts-line-curve"); ) {
    attempt += 1;
    // biome-ignore lint/performance/noAwaitInLoops: Let Recharts resolve dimensions and state.
    await settle();
  }

  // "Average out" covers the four full days; today stays out.
  assert.equal(averageOutLabel(1), "Average out · 1 full day");
  assert.equal(averageOutLabel(0), "Average out");
  assert.deepEqual(text("dt"), ["Average out · 4 full days", "Resting", "Active"]);
  assert.deepEqual(text("dd"), ["1,565 kcal / day", "1,350 kcal", "215 kcal"]);

  // Two lines coloured by metric (active orange, resting blue): no area, no grey outline.
  assert.equal(container.querySelector(".recharts-area"), null, "Active energy is a line");
  const curves = all(".trend-chart-line-line .recharts-line-curve");
  assert.deepEqual(
    curves.map((curve) => [curve.getAttribute("stroke"), curve.getAttribute("stroke-width")]),
    [
      ["var(--color-chart-2)", "2.5"],
      ["var(--color-chart-1)", "2.5"],
    ],
  );
  assert(!container.innerHTML.includes("muted-foreground)"), "No neutral series outline");
  assert.equal(all("circle.trend-chart-dot-line").length, 6, "A dot on every full-day reading");
  assert(all("circle.trend-chart-dot-line").every((dot) => dot.getAttribute("r") === "3"));

  // Today's partial row: dashed segments to an open dot per series.
  const dashed = all(".trend-chart-partial .recharts-line-curve");
  assert.equal(dashed.length, 2);
  assert(dashed.every((curve) => curve.getAttribute("stroke-dasharray") === "3 3"));
  assert.deepEqual(
    all(".trend-chart-open-dot").map((dot) => [
      dot.getAttribute("stroke"),
      dot.getAttribute("fill"),
    ]),
    [
      ["var(--color-chart-2)", "var(--color-card)"],
      ["var(--color-chart-1)", "var(--color-card)"],
    ],
  );
  assert.equal(
    text("p").at(-1),
    "Today so far is the open dot after the dashed line.",
    "The partial-day caption shows while today has a row",
  );

  // The value axis starts at zero; the legend names both series with their units.
  assert.equal(text(".recharts-yAxis-tick-labels text")[0], "0");
  assert.equal(one("ul").textContent, "Active (kcal)Resting (kcal)");
  assert.deepEqual(
    all('ul [data-swatch="line"]').map((swatch) => (swatch as HTMLElement).style.backgroundColor),
    ["var(--color-chart-2)", "var(--color-chart-1)"],
  );

  // The spoken summary covers full days and ends with today so far.
  const chart = one('svg[role="application"]');
  const label = chart.getAttribute("aria-label") ?? "";
  const date = (iso: string) => formatChartDate(iso);
  assert(
    label.startsWith(
      `Active and resting energy per day, ${date("2026-06-01")} to ${date("2026-06-04")}. Active: lowest 10 kcal, highest 500 kcal`,
    ),
    label,
  );
  assert(label.endsWith("Today so far: Active 230 kcal, Resting 700 kcal."), label);

  // Keyboard tooltips list only the components a day has.
  await settle(() => chart.dispatchEvent(new window.FocusEvent("focusin", { bubbles: true })));
  const tooltip = () => one(".recharts-tooltip-wrapper").textContent ?? "";
  const expected = [
    ["Active350 kcal", "Resting1,800 kcal"],
    ["Resting1,750 kcal"],
    ["Active500 kcal"],
    ["Active10 kcal", "Resting1,850 kcal"],
    ["so far", "Active230 kcal", "Resting700 kcal"],
  ];
  for (const [index, parts] of expected.entries()) {
    if (index > 0) {
      // biome-ignore lint/performance/noAwaitInLoops: Walk the keyboard cursor in date order.
      await settle(() =>
        chart.dispatchEvent(
          new window.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
        ),
      );
    }
    for (const part of parts) {
      assert(tooltip().includes(part), `${index}: ${tooltip()}`);
    }
    assert.equal(
      tooltip().includes("Active"),
      parts.some((part) => part.startsWith("Active")),
    );
    assert.equal(
      tooltip().includes("Resting"),
      parts.some((part) => part.startsWith("Resting")),
    );
    for (const row of one(".recharts-tooltip-wrapper").querySelectorAll("p.font-medium")) {
      assert(row.classList.contains("text-popover-foreground"), "Tooltip values use neutral text");
    }
  }

  // Without a row today there is no partial point or caption.
  const past = buildEnergyTrend(rows.slice(0, 4), { today, ...domain });
  await settle(() =>
    root.render(
      <ResponsiveContainer width={640} height={320}>
        <EnergyTrendSummary trend={past} domain={domain} periodControl={null} />
      </ResponsiveContainer>,
    ),
  );
  assert.equal(all(".trend-chart-open-dot").length, 0);
  assert(!container.textContent?.includes("Today so far"));
} finally {
  act(() => root.unmount());
  await dom.happyDOM.close();
}
console.info(
  "Energy draws orange active and blue resting lines from zero with today's partial row dashed, full-day averages and nullable tooltips.",
);
