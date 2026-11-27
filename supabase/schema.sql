-- LOOP: Supabase database + storage setup
-- Run this entire file in Supabase Dashboard -> SQL Editor on a new project.
-- The browser uses the publishable key only. Never put the service_role key in VITE_* variables.

create extension if not exists pgcrypto;

-- ============================================================
-- TABLES
-- ============================================================

create table if not exists public.private_user_data (
  user_id uuid primary key references auth.users(id) on delete cascade,
  date_of_birth date not null,
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  constraint private_user_min_age check (date_of_birth <= (current_date - interval '13 years')::date)
);

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text not null unique check (username ~ '^[a-zA-Z0-9_.]{3,24}$'),
  display_name text not null default 'New creator' check (char_length(display_name) between 1 and 40),
  bio text not null default '' check (char_length(bio) <= 160),
  avatar_url text,
  is_private boolean not null default true,
  is_suspended boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.follows (
  follower_id uuid not null references public.profiles(id) on delete cascade,
  following_id uuid not null references public.profiles(id) on delete cascade,
  status text not null default 'accepted' check (status in ('pending', 'accepted')),
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  constraint no_self_follow check (follower_id <> following_id)
);

create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint no_self_block check (blocker_id <> blocked_id)
);

create table if not exists public.posts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  video_path text not null unique,
  caption text not null default '' check (char_length(caption) <= 220),
  hashtags text[] not null default '{}',
  duration_seconds numeric(5,2) not null check (duration_seconds > 0 and duration_seconds <= 10.00),
  visibility text not null default 'public' check (visibility in ('public', 'followers', 'private')),
  moderation_status text not null default 'review' check (moderation_status in ('approved', 'review', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.likes (
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table if not exists public.comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.posts(id) on delete cascade,
  user_id uuid not null references public.profiles(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  moderation_status text not null default 'approved' check (moderation_status in ('approved', 'review', 'removed')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.saved_posts (
  user_id uuid not null references public.profiles(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null check (target_type in ('post', 'user', 'comment')),
  target_id uuid not null,
  reason text not null check (char_length(reason) between 3 and 100),
  details text check (char_length(details) <= 400),
  status text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz
);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid not null references public.profiles(id) on delete cascade,
  actor_id uuid not null references public.profiles(id) on delete cascade,
  type text not null check (type in ('follow', 'follow_request', 'like', 'comment')),
  post_id uuid references public.posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  read_at timestamptz,
  constraint no_self_notification check (recipient_id <> actor_id)
);

-- Helpful indexes for timelines and moderation.
create index if not exists posts_created_at_idx on public.posts (created_at desc);
create index if not exists posts_user_created_idx on public.posts (user_id, created_at desc);
create index if not exists posts_status_created_idx on public.posts (moderation_status, created_at desc);
create index if not exists follows_following_status_idx on public.follows (following_id, status);
create index if not exists follows_follower_status_idx on public.follows (follower_id, status);
create index if not exists comments_post_created_idx on public.comments (post_id, created_at);
create index if not exists notifications_recipient_created_idx on public.notifications (recipient_id, created_at desc);
create index if not exists reports_status_created_idx on public.reports (status, created_at desc);

-- ============================================================
-- SECURITY HELPERS (SECURITY DEFINER avoids policy recursion)
-- ============================================================

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.private_user_data pud
    where pud.user_id = auth.uid() and pud.role = 'admin'
  );
$$;

create or replace function public.is_minor(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((
    select pud.date_of_birth > (current_date - interval '18 years')::date
    from public.private_user_data pud
    where pud.user_id = p_user_id
  ), true);
$$;

create or replace function public.is_blocked_between(p_user_a uuid, p_user_b uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.blocks b
    where (b.blocker_id = p_user_a and b.blocked_id = p_user_b)
       or (b.blocker_id = p_user_b and b.blocked_id = p_user_a)
  );
$$;

create or replace function public.can_view_profile(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_profile_id = auth.uid() or public.is_admin() then true
    when public.is_blocked_between(auth.uid(), p_profile_id) then false
    else exists (
      select 1 from public.profiles p
      where p.id = p_profile_id and not p.is_suspended
        and (
          not p.is_private
          or exists (
            select 1 from public.follows f
            where f.follower_id = auth.uid() and f.following_id = p_profile_id and f.status = 'accepted'
          )
        )
    )
  end;
$$;

create or replace function public.can_view_post(p_owner_id uuid, p_visibility text, p_moderation_status text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select case
    when p_owner_id = auth.uid() or public.is_admin() then p_moderation_status <> 'removed'
    when public.is_blocked_between(auth.uid(), p_owner_id) then false
    else exists (
      select 1 from public.profiles p
      where p.id = p_owner_id and not p.is_suspended
        and p_moderation_status = 'approved'
        and (
          (not p.is_private and p_visibility = 'public')
          or (
            p_visibility in ('public', 'followers')
            and exists (
              select 1 from public.follows f
              where f.follower_id = auth.uid() and f.following_id = p_owner_id and f.status = 'accepted'
            )
          )
        )
    )
  end;
$$;

create or replace function public.can_read_video_object(p_path text)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.posts p
    where p.video_path = p_path
      and public.can_view_post(p.user_id, p.visibility, p.moderation_status)
  );
$$;

-- ============================================================
-- AUTH + PRIVACY TRIGGERS
-- ============================================================

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dob date;
  v_username text;
  v_display_name text;
begin
  begin
    v_dob := (new.raw_user_meta_data ->> 'date_of_birth')::date;
  exception when others then
    raise exception 'A valid date of birth is required.';
  end;

  if v_dob is null or v_dob > (current_date - interval '13 years')::date then
    raise exception 'Loop is for people aged 13 and above.';
  end if;

  v_username := lower(regexp_replace(coalesce(new.raw_user_meta_data ->> 'username', ''), '[^a-zA-Z0-9_.]', '', 'g'));
  if char_length(v_username) < 3 or char_length(v_username) > 24 then
    raise exception 'Username must be 3 to 24 characters.';
  end if;
  v_display_name := left(trim(coalesce(new.raw_user_meta_data ->> 'display_name', v_username)), 40);
  if v_display_name = '' then v_display_name := v_username; end if;

  insert into public.private_user_data (user_id, date_of_birth, role)
  values (new.id, v_dob, 'user');

  insert into public.profiles (id, username, display_name, is_private)
  values (new.id, v_username, v_display_name, v_dob > (current_date - interval '18 years')::date);

  return new;
end;
$$;

drop trigger if exists on_auth_user_created_loop on auth.users;
create trigger on_auth_user_created_loop
after insert on auth.users
for each row execute procedure public.handle_new_user();

create or replace function public.enforce_minor_privacy()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_minor(new.id) then
    new.is_private := true;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_minor_privacy_on_profile on public.profiles;
create trigger enforce_minor_privacy_on_profile
before insert or update of is_private on public.profiles
for each row execute procedure public.enforce_minor_privacy();

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_touch_updated_at on public.profiles;
create trigger profiles_touch_updated_at before update on public.profiles for each row execute procedure public.touch_updated_at();
drop trigger if exists posts_touch_updated_at on public.posts;
create trigger posts_touch_updated_at before update on public.posts for each row execute procedure public.touch_updated_at();
drop trigger if exists comments_touch_updated_at on public.comments;
create trigger comments_touch_updated_at before update on public.comments for each row execute procedure public.touch_updated_at();

-- A creator can edit a caption/visibility, but cannot reverse a moderation decision.
create or replace function public.protect_moderation_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.moderation_status is distinct from old.moderation_status and not public.is_admin() then
    raise exception 'Only Loop moderators can change moderation status.';
  end if;
  return new;
end;
$$;

drop trigger if exists protect_post_moderation_status on public.posts;
create trigger protect_post_moderation_status before update on public.posts for each row execute procedure public.protect_moderation_status();
drop trigger if exists protect_comment_moderation_status on public.comments;
create trigger protect_comment_moderation_status before update on public.comments for each row execute procedure public.protect_moderation_status();

-- Private profiles automatically receive follow requests; public profiles accept follows immediately.
create or replace function public.set_follow_status()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_private boolean;
begin
  select p.is_private into v_private from public.profiles p where p.id = new.following_id;
  if v_private is null then raise exception 'Creator not found.'; end if;
  if new.follower_id <> auth.uid() and not public.is_admin() then
    raise exception 'You can only follow from your own account.';
  end if;
  if v_private then new.status := 'pending'; else new.status := 'accepted'; end if;
  return new;
end;
$$;

drop trigger if exists set_follow_status_before_insert on public.follows;
create trigger set_follow_status_before_insert before insert on public.follows for each row execute procedure public.set_follow_status();

-- ============================================================
-- NOTIFICATION TRIGGERS
-- ============================================================

create or replace function public.notify_follow()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.notifications (recipient_id, actor_id, type)
  values (new.following_id, new.follower_id, case when new.status = 'pending' then 'follow_request' else 'follow' end);
  return new;
end;
$$;
drop trigger if exists notify_follow_insert on public.follows;
create trigger notify_follow_insert after insert on public.follows for each row execute procedure public.notify_follow();

create or replace function public.notify_follow_accepted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status = 'pending' and new.status = 'accepted' then
    insert into public.notifications (recipient_id, actor_id, type)
    values (new.follower_id, new.following_id, 'follow');
  end if;
  return new;
end;
$$;
drop trigger if exists notify_follow_accepted_update on public.follows;
create trigger notify_follow_accepted_update after update on public.follows for each row execute procedure public.notify_follow_accepted();

create or replace function public.notify_like()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_owner uuid;
begin
  select user_id into v_owner from public.posts where id = new.post_id;
  if v_owner is not null and v_owner <> new.user_id then
    insert into public.notifications (recipient_id, actor_id, type, post_id) values (v_owner, new.user_id, 'like', new.post_id);
  end if;
  return new;
end;
$$;
drop trigger if exists notify_like_insert on public.likes;
create trigger notify_like_insert after insert on public.likes for each row execute procedure public.notify_like();

create or replace function public.notify_comment()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_owner uuid;
begin
  select user_id into v_owner from public.posts where id = new.post_id;
  if v_owner is not null and v_owner <> new.user_id then
    insert into public.notifications (recipient_id, actor_id, type, post_id) values (v_owner, new.user_id, 'comment', new.post_id);
  end if;
  return new;
end;
$$;
drop trigger if exists notify_comment_insert on public.comments;
create trigger notify_comment_insert after insert on public.comments for each row execute procedure public.notify_comment();

-- Only an existing admin can grant another admin role. Bootstrap the first admin manually in README.
create or replace function public.promote_user_to_admin(p_email text)
returns boolean
language plpgsql
security definer
set search_path = public, auth
as $$
declare v_user_id uuid;
begin
  if not public.is_admin() then raise exception 'Only an existing admin can add admins.'; end if;
  select id into v_user_id from auth.users where lower(email) = lower(trim(p_email)) limit 1;
  if v_user_id is null then return false; end if;
  update public.private_user_data set role = 'admin' where user_id = v_user_id;
  return found;
end;
$$;

-- Blocking is atomic and removes any existing follow relationship in either direction.
create or replace function public.block_user(p_blocked_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception 'Sign in to block an account.'; end if;
  if p_blocked_id is null or p_blocked_id = auth.uid() then raise exception 'Choose another account to block.'; end if;
  if not exists (select 1 from public.profiles p where p.id = auth.uid() and not p.is_suspended) then
    raise exception 'This account cannot perform social actions.';
  end if;
  insert into public.blocks (blocker_id, blocked_id) values (auth.uid(), p_blocked_id)
  on conflict (blocker_id, blocked_id) do nothing;
  delete from public.follows
  where (follower_id = auth.uid() and following_id = p_blocked_id)
     or (follower_id = p_blocked_id and following_id = auth.uid());
end;
$$;

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.private_user_data enable row level security;
alter table public.profiles enable row level security;
alter table public.follows enable row level security;
alter table public.blocks enable row level security;
alter table public.posts enable row level security;
alter table public.likes enable row level security;
alter table public.comments enable row level security;
alter table public.saved_posts enable row level security;
alter table public.reports enable row level security;
alter table public.notifications enable row level security;

-- Private DOB/role: visible only to the account owner and moderators.
drop policy if exists private_user_data_read_self_or_admin on public.private_user_data;
create policy private_user_data_read_self_or_admin on public.private_user_data for select to authenticated
using (user_id = auth.uid() or public.is_admin());

-- Public profile fields can be discovered; private content remains protected by posts/follows policies.
drop policy if exists profiles_read_discoverable on public.profiles;
create policy profiles_read_discoverable on public.profiles for select to authenticated
using ((not is_suspended or id = auth.uid() or public.is_admin()) and (id = auth.uid() or public.is_admin() or not public.is_blocked_between(auth.uid(), id)));
drop policy if exists profiles_update_self_or_admin on public.profiles;
create policy profiles_update_self_or_admin on public.profiles for update to authenticated
using (id = auth.uid() or public.is_admin())
with check (id = auth.uid() or public.is_admin());

-- Follow graph: accepted relationships are visible where both profiles are viewable.
drop policy if exists follows_read_related on public.follows;
create policy follows_read_related on public.follows for select to authenticated
using (
  follower_id = auth.uid() or following_id = auth.uid() or public.is_admin()
  or (status = 'accepted' and public.can_view_profile(follower_id) and public.can_view_profile(following_id))
);
drop policy if exists follows_insert_self on public.follows;
create policy follows_insert_self on public.follows for insert to authenticated
with check (follower_id = auth.uid() and follower_id <> following_id and not public.is_blocked_between(follower_id, following_id) and exists (select 1 from public.profiles me where me.id = auth.uid() and not me.is_suspended));
drop policy if exists follows_accept_request on public.follows;
create policy follows_accept_request on public.follows for update to authenticated
using (following_id = auth.uid() and status = 'pending')
with check (following_id = auth.uid() and status = 'accepted');
drop policy if exists follows_delete_self_or_target on public.follows;
create policy follows_delete_self_or_target on public.follows for delete to authenticated
using (follower_id = auth.uid() or following_id = auth.uid() or public.is_admin());

-- Blocks are private to the person who created them.
drop policy if exists blocks_read_self on public.blocks;
create policy blocks_read_self on public.blocks for select to authenticated using (blocker_id = auth.uid() or public.is_admin());
drop policy if exists blocks_insert_self on public.blocks;
create policy blocks_insert_self on public.blocks for insert to authenticated with check (blocker_id = auth.uid() and blocker_id <> blocked_id);
drop policy if exists blocks_delete_self on public.blocks;
create policy blocks_delete_self on public.blocks for delete to authenticated using (blocker_id = auth.uid() or public.is_admin());

-- Posts obey account privacy, follower-only visibility, blocks and moderation.
drop policy if exists posts_read_visible on public.posts;
create policy posts_read_visible on public.posts for select to authenticated
using (public.can_view_post(user_id, visibility, moderation_status));
drop policy if exists posts_insert_self on public.posts;
create policy posts_insert_self on public.posts for insert to authenticated
with check (user_id = auth.uid() and moderation_status = 'review' and duration_seconds <= 10.00 and exists (select 1 from public.profiles me where me.id = auth.uid() and not me.is_suspended));
drop policy if exists posts_update_owner_or_admin on public.posts;
create policy posts_update_owner_or_admin on public.posts for update to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());
drop policy if exists posts_delete_owner_or_admin on public.posts;
create policy posts_delete_owner_or_admin on public.posts for delete to authenticated
using (user_id = auth.uid() or public.is_admin());

-- Likes are private to the owner for changes and visible only with a viewable post.
drop policy if exists likes_read_with_post on public.likes;
create policy likes_read_with_post on public.likes for select to authenticated
using (exists (select 1 from public.posts p where p.id = post_id and public.can_view_post(p.user_id, p.visibility, p.moderation_status)));
drop policy if exists likes_insert_self on public.likes;
create policy likes_insert_self on public.likes for insert to authenticated
with check (user_id = auth.uid() and exists (select 1 from public.profiles me where me.id = auth.uid() and not me.is_suspended) and exists (select 1 from public.posts p where p.id = post_id and public.can_view_post(p.user_id, p.visibility, p.moderation_status)));
drop policy if exists likes_delete_self on public.likes;
create policy likes_delete_self on public.likes for delete to authenticated using (user_id = auth.uid() or public.is_admin());

-- Comments are visible only where the related loop is visible.
drop policy if exists comments_read_with_post on public.comments;
create policy comments_read_with_post on public.comments for select to authenticated
using (moderation_status = 'approved' and not public.is_blocked_between(auth.uid(), user_id) and exists (select 1 from public.posts p where p.id = post_id and public.can_view_post(p.user_id, p.visibility, p.moderation_status)));
drop policy if exists comments_insert_self on public.comments;
create policy comments_insert_self on public.comments for insert to authenticated
with check (user_id = auth.uid() and moderation_status = 'approved' and exists (select 1 from public.profiles me where me.id = auth.uid() and not me.is_suspended) and exists (select 1 from public.posts p where p.id = post_id and public.can_view_post(p.user_id, p.visibility, p.moderation_status)));
drop policy if exists comments_update_owner_or_admin on public.comments;
create policy comments_update_owner_or_admin on public.comments for update to authenticated
using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid() or public.is_admin());
drop policy if exists comments_delete_owner_or_admin on public.comments;
create policy comments_delete_owner_or_admin on public.comments for delete to authenticated
using (user_id = auth.uid() or public.is_admin());

-- Saved loops are private to each account.
drop policy if exists saved_posts_read_self on public.saved_posts;
create policy saved_posts_read_self on public.saved_posts for select to authenticated using (user_id = auth.uid());
drop policy if exists saved_posts_insert_self on public.saved_posts;
create policy saved_posts_insert_self on public.saved_posts for insert to authenticated
with check (user_id = auth.uid() and exists (select 1 from public.profiles me where me.id = auth.uid() and not me.is_suspended) and exists (select 1 from public.posts p where p.id = post_id and public.can_view_post(p.user_id, p.visibility, p.moderation_status)));
drop policy if exists saved_posts_delete_self on public.saved_posts;
create policy saved_posts_delete_self on public.saved_posts for delete to authenticated using (user_id = auth.uid());

-- Reports can be submitted by a user. Only that user and admins can read them; only admins can update status.
drop policy if exists reports_insert_self on public.reports;
create policy reports_insert_self on public.reports for insert to authenticated with check (reporter_id = auth.uid() and status = 'open');
drop policy if exists reports_read_self_or_admin on public.reports;
create policy reports_read_self_or_admin on public.reports for select to authenticated using (reporter_id = auth.uid() or public.is_admin());
drop policy if exists reports_update_admin on public.reports;
create policy reports_update_admin on public.reports for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Notifications are private to the recipient.
drop policy if exists notifications_read_recipient on public.notifications;
create policy notifications_read_recipient on public.notifications for select to authenticated using (recipient_id = auth.uid());
drop policy if exists notifications_update_recipient on public.notifications;
create policy notifications_update_recipient on public.notifications for update to authenticated using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());
drop policy if exists notifications_delete_recipient on public.notifications;
create policy notifications_delete_recipient on public.notifications for delete to authenticated using (recipient_id = auth.uid());

-- Helper RPC permissions.
grant execute on function public.is_admin() to authenticated;
grant execute on function public.is_minor(uuid) to authenticated;
grant execute on function public.can_view_profile(uuid) to authenticated;
grant execute on function public.can_view_post(uuid, text, text) to authenticated;
grant execute on function public.is_blocked_between(uuid, uuid) to authenticated;
grant execute on function public.can_read_video_object(text) to authenticated;
grant execute on function public.promote_user_to_admin(text) to authenticated;
grant execute on function public.block_user(uuid) to authenticated;

-- ============================================================
-- STORAGE BUCKETS + ACCESS POLICIES
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('loop-videos', 'loop-videos', false, 83886080, array['video/mp4', 'video/webm', 'video/quicktime'])
on conflict (id) do update set public = false, file_size_limit = 83886080, allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('loop-avatars', 'loop-avatars', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update set public = true, file_size_limit = 5242880, allowed_mime_types = excluded.allowed_mime_types;

-- Private videos: signed reads require permission to view the matching post.
drop policy if exists loop_videos_read_visible on storage.objects;
create policy loop_videos_read_visible on storage.objects for select to authenticated
using (bucket_id = 'loop-videos' and public.can_read_video_object(name));
drop policy if exists loop_videos_insert_owner on storage.objects;
create policy loop_videos_insert_owner on storage.objects for insert to authenticated
with check (bucket_id = 'loop-videos' and (storage.foldername(name))[1] = auth.uid()::text and exists (select 1 from public.profiles me where me.id = auth.uid() and not me.is_suspended));
drop policy if exists loop_videos_delete_owner on storage.objects;
create policy loop_videos_delete_owner on storage.objects for delete to authenticated
using (bucket_id = 'loop-videos' and ((storage.foldername(name))[1] = auth.uid()::text or public.is_admin()));

-- Public avatar images. The first folder is always the authenticated user's id.
drop policy if exists loop_avatars_read_public on storage.objects;
create policy loop_avatars_read_public on storage.objects for select
using (bucket_id = 'loop-avatars');
drop policy if exists loop_avatars_insert_owner on storage.objects;
create policy loop_avatars_insert_owner on storage.objects for insert to authenticated
with check (bucket_id = 'loop-avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists loop_avatars_update_owner on storage.objects;
create policy loop_avatars_update_owner on storage.objects for update to authenticated
using (bucket_id = 'loop-avatars' and (storage.foldername(name))[1] = auth.uid()::text)
with check (bucket_id = 'loop-avatars' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists loop_avatars_delete_owner on storage.objects;
create policy loop_avatars_delete_owner on storage.objects for delete to authenticated
using (bucket_id = 'loop-avatars' and (storage.foldername(name))[1] = auth.uid()::text);

-- Ensure API roles can use the public schema. RLS remains the final data gate.
grant usage on schema public to anon, authenticated;
grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.follows, public.posts, public.likes, public.comments, public.saved_posts to authenticated;
grant select, delete on public.blocks to authenticated;
grant select, update, delete on public.notifications to authenticated;
grant select, insert, update on public.reports to authenticated;
grant select on public.private_user_data to authenticated;

-- NOTE: Browser metadata checks video duration before upload, and the posts table rejects
-- a recorded duration over 10.00 seconds. This is not a tamper-proof media inspection step.
-- Before a public launch, add server-side transcoding/probing to verify the actual uploaded
-- file duration, strip metadata, scan/report abusive content, and rate-limit uploads/comments.

-- ============================================================
-- FINAL HARDENING + PROFILE COUNTS
-- ============================================================

create or replace function public.protect_profile_admin_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    if new.is_suspended is distinct from old.is_suspended then
      raise exception 'Only moderators can change suspension status.';
    end if;
    if new.created_at is distinct from old.created_at or new.id is distinct from old.id then
      raise exception 'Profile identity fields cannot be changed.';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists protect_profile_admin_fields_trigger on public.profiles;
create trigger protect_profile_admin_fields_trigger before update on public.profiles for each row execute procedure public.protect_profile_admin_fields();

create or replace function public.protect_post_identity_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() and (
    new.id is distinct from old.id
    or new.user_id is distinct from old.user_id
    or new.video_path is distinct from old.video_path
    or new.duration_seconds is distinct from old.duration_seconds
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'Post ownership and media metadata cannot be changed.';
  end if;
  return new;
end;
$$;
drop trigger if exists protect_post_identity_fields_trigger on public.posts;
create trigger protect_post_identity_fields_trigger before update on public.posts for each row execute procedure public.protect_post_identity_fields();

create or replace function public.protect_comment_identity_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() and (
    new.id is distinct from old.id
    or new.post_id is distinct from old.post_id
    or new.user_id is distinct from old.user_id
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'Comment ownership and post reference cannot be changed.';
  end if;
  return new;
end;
$$;
drop trigger if exists protect_comment_identity_fields_trigger on public.comments;
create trigger protect_comment_identity_fields_trigger before update on public.comments for each row execute procedure public.protect_comment_identity_fields();

create or replace function public.protect_follow_identity_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() and (
    new.follower_id is distinct from old.follower_id
    or new.following_id is distinct from old.following_id
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'Follow relationship identities cannot be changed.';
  end if;
  return new;
end;
$$;
drop trigger if exists protect_follow_identity_fields_trigger on public.follows;
create trigger protect_follow_identity_fields_trigger before update on public.follows for each row execute procedure public.protect_follow_identity_fields();

create or replace function public.protect_notification_fields()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() and (
    new.id is distinct from old.id
    or new.recipient_id is distinct from old.recipient_id
    or new.actor_id is distinct from old.actor_id
    or new.type is distinct from old.type
    or new.post_id is distinct from old.post_id
    or new.created_at is distinct from old.created_at
  ) then
    raise exception 'Only the read state of a notification can be changed.';
  end if;
  return new;
end;
$$;
drop trigger if exists protect_notification_fields_trigger on public.notifications;
create trigger protect_notification_fields_trigger before update on public.notifications for each row execute procedure public.protect_notification_fields();

create or replace function public.get_profile_counts(p_profile_id uuid)
returns table(posts_count bigint, followers_count bigint, following_count bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    (select count(*) from public.posts p where p.user_id = p_profile_id and p.moderation_status = 'approved'),
    (select count(*) from public.follows f where f.following_id = p_profile_id and f.status = 'accepted'),
    (select count(*) from public.follows f where f.follower_id = p_profile_id and f.status = 'accepted');
$$;
grant execute on function public.get_profile_counts(uuid) to authenticated;
