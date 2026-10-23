create extension if not exists pgcrypto;

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  company_name text not null,
  normalized_company_name text not null,
  domain text,
  normalized_domain text,
  website text,
  source_platform text check (source_platform in ('google_maps','meta_ads','manual','other')),
  source_url text,
  investment_offer_hint text,
  current_investment_branch text not null default 'unknown' check (current_investment_branch in ('recurring_payout','buyback_maturity','both','unknown')),
  current_offer_summary text,
  current_investment_confidence double precision not null default 0 check (current_investment_confidence between 0 and 1),
  total_score integer not null default 0 check (total_score between 0 and 100),
  icp_fit_score integer not null default 0 check (icp_fit_score between 0 and 40),
  decision_maker_score integer not null default 0 check (decision_maker_score between 0 and 30),
  reachability_score integer not null default 0 check (reachability_score between 0 and 30),
  grade text not null default 'C' check (grade in ('A','B','C')),
  primary_contact_name text,
  primary_contact_role text,
  primary_email text,
  primary_email_verification text,
  primary_phone text,
  primary_whatsapp text,
  secondary_contact_name text,
  secondary_contact_role text,
  best_route_type text,
  best_route_value text,
  reachability text not null default 'none' check (reachability in ('direct_email','phone_or_whatsapp','company_route','none')),
  latest_enrichment_run_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  last_enriched_at timestamptz
);

create unique index leads_normalized_domain_unique on public.leads (normalized_domain) where normalized_domain is not null;
create unique index leads_name_without_domain_unique on public.leads (normalized_company_name) where normalized_domain is null;
create index leads_priority_idx on public.leads (total_score desc, last_enriched_at desc);
create index leads_grade_idx on public.leads (grade);
create index leads_branch_idx on public.leads (current_investment_branch);
create index leads_reachability_idx on public.leads (reachability);
create index leads_company_search_idx on public.leads (normalized_company_name);

create table public.enrichment_runs (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  status text not null check (status in ('running','succeeded','failed')),
  enrichment_input jsonb not null,
  final_result jsonb,
  score_snapshot jsonb,
  warnings jsonb not null default '[]'::jsonb,
  error_metadata jsonb,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  constraint completed_run_shape check (
    (status = 'running' and completed_at is null) or
    (status = 'succeeded' and completed_at is not null and final_result is not null) or
    (status = 'failed' and completed_at is not null and error_metadata is not null)
  )
);
create index enrichment_runs_lead_history_idx on public.enrichment_runs (lead_id, started_at desc);
create unique index enrichment_runs_one_running_per_lead on public.enrichment_runs (lead_id) where status = 'running';

alter table public.leads add constraint leads_latest_run_fk foreign key (latest_enrichment_run_id) references public.enrichment_runs(id) on delete set null;

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  enrichment_run_id uuid not null references public.enrichment_runs(id) on delete cascade,
  name text not null,
  title text not null,
  role_category text not null,
  relevance text not null,
  work_email text,
  email_verification text,
  business_phone text,
  business_whatsapp text,
  confidence double precision not null check (confidence between 0 and 1),
  contact_status text not null check (contact_status in ('primary','secondary','other')),
  source_urls jsonb not null default '[]'::jsonb,
  evidence_snippet text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index contacts_lead_current_idx on public.contacts (lead_id, enrichment_run_id, contact_status);
create index contacts_name_idx on public.contacts (lower(name));

