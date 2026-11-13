// Run in a subprocess so browser globals and module mocks cannot leak into other tests.
import { mock } from "bun:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { Window as TestWindow } from "happy-dom";
import { act, type ReactNode } from "react";

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

mock.module("@tanstack/react-router", () => ({
  Link: ({ children, className }: { children: ReactNode; className?: string }) => (
    <a href="/" className={className}>
      {children}
    </a>
  ),
  useNavigate: () => () => undefined,
}));
mock.module("@/lib/hooks/use-start-session", () => ({
  useStartSession: () => ({ isPending: false, mutate: () => undefined }),
}));
mock.module("@/components/storage-image", () => ({ AlternatingStorageImage: () => null }));
mock.module("@/lib/graphql", () => ({
  gqlRequest: () => {
    throw new Error("Exercise detail must render the seeded query data");
  },
}));

const { createRoot } = await import("react-dom/client");
const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
const { ResponsiveContainer } = await import("recharts");
const { BodyMetricsChart } = await import("@/components/body-metrics-chart");
const { ExerciseDetail } = await import("@/components/exercise-detail");

// Resolve rendered token references against both checked-in palettes.
const styles = readFileSync(new URL("../src/styles.css", import.meta.url), "utf8");
type RGB = [number, number, number];
const HEX_COLOR = /^#[\da-f]{6}$/i;
const LIGHT_PALETTE = /:root \{([^}]+)\}/;
const DARK_PALETTE = /\.dark \{([^}]+)\}/;
const COLOR_TOKEN = /^var\(--color-([\w-]+)\)$/;
const PALETTE_TOKEN = /--([\w-]+):\s*(#[\da-f]+);/g;
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
function palette(theme: "light" | "dark") {
  const block = styles.match(theme === "light" ? LIGHT_PALETTE : DARK_PALETTE)?.[1];
  assert(block);
  const tokens = new Map([...block.matchAll(PALETTE_TOKEN)].map((m) => [m[1], m[2]]));
  return (reference: string | null | undefined) => {
    const token = reference?.match(COLOR_TOKEN)?.[1] ?? reference;
    assert(token, "Missing colour reference");
    const hex = tokens.get(token);
    assert(hex, `Missing ${theme} ${token}`);
    return rgb(hex);
  };
}

const client = new QueryClient({
  defaultOptions: { queries: { retry: false, staleTime: Number.POSITIVE_INFINITY } },
});
const container = document.createElement("div");
document.body.append(container);
const root = createRoot(container);
async function settle(action: () => unknown = () => undefined) {
  await act(async () => {
    await action();
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
}
async function waitFor(condition: () => boolean, what: string) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    // biome-ignore lint/performance/noAwaitInLoops: Let real Recharts resolve dimensions and state.
    await settle();
    if (condition()) {
      return;
    }
  }
  throw new Error(`Timed out waiting for ${what}: ${container.textContent}`);
}
function all(selector: string) {
  return [...container.querySelectorAll(selector)];
}

async function checkBodyChart() {
  const points = [
    { date: Date.UTC(2026, 9, 1), weightKg: 82.4, bodyFatPct: null },
    { date: Date.UTC(2026, 9, 8), weightKg: 81.7, bodyFatPct: 18.2 },
    { date: Date.UTC(2026, 9, 15), weightKg: 80.9, bodyFatPct: 17.5 },
  ];
  await settle(() =>
    root.render(
      <ResponsiveContainer width={640} height={224}>
        <BodyMetricsChart points={points} />
      </ResponsiveContainer>,
    ),
  );
  await waitFor(() => all(".recharts-line-curve").length === 2, "body chart");
  assert(!container.innerHTML.includes("chart-2"), "Body chart must not draw orange lines or text");

  const lines = all(".recharts-line-curve").map((line) => line.getAttribute("stroke"));
  assert.deepEqual(lines, ["var(--color-chart-1)", "var(--color-chart-3)"]);
  const ticks = [
    ...new Set(all(".recharts-cartesian-axis-tick-value").map((tick) => tick.getAttribute("fill"))),
  ];
  assert(ticks.includes("var(--color-chart-3)"), "Body fat axis labels follow their series");
  const legend = all(".recharts-legend-item-text").map((item) => (item as HTMLElement).style.color);
  assert.equal(legend.length, 2);

  for (const theme of ["light", "dark"] as const) {
    const color = palette(theme);
    const card = color("card");
    for (const line of lines) {
      assert(contrast(color(line), card) >= 3, `${theme}: ${line} line contrast`);
    }
    for (const fill of ticks) {
      assert(contrast(color(fill), card) >= 4.5, `${theme}: ${fill} axis label contrast`);
    }
    for (const text of legend) {
      assert(contrast(color(text), card) >= 4.5, `${theme}: ${text} legend contrast`);
    }
    assert(contrast(color("popover-foreground"), color("popover")) >= 4.5);
  }

  const chart = container.querySelector('[role="application"]');
  assert(chart, "Keep Recharts keyboard access");
  await settle(() => chart.dispatchEvent(new window.FocusEvent("focusin", { bubbles: true })));
  await settle(() =>
    chart.dispatchEvent(new window.KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true })),
  );
  const tooltip = () => container.querySelector(".recharts-tooltip-wrapper")?.textContent ?? "";
  await waitFor(() => tooltip().includes("Body fat: "), "body tooltip");
  const rows = all(".recharts-tooltip-wrapper p.font-medium");
  assert.equal(rows.length, 2);
  for (const row of rows) {
    assert(row.classList.contains("text-popover-foreground"));
    assert.equal(row.getAttribute("style"), null, "Tooltip values use neutral text");
  }
}

