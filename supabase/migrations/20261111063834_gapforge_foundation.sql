-- GapForge foundation. Run only in a dedicated local/new project after review.
-- No SECURITY DEFINER functions or service-role access are used.
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text, created_at timestamptz not null default now()
);
create table public.research_projects (
  id uuid primary key, owner_id uuid not null references auth.users(id) on delete cascade,
  question text not null check (length(question) between 15 and 12000),
  workspace jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  unique(id, owner_id)
);
create index research_projects_owner_updated on public.research_projects(owner_id, updated_at desc);
create table public.papers (
  id uuid primary key default gen_random_uuid(), owner_id uuid not null references auth.users(id) on delete cascade,
  external_key text not null, title text not null, year integer,
  metadata jsonb not null, unique(owner_id, external_key), unique(id, owner_id)
);
create table public.paper_identifiers (
  owner_id uuid not null, paper_id uuid not null, scheme text not null check(scheme in ('doi','openalex','semantic-scholar')), value text not null,
  primary key(paper_id, scheme), foreign key(paper_id,owner_id) references public.papers(id,owner_id) on delete cascade,
  unique(owner_id,scheme,value)
);
create index paper_identifiers_owner on public.paper_identifiers(owner_id);
create table public.project_papers (
  project_id uuid not null, paper_id uuid not null, owner_id uuid not null,
  source_key text not null, bookmarked boolean not null default false, position jsonb,
  primary key(project_id,paper_id),
  foreign key(project_id,owner_id) references public.research_projects(id,owner_id) on delete cascade,
  foreign key(paper_id,owner_id) references public.papers(id,owner_id) on delete cascade
);
create index project_papers_owner on public.project_papers(owner_id,project_id);
create index project_papers_paper on public.project_papers(paper_id,owner_id);
create table public.paper_references (
  owner_id uuid not null, paper_id uuid not null, reference_external_id text not null,
  primary key(paper_id,reference_external_id),
  foreign key(paper_id,owner_id) references public.papers(id,owner_id) on delete cascade
);
create index paper_references_owner on public.paper_references(owner_id);
create table public.research_queries (
  id uuid primary key default gen_random_uuid(), project_id uuid not null, owner_id uuid not null,
  query text not null, mode text not null, run_at timestamptz not null,
  foreign key(project_id,owner_id) references public.research_projects(id,owner_id) on delete cascade,
  unique(project_id,query,run_at)
);
create table public.graph_edges (
  id uuid primary key default gen_random_uuid(), external_key text not null, project_id uuid not null, owner_id uuid not null,
  source_key text not null, target_key text not null, relation text not null,
  verified boolean not null, evidence jsonb not null,
  foreign key(project_id,owner_id) references public.research_projects(id,owner_id) on delete cascade,
  unique(project_id,external_key)
);
create table public.research_clusters (
  id uuid primary key default gen_random_uuid(), project_id uuid not null, owner_id uuid not null,
  label text not null, paper_keys text[] not null, method text not null default 'first provider topic',
  foreign key(project_id,owner_id) references public.research_projects(id,owner_id) on delete cascade,
  unique(project_id,label)
);
create table public.novelty_challenges (
  id uuid primary key default gen_random_uuid(), project_id uuid not null, owner_id uuid not null,
  kind text not null check(kind in ('analysis','challenge')), content jsonb not null,
  foreign key(project_id,owner_id) references public.research_projects(id,owner_id) on delete cascade,
  unique(project_id,kind)
);
create table public.gap_hypotheses (
  id uuid primary key default gen_random_uuid(), external_key text not null, project_id uuid not null, owner_id uuid not null,
  content jsonb not null, saved boolean not null default false,
  foreign key(project_id,owner_id) references public.research_projects(id,owner_id) on delete cascade,
  unique(project_id,external_key)
);
create table public.experiment_designs (
  project_id uuid primary key, owner_id uuid not null, content jsonb not null,
  foreign key(project_id,owner_id) references public.research_projects(id,owner_id) on delete cascade
);
create table public.project_notes (
  project_id uuid primary key, owner_id uuid not null, content text not null default '',
  foreign key(project_id,owner_id) references public.research_projects(id,owner_id) on delete cascade
);
create table public.research_reports (
  id uuid primary key default gen_random_uuid(), project_id uuid not null, owner_id uuid not null,
  format text not null check(format in ('markdown','pdf')), content text not null, created_at timestamptz not null default now(),
  foreign key(project_id,owner_id) references public.research_projects(id,owner_id) on delete cascade
);
create table public.analysis_jobs (
  id uuid primary key default gen_random_uuid(), project_id uuid not null, owner_id uuid not null,
  status text not null check(status in ('queued','running','completed','failed','cancelled')),
  stage text, input jsonb not null, error text, attempt integer not null default 1,
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  foreign key(project_id,owner_id) references public.research_projects(id,owner_id) on delete cascade
);
-- Every exposed table has RLS. Composite foreign keys enforce parent ownership.
alter table public.profiles enable row level security;
create policy own_profile on public.profiles for all to authenticated
  using ((select auth.uid())=id) with check ((select auth.uid())=id);
