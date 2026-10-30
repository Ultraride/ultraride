-- =====================================================================
-- App mobile UltraRide : suppression de compte + notifications push
-- À coller dans Supabase → SQL Editor (projet fvykkcgwnomynnbhiggh), puis Run.
-- Le script peut être relancé sans risque.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Suppression de compte complète (exigée par Apple et Google)
--    Efface les données personnelles, puis le compte de connexion
--    lui-même (auth.users) : l'email ne peut plus se reconnecter.
--    Les avis restent visibles, signés « utilisateur supprimé ».
-- ---------------------------------------------------------------------
create or replace function public.delete_my_account()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'Non connecté';
  end if;

  delete from public.favorites    where user_id = uid;
  delete from public.race_results where user_id = uid;
  update public.organizers set linked_profile_id = null where linked_profile_id = uid;

  -- Avis : on les garde, anonymisés. Si la colonne n'accepte pas null,
  -- on les supprime plutôt que de bloquer la suppression du compte.
  begin
    update public.comments set author_id = null where author_id = uid;
  exception when others then
    delete from public.comments where author_id = uid;
  end;

  delete from public.profiles where id = uid;
  delete from auth.users      where id = uid;
end;
$$;

revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ---------------------------------------------------------------------
-- 2. File d'attente des notifications
--    Chaque publication d'ultra ou validation de mise à jour ajoute une
--    ligne ; la fonction send-push les regroupe en UNE notification
--    par vague (pas une par fiche).
-- ---------------------------------------------------------------------
create table if not exists public.push_queue (
  id         bigserial primary key,
  kind       text not null check (kind in ('new_race', 'race_update')),
  race_id    text not null,
  created_at timestamptz not null default now(),
  sent_at    timestamptz
);
create index if not exists push_queue_pending on public.push_queue (kind) where sent_at is null;

create table if not exists public.push_notifications (
  id         bigserial primary key,
  kind       text not null,
  title      text not null,
  body       text not null,
  url        text,
  race_count int  not null default 0,
  sent_at    timestamptz not null default now(),
  error      text
);

alter table public.push_queue         enable row level security;
alter table public.push_notifications enable row level security;

drop policy if exists push_notifications_admin_read on public.push_notifications;
create policy push_notifications_admin_read on public.push_notifications
  for select using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

drop policy if exists push_queue_admin_read on public.push_queue;
create policy push_queue_admin_read on public.push_queue
  for select using (exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'admin'));

-- Nouvel ultra : fiche qui passe en « published » (première édition
-- seulement ; une nouvelle édition est annoncée comme mise à jour).
create or replace function public.queue_push_new_race()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'published'
     and (tg_op = 'INSERT' or old.status is distinct from 'published')
     and coalesce(nullif(regexp_replace(new.edition::text, '\D', '', 'g'), '')::int, 1) <= 1 then
    insert into public.push_queue (kind, race_id) values ('new_race', new.id::text);
  end if;
  return new;
end;
$$;

drop trigger if exists push_new_race on public.races;
create trigger push_new_race
  after insert or update of status on public.races
  for each row execute function public.queue_push_new_race();

-- Vague de mises à jour : suggestion validée dans /admin/mises-a-jour.
create or replace function public.queue_push_race_update()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'accepted' and old.status is distinct from 'accepted' then
    insert into public.push_queue (kind, race_id) values ('race_update', new.race_id::text);
  end if;
  return new;
end;
$$;

drop trigger if exists push_race_update on public.race_update_suggestions;
create trigger push_race_update
  after update of status on public.race_update_suggestions
  for each row execute function public.queue_push_race_update();

-- ---------------------------------------------------------------------
-- 3. Envoi planifié toutes les 15 minutes
--    Réutilise le secret Vault déjà utilisé par check-race-updates-weekly
--    (même CRON_SECRET côté Edge Functions).
-- ---------------------------------------------------------------------
do $$
declare
  existing text;
  secret_name text;
begin
  select command into existing from cron.job where jobname = 'check-race-updates-weekly';
  secret_name := substring(existing from $re$name\s*=\s*'([^']+)'$re$);
  if secret_name is null then
    raise exception 'Nom du secret Vault introuvable dans le job check-race-updates-weekly : envoie-moi le résultat de « select command from cron.job »';
  end if;

  perform cron.unschedule(jobid) from cron.job where jobname = 'send-push-notifications';
  perform cron.schedule(
    'send-push-notifications',
    '*/15 * * * *',
    format($cmd$
      select net.http_post(
        url := 'https://fvykkcgwnomynnbhiggh.supabase.co/functions/v1/send-push',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = %L)
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 30000
      );
    $cmd$, secret_name)
  );
end;
$$;