create table public.evidence_sources (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads(id) on delete cascade,
  enrichment_run_id uuid not null references public.enrichment_runs(id) on delete cascade,
  source_url text not null,
  source_type text not null check (source_type in ('company_site','web_search','hunter','user_input')),
  title text,
  snippet text,
  supports jsonb not null,
  retrieved_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index evidence_sources_run_idx on public.evidence_sources (enrichment_run_id);

alter table public.leads enable row level security;
alter table public.enrichment_runs enable row level security;
alter table public.contacts enable row level security;
alter table public.evidence_sources enable row level security;

create or replace function public.execfind_begin_run(
  p_input jsonb, p_normalized_name text, p_identity_domain text default null, p_lead_id uuid default null
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_lead_id uuid; v_run_id uuid;
begin
  if p_normalized_name is null or length(p_normalized_name) < 2 then raise exception 'Invalid normalized company name'; end if;
  perform pg_advisory_xact_lock(hashtextextended(coalesce(p_identity_domain, p_normalized_name), 0));
  if p_lead_id is not null then
    select id into v_lead_id from public.leads where id = p_lead_id for update;
    if v_lead_id is null then raise exception 'Lead not found'; end if;
  elsif p_identity_domain is not null then
    select id into v_lead_id from public.leads where normalized_domain = p_identity_domain for update;
    if v_lead_id is null then
      select id into v_lead_id from public.leads where normalized_company_name = p_normalized_name and normalized_domain is null order by created_at asc limit 1 for update;
    end if;
  else
    select id into v_lead_id from public.leads where normalized_company_name = p_normalized_name order by (normalized_domain is null) desc, created_at asc limit 1 for update;
  end if;
  if v_lead_id is null then
    insert into public.leads (company_name, normalized_company_name, domain, normalized_domain, website, source_platform, source_url, investment_offer_hint)
    values (p_input->>'companyName', p_normalized_name, p_identity_domain, p_identity_domain, nullif(p_input->>'website',''), nullif(p_input->>'sourcePlatform',''), nullif(p_input->>'sourceUrl',''), nullif(p_input->>'investmentOfferHint',''))
    returning id into v_lead_id;
  end if;
  if exists (select 1 from public.enrichment_runs where lead_id = v_lead_id and status = 'running') then
    raise exception 'An enrichment run is already active for this lead' using errcode = 'P0001';
  end if;
  insert into public.enrichment_runs (lead_id, status, enrichment_input) values (v_lead_id, 'running', p_input) returning id into v_run_id;
  return jsonb_build_object('lead_id', v_lead_id, 'run_id', v_run_id);
end $$;

create or replace function public.execfind_complete_run(
  p_lead_id uuid, p_run_id uuid, p_input jsonb, p_result jsonb, p_snapshot jsonb,
  p_contacts jsonb, p_evidence jsonb, p_score jsonb, p_warnings jsonb
) returns jsonb language plpgsql security definer set search_path = public as $$
declare v_target_id uuid := p_lead_id; v_domain text := nullif(p_snapshot->>'normalizedDomain',''); item jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended(coalesce(v_domain, p_snapshot->>'normalizedCompanyName'), 0));
  if not exists (select 1 from public.enrichment_runs where id = p_run_id and lead_id = p_lead_id and status = 'running' for update) then
    raise exception 'Running enrichment record not found';
  end if;
  if v_domain is not null then
    select id into v_target_id from public.leads where normalized_domain = v_domain and id <> p_lead_id for update;
    if v_target_id is null then v_target_id := p_lead_id; end if;
  end if;
  if v_target_id <> p_lead_id then
    update public.enrichment_runs set lead_id = v_target_id where lead_id = p_lead_id;
    update public.contacts set lead_id = v_target_id where lead_id = p_lead_id;
    update public.evidence_sources set lead_id = v_target_id where lead_id = p_lead_id;
    delete from public.leads where id = p_lead_id;
  end if;
  update public.enrichment_runs set status = 'succeeded', final_result = p_result, score_snapshot = p_score,
    warnings = coalesce(p_warnings, '[]'::jsonb), completed_at = now()
  where id = p_run_id and lead_id = v_target_id;
  for item in select value from jsonb_array_elements(coalesce(p_contacts, '[]'::jsonb)) loop
    insert into public.contacts (lead_id, enrichment_run_id, name, title, role_category, relevance, work_email, email_verification, business_phone, business_whatsapp, confidence, contact_status, source_urls, evidence_snippet)
    values (v_target_id, p_run_id, item->>'name', item->>'title', item->>'roleCategory', item->>'relevance', nullif(item->>'workEmail',''), nullif(item->>'emailVerification',''), nullif(item->>'businessPhone',''), nullif(item->>'businessWhatsapp',''), (item->>'confidence')::double precision, item->>'status', coalesce(item->'sourceUrls','[]'::jsonb), item->>'evidenceSnippet');
  end loop;
  for item in select value from jsonb_array_elements(coalesce(p_evidence, '[]'::jsonb)) loop
    insert into public.evidence_sources (lead_id, enrichment_run_id, source_url, source_type, title, snippet, supports, retrieved_at)
    values (v_target_id, p_run_id, item->>'sourceUrl', item->>'sourceType', nullif(item->>'title',''), nullif(item->>'snippet',''), item->'supports', (item->>'retrievedAt')::timestamptz);
  end loop;
  update public.leads set
    company_name = p_snapshot->>'companyName', normalized_company_name = p_snapshot->>'normalizedCompanyName',
    domain = nullif(p_snapshot->>'domain',''), normalized_domain = v_domain, website = nullif(p_snapshot->>'website',''),
    source_platform = coalesce(nullif(p_input->>'sourcePlatform',''), source_platform), source_url = coalesce(nullif(p_input->>'sourceUrl',''), source_url),
    investment_offer_hint = coalesce(nullif(p_input->>'investmentOfferHint',''), investment_offer_hint),
    current_investment_branch = p_snapshot->>'investmentBranch', current_offer_summary = nullif(p_snapshot->>'offerSummary',''),
    current_investment_confidence = (p_snapshot->>'investmentConfidence')::double precision,
    total_score = (p_snapshot->>'totalScore')::integer, icp_fit_score = (p_snapshot->>'icpFitScore')::integer,
    decision_maker_score = (p_snapshot->>'decisionMakerScore')::integer, reachability_score = (p_snapshot->>'reachabilityScore')::integer,
    grade = p_snapshot->>'grade', primary_contact_name = nullif(p_snapshot->>'primaryContactName',''), primary_contact_role = nullif(p_snapshot->>'primaryContactRole',''),
    primary_email = nullif(p_snapshot->>'primaryEmail',''), primary_email_verification = nullif(p_snapshot->>'primaryEmailVerification',''),
    primary_phone = nullif(p_snapshot->>'primaryPhone',''), primary_whatsapp = nullif(p_snapshot->>'primaryWhatsapp',''),
    secondary_contact_name = nullif(p_snapshot->>'secondaryContactName',''), secondary_contact_role = nullif(p_snapshot->>'secondaryContactRole',''),
    best_route_type = nullif(p_snapshot->>'bestRouteType',''), best_route_value = nullif(p_snapshot->>'bestRouteValue',''), reachability = p_snapshot->>'reachability',
    latest_enrichment_run_id = p_run_id, last_enriched_at = now(), updated_at = now()
  where id = v_target_id;
  return jsonb_build_object('lead_id', v_target_id, 'run_id', p_run_id);
end $$;

create or replace function public.execfind_fail_run(p_lead_id uuid, p_run_id uuid, p_error jsonb)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.enrichment_runs set status = 'failed', error_metadata = p_error, completed_at = now()
  where id = p_run_id and lead_id = p_lead_id and status = 'running';
  if not found then raise exception 'Running enrichment record not found'; end if;
end $$;

create or replace function public.execfind_lead_json(l public.leads) returns jsonb language sql stable set search_path = public as $$
  select jsonb_build_object(
    'id',l.id,'companyName',l.company_name,'domain',l.domain,'website',l.website,'sourcePlatform',l.source_platform,'sourceUrl',l.source_url,
    'investmentBranch',l.current_investment_branch,'offerSummary',l.current_offer_summary,'investmentConfidence',l.current_investment_confidence,
    'totalScore',l.total_score,'icpFitScore',l.icp_fit_score,'decisionMakerScore',l.decision_maker_score,'reachabilityScore',l.reachability_score,'grade',l.grade,
    'primaryContactName',l.primary_contact_name,'primaryContactRole',l.primary_contact_role,'primaryEmail',l.primary_email,'primaryEmailVerification',l.primary_email_verification,
    'primaryPhone',l.primary_phone,'primaryWhatsapp',l.primary_whatsapp,'secondaryContactName',l.secondary_contact_name,'secondaryContactRole',l.secondary_contact_role,
    'bestRouteType',l.best_route_type,'bestRouteValue',l.best_route_value,'reachability',l.reachability,'lastEnrichedAt',l.last_enriched_at,
    'createdAt',l.created_at,'updatedAt',l.updated_at
  )
$$;

create or replace function public.execfind_list_leads(
  p_search text default '', p_grades text[] default '{}', p_branches text[] default '{}', p_reachability text[] default '{}',
  p_sort text default 'score_desc', p_limit integer default 100, p_offset integer default 0
) returns jsonb language plpgsql security definer set search_path = public as $$
declare result jsonb; normalized_search text := lower(trim(coalesce(p_search,'')));
begin
  if p_sort not in ('score_desc','newest','oldest','company_asc') then raise exception 'Invalid sort'; end if;
  if p_limit < 1 or p_limit > 5000 or p_offset < 0 then raise exception 'Invalid pagination'; end if;
  with filtered as (
    select l.* from public.leads l where l.latest_enrichment_run_id is not null
      and (cardinality(p_grades)=0 or l.grade = any(p_grades))
      and (cardinality(p_branches)=0 or l.current_investment_branch = any(p_branches))
      and (cardinality(p_reachability)=0 or l.reachability = any(p_reachability))
      and (normalized_search = '' or lower(l.company_name) like '%'||normalized_search||'%' or lower(coalesce(l.domain,'')) like '%'||normalized_search||'%'
        or lower(coalesce(l.primary_contact_name,'')) like '%'||normalized_search||'%' or lower(coalesce(l.primary_contact_role,'')) like '%'||normalized_search||'%'
        or lower(coalesce(l.secondary_contact_name,'')) like '%'||normalized_search||'%' or lower(coalesce(l.secondary_contact_role,'')) like '%'||normalized_search||'%')
  ), page as (
    select * from filtered order by
      case when p_sort='score_desc' then total_score end desc,
      case when p_sort='newest' then last_enriched_at end desc,
      case when p_sort='oldest' then last_enriched_at end asc,
      case when p_sort='company_asc' then company_name end asc,
      total_score desc, company_name asc limit p_limit offset p_offset
  )
  select jsonb_build_object(
    'items',coalesce((select jsonb_agg(public.execfind_lead_json(page)) from page),'[]'::jsonb),
    'total',(select count(*) from filtered),
    'summary',jsonb_build_object('total',(select count(*) from filtered),'gradeA',(select count(*) from filtered where grade='A'),
      'recurringPayout',(select count(*) from filtered where current_investment_branch='recurring_payout'),
      'buybackMaturity',(select count(*) from filtered where current_investment_branch='buyback_maturity'),'both',(select count(*) from filtered where current_investment_branch='both'))
  ) into result;
  return result;
end $$;

create or replace function public.execfind_get_lead(p_lead_id uuid) returns jsonb language plpgsql security definer set search_path = public as $$
declare result jsonb;
begin
  select jsonb_build_object(
    'lead',public.execfind_lead_json(l) || jsonb_build_object('investmentOfferHint',l.investment_offer_hint,'latestEnrichmentRunId',l.latest_enrichment_run_id),
    'runs',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'status',r.status,'input',r.enrichment_input,'result',r.final_result,'score',r.score_snapshot,
      'warnings',r.warnings,'error',r.error_metadata,'startedAt',r.started_at,'completedAt',r.completed_at) order by r.started_at desc)
      from public.enrichment_runs r where r.lead_id=l.id),'[]'::jsonb)
  ) into result from public.leads l where l.id=p_lead_id;
  return result;
end $$;

revoke all on public.leads, public.enrichment_runs, public.contacts, public.evidence_sources from anon, authenticated;
revoke all on function public.execfind_begin_run(jsonb,text,text,uuid), public.execfind_complete_run(uuid,uuid,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb),
  public.execfind_fail_run(uuid,uuid,jsonb), public.execfind_lead_json(public.leads), public.execfind_list_leads(text,text[],text[],text[],text,integer,integer), public.execfind_get_lead(uuid) from public, anon, authenticated;
grant execute on function public.execfind_begin_run(jsonb,text,text,uuid), public.execfind_complete_run(uuid,uuid,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb,jsonb),
  public.execfind_fail_run(uuid,uuid,jsonb), public.execfind_list_leads(text,text[],text[],text[],text,integer,integer), public.execfind_get_lead(uuid) to service_role;
