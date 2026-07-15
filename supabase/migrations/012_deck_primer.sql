-- 012_deck_primer.sql
-- AI deck primer (game plan, key cards, mulligan, key lines) stored on the deck.
alter table decks add column if not exists primer jsonb;
alter table decks add column if not exists primer_generated_at timestamptz;
