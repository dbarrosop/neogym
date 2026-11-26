import { Loader2, Trash2 } from "lucide-react";
import { type SubmitEvent, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  buildZodSchemaFromMetricsSchema,
  type CardioFieldState,
  type CardioMetricSpec,
  type CardioMetrics,
  type CardioMetricsSchema,
  durationInputNotation,
  iterateMetrics,
  orderMetricsForForm,
  parseField,
  seedFieldStates,
} from "@/lib/cardio-schema";

type CollectResult = { ok: true; out: CardioMetrics } | { ok: false; key: string; message: string };

// Walk the specs in order, parse each field via parseField, and either return
// a clean CardioMetrics object or the first failing field. Pulled out of
// handleSubmit so the submit handler stays under biome's cognitive-complexity
// budget.
function collectMetrics(
  specs: readonly CardioMetricSpec[],
  values: Record<string, CardioFieldState>,
): CollectResult {
  const out: CardioMetrics = {};
  for (const spec of specs) {
    const parsed = parseField(spec, values[spec.key]);
    if (parsed === "invalid") {
      return { ok: false, key: spec.key, message: `${spec.label} is invalid` };
    }
    if (parsed === "empty") {
      if (spec.required) {
        return { ok: false, key: spec.key, message: `${spec.label} is required` };
      }
      continue;
    }
    out[spec.key] = parsed;
  }
  return { ok: true, out };
}

interface CardioMetricsFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "add" | "edit";
  schema: CardioMetricsSchema;
  exerciseName: string;
  nextEntryNumber: number;
  editingEntryNumber: number | null;
  initialMetrics: CardioMetrics | null;
  previousMetrics: CardioMetrics | null;
  isPending: boolean;
  onSubmit: (metrics: CardioMetrics) => void;
  onDelete?: () => void;
}

