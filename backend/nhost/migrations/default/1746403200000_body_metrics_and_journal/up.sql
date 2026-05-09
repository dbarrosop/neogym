-- Body metrics: one entry per user per day (weight and/or fat percentage)
CREATE TABLE public.body_metrics (
  id          uuid          PRIMARY KEY DEFAULT uuidv7(),
  user_id     uuid          NOT NULL REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  measured_on date          NOT NULL DEFAULT CURRENT_DATE,
  weight_kg   numeric(6,2)  CHECK (weight_kg > 0),
  fat_pct     numeric(5,2)  CHECK (fat_pct > 0 AND fat_pct < 100),
  notes       text,
  created_at  timestamptz   NOT NULL DEFAULT now(),
  updated_at  timestamptz   NOT NULL DEFAULT now(),
  UNIQUE (user_id, measured_on),
  CONSTRAINT body_metrics_at_least_one CHECK (weight_kg IS NOT NULL OR fat_pct IS NOT NULL)
);

CREATE INDEX body_metrics_user_id_measured_on_idx
  ON public.body_metrics(user_id, measured_on DESC);

CREATE TRIGGER set_body_metrics_updated_at
  BEFORE UPDATE ON public.body_metrics
  FOR EACH ROW EXECUTE FUNCTION set_current_timestamp_updated_at();

-- Journal labels: user-defined, color-coded tags
CREATE TABLE public.journal_labels (
  id         uuid        PRIMARY KEY DEFAULT uuidv7(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  name       text        NOT NULL,
  color      text        NOT NULL DEFAULT '#6366f1',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

CREATE INDEX journal_labels_user_id_idx ON public.journal_labels(user_id);

CREATE TRIGGER set_journal_labels_updated_at
  BEFORE UPDATE ON public.journal_labels
  FOR EACH ROW EXECUTE FUNCTION set_current_timestamp_updated_at();

-- Journal entries: dated text entries (Markdown content)
CREATE TABLE public.journal_entries (
  id         uuid        PRIMARY KEY DEFAULT uuidv7(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  entry_date date        NOT NULL DEFAULT CURRENT_DATE,
  title      text,
  content    text        NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX journal_entries_user_id_entry_date_idx
  ON public.journal_entries(user_id, entry_date DESC);

CREATE TRIGGER set_journal_entries_updated_at
  BEFORE UPDATE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION set_current_timestamp_updated_at();

-- Junction table: journal entry ↔ label (many-to-many)
CREATE TABLE public.journal_entry_labels (
  entry_id uuid NOT NULL REFERENCES public.journal_entries(id) ON UPDATE CASCADE ON DELETE CASCADE,
  label_id uuid NOT NULL REFERENCES public.journal_labels(id)  ON UPDATE CASCADE ON DELETE CASCADE,
  PRIMARY KEY (entry_id, label_id)
);
