-- Enable RLS on tables flagged by Supabase Security Advisor.
-- The app uses the service role key (which bypasses RLS), so all existing
-- API routes continue to work. This is defense-in-depth against accidental
-- exposure via the anon key.

ALTER TABLE public.decks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.deck_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.binders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collection_cards ENABLE ROW LEVEL SECURITY;
