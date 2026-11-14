import { Tag as TagIcon } from "lucide-react";
import { type ReactNode, useId, useMemo, useState } from "react";
import { Tag } from "@/components/patterns/tag";
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

/** The caption under the labels field (Web-JournalEditor). */
export const LABEL_INPUT_HINT =
  "Press Enter to add. Labels you already use are suggested as you type.";

interface LabelInputProps {
  value: LabelSelection[];
  onChange: (labels: LabelSelection[]) => void;
  /** Labels visible to the user (own + public) — used for autocomplete and id resolution. */
  suggestions: LabelSuggestion[];
  disabled?: boolean;
  placeholder?: string;
  /** Field label; the boards say just "Labels". */
  label?: string;
  /** Show the secondary "Optional" suffix after the label (default true). */
  optional?: boolean;
  /** Caption under the field, linked as its description; `null` hides it. */
  hint?: ReactNode;
}

export function LabelInput({
  value,
  onChange,
  suggestions,
  disabled,
  placeholder = "Add label",
  label = "Labels",
  optional = true,
  hint = LABEL_INPUT_HINT,
}: LabelInputProps) {
  const [input, setInput] = useState("");
  const [open, setOpen] = useState(false);
  const inputId = useId();
  const hintId = useId();

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
    <div className="flex flex-col gap-1.5">
      <label htmlFor={inputId} className="text-[13px] font-semibold text-soft-foreground">
        {label}
        {optional ? (
          <span className="ml-1.5 font-medium text-muted-foreground">Optional</span>
        ) : null}
      </label>
      <div className="relative">
        <div
          className={cn(
            "flex min-h-11 flex-wrap items-center gap-1.5 rounded-[9px] border border-input bg-card px-2 py-1.5 transition focus-within:border-ring focus-within:ring-ring/50 focus-within:ring-[3px]",
            disabled && "pointer-events-none opacity-50",
          )}
        >
          {value.map((selection) => (
            <Tag
              key={selection.name}
              onRemove={() => remove(selection.name)}
              removeLabel={`Remove label ${selection.name}`}
            >
              {selection.name}
            </Tag>
          ))}
          <Input
            id={inputId}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 120)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            aria-describedby={hint ? hintId : undefined}
            maxLength={LABEL_MAX_LEN}
            disabled={disabled}
            // 16 px below 768 px, like Input, so iOS Safari does not zoom in.
            className="h-[30px] min-w-[120px] flex-1 border-0 bg-transparent px-1 py-0 text-base focus-visible:ring-0 md:text-sm"
          />
        </div>
        {(showSuggestions || showCreateHint) && (
          <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-popover p-1 text-sm shadow-md">
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
                  <TagIcon className="h-3 w-3 text-muted-foreground" />
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
                  <TagIcon className="h-3 w-3 text-muted-foreground" />
                  <span>
                    Create <span className="font-medium">"{trimmedInput}"</span>
                  </span>
                </button>
              </li>
            ) : null}
          </ul>
        )}
      </div>
      {hint ? (
        <p id={hintId} className="text-[13px] text-muted-foreground">
          {hint}
        </p>
      ) : null}
    </div>
  );
}
