import { Link } from "@tanstack/react-router";
import Fuse from "fuse.js";
import { Check, ChevronDown, Plus, Search, X } from "lucide-react";
import {
  type FocusEvent,
  type KeyboardEvent,
  type ReactNode,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";
import { Tag } from "@/components/patterns/tag";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { MacroFields } from "@/lib/nutrition";
import { macroSummary } from "@/lib/nutrition";
import { cn } from "@/lib/utils";

export interface FoodPickerOption extends MacroFields {
  id: string;
  name: string;
  isPublic: boolean;
  userId?: string | null;
}

/**
 * Naming props shared by the food and meal pickers. Pass `id` and render
 * `<Label htmlFor={id}>`, or pass `aria-label` / `aria-labelledby`. Without
 * any of them the picker names itself ("Food", "Meal").
 */
export interface PickerAccessibilityProps {
  /** Lands on the focusable control: the search input, or the select trigger. */
  id?: string;
  "aria-label"?: string;
  "aria-labelledby"?: string;
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
}

/**
 * "search" (default): an inline search field that is itself the combobox.
 * "select": a select-like button showing the chosen item and a chevron; it
 * opens a panel with a search field and the list (Web-MealEditor,
 * Web-PlanEditor, Web-Dialogs Log food).
 */
export type PickerMode = "search" | "select";

interface FoodPickerProps extends PickerAccessibilityProps {
  foods: FoodPickerOption[];
  value: string;
  onChange: (foodId: string) => void;
  disabled?: boolean;
  mode?: PickerMode;
  className?: string;
}

export function FoodPicker({ foods, ...props }: FoodPickerProps) {
  return (
    <PickerCombobox
      {...props}
      items={foods}
      fuseKeys={FOOD_FUSE_KEYS}
      text={FOOD_PICKER_TEXT}
      empty={
        <PickerEmpty
          message="No foods are available yet. Create a private food first."
          action={
            <Link to="/nutrition/foods/new">
              <Plus className="h-4 w-4" />
              New food
            </Link>
          }
        />
      }
      renderOption={(food) => (
        <span className="flex min-w-0 flex-col gap-0.5">
          <span className="flex min-w-0 items-center gap-2">
            <span className="truncate text-sm font-medium">{food.name}</span>
            {food.isPublic ? <PublicTag /> : null}
          </span>
          <span className="line-clamp-2 text-xs text-muted-foreground">
            {macroSummary(food)} per 100 g
          </span>
        </span>
      )}
      renderSelected={(food) => (food.isPublic ? <PublicTag /> : null)}
    />
  );
}

const FOOD_FUSE_KEYS = ["name"];

const FOOD_PICKER_TEXT: PickerText = {
  name: "Food",
  list: "Foods",
  search: "Search foods",
  searchPlaceholder: "Search own and public foods…",
  selectPlaceholder: "Choose a food",
  clear: "Clear food search",
  noMatch: "No foods match this search.",
};

/** The neutral lowercase "public" tag used for public foods everywhere. */
function PublicTag() {
  return <Tag className="shrink-0">public</Tag>;
}

export function PickerEmpty({ message, action }: { message: string; action: ReactNode }) {
  return (
    <div className="space-y-3 px-3 py-5 text-center text-sm text-muted-foreground">
      <p>{message}</p>
      <Button asChild size="sm" variant="outline">
        {action}
      </Button>
    </div>
  );
}

export interface PickerText {
  /** Accessible name used when the caller provides none. */
  name: string;
  /** Listbox name, e.g. "Foods". */
  list: string;
  /** Name of the search field inside the select panel. */
  search: string;
  searchPlaceholder: string;
  selectPlaceholder: string;
  clear: string;
  noMatch: string;
}

interface PickerItem {
  id: string;
  name: string;
}

interface PickerComboboxProps<T extends PickerItem> extends PickerAccessibilityProps {
  items: T[];
  value: string;
  onChange: (id: string) => void;
  disabled?: boolean | undefined;
  mode?: PickerMode | undefined;
  className?: string | undefined;
  fuseKeys: string[];
  text: PickerText;
  /** Shown instead of the list when there are no items at all. */
  empty: ReactNode;
  renderOption: (item: T) => ReactNode;
  /** Extra trailing content in the select trigger (e.g. the public tag). */
  renderSelected?: (item: T) => ReactNode;
}

/**
 * The shared combobox behind FoodPicker and MealPicker: fuzzy search, a
 * `listbox` of `option`s driven by `aria-activedescendant`, Up/Down to move,
 * Enter to choose, Escape to close (without closing a surrounding dialog).
 */
export function PickerCombobox<T extends PickerItem>(props: PickerComboboxProps<T>) {
  const { items, value, mode = "search", fuseKeys } = props;
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const listboxId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const selected = items.find((item) => item.id === value) ?? null;

  const fuse = useMemo(
    () => new Fuse(items, { keys: fuseKeys, ignoreLocation: true, threshold: 0.35 }),
    [items, fuseKeys],
  );
  const visible = useMemo(() => {
    const trimmed = query.trim();
    if (!trimmed) {
      return items;
    }
    return fuse.search(trimmed).map((match) => match.item);
  }, [fuse, items, query]);

  const isOpen = open && !props.disabled;
  useEscapeToClose(isOpen, wrapperRef, () => close(mode === "select"));

  useEffect(() => {
    if (mode === "search" && !open) {
      setQuery(selected?.name ?? "");
    }
  }, [mode, open, selected]);

  useEffect(() => {
    if (isOpen && activeIndex >= 0) {
      document.getElementById(optionId(listboxId, activeIndex))?.scrollIntoView?.({
        block: "nearest",
      });
    }
  }, [activeIndex, isOpen, listboxId]);

  /** Opens the list with the current choice active; `options` is what will show. */
  function openList(options: readonly T[] = visible) {
    setOpen(true);
    setActiveIndex(options.findIndex((item) => item.id === value));
  }

  function close(focusTrigger: boolean) {
    setOpen(false);
    setActiveIndex(-1);
    if (focusTrigger) {
      wrapperRef.current?.querySelector<HTMLElement>("[data-picker-trigger]")?.focus();
    }
  }

  function select(item: T) {
    props.onChange(item.id);
    if (mode === "search") {
      setQuery(item.name);
    }
    close(mode === "select");
  }

  function changeQuery(next: string) {
    setQuery(next);
    setOpen(true);
    setActiveIndex(next.trim() ? 0 : -1);
    if (mode === "search" && selected && next !== selected.name) {
      props.onChange("");
    }
  }

  function handleKeyDown(event: KeyboardEvent<HTMLElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (!isOpen) {
        openList();
        return;
      }
      const step = event.key === "ArrowDown" ? 1 : -1;
      setActiveIndex((index) => clampIndex(index + step, visible.length));
      return;
    }
    if (event.key === "Enter" && isOpen) {
      event.preventDefault();
      const item = visible[activeIndex];
      if (item) {
        select(item);
      }
    }
  }

  const list = (
    <PickerList
      {...props}
      listboxId={listboxId}
      visible={visible}
      activeIndex={activeIndex}
      onActiveIndexChange={setActiveIndex}
      onSelect={select}
    />
  );

  if (mode === "select") {
    return (
      <SelectModePicker
        {...props}
        wrapperRef={wrapperRef}
        isOpen={isOpen}
        selected={selected}
        query={query}
        listboxId={listboxId}
        activeIndex={activeIndex}
        list={list}
        onToggle={() => {
          if (isOpen) {
            close(true);
          } else {
            // The panel always opens on the full list.
            setQuery("");
            openList(items);
          }
        }}
        onClose={() => close(false)}
        onQueryChange={changeQuery}
        onKeyDown={handleKeyDown}
      />
    );
  }

  return (
    <SearchModePicker
      {...props}
      wrapperRef={wrapperRef}
      isOpen={isOpen}
      query={query}
      listboxId={listboxId}
      activeIndex={activeIndex}
      list={list}
      onFocus={() => openList()}
      onBlur={() => {
        window.setTimeout(() => {
          setOpen(false);
          setActiveIndex(-1);
          setQuery(selected?.name ?? "");
        }, 100);
      }}
      onQueryChange={changeQuery}
      onKeyDown={handleKeyDown}
    />
  );
}

