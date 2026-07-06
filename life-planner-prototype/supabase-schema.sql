create table if not exists planner_records (
  owner_id text not null,
  store text not null,
  id text not null,
  data jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (owner_id, store, id)
);

create index if not exists planner_records_owner_store_idx
  on planner_records (owner_id, store);

alter table planner_records enable row level security;

drop policy if exists "planner_records_personal_read" on planner_records;
drop policy if exists "planner_records_personal_insert" on planner_records;
drop policy if exists "planner_records_personal_update" on planner_records;
drop policy if exists "planner_records_personal_delete" on planner_records;
drop policy if exists "planner_records_user_read" on planner_records;
drop policy if exists "planner_records_user_insert" on planner_records;
drop policy if exists "planner_records_user_update" on planner_records;
drop policy if exists "planner_records_user_delete" on planner_records;

-- Supabase Auth 기준 사용자별 분리 정책입니다.
-- 앱은 로그인된 사용자의 auth.uid()를 owner_id로 저장합니다.
create policy "planner_records_user_read"
  on planner_records for select
  using (owner_id = auth.uid()::text);

create policy "planner_records_user_insert"
  on planner_records for insert
  with check (owner_id = auth.uid()::text);

create policy "planner_records_user_update"
  on planner_records for update
  using (owner_id = auth.uid()::text)
  with check (owner_id = auth.uid()::text);

create policy "planner_records_user_delete"
  on planner_records for delete
  using (owner_id = auth.uid()::text);
