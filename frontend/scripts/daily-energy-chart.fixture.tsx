// Run in a subprocess so browser globals cannot leak into other tests.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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
const { DailyEnergyChart } = await import("@/components/daily-energy-chart");
const points = [
  { date: Date.UTC(2026, 5, 1), activeKcal: 350, restingKcal: 1800 },
  { date: Date.UTC(2026, 5, 2), activeKcal: null, restingKcal: 1750 },
  { date: Date.UTC(2026, 5, 3), activeKcal: 500, restingKcal: null },
  { date: Date.UTC(2026, 5, 4), activeKcal: 0, restingKcal: 1850 },
  { date: Date.UTC(2026, 5, 5), activeKcal: 2300, restingKcal: 1500 },
];
const container = document.createElement("div");
document.body.append(container);
const root = createRoot(container);

async function settle(action: () => unknown = () => undefined) {
  await act(async () => {
    await action();
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}
async function waitFor(condition: () => boolean) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    // biome-ignore lint/performance/noAwaitInLoops: Flush chart state between polls.
    await settle();
    if (condition()) {
      return;
    }
  }
  throw new Error(`Timed out waiting for energy chart: ${container.textContent}`);
}
function element(selector: string) {
  const result = container.querySelector(selector);
  assert(result, `Missing ${selector}`);
  return result;
}

// Resolve the chart's actual token references against both checked-in palettes.
const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
type RGB = [number, number, number];
const HEX_COLOR = /^#[\da-f]{6}$/i;
const LIGHT_PALETTE = /:root \{([^}]+)\}/;
const DARK_PALETTE = /\.dark \{([^}]+)\}/;
const COLOR_TOKEN = /^var\(--color-([\w-]+)\)$/;
function rgb(hex: string): RGB {
  assert.match(hex, HEX_COLOR);
  return [1, 3, 5].map((offset) => Number.parseInt(hex.slice(offset, offset + 2), 16) / 255) as RGB;
}
function luminance(color: RGB) {
  const [r, g, b] = color.map((v) => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  assert(r !== undefined && g !== undefined && b !== undefined);
  return r * 0.2126 + g * 0.7152 + b * 0.0722;
}
function contrast(a: RGB, b: RGB) {
  const values = [luminance(a), luminance(b)];
  return (Math.max(...values) + 0.05) / (Math.min(...values) + 0.05);
}
function checkContrast(theme: "light" | "dark") {
  const palette = styles.match(theme === "light" ? LIGHT_PALETTE : DARK_PALETTE)?.[1];
  assert(palette);
  const tokens = new Map(
    [...palette.matchAll(/--([\w-]+):\s*(#[\da-f]+);/g)].map((m) => [m[1], m[2]]),
  );
  function color(token: string) {
    const hex = tokens.get(token);
    assert(hex, `Missing ${theme} ${token}`);
    return rgb(hex);
  }
  function attributeColor(selector: string, attribute: string) {
    const token = element(selector).getAttribute(attribute)?.match(COLOR_TOKEN)?.[1];
    assert(token);
    return color(token);
  }
  const card = color("card");
  const activeFill = attributeColor(".recharts-area-area", "fill");
  const alpha = Number(element(".recharts-area-area").getAttribute("fill-opacity"));
  assert(alpha > 0 && alpha <= 1);
  const shaded = activeFill.map((v, index) => v * alpha + (card[index] ?? 0) * (1 - alpha)) as RGB;
  const outline = attributeColor(".recharts-area-curve", "stroke");
  const resting = attributeColor(".recharts-line-curve", "stroke");
  for (const background of [card, shaded]) {
    assert(contrast(outline, background) >= 3, `${theme}: active outline contrast`);
    assert(contrast(resting, background) >= 3, `${theme}: resting line contrast`);
  }
  const restingKeyToken = (element("li:last-child span") as HTMLElement).style.borderColor.match(
    COLOR_TOKEN,
  )?.[1];
  assert(restingKeyToken);
  assert(contrast(color(restingKeyToken), card) >= 3, `${theme}: resting legend key contrast`);
  assert(contrast(outline, card) >= 3, `${theme}: active legend border contrast`);
  assert(contrast(color("foreground"), card) >= 4.5, `${theme}: legend text contrast`);
  assert(
    contrast(color("popover-foreground"), color("popover")) >= 4.5,
    `${theme}: tooltip text contrast`,
  );
}

try {
  // The outer, fixed-size public container supplies chart dimensions without a layout engine.
  await settle(() =>
    root.render(
      <ResponsiveContainer width={640} height={224}>
        <DailyEnergyChart points={points} />
      </ResponsiveContainer>,
    ),
  );
  await waitFor(() => !!container.querySelector(".recharts-line-curve"));
  assert.equal(element(".recharts-area-area").getAttribute("fill"), "var(--color-chart-2)");
  assert.equal(
    element(".recharts-area-curve").getAttribute("stroke"),
    "var(--color-muted-foreground)",
  );
  assert.equal(element(".recharts-line-curve").getAttribute("stroke"), "var(--color-chart-1)");
  assert.equal(container.querySelectorAll(".recharts-line-curve").length, 1);
  assert(!element(".recharts-area-area").getAttribute("d")?.includes("NaN"));
  const legend = element(".recharts-legend-wrapper ul");
  assert(legend.classList.contains("text-foreground"));
  assert.equal(legend.textContent, "Active (kcal)Resting (kcal)");
  assert.equal(
    element("li:first-child span").getAttribute("style"),
    "background-color: var(--color-chart-2);",
  );
  assert(element("li:first-child span").classList.contains("border-muted-foreground"));
  assert.equal(
    (element("li:last-child span") as HTMLElement).style.borderColor,
    "var(--color-chart-1)",
  );

  for (const theme of ["light", "dark"] as const) {
    checkContrast(theme);
  }

  const chart = element('[role="application"]');
  await settle(() => chart.dispatchEvent(new window.FocusEvent("focusin", { bubbles: true })));
  await waitFor(
    () => element(".recharts-tooltip-wrapper").textContent?.includes("Active: 350 kcal") ?? false,
  );
  for (const [index, point] of points.entries()) {
    if (index > 0) {
      // biome-ignore lint/performance/noAwaitInLoops: Exercise keyboard navigation in date order.
      await settle(() =>
        chart.dispatchEvent(
          new window.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
        ),
      );
    }
    const tooltip = element(".recharts-tooltip-wrapper");
    assert.equal((tooltip as HTMLElement).style.visibility, "visible");
    assert(
      tooltip.textContent?.includes(
        new Date(point.date).toLocaleDateString(undefined, {
          weekday: "short",
          day: "numeric",
          month: "short",
          year: "numeric",
        }),
      ),
    );
    for (const [label, value] of [
      ["Active", point.activeKcal],
      ["Resting", point.restingKcal],
    ] as const) {
      assert.equal(tooltip.textContent?.includes(`${label}: `), value !== null);
      if (value !== null) {
        assert(tooltip.textContent?.includes(`${label}: ${value.toFixed(0)} kcal`));
      }
    }
    for (const row of tooltip.querySelectorAll("p.font-medium")) {
      assert(row.classList.contains("text-popover-foreground"));
      assert.equal(row.getAttribute("style"), null, "Tooltip values must not use orange text");
    }
  }
} finally {
  act(() => root.unmount());
  await dom.happyDOM.close();
}
console.info(
  "Energy uses an orange active fill and accent resting line with legible labels and nullable tooltips.",
);
