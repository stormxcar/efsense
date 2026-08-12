# Supabase setup for Football Stories

Target project: `iptmtmlgdwhtxhhvvith`

The migration in `migrations/202607300001_initial_football_stories.sql` creates:

- application tables and relationships;
- indexes and Vietnamese full-text search support;
- Auth user profile synchronization;
- RLS policies;
- Storage buckets and policies;
- initial Vietnamese series and tags.

Before applying it, configure credentials belonging to this exact project:

```env
VITE_SUPABASE_URL=https://iptmtmlgdwhtxhhvvith.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<publishable-key-from-this-project>
```

The migration must be applied with an authenticated Supabase CLI session, database
password, or through the SQL editor for this project. Never reuse a key from another
Supabase project.

## Automatic setup

From PowerShell in the project directory:

```powershell
.\scripts\setup-supabase.ps1 -PublishableKey "sb_publishable_..."
```

The script asks securely for a Personal Access Token and database password, updates
the frontend `.env`, links only project `iptmtmlgdwhtxhhvvith`, runs a migration
dry-run, pushes the migration, and verifies remote migration history.
