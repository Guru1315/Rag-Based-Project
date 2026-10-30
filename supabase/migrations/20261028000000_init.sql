-- =====================================================================
-- DocuMind AI - initial schema
-- Run with the Supabase CLI (`supabase db push`) or paste into the
-- Supabase SQL Editor. See README.md -> "Database setup".
--
-- Design rules
--   * Every row has a user_id; Row Level Security (RLS) limits access to it.
--   * The app NEVER uses the service-role key. Everything runs as the
--     signed-in user, so RLS is the real security boundary.
--   * Embeddings are 768-dimensional (Gemini embedding model, truncated
--     with outputDimensionality = 768).
-- =====================================================================

create extension if not exists vector with schema extensions;

-- ---------------------------------------------------------------------
-- Helper: keep updated_at fresh
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------
-- profiles (one row per auth user, created by trigger)
-- ---------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name'),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------
-- knowledge_bases
-- ---------------------------------------------------------------------
create table public.knowledge_bases (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null default auth.uid() references auth.users(id) on delete cascade,
  name             text not null check (char_length(btrim(name)) between 1 and 100),
  description      text check (description is null or char_length(description) <= 500),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  last_accessed_at timestamptz not null default now()
);

create unique index knowledge_bases_user_name_key
  on public.knowledge_bases (user_id, lower(btrim(name)));
create index knowledge_bases_user_recent_idx
  on public.knowledge_bases (user_id, last_accessed_at desc);

create trigger knowledge_bases_updated_at before update on public.knowledge_bases
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- documents
-- status is a real processing state written by the server while it works:
--   uploading -> extracting -> chunking -> indexing -> ready   (or failed)
--   'queued' = registered and waiting to be processed (e.g. after retry)
-- ---------------------------------------------------------------------
create table public.documents (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid not null default auth.uid() references auth.users(id) on delete cascade,
  knowledge_base_id     uuid not null references public.knowledge_bases(id) on delete cascade,
  file_name             text not null check (char_length(file_name) between 1 and 255),
  relative_path         text not null check (char_length(relative_path) between 1 and 1000),
  file_ext              text not null,
  mime_type             text,
  size_bytes            bigint not null check (size_bytes > 0),
  content_hash          text not null,                  -- SHA-256 hex, used for duplicate detection
  storage_path          text not null,
  status                text not null default 'uploading'
                        check (status in ('queued','uploading','extracting','chunking','indexing','ready','failed')),
  error_code            text,
  error_message         text,
  page_count            integer,
  chunk_count           integer not null default 0,
  char_count            integer,
  starred               boolean not null default false,
  embedding_model       text,
  embedding_dimensions  integer,
  chunk_config_version  text,
  processing_started_at timestamptz,
  indexed_at            timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create unique index documents_kb_hash_key on public.documents (knowledge_base_id, content_hash);
create index documents_user_created_idx on public.documents (user_id, created_at desc);
create index documents_kb_idx on public.documents (knowledge_base_id);
create index documents_user_status_idx on public.documents (user_id, status);
create index documents_user_starred_idx on public.documents (user_id) where starred;

create trigger documents_updated_at before update on public.documents
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- document_chunks (text + embedding + source metadata)
-- ---------------------------------------------------------------------
create table public.document_chunks (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  knowledge_base_id uuid not null references public.knowledge_bases(id) on delete cascade,
  document_id       uuid not null references public.documents(id) on delete cascade,
  chunk_index       integer not null,
  content           text not null,
  page_number       integer,
  section           text,
  char_count        integer not null,
  embedding         extensions.vector(768) not null,
  created_at        timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create index document_chunks_document_idx on public.document_chunks (document_id, chunk_index);
create index document_chunks_kb_idx on public.document_chunks (knowledge_base_id);
create index document_chunks_user_idx on public.document_chunks (user_id);
-- Approximate nearest-neighbour index (cosine distance)
create index document_chunks_embedding_idx
  on public.document_chunks using hnsw (embedding extensions.vector_cosine_ops);

-- ---------------------------------------------------------------------
-- conversations + messages
-- ---------------------------------------------------------------------
create table public.conversations (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  knowledge_base_id uuid references public.knowledge_bases(id) on delete set null,
  document_ids      uuid[] not null default '{}',
  title             text not null default 'New conversation' check (char_length(title) between 1 and 200),
  starred           boolean not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index conversations_user_updated_idx on public.conversations (user_id, updated_at desc);

create trigger conversations_updated_at before update on public.conversations
  for each row execute function public.set_updated_at();

create table public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id         uuid not null default auth.uid() references auth.users(id) on delete cascade,
  role            text not null check (role in ('user','assistant')),
  content         text not null,
  sources         jsonb not null default '[]'::jsonb,   -- real retrieved chunks used for this answer
  grounded        boolean,                               -- false = "not enough information" answer
  status          text not null default 'complete' check (status in ('complete','stopped','error')),
  created_at      timestamptz not null default now()
);

create index messages_conversation_idx on public.messages (conversation_id, created_at);
create index messages_user_created_idx on public.messages (user_id, created_at desc);

-- ---------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------
alter table public.profiles         enable row level security;
alter table public.knowledge_bases  enable row level security;
alter table public.documents        enable row level security;
alter table public.document_chunks  enable row level security;
alter table public.conversations    enable row level security;
alter table public.messages         enable row level security;

-- profiles: read/update only your own row (insert is done by the trigger)
create policy "profiles_select_own" on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy "profiles_update_own" on public.profiles
  for update to authenticated using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- knowledge_bases
create policy "kb_select_own" on public.knowledge_bases
  for select to authenticated using (user_id = (select auth.uid()));
create policy "kb_insert_own" on public.knowledge_bases
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy "kb_update_own" on public.knowledge_bases
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "kb_delete_own" on public.knowledge_bases
  for delete to authenticated using (user_id = (select auth.uid()));

-- documents (the knowledge base must also belong to you)
create policy "documents_select_own" on public.documents
  for select to authenticated using (user_id = (select auth.uid()));
create policy "documents_insert_own" on public.documents
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.knowledge_bases kb
                where kb.id = knowledge_base_id and kb.user_id = (select auth.uid()))
  );