grant select,insert,update,delete on public.profiles to authenticated;
revoke all on public.profiles from anon;
do $policies$
declare tbl text;
begin
  foreach tbl in array array['research_projects','papers','paper_identifiers','project_papers','paper_references','research_queries','graph_edges','research_clusters','novelty_challenges','gap_hypotheses','experiment_designs','project_notes','research_reports','analysis_jobs'] loop
    execute format('alter table public.%I enable row level security',tbl);
    execute format('create policy own_rows on public.%I for all to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id)',tbl);
    execute format('grant select,insert,update,delete on public.%I to authenticated',tbl);
    execute format('revoke all on public.%I from anon',tbl);
  end loop;
  foreach tbl in array array['research_queries','graph_edges','research_clusters','novelty_challenges','gap_hypotheses','experiment_designs','project_notes','research_reports','analysis_jobs'] loop
    execute format('create index %I on public.%I(owner_id,project_id)',tbl||'_owner_project',tbl);
  end loop;
end $policies$;
grant usage on schema public to authenticated;

-- Atomic, idempotent save of a verified project bundle. RLS applies to every statement.
create function public.save_research_project(payload jsonb) returns uuid
language plpgsql security invoker set search_path='' as $save$
declare
  uid uuid := auth.uid(); pid uuid := (payload->>'id')::uuid;
  item jsonb; entry jsonb; run jsonb; query jsonb; record_id uuid; kind text;
  paper_key text;
