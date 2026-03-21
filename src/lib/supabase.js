import { createClient } from '@supabase/supabase-js'

// Replace these with your Supabase project values from https://supabase.com/dashboard
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://YOUR_PROJECT.supabase.co'
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'YOUR_ANON_KEY'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// ── Auth ─────────────────────────────────────────────────────────────────────
export const signIn = (email, password) =>
  supabase.auth.signInWithPassword({ email, password })

export const signOut = () => supabase.auth.signOut()

export const getSession = () => supabase.auth.getSession()

export const onAuthChange = (cb) => supabase.auth.onAuthStateChange(cb)

// ── Trade Notes (persisted per user) ─────────────────────────────────────────
export const fetchNotes = async (userId) => {
  const { data, error } = await supabase
    .from('trade_notes')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
  if (error) throw error
  return data
}

export const upsertNote = async (note) => {
  const { data, error } = await supabase
    .from('trade_notes')
    .upsert(note, { onConflict: 'id' })
    .select()
    .single()
  if (error) throw error
  return data
}

export const deleteNote = async (id) => {
  const { error } = await supabase.from('trade_notes').delete().eq('id', id)
  if (error) throw error
}

// ── Saved API Keys (encrypted via Supabase RLS — user sees only their own) ───
export const saveBinanceKeys = async (userId, apiKey, label) => {
  const { data, error } = await supabase
    .from('api_keys')
    .upsert({ user_id: userId, api_key: apiKey, label }, { onConflict: 'user_id' })
    .select()
    .single()
  if (error) throw error
  return data
}

export const fetchBinanceKeys = async (userId) => {
  const { data, error } = await supabase
    .from('api_keys')
    .select('api_key, label')
    .eq('user_id', userId)
    .single()
  if (error) return null
  return data
}


// ── Capital Flow (deposits & withdrawals — synced across devices) ────────────
export const fetchCapitalFlow = async (userId) => {
  const { data, error } = await supabase
    .from('capital_flow')
    .select('*')
    .eq('user_id', userId)
    .order('time', { ascending: true })
  if (error) return []
  return data
}

export const upsertCapitalFlow = async (entry, userId) => {
  const { error } = await supabase
    .from('capital_flow')
    .upsert({ ...entry, user_id: userId }, { onConflict: 'id' })
  if (error) throw error
}

export const deleteCapitalFlow = async (id) => {
  const { error } = await supabase.from('capital_flow').delete().eq('id', id)
  if (error) throw error
}

/* ─────────────────────────────────────────────────────────────────────────────
   SUPABASE SETUP INSTRUCTIONS
   Run these SQL commands in your Supabase SQL Editor:

   -- Trade notes table
   create table trade_notes (
     id uuid primary key default gen_random_uuid(),
     user_id uuid references auth.users not null,
     trade_id text,
     date date,
     symbol text,
     title text,
     body text,
     mood text,
     tags text[],
     created_at timestamptz default now(),
     updated_at timestamptz default now()
   );
   alter table trade_notes enable row level security;
   create policy "Users own their notes" on trade_notes
     for all using (auth.uid() = user_id);

   -- API keys table
   create table api_keys (
     user_id uuid primary key references auth.users,
     api_key text,
     label text,
     created_at timestamptz default now()
   );
   alter table api_keys enable row level security;
   create policy "Users own their keys" on api_keys
     for all using (auth.uid() = user_id);

   -- Capital flow table (deposits & withdrawals)
   create table capital_flow (
     id text primary key,
     user_id uuid references auth.users not null,
     type text not null,
     amount numeric not null,
     time bigint not null,
     date text,
     note text,
     created_at timestamptz default now()
   );
   alter table capital_flow enable row level security;
   create policy "Users own their flow" on capital_flow
     for all using (auth.uid() = user_id);

   Then go to Authentication → Settings → Site URL → set to your Netlify/Vercel URL
   Enable Email auth under Authentication → Providers
   ───────────────────────────────────────────────────────────────────────────── */
