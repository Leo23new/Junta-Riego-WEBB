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
---

## Verificación de aislamiento (verify-isolation.mjs)

Verifica que las políticas RLS aíslen los datos entre juntas: cada usuario solo
debe ver filas de su propia junta (o recibir 403 / cero filas).

### How to run

```bash
node scripts/verify-isolation.mjs
```

### What it does

1. Ejecuta `seed.mjs` primero si la junta demo no existe (requisito previo).
2. Auto-provisiona (de forma idempotente) una **segunda junta**
   ("Junta de Agua Potable El Ángel", Carchi) con su propio usuario
   administrador `b-admin@demo.com` (contraseña `Demo1234!`).
3. Asegura que ambas juntas tengan al menos una fila en `miembros`, `ingresos`
   y `predios` (insertando datos mínimos si faltan).
4. Inicia sesión como `admin@demo.com` (junta 1) y `b-admin@demo.com`
   (junta 2) con la anon key.
5. Consulta `miembros`, `ingresos` y `predios` vía REST (PostgREST) con el
   JWT de cada usuario: 2 usuarios × 3 tablas = 6 comprobaciones.
6. Falla (exit 1) si cualquier consulta retorna filas de la junta opuesta.

### Expected output on success

```
[PASS] A/miembros: N filas, ninguna de la junta opuesta
[PASS] A/ingresos: N filas, ninguna de la junta opuesta
[PASS] A/predios: N filas, ninguna de la junta opuesta
[PASS] B/miembros: N filas, ninguna de la junta opuesta
[PASS] B/ingresos: N filas, ninguna de la junta opuesta
[PASS] B/predios: N filas, ninguna de la junta opuesta

✅ AISLAMIENTO VERIFICADO: todas las pruebas pasaron.
```

A 403 response or an empty result set also counts as PASS, per the
specification ("verifica que cada consulta retorne 0 filas de la junta
opuesta o un error 403").

### Idempotency

The script is safe to run multiple times: the second junta and its users are
upserted, and the data rows are only inserted when the junta has none.
