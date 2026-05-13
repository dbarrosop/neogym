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
  iterateMetrics,
  parseField,
  seedFieldStates,
  shouldShowHoursInput,
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
  const specs = useMemo(() => iterateMetrics(schema), [schema]);
  const zod = useMemo(() => buildZodSchemaFromMetricsSchema(schema), [schema]);
  const firstInputRef = useRef<HTMLInputElement | null>(null);
  const [values, setValues] = useState<Record<string, CardioFieldState>>({});
  // Marks the field that failed the most recent submit so MetricInput can paint
  // aria-invalid + the Input's red border. Cleared the moment the user edits
  // any field — once they start correcting, the negative-state cue is stale.
  const [invalidKey, setInvalidKey] = useState<string | null>(null);
  const wasOpenRef = useRef(false);
  const submitLabel = mode === "edit" ? "Save" : "Log entry";

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
    // The duration control's first visible input id is `metric-${key}` (h
    // when showHours, otherwise m), so this works for both scalar and
    // duration shapes.
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
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "edit"
              ? `Edit entry ${editingEntryNumber ?? ""}`
              : `Add entry ${nextEntryNumber}`}
          </DialogTitle>
          <DialogDescription>{exerciseName}</DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
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
                <Trash2 className="mr-1 h-4 w-4" />
                Delete
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? (
                <>
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
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

function MetricInput({ spec, value, invalid, onChange, inputRef }: MetricInputProps) {
  const labelSuffix = spec.unit ? ` (${spec.unit})` : "";
  const optionalBadge = spec.required ? null : (
    <span className="text-muted-foreground ml-1 text-[10px] uppercase tracking-wide">optional</span>
  );
  // The shared Input has aria-invalid: styling, so a boolean `true` paints the
  // red ring; undefined keeps the default border. Same convention as the rest
  // of the codebase.
  const ariaInvalid = invalid ? true : undefined;
  const ariaRequired = spec.required ? true : undefined;

  if (spec.format === "duration_seconds") {
    const parts = (value as { h: string; m: string; s: string } | undefined) ?? {
      h: "",
      m: "",
      s: "",
    };
    const showH = shouldShowHoursInput(spec);
    const id = `metric-${spec.key}`;
    return (
      <div className="col-span-2 space-y-1.5">
        <Label htmlFor={id} className="text-xs">
          {spec.label}
          {optionalBadge}
        </Label>
        <div className={`grid ${showH ? "grid-cols-3" : "grid-cols-2"} gap-2`}>
          {showH ? (
            <Input
              id={id}
              ref={inputRef}
              type="number"
              inputMode="numeric"
              min="0"
              step="1"
              placeholder="h"
              aria-label={`${spec.label} hours`}
              aria-invalid={ariaInvalid}
              aria-required={ariaRequired}
              value={parts.h}
              onChange={(e) => onChange({ ...parts, h: e.target.value })}
              className="text-right tabular-nums"
            />
          ) : null}
          <Input
            id={showH ? undefined : id}
            ref={showH ? undefined : inputRef}
            type="number"
            inputMode="numeric"
            min="0"
            step="1"
            placeholder="min"
            aria-label={`${spec.label} minutes`}
            aria-invalid={ariaInvalid}
            // When hours is hidden minutes is the first/required sub-input;
            // when hours is shown, hours carries aria-required and minutes is
            // optional from an a11y standpoint.
            aria-required={showH ? undefined : ariaRequired}
            value={parts.m}
            onChange={(e) => onChange({ ...parts, m: e.target.value })}
            className="text-right tabular-nums"
          />
          <Input
            type="number"
            inputMode="numeric"
            min="0"
            step="1"
            placeholder="sec"
            aria-label={`${spec.label} seconds`}
            aria-invalid={ariaInvalid}
            value={parts.s}
            onChange={(e) => onChange({ ...parts, s: e.target.value })}
            className="text-right tabular-nums"
          />
        </div>
      </div>
    );
  }

  const text = typeof value === "string" ? value : "";
  const id = `metric-${spec.key}`;
  const isIntegerLike = spec.format === "integer" || spec.format === "average";
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-xs">
        {spec.label}
        {labelSuffix}
        {optionalBadge}
      </Label>
      <Input
        id={id}
        ref={inputRef}
        type={isIntegerLike ? "number" : "text"}
        inputMode={isIntegerLike ? "numeric" : "decimal"}
        pattern={isIntegerLike ? undefined : "[0-9]*[.,]?[0-9]*"}
        step={isIntegerLike ? "1" : undefined}
        min={spec.minimum === undefined ? undefined : String(spec.minimum)}
        aria-invalid={ariaInvalid}
        aria-required={ariaRequired}
        value={text}
        onChange={(e) => onChange(e.target.value)}
        className="text-right tabular-nums"
        placeholder="0"
      />
    </div>
  );
}
