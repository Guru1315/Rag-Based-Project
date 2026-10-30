-- =====================================================================
-- RLS isolation test. Run it in the Supabase SQL Editor AFTER applying
-- the migration. It creates two throw-away users, acts as each of them
-- and checks that user B cannot see or change user A's data.
--
-- Everything runs inside one transaction that is ROLLED BACK at the end,
-- so nothing is left behind. If any check fails you get an exception.
-- =====================================================================
begin;

-- two fake users (inserted as the postgres role, bypasses RLS)
insert into auth.users (id, instance_id, aud, role, email)
values
  ('aaaaaaaa-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'user-a@example.test'),
  ('bbbbbbbb-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'user-b@example.test');

-- ----- act as user A: create a KB, a document, a chunk, a conversation, a message
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"aaaaaaaa-0000-0000-0000-000000000001","role":"authenticated"}', true);

insert into public.knowledge_bases (id, name) values ('a1000000-0000-0000-0000-000000000001', 'A private KB');

insert into public.documents (id, knowledge_base_id, file_name, relative_path, file_ext, size_bytes, content_hash, storage_path, status)
values ('a2000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001',
        'secret.txt', 'secret.txt', 'txt', 10, 'hash-a', 'aaaaaaaa-0000-0000-0000-000000000001/a2/secret.txt', 'ready');

insert into public.document_chunks (knowledge_base_id, document_id, chunk_index, content, char_count, embedding)
values ('a1000000-0000-0000-0000-000000000001', 'a2000000-0000-0000-0000-000000000001', 0, 'top secret', 10,
        (select array_fill(0.1::real, array[768])::extensions.vector));

insert into public.conversations (id, knowledge_base_id, title)
values ('a3000000-0000-0000-0000-000000000001', 'a1000000-0000-0000-0000-000000000001', 'A chat');

insert into public.messages (conversation_id, role, content)
values ('a3000000-0000-0000-0000-000000000001', 'user', 'secret question');

do $$
begin
  if (select count(*) from public.knowledge_bases) <> 1 then raise exception 'FAIL: user A should see own KB'; end if;
end $$;

-- ----- act as user B: must see nothing of A's
select set_config('request.jwt.claims', '{"sub":"bbbbbbbb-0000-0000-0000-000000000002","role":"authenticated"}', true);

do $$
declare n integer;
begin
  select count(*) into n from public.knowledge_bases;    if n <> 0 then raise exception 'FAIL: B can see A knowledge bases'; end if;
  select count(*) into n from public.documents;          if n <> 0 then raise exception 'FAIL: B can see A documents'; end if;
  select count(*) into n from public.document_chunks;    if n <> 0 then raise exception 'FAIL: B can see A chunks'; end if;
  select count(*) into n from public.conversations;      if n <> 0 then raise exception 'FAIL: B can see A conversations'; end if;
  select count(*) into n from public.messages;           if n <> 0 then raise exception 'FAIL: B can see A messages'; end if;

  -- vector search as B must not return A's chunk, even with a perfect match and no filters
  select count(*) into n from public.match_chunks(
    (select array_fill(0.1::real, array[768])::extensions.vector), 20, -1.0, null, null);
  if n <> 0 then raise exception 'FAIL: B retrieved A chunks through match_chunks'; end if;

  -- B cannot update or delete A's rows (RLS makes them invisible -> 0 rows affected)
  update public.knowledge_bases set name = 'hacked' where id = 'a1000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;  if n <> 0 then raise exception 'FAIL: B updated A KB'; end if;
  delete from public.documents where id = 'a2000000-0000-0000-0000-000000000001';
  get diagnostics n = row_count;  if n <> 0 then raise exception 'FAIL: B deleted A document'; end if;
end $$;

-- B cannot insert a document into A's knowledge base
do $$
begin
  begin
    insert into public.documents (knowledge_base_id, file_name, relative_path, file_ext, size_bytes, content_hash, storage_path)
    values ('a1000000-0000-0000-0000-000000000001', 'x.txt', 'x.txt', 'txt', 1, 'hash-b', 'x');
    raise exception 'FAIL: B inserted a document into A KB';
  exception when insufficient_privilege or check_violation then
    null; -- expected: blocked by RLS
  end;
end $$;

-- B cannot post a message into A's conversation
do $$
begin
  begin
    insert into public.messages (conversation_id, role, content)
    values ('a3000000-0000-0000-0000-000000000001', 'user', 'intruder');
    raise exception 'FAIL: B inserted a message into A conversation';
  exception when insufficient_privilege or check_violation then
    null;
  end;
end $$;

-- ----- anonymous (not signed in) sees nothing and cannot call match_chunks
reset role;
set local role anon;
do $$
declare n integer;
begin
  select count(*) into n from public.documents;
  -- anon has no grants/policies: either 0 rows or a permission error is acceptable
  if n <> 0 then raise exception 'FAIL: anon can read documents'; end if;
exception when insufficient_privilege then
  null;
end $$;

select 'ALL RLS ISOLATION CHECKS PASSED' as result;

rollback;
