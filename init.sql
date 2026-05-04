CREATE ROLE supabase_admin LOGIN SUPERUSER PASSWORD 'postgres';
CREATE ROLE anon NOLOGIN NOINHERIT;
CREATE ROLE authenticated NOLOGIN NOINHERIT;
CREATE ROLE service_role NOLOGIN NOINHERIT BYPASSRLS;

GRANT anon, authenticated, service_role TO supabase_admin;
GRANT ALL ON DATABASE postgres TO supabase_admin;
GRANT ALL ON SCHEMA public TO supabase_admin;