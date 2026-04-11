-- 在 Supabase SQL Editor 中执行此脚本来创建数据表

-- 1. 创建项目表
create table if not exists flow_projects (
  id text primary key,
  name text not null default '',
  nodes jsonb not null default '[]'::jsonb,
  edges jsonb not null default '[]'::jsonb,
  scenario_rules jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

-- 2. 开启 Row Level Security（但允许所有人读写，适合团队内部使用）
alter table flow_projects enable row level security;

create policy "允许所有人读取" on flow_projects
  for select using (true);

create policy "允许所有人写入" on flow_projects
  for insert with check (true);

create policy "允许所有人更新" on flow_projects
  for update using (true);

create policy "允许所有人删除" on flow_projects
  for delete using (true);

-- 3. 开启实时同步（关键！）
alter publication supabase_realtime add table flow_projects;
