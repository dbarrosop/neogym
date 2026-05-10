-- =====================================================================
-- journal_labels
-- Per-user tags on journal entries. Unlike public.labels these are
-- strictly private (no public seeds, no is_public column) — journals
-- are not shared, so there is no need for a cross-user namespace.
-- =====================================================================
CREATE TABLE public.journal_labels (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT journal_labels_name_format_check CHECK (length(name) BETWEEN 1 AND 64),
  -- Real UNIQUE constraint (not a partial index) so Hasura's `on_conflict`
  -- accepts it — the frontend's create-on-the-fly label flow targets this
  -- constraint when inserting through a journal entry mutation.
  CONSTRAINT journal_labels_user_name_key UNIQUE (user_id, name)
);
CREATE INDEX journal_labels_user_id_idx ON public.journal_labels(user_id);

CREATE TRIGGER set_public_journal_labels_updated_at
BEFORE UPDATE ON public.journal_labels
FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
COMMENT ON TRIGGER set_public_journal_labels_updated_at ON public.journal_labels
IS 'trigger to set value of column "updated_at" to current timestamp on row update';

-- =====================================================================
-- journal_entry_labels (journal_entry ↔ journal_label association)
-- No user_id column — visibility is enforced through the journal_entry
-- relationship in Hasura permissions.
-- =====================================================================
CREATE TABLE public.journal_entry_labels (
  journal_entry_id uuid NOT NULL REFERENCES public.journal_entries(id) ON UPDATE CASCADE ON DELETE CASCADE,
  label_id         uuid NOT NULL REFERENCES public.journal_labels(id)  ON UPDATE CASCADE ON DELETE CASCADE,
  created_at       timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (journal_entry_id, label_id)
);
CREATE INDEX journal_entry_labels_label_idx ON public.journal_entry_labels(label_id);
