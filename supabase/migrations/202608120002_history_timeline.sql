begin;

create table if not exists public.history_timeline_events (
  id uuid primary key default gen_random_uuid(),
  year integer not null check (year between 1800 and 2100),
  era text not null check (char_length(trim(era)) between 2 and 80),
  title text not null check (char_length(trim(title)) between 8 and 180),
  description text not null check (char_length(trim(description)) between 20 and 800),
  accent_color text not null default '#b7f34a' check (accent_color ~ '^#[0-9A-Fa-f]{6}$'),
  post_id uuid references public.posts(id) on delete set null,
  media_url text check (media_url is null or media_url ~ '^https?://'),
  media_type text check (media_type is null or media_type in ('image', 'video')),
  sort_order integer not null default 0 check (sort_order between 0 and 9999),
  status text not null default 'published' check (status in ('draft', 'published')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint timeline_media_type_requires_url check (media_type is null or media_url is not null)
);

create index if not exists history_timeline_feed_idx on public.history_timeline_events (status, sort_order, year);
create index if not exists history_timeline_post_idx on public.history_timeline_events (post_id);

alter table public.history_timeline_events enable row level security;

drop policy if exists "public read published timeline" on public.history_timeline_events;
create policy "public read published timeline" on public.history_timeline_events
  for select using (status = 'published' or public.is_admin());

drop policy if exists "admins manage timeline" on public.history_timeline_events;
create policy "admins manage timeline" on public.history_timeline_events
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

create or replace function public.touch_history_timeline_updated_at()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists history_timeline_touch_updated_at on public.history_timeline_events;
create trigger history_timeline_touch_updated_at before update on public.history_timeline_events
for each row execute function public.touch_history_timeline_updated_at();

insert into public.history_timeline_events (year, era, title, description, accent_color, sort_order, status)
values
  (1930, 'Khởi nguyên', 'World Cup đầu tiên mở ra một sân khấu toàn cầu', 'Uruguay đăng cai giải đấu đầu tiên, đặt nền móng cho ký ức bóng đá vượt qua biên giới.', '#b7f34a', 10, 'published'),
  (1958, 'Biểu tượng', 'Pelé và thế hệ làm thay đổi cách nhìn về bóng đá', 'Một cậu bé 17 tuổi biến kỹ thuật, tốc độ và niềm vui thành ngôn ngữ chung của sân cỏ.', '#f6b73c', 20, 'published'),
  (1974, 'Cách mạng chiến thuật', 'Bóng đá tổng lực đưa vị trí trở thành ý tưởng', 'Hà Lan trình diễn cách cả đội cùng tấn công, cùng phòng ngự và liên tục hoán đổi không gian.', '#69a7ff', 30, 'published'),
  (1998, 'Bản sắc', 'Một thế hệ Pháp viết lại câu chuyện trên sân nhà', 'Sức mạnh tập thể, sự đa dạng và một hàng tiền vệ giàu năng lượng tạo nên khoảnh khắc lịch sử.', '#f07167', 40, 'published'),
  (2010, 'Kiểm soát', 'Tiki-taka biến những đường chuyền thành nhịp điệu', 'Từ những tam giác nhỏ đến quyền kiểm soát lớn, bóng đá trở thành một bài toán về thời gian.', '#8bd450', 50, 'published'),
  (2022, 'Ký ức mới', 'Một trận chung kết nhắc chúng ta vì sao vẫn yêu bóng đá', 'Kịch bản không thể đoán trước và cảm xúc đi qua nhiều thế hệ trong cùng 120 phút.', '#d59bf6', 60, 'published')
on conflict do nothing;

alter table public.history_timeline_events replica identity full;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'history_timeline_events'
  ) then
    alter publication supabase_realtime add table public.history_timeline_events;
  end if;
end
$$;

commit;