export function CardioMetricsForm({
  open,
  onOpenChange,
  mode,
  schema,
  exerciseName,
  nextEntryNumber,
  editingEntryNumber,
  initialMetrics,
  previousMetrics,
  isPending,
  onSubmit,
  onDelete,
}: CardioMetricsFormProps) {
  // Required fields come first in the dialog; the stored shape is unchanged.
  const specs = useMemo(() => orderMetricsForForm(iterateMetrics(schema)), [schema]);
  const zod = useMemo(() => buildZodSchemaFromMetricsSchema(schema), [schema]);
  const firstInputRef = useRef<HTMLInputElement | null>(null);
  const [values, setValues] = useState<Record<string, CardioFieldState>>({});
  // Marks the field that failed the most recent submit so MetricInput can paint
  // aria-invalid + the Input's red border. Cleared the moment the user edits
  // any field — once they start correcting, the negative-state cue is stale.
  const [invalidKey, setInvalidKey] = useState<string | null>(null);
  const wasOpenRef = useRef(false);
  const submitLabel = mode === "edit" ? "Save" : "Add entry";

  // Seed only on the false→true edge of `open`. A reference change in
  // initialMetrics/previousMetrics while the dialog is open (e.g., react-query
  // refetch on PWA resume) must not reseed — that would wipe whatever the user
  // is typing.
  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setValues(seedFieldStates(specs, initialMetrics ?? previousMetrics ?? null));
      setInvalidKey(null);
      requestAnimationFrame(() => firstInputRef.current?.select());
    }
    wasOpenRef.current = open;
  }, [open, initialMetrics, previousMetrics, specs]);

  function focusInvalid(key: string) {
    setInvalidKey(key);
    requestAnimationFrame(() => {
      document.getElementById(`metric-${key}`)?.focus();
    });
  }

  function handleSubmit(e: SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    if (isPending) {
      return;
    }
    const collected = collectMetrics(specs, values);
    if (!collected.ok) {
      toast.error(collected.message);
      focusInvalid(collected.key);
      return;
    }
    const out = collected.out;
    const result = zod.safeParse(out);
    if (!result.success) {
      const first = result.error.issues[0];
      toast.error(first ? `${first.path.join(".")}: ${first.message}` : "Validation failed");
      // Zod's issue.path[0] is the failing spec key when validation runs
      // against the flat metrics object — same shape `parseField` was
      // checking above. Focus that field; fall back to the first spec.
      const key = typeof first?.path?.[0] === "string" ? first.path[0] : specs[0]?.key;
      if (key) {
        focusInvalid(key);
      }
      return;
    }
    // Block the all-empty submission when the schema has fields but none are
    // required — zod and pg_jsonschema both accept `{}` in that case, which
    // would silently insert a blank entry and render an empty pill. Skip the
    // guard for a degenerate schema (specs.length === 0).
    if (specs.length > 0 && Object.keys(out).length === 0) {
      toast.error("Enter at least one value");
      if (specs[0]) {
        focusInvalid(specs[0].key);
      }
      return;
    }
    onSubmit(out);
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="md:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>
            {mode === "edit"
              ? `Edit entry ${editingEntryNumber ?? ""}`
              : `Add entry ${nextEntryNumber}`}
          </DialogTitle>
          <DialogDescription>
            {exerciseName} · fields come from the exercise’s metrics
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="flex flex-col gap-4.5">
          {specs.length > 0 && specs.every((spec) => !spec.required) && (
            <p className="text-sm text-muted-foreground">Enter at least one value.</p>
          )}
          <div className="grid grid-cols-2 gap-3">
            {specs.map((spec, idx) => (
              <MetricInput
                key={spec.key}
                spec={spec}
                value={values[spec.key]}
                invalid={invalidKey === spec.key}
                onChange={(next) => {
                  setValues((prev) => ({ ...prev, [spec.key]: next }));
                  if (invalidKey === spec.key) {
                    setInvalidKey(null);
                  }
                }}
                inputRef={idx === 0 ? firstInputRef : undefined}
              />
            ))}
          </div>
          <DialogFooter className="gap-2">
            {mode === "edit" && onDelete ? (
              <Button
                type="button"
                variant="ghost"
                className="text-destructive hover:bg-destructive/10 hover:text-destructive sm:mr-auto"
                onClick={onDelete}
                disabled={isPending}
              >
                <Trash2 />
                Delete
              </Button>
            ) : null}
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="animate-spin" />
                  Saving…
                </>
              ) : (
                submitLabel
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

interface MetricInputProps {
  spec: CardioMetricSpec;
  value: CardioFieldState | undefined;
  invalid: boolean;
  onChange: (next: CardioFieldState) => void;
  inputRef?: React.RefObject<HTMLInputElement | null> | undefined;
}

function inputModeFor(spec: CardioMetricSpec): "numeric" | "decimal" | "text" {
  if (spec.format === "integer" || spec.format === "average") {
    return "numeric";
  }
  // A duration needs the colon, which numeric keypads lack.
  return spec.format === "duration_seconds" ? "text" : "decimal";
}

function MetricInput({ spec, value, invalid, onChange, inputRef }: MetricInputProps) {
  const id = `metric-${spec.key}`;
  const isDuration = spec.format === "duration_seconds";
  // Durations are typed as one "mm:ss" (or "h:mm:ss") value; the notation sits
  // where other fields show their unit.
  const unit = isDuration ? durationInputNotation(spec) : spec.unit;
  const durationPlaceholder = unit === "mm:ss" ? "0:00" : "0:00:00";
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <Label htmlFor={id} className="flex-wrap gap-x-1.5 gap-y-0">
        {spec.label}
        {unit ? <span className="font-medium text-muted-foreground">{unit}</span> : null}
        {!spec.required && <span className="font-normal text-muted-foreground">Optional</span>}
      </Label>
      <Input
        id={id}
        ref={inputRef}
        type="text"
        inputMode={inputModeFor(spec)}
        autoComplete="off"
        // The shared Input paints the red ring for aria-invalid.
        aria-invalid={invalid ? true : undefined}
        aria-required={spec.required ? true : undefined}
        value={typeof value === "string" ? value : ""}
        onChange={(e) => onChange(e.target.value)}
        className="text-right tabular-nums"
        placeholder={isDuration ? durationPlaceholder : "0"}
      />
    </div>
  );
}
