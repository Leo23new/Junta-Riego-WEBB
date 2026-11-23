// scripts/seed.mjs
// Seed script — populates the Supabase database with minimal demo data.
// Run from the project root: node scripts/seed.mjs
// Requires: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local

import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// 1. Load environment variables from .env.local (no extra dependencies needed)
// ---------------------------------------------------------------------------
try {
  const env = readFileSync('.env.local', 'utf8');
  for (const line of env.split('\n')) {
    const [k, ...v] = line.split('=');
    if (k && !k.startsWith('#')) process.env[k.trim()] = v.join('=').trim();
  }
} catch {
  // File may not exist; fall through to env validation below.
}

const SUPABASE_URL = process.env.VITE_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    '❌ Missing required environment variables.\n' +
    '   Set VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local'
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 2. Create a Supabase admin client (service-role key bypasses RLS)
// ---------------------------------------------------------------------------
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

// ---------------------------------------------------------------------------
// 3. Seed data definitions
// ---------------------------------------------------------------------------
const JUNTA = {
  nombre: 'Junta de Riego San Pablo',
  tipo: 'riego',
  provincia: 'Imbabura',
  canton: 'Otavalo',
  parroquia: 'San Pablo del Lago',
  direccion: 'Calle Principal s/n',
  fecha_constitucion: '2000-01-01',
};

const USERS = [
  { rol: 'super_admin', email: 'superadmin@demo.com', nombre_completo: 'Super Admin Demo' },
  { rol: 'admin',       email: 'admin@demo.com',       nombre_completo: 'Admin Demo'       },
  { rol: 'secretario',  email: 'secretario@demo.com',  nombre_completo: 'Secretario Demo'  },
  { rol: 'tesorero',    email: 'tesorero@demo.com',    nombre_completo: 'Tesorero Demo'    },
  { rol: 'miembro',     email: 'miembro@demo.com',     nombre_completo: 'Miembro Demo'     },
];

const PASSWORD = 'Demo1234!';

// ---------------------------------------------------------------------------
// 4. Main seed function
// ---------------------------------------------------------------------------
async function seed() {
  // --- 4a. Upsert junta (conflict on nombre) ---
  const { data: juntaRows, error: juntaError } = await supabase
    .from('juntas')
    .upsert(JUNTA, { onConflict: 'nombre' })
    .select('id');

  if (juntaError) {
    console.error('❌ Error upserting junta:', juntaError.message);
    process.exit(1);
  }

  const juntaId = juntaRows[0].id;
  console.log(`✓ Junta created (id: ${juntaId})`);

  // --- 4b. Create users and upsert perfiles ---
  for (const { rol, email, nombre_completo } of USERS) {
    // Attempt to create user; handle "already registered" gracefully.
    let userId;

    const { data: createData, error: createError } =
      await supabase.auth.admin.createUser({
        email,
        password: PASSWORD,
        email_confirm: true,
      });

    if (createError) {
      const alreadyExists =
        createError.message?.toLowerCase().includes('already registered') ||
        createError.message?.toLowerCase().includes('already been registered') ||
        createError.code === 'email_exists' ||
        createError.status === 422;

      if (alreadyExists) {
        // Fetch the existing user by email.
        const { data: listData, error: listError } =
          await supabase.auth.admin.listUsers();

        if (listError) {
          console.error(`❌ Could not list users to find ${email}:`, listError.message);
          process.exit(1);
        }

        const existing = listData.users.find((u) => u.email === email);
        if (!existing) {
          console.error(`❌ User ${email} reportedly exists but was not found in the user list.`);
          process.exit(1);
        }

        userId = existing.id;
        console.log(`✓ User already exists: ${email} (id: ${userId})`);
      } else {
        console.error(`❌ Error creating user ${email}:`, createError.message);
        process.exit(1);
      }
    } else {
      userId = createData.user.id;
      console.log(`✓ User created: ${email} (id: ${userId})`);
    }

    // --- 4c. Upsert perfil (conflict on id) ---
    const { error: perfilError } = await supabase
      .from('perfiles')
      .upsert(
        {
          id: userId,
          junta_id: rol === 'super_admin' ? null : juntaId,
          rol,
          nombre_completo,
          activo: true,
        },
        { onConflict: 'id' }
      );

    if (perfilError) {
      console.error(`❌ Error upserting perfil for ${email}:`, perfilError.message);
      process.exit(1);
    }

    console.log(`✓ Perfil upserted: ${email}`);
  }

  console.log('\n✅ Seed completado.');
}

seed().catch((err) => {
  console.error('❌ Unexpected error:', err?.message ?? err);
  process.exit(1);
});
