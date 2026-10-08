-- Example chorus for a first run. Edit the values, then run in the SQL editor.
insert into public.choruses (slug, recipient_name, occasion, opens_at)
values ('for-maya', 'Maya', 'her 40th birthday', '2026-11-02 08:00:00-05')
on conflict (slug) do nothing;

-- Contributor link: https://<your-domain>/c/for-maya
