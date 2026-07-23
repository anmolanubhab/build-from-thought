-- Backs the redesigned People settings page:
--   1. Renames the non-owner role "member" -> "editor" (same permissions,
--      just the label the People page shows in Lovable-style UIs).
--   2. Email-based invitations, separate from the existing shareable
--      invite-code link, with a real pending/accepted/revoked lifecycle.
--   3. A credit-usage ledger so the People table can show real per-member
--      "this month" / "total" usage instead of made-up numbers.
--   4. get_workspace_roster(): one round trip returning members + pending
--      invitations with the email/usage columns the UI needs (auth.users
--      email isn't otherwise readable client-side).

-- 1. Role rename ------------------------------------------------------------
alter table public.workspace_members drop constraint workspace_members_role_check;
update public.workspace_members set role = 'editor' where role = 'member';
alter table public.workspace_members alter column role set default 'editor';
alter table public.workspace_members add constraint workspace_members_role_check check (role in ('owner', 'editor'));

create or replace function public.join_workspace_by_code(p_code text)
returns public.workspaces
language plpgsql
security definer
set search_path = public
as $$
declare
  v_workspace public.workspaces;
  v_inserted uuid;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into v_workspace from public.workspaces where invite_code = p_code;

  if v_workspace.id is null then
    raise exception 'Invalid invite link';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_workspace.id, auth.uid(), 'editor')
  on conflict (workspace_id, user_id) do nothing
  returning id into v_inserted;

  if v_inserted is not null and v_workspace.default_member_credit_limit is not null then
    update public.profiles
    set credits_daily_limit = v_workspace.default_member_credit_limit,
        credits_remaining = v_workspace.default_member_credit_limit
    where id = auth.uid();
  end if;

  return v_workspace;
end;
$$;

-- 2. Email invitations --------------------------------------------------------
create table public.workspace_invitations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  email text not null,
  role text not null default 'editor' check (role in ('editor')),
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  invited_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  responded_at timestamptz
);

alter table public.workspace_invitations enable row level security;

create index idx_workspace_invitations_workspace_id on public.workspace_invitations(workspace_id);
create unique index idx_workspace_invitations_pending_email on public.workspace_invitations(workspace_id, email) where (status = 'pending');

create policy "Workspace members can view invitations"
  on public.workspace_invitations for select
  using (exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = workspace_invitations.workspace_id and wm.user_id = auth.uid()
  ));

-- Writes go through the security-definer functions below (which also
-- validate role/email and enforce "owner only"), not direct table access.

create or replace function public.invite_workspace_member(p_workspace_id uuid, p_email text)
returns public.workspace_invitations
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitation public.workspace_invitations;
  v_email text := lower(trim(p_email));
begin
  if not exists (
    select 1 from public.workspace_members wm
    where wm.workspace_id = p_workspace_id and wm.user_id = auth.uid() and wm.role = 'owner'
  ) then
    raise exception 'Only the workspace owner can invite members';
  end if;

  if v_email = '' or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Enter a valid email address';
  end if;

  if exists (
    select 1 from public.workspace_members wm
    join auth.users u on u.id = wm.user_id
    where wm.workspace_id = p_workspace_id and lower(u.email) = v_email
  ) then
    raise exception 'That person is already a member';
  end if;

  insert into public.workspace_invitations (workspace_id, email, invited_by)
  values (p_workspace_id, v_email, auth.uid())
  on conflict (workspace_id, email) where (status = 'pending')
  do update set created_at = now(), invited_by = auth.uid()
  returning * into v_invitation;

  return v_invitation;
end;
$$;

create or replace function public.revoke_workspace_invitation(p_invitation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.workspace_invitations wi
  set status = 'revoked', responded_at = now()
  where wi.id = p_invitation_id
    and wi.status = 'pending'
    and exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = wi.workspace_id and wm.user_id = auth.uid() and wm.role = 'owner'
    );

  if not found then
    raise exception 'Invitation not found or not permitted';
  end if;
end;
$$;

create or replace function public.accept_workspace_invitation(p_invitation_id uuid)
returns public.workspaces
language plpgsql
security definer
set search_path = public
as $$
declare
  v_invitation public.workspace_invitations;
  v_workspace public.workspaces;
  v_email text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select email into v_email from auth.users where id = auth.uid();

  select * into v_invitation from public.workspace_invitations
  where id = p_invitation_id and status = 'pending' and lower(email) = lower(v_email);

  if v_invitation.id is null then
    raise exception 'Invitation not found';
  end if;

  insert into public.workspace_members (workspace_id, user_id, role)
  values (v_invitation.workspace_id, auth.uid(), v_invitation.role)
  on conflict (workspace_id, user_id) do nothing;

  update public.workspace_invitations set status = 'accepted', responded_at = now() where id = v_invitation.id;

  select * into v_workspace from public.workspaces where id = v_invitation.workspace_id;
  return v_workspace;
end;
$$;

-- 3. Credit usage ledger ------------------------------------------------------
create table public.credit_usage_events (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount int not null default 1,
  created_at timestamptz not null default now()
);

alter table public.credit_usage_events enable row level security;

create index idx_credit_usage_events_user_id_created_at on public.credit_usage_events(user_id, created_at);

create policy "Users can log their own credit usage"
  on public.credit_usage_events for insert
  with check (user_id = auth.uid());

create policy "Users can view own usage, owners can view co-members' usage"
  on public.credit_usage_events for select
  using (
    user_id = auth.uid()
    or exists (
      select 1 from public.workspace_members wm_target
      join public.workspace_members wm_owner on wm_owner.workspace_id = wm_target.workspace_id
      where wm_target.user_id = credit_usage_events.user_id
        and wm_owner.user_id = auth.uid()
        and wm_owner.role = 'owner'
    )
  );

-- 4. Roster read model ---------------------------------------------------
create or replace function public.get_workspace_roster(p_workspace_id uuid)
returns table (
  kind text,
  id uuid,
  user_id uuid,
  email text,
  display_name text,
  username text,
  avatar_url text,
  role text,
  status text,
  joined_at timestamptz,
  credit_limit int,
  usage_month bigint,
  usage_total bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.workspace_members me
    where me.workspace_id = p_workspace_id and me.user_id = auth.uid()
  ) then
    raise exception 'Not a member of this workspace';
  end if;

  return query
  select
    'member'::text,
    wm.id,
    wm.user_id,
    u.email::text,
    p.display_name,
    p.username,
    p.avatar_url,
    wm.role,
    'active'::text,
    wm.created_at,
    p.credits_daily_limit,
    coalesce((select sum(e.amount) from public.credit_usage_events e
      where e.user_id = wm.user_id and e.created_at >= date_trunc('month', now())), 0),
    coalesce((select sum(e.amount) from public.credit_usage_events e where e.user_id = wm.user_id), 0)
  from public.workspace_members wm
  join auth.users u on u.id = wm.user_id
  left join public.profiles p on p.id = wm.user_id
  where wm.workspace_id = p_workspace_id

  union all

  select
    'invitation'::text,
    wi.id,
    null::uuid,
    wi.email,
    null::text,
    null::text,
    null::text,
    wi.role,
    wi.status,
    wi.created_at,
    null::int,
    0::bigint,
    0::bigint
  from public.workspace_invitations wi
  where wi.workspace_id = p_workspace_id and wi.status = 'pending';
end;
$$;
