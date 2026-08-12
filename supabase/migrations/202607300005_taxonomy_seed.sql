insert into public.clubs (name, slug, league_id) values
  ('Arsenal', 'arsenal', (select id from public.leagues where slug = 'premier-league')),
  ('Manchester City', 'manchester-city', (select id from public.leagues where slug = 'premier-league')),
  ('Liverpool', 'liverpool', (select id from public.leagues where slug = 'premier-league')),
  ('Real Madrid', 'real-madrid', (select id from public.leagues where slug = 'la-liga')),
  ('Barcelona', 'barcelona', (select id from public.leagues where slug = 'la-liga')),
  ('Inter Milan', 'inter-milan', (select id from public.leagues where slug = 'serie-a')),
  ('Hà Nội FC', 'ha-noi-fc', (select id from public.leagues where slug = 'v-league-1')),
  ('Thể Công Viettel', 'the-cong-viettel', (select id from public.leagues where slug = 'v-league-1'))
on conflict (slug) do nothing;

insert into public.players (name, slug, club_id) values
  ('Bukayo Saka', 'bukayo-saka', (select id from public.clubs where slug = 'arsenal')),
  ('Erling Haaland', 'erling-haaland', (select id from public.clubs where slug = 'manchester-city')),
  ('Mohamed Salah', 'mohamed-salah', (select id from public.clubs where slug = 'liverpool')),
  ('Kylian Mbappé', 'kylian-mbappe', (select id from public.clubs where slug = 'real-madrid')),
  ('Lamine Yamal', 'lamine-yamal', (select id from public.clubs where slug = 'barcelona')),
  ('Nguyễn Quang Hải', 'nguyen-quang-hai', (select id from public.clubs where slug = 'ha-noi-fc'))
on conflict (slug) do nothing;

update public.posts
set season_id = (select id from public.seasons where slug = '2026-27')
where season_id is null;

update public.posts
set league_id = (select id from public.leagues where slug = 'v-league-1')
where slug = 'bong-da-viet-nam-bai-toan-xay-dung-ban-sac-dai-han'
  and league_id is null;