function optionId(listboxId: string, index: number) {
  return `${listboxId}-option-${index}`;
}

function clampIndex(index: number, length: number) {
  if (length === 0) {
    return -1;
  }
  return Math.min(Math.max(index, 0), length - 1);
}

/**
 * Escape closes the open list first. Radix dialogs listen for Escape on the
 * document in the capture phase, so the picker listens on the window (which
 * captures earlier) and stops the event when it started inside the picker.
 */
function useEscapeToClose(
  isOpen: boolean,
  wrapperRef: React.RefObject<HTMLDivElement | null>,
  onClose: () => void,
) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useEffect(() => {
    if (!isOpen) {
      return;
    }
    function handleKeyDown(event: globalThis.KeyboardEvent) {
      if (event.key !== "Escape") {
        return;
      }
      const target = event.target;
      if (target instanceof Node && wrapperRef.current?.contains(target)) {
        event.preventDefault();
        event.stopPropagation();
        onCloseRef.current();
      }
    }
    window.addEventListener("keydown", handleKeyDown, { capture: true });
    return () => window.removeEventListener("keydown", handleKeyDown, { capture: true });
  }, [isOpen, wrapperRef]);
}

function accessibleName(props: PickerAccessibilityProps, fallback: string) {
  const named = !!(props.id || props["aria-label"] || props["aria-labelledby"]);
  return named ? props["aria-label"] : fallback;
}

