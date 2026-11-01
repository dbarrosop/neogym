// Mirrors the server reporting contract until charts read its computed fields.
// Single reps are measured 1RMs; Epley estimates 2+ rep sets using recorded weight.
export function estimateOneRepMax(weight: number, reps: number): number {
  if (weight <= 0 || reps <= 0) {
    return 0;
  }
  return reps === 1 ? weight : weight * (1 + reps / 30);
}
