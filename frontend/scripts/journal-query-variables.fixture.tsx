import { mock } from "bun:test";
import assert from "node:assert/strict";
import { Window } from "happy-dom";
import { act } from "react";

const dom = new Window({ url: "http://localhost" });
Object.assign(globalThis, {
  window: dom,
  document: dom.document,
  navigator: dom.navigator,
  IS_REACT_ACT_ENVIRONMENT: true,
});
const requests: Record<string, unknown>[] = [];
mock.module("@/lib/graphql", () => ({
  gqlRequest: (_document: unknown, variables: Record<string, unknown>) => {
    requests.push(variables);
    return Promise.resolve({ journalEntries: [] });
  },
}));
const { createRoot } = await import("react-dom/client");
const { QueryClient, QueryClientProvider } = await import("@tanstack/react-query");
const { useJournalEntries } = await import("@/lib/hooks/use-journal-index");
const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
const container = document.createElement("div");
document.body.append(container);
const root = createRoot(container);
function Probe({ labels }: { labels: string[] }) {
  const result = useJournalEntries(labels);
  return <p>{result.status}</p>;
}
async function load(labels: string[]) {
  await act(async () => {
    root.render(
      <QueryClientProvider client={client}>
        <Probe labels={labels} />
      </QueryClientProvider>,
    );
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 20));
  });
  assert.equal(container.textContent, "success");
}
await load([]);
assert.deepEqual(requests[0], { limit: 25, offset: 0, where: {} });
await load(["training", "recovery"]);
assert.deepEqual(requests[1]?.["where"], {
  _and: [
    { journalEntryLabels: { labelId: { _eq: "training" } } },
    { journalEntryLabels: { labelId: { _eq: "recovery" } } },
  ],
});
await act(async () => root.unmount());
client.clear();
dom.happyDOM.abort();
process.stdout.write(
  "Journal queries send explicit match-all filters and preserve AND label semantics.\n",
);
