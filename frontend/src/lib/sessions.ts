// Display name for a session: the workout name if attached, otherwise the
// first exercise's name (with "+N more" if it had multiple ad-hoc exercises).
export function sessionDisplayName(opts: {
  workoutName?: string | null | undefined;
  exerciseNames: string[];
}): string {
  if (opts.workoutName) {
    return opts.workoutName;
  }
  if (opts.exerciseNames.length === 0) {
    return "Untitled session";
  }
  const first = opts.exerciseNames[0] ?? "Untitled session";
  if (opts.exerciseNames.length === 1) {
    return first;
  }
  return `${first} +${opts.exerciseNames.length - 1} more`;
}