async function checkExerciseProgress() {
  const session = (id: string, startedAt: string, weight: number) => ({
    id: `wse-${id}`,
    workoutSession: { id, startedAt, workout: null },
    workoutSessionStrengthSets: [1, 2, 3].map((setNumber) => ({
      id: `${id}-${setNumber}`,
      setNumber,
      reps: 5,
      weight: String(weight),
    })),
    workoutSessionCardioEntries: [],
  });
  client.setQueryData(["exercises", "detail", "bench"], {
    exercise: {
      id: "bench",
      name: "Bench press",
      instructions: [],
      image1FileId: null,
      image2FileId: null,
      level: "intermediate",
      category: "strength",
      kind: "strength",
      equipment: "barbell",
      primaryMuscleGroup: "chest",
      strength: { doubleWeight: false, force: "push", mechanic: "compound" },
      cardio: null,
      secondaryMuscleGroups: [],
      workoutSessionExercises: [
        session("s1", "2026-10-01T07:00:00Z", 80),
        session("s2", "2026-10-08T07:00:00Z", 85),
      ],
    },
  });
  await settle(() =>
    root.render(
      <QueryClientProvider client={client}>
        <ResponsiveContainer width={640} height={480}>
          <ExerciseDetail exerciseId="bench" />
        </ResponsiveContainer>
      </QueryClientProvider>,
    ),
  );
  await waitFor(() => all(".recharts-area-curve").length === 2, "exercise progress charts");

  const strokes = all(".recharts-area-curve").map((curve) => curve.getAttribute("stroke"));
  assert.deepEqual(strokes, ["var(--color-chart-1)", "var(--color-muted-foreground)"]);
  const oneRmStops = all("#progress-1rm stop").map((stop) => stop.getAttribute("stop-color"));
  assert.deepEqual(oneRmStops, ["var(--color-chart-2)", "var(--color-chart-2)"]);

  for (const theme of ["light", "dark"] as const) {
    const color = palette(theme);
    const surface = color("surface-inset");
    for (const stroke of strokes) {
      assert(contrast(color(stroke), surface) >= 3, `${theme}: ${stroke} trend line contrast`);
    }
  }
}

try {
  await checkBodyChart();
  await checkExerciseProgress();
} finally {
  act(() => root.unmount());
  client.clear();
  await dom.happyDOM.close();
}
console.info("Orange stays fill-only; Body and exercise trend lines and labels pass contrast.");
