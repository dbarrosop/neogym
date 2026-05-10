-- =====================================================================
-- journal_entries
-- Dated markdown entries, multiple allowed per day. Title is optional;
-- body is required and rendered as markdown on the client.
-- =====================================================================
CREATE TABLE public.journal_entries (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid NOT NULL REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE,
  entry_date  date NOT NULL DEFAULT CURRENT_DATE,
  title       text NULL,
  body        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT journal_entries_body_nonempty_check CHECK (length(body) > 0),
  CONSTRAINT journal_entries_title_length_check
    CHECK (title IS NULL OR length(title) BETWEEN 1 AND 200)
);
CREATE INDEX journal_entries_user_date_idx
  ON public.journal_entries(user_id, entry_date DESC, created_at DESC);

CREATE TRIGGER set_public_journal_entries_updated_at
BEFORE UPDATE ON public.journal_entries
FOR EACH ROW EXECUTE FUNCTION public.set_current_timestamp_updated_at();
COMMENT ON TRIGGER set_public_journal_entries_updated_at ON public.journal_entries
IS 'trigger to set value of column "updated_at" to current timestamp on row update';
