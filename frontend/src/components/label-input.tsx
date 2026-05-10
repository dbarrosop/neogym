import { Tag, X } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const LABEL_MAX_LEN = 64;

export function normalizeLabel(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").toLowerCase();
}

/**
 * A label selection on the form: either an existing label (carries `id`) or a
 * brand-new one (just `name`). The submit handler resolves new ones to ids by
 * inserting them before attaching them to the workout.
 */
export interface LabelSelection {
  id?: string;
  name: string;
}

/** A label suggestion the user can pick from autocomplete. */
export interface LabelSuggestion {
  id: string;
  name: string;
}

interface LabelInputProps {
  value: LabelSelection[];
  onChange: (labels: LabelSelection[]) => void;
  /** Labels visible to the user (own + public) — used for autocomplete and id resolution. */
  suggestions: LabelSuggestion[];
  disabled?: boolean;
  placeholder?: string;
}

export function LabelInput({
  value,
  onChange,
  suggestions,
  disabled,
  placeholder = "Add a label and press Enter",
}: LabelInputProps) {
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const inputId = useId();

  const selectedNames = useMemo(() => new Set(value.map((l) => l.name)), [value]);
  const trimmedInput = normalizeLabel(input);

  const filteredSuggestions = useMemo(() => {
    const lower = trimmedInput.toLowerCase();
    return suggestions
      .filter((s) => !selectedNames.has(s.name))
      .filter((s) => (lower ? s.name.toLowerCase().includes(lower) : true))
      .slice(0, 8);
  }, [suggestions, selectedNames, trimmedInput]);

  function commitSuggestion(suggestion: LabelSuggestion) {
    if (selectedNames.has(suggestion.name)) {
      setInput("");
      return;
    }
    onChange([...value, { id: suggestion.id, name: suggestion.name }]);
    setInput("");
  }

  function commitTyped(raw: string) {
    const next = normalizeLabel(raw);
    if (!next || next.length > LABEL_MAX_LEN) {
      return;
    }
    if (selectedNames.has(next)) {
      setInput("");
      return;
    }
    // If the typed text matches a visible label, link to that id rather than
    // creating a private duplicate. Cross-user private collisions are fine —
    // the DB scopes uniqueness per (user_id, name) — but reusing public seeds
    // (and our own existing labels) keeps the namespace tidy.
    const existing = suggestions.find((s) => s.name === next);
    onChange([...value, existing ? { id: existing.id, name: existing.name } : { name: next }]);
    setInput("");
  }

  function remove(name: string) {
    onChange(value.filter((l) => l.name !== name));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (trimmedInput) {
        commitTyped(trimmedInput);
      }
      return;
    }
    if (e.key === "Backspace" && input === "" && value.length > 0) {
      const last = value[value.length - 1];
      if (last !== undefined) {
        remove(last.name);
      }
    }
  }

  const showSuggestions = open && filteredSuggestions.length > 0;
  const showCreateHint =
    open &&
    trimmedInput.length > 0 &&
    !selectedNames.has(trimmedInput) &&
    !filteredSuggestions.some((s) => s.name.toLowerCase() === trimmedInput.toLowerCase());

  return (
    <div className="space-y-1.5">
      <label htmlFor={inputId} className="text-sm font-medium">
        Labels
        <span className="ml-2 text-xs font-normal text-muted-foreground">Optional</span>
      </label>
      <div className="relative">
        <div
          className={cn(
            "flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-transparent px-2 py-1.5 text-sm shadow-xs transition focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]",
            disabled && "pointer-events-none opacity-50",
          )}
        >
          {value.map((label) => (
            <span
              key={label.name}
              className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
            >
              <Tag className="h-3 w-3" />
              {label.name}
              <button
                type="button"
                onClick={() => remove(label.name)}
                aria-label={`Remove label ${label.name}`}
                className="grid h-4 w-4 place-items-center rounded-full text-primary/70 hover:bg-primary/15 hover:text-primary"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          ))}
          <Input
            id={inputId}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 120)}
            onKeyDown={handleKeyDown}
            placeholder={value.length === 0 ? placeholder : ""}
            maxLength={LABEL_MAX_LEN}
            disabled={disabled}
            className="h-7 min-w-[10ch] flex-1 border-0 bg-transparent px-1 py-0 shadow-none focus-visible:ring-0"
          />
        </div>
        {(showSuggestions || showCreateHint) && (
          <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border/60 bg-popover p-1 text-sm shadow-md">
            {filteredSuggestions.map((s) => (
              <li key={s.id}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    commitSuggestion(s);
                  }}
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left hover:bg-accent"
                >
                  <Tag className="h-3 w-3 text-muted-foreground" />
                  <span>{s.name}</span>
                </button>
              </li>
            ))}
            {showCreateHint ? (
              <li>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    commitTyped(trimmedInput);
                  }}
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left hover:bg-accent"
                >
                  <Tag className="h-3 w-3 text-muted-foreground" />
                  <span>
                    Create <span className="font-medium">"{trimmedInput}"</span>
                  </span>
                </button>
              </li>
            ) : null}
          </ul>
        )}
      </div>
    </div>
  );
}
