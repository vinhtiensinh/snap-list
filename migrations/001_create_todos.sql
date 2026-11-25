create table if not exists todos (
  id text primary key,
  owner text not null,
  stage text not null default 'production',
  title text not null,
  notes text not null default '',
  source text not null default 'manual',
  priority text not null default 'normal',
  due_on date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint todos_stage_check check (stage in ('production', 'preview')),
  constraint todos_source_check check (source in ('manual', 'messenger', 'sms', 'email', 'other')),
  constraint todos_priority_check check (priority in ('low', 'normal', 'high')),
  constraint todos_title_len check (char_length(title) between 1 and 280),
  constraint todos_notes_len check (char_length(notes) <= 4000)
);

create index if not exists todos_owner_stage_created_idx on todos (owner, stage, created_at desc);