interface ModeProps<T extends PickerItem> extends PickerComboboxProps<T> {
  wrapperRef: React.RefObject<HTMLDivElement | null>;
  isOpen: boolean;
  query: string;
  listboxId: string;
  activeIndex: number;
  list: ReactNode;
  onQueryChange: (query: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
}

function SearchModePicker<T extends PickerItem>(
  props: ModeProps<T> & { onFocus: () => void; onBlur: () => void },
) {
  const { isOpen, query, listboxId, activeIndex, text, disabled } = props;
  return (
    <div ref={props.wrapperRef} className={cn("relative", props.className)}>
      <Search className="pointer-events-none absolute top-1/2 left-3 z-10 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        id={props.id}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        aria-activedescendant={
          isOpen && activeIndex >= 0 ? optionId(listboxId, activeIndex) : undefined
        }
        aria-label={accessibleName(props, text.name)}
        aria-labelledby={props["aria-labelledby"]}
        aria-describedby={props["aria-describedby"]}
        aria-invalid={props["aria-invalid"]}
        autoComplete="off"
        value={query}
        onFocus={(event) => {
          props.onFocus();
          event.currentTarget.select();
        }}
        onBlur={props.onBlur}
        onChange={(event) => props.onQueryChange(event.target.value)}
        onKeyDown={props.onKeyDown}
        placeholder={text.searchPlaceholder}
        className="pr-9 pl-9"
        disabled={disabled}
      />
      {query ? (
        <button
          type="button"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => props.onQueryChange("")}
          className="absolute top-1/2 right-2.5 z-10 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground"
          aria-label={text.clear}
          disabled={disabled}
        >
          <X className="h-4 w-4" />
        </button>
      ) : null}
      {isOpen ? (
        <div className="absolute top-full right-0 left-0 z-30 mt-2 rounded-[10px] border bg-popover p-1 shadow-lg">
          {props.list}
        </div>
      ) : null}
    </div>
  );
}