create policy "documents_update_own" on public.documents
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "documents_delete_own" on public.documents
  for delete to authenticated using (user_id = (select auth.uid()));

-- document_chunks (the document must also belong to you)
create policy "chunks_select_own" on public.document_chunks
  for select to authenticated using (user_id = (select auth.uid()));
create policy "chunks_insert_own" on public.document_chunks
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.documents d
                where d.id = document_id and d.user_id = (select auth.uid())
                  and d.knowledge_base_id = knowledge_base_id)
  );
create policy "chunks_delete_own" on public.document_chunks
  for delete to authenticated using (user_id = (select auth.uid()));

-- conversations
create policy "conversations_select_own" on public.conversations
  for select to authenticated using (user_id = (select auth.uid()));
create policy "conversations_insert_own" on public.conversations
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and (knowledge_base_id is null or exists (
          select 1 from public.knowledge_bases kb
          where kb.id = knowledge_base_id and kb.user_id = (select auth.uid())))
  );
create policy "conversations_update_own" on public.conversations
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "conversations_delete_own" on public.conversations
  for delete to authenticated using (user_id = (select auth.uid()));

-- messages (the conversation must also belong to you)
create policy "messages_select_own" on public.messages
  for select to authenticated using (user_id = (select auth.uid()));
create policy "messages_insert_own" on public.messages
  for insert to authenticated with check (
    user_id = (select auth.uid())
    and exists (select 1 from public.conversations c
                where c.id = conversation_id and c.user_id = (select auth.uid()))
  );
create policy "messages_update_own" on public.messages
  for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
create policy "messages_delete_own" on public.messages
  for delete to authenticated using (user_id = (select auth.uid()));

-- ---------------------------------------------------------------------
-- Vector search. SECURITY INVOKER means RLS applies, and the function
-- ALSO filters on auth.uid() explicitly (defence in depth).
-- The ownership / knowledge-base / document filters run inside the query.
-- ---------------------------------------------------------------------
create or replace function public.match_chunks(
  query_embedding extensions.vector(768),
  match_count     integer default 8,
  min_similarity  double precision default 0.5,
  kb_id           uuid default null,
  doc_ids         uuid[] default null
)
returns table (
  id             uuid,
  document_id    uuid,
  document_title text,
  relative_path  text,
  chunk_index    integer,
  page_number    integer,
  section        text,
  content        text,
  similarity     double precision
)
language sql
stable
security invoker
set search_path = public, extensions
as $$
  select
    c.id,
    c.document_id,
    d.file_name as document_title,
    d.relative_path,
    c.chunk_index,
    c.page_number,
    c.section,
    c.content,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.document_chunks c
  join public.documents d on d.id = c.document_id
  where c.user_id = auth.uid()
    and d.user_id = auth.uid()
    and d.status = 'ready'
    and (kb_id is null or c.knowledge_base_id = kb_id)
    and (doc_ids is null or cardinality(doc_ids) = 0 or c.document_id = any (doc_ids))
    and 1 - (c.embedding <=> query_embedding) >= min_similarity
  order by c.embedding <=> query_embedding
  limit least(greatest(match_count, 1), 20)
$$;

revoke all on function public.match_chunks(extensions.vector, integer, double precision, uuid, uuid[]) from public, anon;
grant execute on function public.match_chunks(extensions.vector, integer, double precision, uuid, uuid[]) to authenticated;

-- ---------------------------------------------------------------------
-- Private storage bucket. Files live at  <user_id>/<document_id>/<file>
-- Only the owner can read / write / delete files in their own folder.
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('documents', 'documents', false, 20971520)   -- 20 MB; raise together with NEXT_PUBLIC_MAX_UPLOAD_MB
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit;

create policy "documents_bucket_select_own" on storage.objects
  for select to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "documents_bucket_insert_own" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);

-- UPDATE is needed so a retried upload can overwrite the same path (x-upsert).
create policy "documents_bucket_update_own" on storage.objects
  for update to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);

create policy "documents_bucket_delete_own" on storage.objects
  for delete to authenticated
  using (bucket_id = 'documents' and (storage.foldername(name))[1] = (select auth.uid())::text);
