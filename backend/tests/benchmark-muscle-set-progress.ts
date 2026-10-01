// Run on a seeded local stack: cd backend && nix develop ../ --command bun tests/benchmark-muscle-set-progress.ts
export {};
// Observational latency check; machine/network timing must not gate the test suite.
const endpoint = "https://local.hasura.local.nhost.run/v1/graphql";
const user = "f26ac88d-4dcd-48e8-a0ae-b4248918bc1c";
const today = new Date().toISOString().slice(0, 10);
const query = `query($from: date!, $through: date!, $zone: String!) {
  muscleSetProgress(args: {from_day: $from, through_day: $through, time_zone: $zone}) {
    day muscleGroup directSets indirectSets weightedSets
    rollingDirectSets rollingIndirectSets rollingWeightedSets
  }
}`;

for (const days of [180, 366]) {
  const from = new Date(Date.parse(`${today}T00:00:00Z`) - (days - 1) * 86_400_000).toISOString().slice(0, 10);
  const durations: number[] = [];
  let rowCount = 0;
  for (let attempt = 0; attempt < 8; attempt++) {
    const start = performance.now();
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-hasura-admin-secret": "nhost-admin-secret",
        "x-hasura-role": "user",
        "x-hasura-user-id": user,
      },
      body: JSON.stringify({ query, variables: { from, through: today, zone: "UTC" } }),
    });
    const result = await response.json() as {
      data?: { muscleSetProgress: unknown[] };
      errors?: Array<{ message: string }>;
    };
    if (!response.ok || result.errors || !result.data?.muscleSetProgress?.length) {
      throw new Error(`Progress query failed (${response.status}): ${JSON.stringify(result.errors ?? result)}`);
    }
    rowCount = result.data.muscleSetProgress.length;
    if (attempt > 0) durations.push(performance.now() - start); // discard warm-up
  }
  durations.sort((a, b) => a - b);
  const median = durations[Math.floor(durations.length / 2)];
  const p95 = durations[Math.ceil(durations.length * 0.95) - 1];
  console.log(`${days}d UTC (${from}..${today}): ${rowCount} rows, median ${median.toFixed(1)} ms, p95 ${p95.toFixed(1)} ms (7 warm requests)`);
}