function SelectModePicker<T extends PickerItem>(
  props: ModeProps<T> & {
    selected: T | null;
    onToggle: () => void;
    onClose: () => void;
  },
) {
  const { isOpen, query, listboxId, activeIndex, text, disabled, selected } = props;
  // Close when focus leaves both the trigger and the panel's search field.
  const handleBlur = (event: FocusEvent<HTMLElement>) => {
    const next = event.relatedTarget;
    if (isOpen && !(next instanceof Node && props.wrapperRef.current?.contains(next))) {
      props.onClose();
    }
  };
  return (
    <div ref={props.wrapperRef} className={cn("relative min-w-0", props.className)}>
      <button
        type="button"
        data-picker-trigger=""
        id={props.id}
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        aria-controls={isOpen ? listboxId : undefined}
        aria-label={accessibleName(props, text.name)}
        aria-labelledby={props["aria-labelledby"]}
        aria-describedby={props["aria-describedby"]}
        aria-invalid={props["aria-invalid"]}
        disabled={disabled}
        onMouseDown={(event) => {
          // Keep focus in the open panel so its blur does not race the toggle.
          if (isOpen) {
            event.preventDefault();
          }
        }}
        onClick={props.onToggle}
        onBlur={handleBlur}
        onKeyDown={(event) => {
          if (!isOpen && (event.key === "ArrowDown" || event.key === "ArrowUp")) {
            event.preventDefault();
            props.onToggle();
          }
        }}
        className={cn(
          "@container flex h-10 w-full min-w-0 items-center justify-between gap-1.5 rounded-[9px] border border-input bg-card px-3 text-left text-[15px] outline-none transition-[color,box-shadow]",
          "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50",
          "disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive",
        )}
      >
        <span className={cn("min-w-0 truncate", !selected && "text-muted-foreground")}>
          {selected ? selected.name : text.selectPlaceholder}
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {/* In narrow rows the name wins: the selected item's tag only shows from 14rem. */}
          {selected && props.renderSelected ? (
            <span className="hidden @min-[14rem]:inline-flex">
              {props.renderSelected(selected)}
            </span>
          ) : null}
          <ChevronDown aria-hidden="true" className="size-3 text-muted-foreground" />
        </span>
      </button>
      {isOpen ? (
        <div className="absolute top-full right-0 left-0 z-30 mt-1 flex flex-col gap-1 rounded-[10px] border bg-popover p-1 shadow-lg">
          <PanelSearchInput
            listboxId={listboxId}
            activeIndex={activeIndex}
            label={text.search}
            placeholder={text.searchPlaceholder}
            query={query}
            onQueryChange={props.onQueryChange}
            onKeyDown={props.onKeyDown}
            onBlur={handleBlur}
          />
          {props.list}
        </div>
      ) : null}
    </div>
  );
}

/** The select panel's search field; it takes focus when the panel opens. */
function PanelSearchInput({
  listboxId,
  activeIndex,
  label,
  placeholder,
  query,
  onQueryChange,
  onKeyDown,
  onBlur,
}: {
  listboxId: string;
  activeIndex: number;
  label: string;
  placeholder: string;
  query: string;
  onQueryChange: (query: string) => void;
  onKeyDown: (event: KeyboardEvent<HTMLElement>) => void;
  onBlur: (event: FocusEvent<HTMLElement>) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    inputRef.current?.focus();
  }, []);
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
      <Input
        ref={inputRef}
        role="combobox"
        aria-autocomplete="list"
        aria-expanded="true"
        aria-controls={listboxId}
        aria-activedescendant={activeIndex >= 0 ? optionId(listboxId, activeIndex) : undefined}
        aria-label={label}
        autoComplete="off"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        onKeyDown={onKeyDown}
        onBlur={onBlur}
        placeholder={placeholder}
        className="pl-9"
      />
    </div>
  );
}

function PickerList<T extends PickerItem>(
  props: PickerComboboxProps<T> & {
    listboxId: string;
    visible: T[];
    activeIndex: number;
    onActiveIndexChange: (index: number) => void;
    onSelect: (item: T) => void;
  },
) {
  const { items, visible, value, text, listboxId, activeIndex } = props;
  if (items.length === 0) {
    return <div>{props.empty}</div>;
  }
  return (
    <div className="max-h-64 overflow-y-auto">
      {visible.length === 0 ? (
        <p className="px-3 py-5 text-center text-sm text-muted-foreground">{text.noMatch}</p>
      ) : null}
      <div id={listboxId} role="listbox" aria-label={text.list} className="flex flex-col gap-0.5">
        {visible.map((item, index) => {
          const isSelected = item.id === value;
          return (
            <div
              key={item.id}
              id={optionId(listboxId, index)}
              role="option"
              tabIndex={-1}
              aria-selected={isSelected}
              onMouseDown={(event) => event.preventDefault()}
              onMouseMove={() => {
                if (index !== activeIndex) {
                  props.onActiveIndexChange(index);
                }
              }}
              onClick={() => props.onSelect(item)}
              className={cn(
                "flex w-full cursor-pointer items-start justify-between gap-3 rounded-md px-3 py-2 text-left",
                index === activeIndex && "bg-muted",
              )}
            >
              {props.renderOption(item)}
              {isSelected ? (
                <Check aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-link" />
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}
