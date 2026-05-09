import { Tag, X } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export const LABEL_MAX_LEN = 64;

export function normalizeLabel(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

interface LabelInputProps {
  value: string[];
  onChange: (labels: string[]) => void;
  /** All labels the user already owns — used for autocomplete suggestions. */
  suggestions: string[];
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

  const selected = useMemo(() => new Set(value), [value]);
  const trimmedInput = normalizeLabel(input);

  const filteredSuggestions = useMemo(() => {
    const lower = trimmedInput.toLowerCase();
    return suggestions
      .filter((s) => !selected.has(s))
      .filter((s) => (lower ? s.toLowerCase().includes(lower) : true))
      .slice(0, 8);
  }, [suggestions, selected, trimmedInput]);

  function commit(raw: string) {
    const next = normalizeLabel(raw);
    if (!next || next.length > LABEL_MAX_LEN) {
      return;
    }
    if (selected.has(next)) {
      setInput("");
      return;
    }
    onChange([...value, next]);
    setInput("");
  }

  function remove(label: string) {
    onChange(value.filter((l) => l !== label));
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      if (trimmedInput) {
        commit(trimmedInput);
      }
      return;
    }
    if (e.key === "Backspace" && input === "" && value.length > 0) {
      const last = value[value.length - 1];
      if (last !== undefined) {
        remove(last);
      }
    }
  }

  const showSuggestions = open && filteredSuggestions.length > 0;
  const showCreateHint =
    open &&
    trimmedInput.length > 0 &&
    !selected.has(trimmedInput) &&
    !filteredSuggestions.some((s) => s.toLowerCase() === trimmedInput.toLowerCase());

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
              key={label}
              className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary"
            >
              <Tag className="h-3 w-3" />
              {label}
              <button
                type="button"
                onClick={() => remove(label)}
                aria-label={`Remove label ${label}`}
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
              <li key={s}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    commit(s);
                  }}
                  className="flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left hover:bg-accent"
                >
                  <Tag className="h-3 w-3 text-muted-foreground" />
                  <span>{s}</span>
                </button>
              </li>
            ))}
            {showCreateHint ? (
              <li>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    commit(trimmedInput);
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