begin
  if uid is null then raise exception 'Authentication required' using errcode='42501'; end if;
  insert into public.research_projects(id,owner_id,question,workspace,created_at,updated_at)
  values(pid,uid,payload->>'question',payload - array['papers','assessment','challenge','experiment','notes','bookmarks','savedGaps','positions','edges','clusters'],(payload->>'createdAt')::timestamptz,(payload->>'updatedAt')::timestamptz)
  on conflict(id) do update set question=excluded.question, workspace=excluded.workspace, updated_at=excluded.updated_at;
  delete from public.project_papers where project_id=pid;
  for item in select value from jsonb_array_elements(payload->'papers') loop
    paper_key:=item->>'id';
    -- Reuse metadata within the user's catalogue across projects, including cross-provider DOI matches.
    select p.id into record_id from public.papers p
      where p.owner_id=uid and (p.external_key=paper_key or
        (item->>'doi' is not null and p.metadata->>'doi'=item->>'doi') or
        (item->>'openalexId' is not null and p.metadata->>'openalexId'=item->>'openalexId') or
        (item->>'semanticId' is not null and p.metadata->>'semanticId'=item->>'semanticId')) limit 1;
    if record_id is null then
      insert into public.papers(owner_id,external_key,title,year,metadata)
      values(uid,paper_key,item->>'title',(item->>'year')::integer,item-array['id','title','year','references']) returning id into record_id;
    else
      update public.papers set metadata=metadata||(item-array['id','title','year','references']),title=item->>'title',year=(item->>'year')::integer where id=record_id;
    end if;
    insert into public.project_papers(project_id,owner_id,paper_id,source_key,bookmarked,position)
      values(pid,uid,record_id,paper_key,coalesce(payload->'bookmarks' ? paper_key,false),payload->'positions'->paper_key);
    for entry in select value from jsonb_array_elements(item->'references') loop
      insert into public.paper_references(owner_id,paper_id,reference_external_id) values(uid,record_id,entry#>>'{}') on conflict do nothing;
    end loop;
    for kind in select unnest(array['doi','openalexId','semanticId']) loop
      if item->>kind is not null then
        insert into public.paper_identifiers(owner_id,paper_id,scheme,value)
          values(uid,record_id,case kind when 'openalexId' then 'openalex' when 'semanticId' then 'semantic-scholar' else kind end,item->>kind)
          on conflict(paper_id,scheme) do update set value=excluded.value;
      end if;
    end loop;
  end loop;
  delete from public.novelty_challenges where project_id=pid;
  delete from public.gap_hypotheses where project_id=pid;
  for kind in select unnest(array['analysis','challenge']) loop
    item:=case kind when 'analysis' then payload->'assessment' else payload->'challenge' end;
    if item is not null and item<>'null'::jsonb then
      insert into public.novelty_challenges(project_id,owner_id,kind,content) values(pid,uid,kind,item);
      for entry in select value from jsonb_array_elements(item->'gaps') loop
        insert into public.gap_hypotheses(project_id,owner_id,external_key,content,saved)
          values(pid,uid,entry->>'id',entry,coalesce(payload->'savedGaps' ? (entry->>'id'),false))
          on conflict(project_id,external_key) do update set content=excluded.content,saved=excluded.saved;
      end loop;
    end if;
  end loop;
  delete from public.experiment_designs where project_id=pid;
  if payload->'experiment' is not null and payload->'experiment'<>'null'::jsonb then
    insert into public.experiment_designs(project_id,owner_id,content) values(pid,uid,payload->'experiment');
  end if;
  insert into public.project_notes(project_id,owner_id,content) values(pid,uid,coalesce(payload->>'notes',''))
    on conflict(project_id) do update set content=excluded.content;
  delete from public.graph_edges where project_id=pid;
  for entry in select value from jsonb_array_elements(coalesce(payload->'edges','[]'::jsonb)) loop
    insert into public.graph_edges(project_id,owner_id,external_key,source_key,target_key,relation,verified,evidence)
      values(pid,uid,entry->>'id',entry->>'source',entry->>'target',entry->>'type',(entry->>'verified')::boolean,entry->'evidence');
  end loop;
  delete from public.research_clusters where project_id=pid;
  for entry in select value from jsonb_array_elements(coalesce(payload->'clusters','[]'::jsonb)) loop
    insert into public.research_clusters(project_id,owner_id,label,paper_keys)
      values(pid,uid,entry->>'label',array(select jsonb_array_elements_text(entry->'paperIds')));
  end loop;
  for run in select value from jsonb_array_elements(payload->'searchHistory') loop
    for query in select value from jsonb_array_elements(run->'queries') loop
      insert into public.research_queries(project_id,owner_id,query,mode,run_at)
        values(pid,uid,query#>>'{}',run->>'mode',(run->>'at')::timestamptz) on conflict do nothing;
    end loop;
  end loop;
  return pid;
end $save$;
revoke all on function public.save_research_project(jsonb) from public,anon;
grant execute on function public.save_research_project(jsonb) to authenticated;
