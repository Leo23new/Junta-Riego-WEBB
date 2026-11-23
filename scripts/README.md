# scripts/

Utility scripts for the Junta-Riego-WEBB project. Run all commands from the **project root**.

---

## seed.mjs — Demo data seeder

Populates the Supabase database with a sample junta and one test user per role.

### How to run

```bash
node scripts/seed.mjs
```

### Required environment variables

| Variable | Description |
|---|---|
| `VITE_SUPABASE_URL` | Your Supabase project URL (already in `.env.local`) |
| `SUPABASE_SERVICE_ROLE_KEY` | The **service-role** key for your project — **not** the anon key |

Add `SUPABASE_SERVICE_ROLE_KEY` to your `.env.local` file:

```
VITE_SUPABASE_URL=https://<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<anon-key>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>
```

You can find the service-role key in your Supabase dashboard under **Project Settings → API → service_role secret**.

> **Important:** The service-role key bypasses all Row Level Security policies. Never expose it in
> frontend code, never commit it to git, and keep `.env.local` in your `.gitignore`.

### Demo credentials created

| Role | Email | Password |
|---|---|---|
| super_admin | superadmin@demo.com | Demo1234! |
| admin | admin@demo.com | Demo1234! |
| secretario | secretario@demo.com | Demo1234! |
| tesorero | tesorero@demo.com | Demo1234! |
| miembro | miembro@demo.com | Demo1234! |

### Idempotency

The script is safe to run multiple times — it will not create duplicate records:
- The junta is upserted on the `nombre` column.
- If a user email already exists the script reuses that user's UUID.
- Profiles are upserted on the `id` column.

> ⚠️ **Warning:** Running this script against a production database will create real demo user
> accounts. Only run it against development or staging projects.
