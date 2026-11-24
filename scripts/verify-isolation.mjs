// scripts/verify-isolation.mjs
// Verificación de aislamiento multi-tenant (RLS) entre juntas.
// Run from the project root: node scripts/verify-isolation.mjs
// Requires: VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY and
// SUPABASE_SERVICE_ROLE_KEY in .env.local

import { readFileSync } from 'fs';
import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// 1. Load environment variables from .env.local (no extra dependencies)
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
const ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY || !ANON_KEY) {
  console.error(
    '❌ Faltan variables de entorno.\n' +
    '   Requiere VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY y\n' +
    '   SUPABASE_SERVICE_ROLE_KEY en .env.local'
  );
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 2. Service-role admin client (bypasses RLS) — setup phase only
// ---------------------------------------------------------------------------
const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const PASSWORD = 'Demo1234!';
const JUNTA1_NOMBRE = 'Junta de Riego San Pablo';
const JUNTA2 = {
  nombre: 'Junta de Agua Potable El Ángel',
  tipo: 'agua_potable',
  provincia: 'Carchi',
  canton: 'Espejo',
  parroquia: 'El Ángel',
  direccion: 'Calle Bolívar s/n',
  fecha_constitucion: '2005-05-20',
};

// ---------------------------------------------------------------------------
// Valid cédula generation (módulo 10, dígito verificador)
// ---------------------------------------------------------------------------
function digitoVerificador(primeros9) {
  let suma = 0;
  for (let i = 0; i < 9; i++) {
    let d = Number(primeros9[i]);
    if (i % 2 === 0) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    suma += d;
  }
  const resto = suma % 10;
  return resto === 0 ? 0 : 10 - resto;
}

/**
 * Genera una cédula válida (módulo 10) con código de provincia dado
 * ('01' o '02'), verificando que no exista ya en `miembros` para la junta.
 */
async function generarCedulaUnica(provincia, juntaId) {
  for (let n = 0; n < 1000; n++) {
    const medio = String(1000000 + n).slice(0, 7); // 7 dígitos deterministas
    const primeros9 = provincia + medio;
    const cedula = primeros9 + digitoVerificador(primeros9);

    const { data } = await admin
      .from('miembros')
      .select('id')
      .eq('cedula', cedula)
      .eq('junta_id', juntaId)
      .maybeSingle();

    if (!data) return cedula;
  }
  throw new Error(`No se pudo generar una cédula única para la junta ${juntaId}`);
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
async function upsertJunta(junta) {
  const { data, error } = await admin
    .from('juntas')
    .upsert(junta, { onConflict: 'nombre' })
    .select('id')
    .single();
  if (error) {
    console.error('❌ Error upserting junta:', error.message);
    process.exit(1);
  }
  return data.id;
}

async function ensureUser(email, rol, nombre, juntaId) {
  let userId;
  const { data: createData, error: createError } = await admin.auth.admin.createUser({
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
      const { data: listData, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
      if (listError) {
        console.error(`❌ No se pudo listar usuarios para ${email}:`, listError.message);
        process.exit(1);
      }
      const existing = listData.users.find((u) => u.email === email);
      if (!existing) {
        console.error(`❌ El usuario ${email} existe pero no fue encontrado.`);
        process.exit(1);
      }
      userId = existing.id;
      console.log(`✓ Usuario ya existe: ${email}`);
    } else {
      console.error(`❌ Error creando usuario ${email}:`, createError.message);
      process.exit(1);
    }
  } else {
    userId = createData.user.id;
    console.log(`✓ Usuario creado: ${email}`);
  }

  const { error: perfilError } = await admin
    .from('perfiles')
    .upsert(
      { id: userId, junta_id: juntaId, rol, nombre_completo: nombre, activo: true },
      { onConflict: 'id' }
    );
  if (perfilError) {
    console.error(`❌ Error upserting perfil de ${email}:`, perfilError.message);
    process.exit(1);
  }
  return userId;
}

/** Asegura que exista un miembro para la junta; devuelve su id. */
async function ensureMiembro(juntaId, provincia, correo) {
  const { count } = await admin
    .from('miembros')
    .select('id', { count: 'exact', head: true })
    .eq('junta_id', juntaId);

  if (count > 0) {
    const { data, error } = await admin
      .from('miembros')
      .select('id')
      .eq('junta_id', juntaId)
      .limit(1);
    if (error || !data?.length) {
      console.error('❌ Error leyendo miembros existentes:', error?.message);
      process.exit(1);
    }
    return data[0].id;
  }

  const cedula = await generarCedulaUnica(provincia, juntaId);
  const { data, error } = await admin
    .from('miembros')
    .insert({
      junta_id: juntaId,
      cedula,
      nombres: 'Miembro',
      apellidos: 'Verificación',
      correo,
      fecha_ingreso: '2024-01-01',
      activo: true,
    })
    .select('id')
    .single();

  if (error) {
    console.error('❌ Error insertando miembro de prueba:', error.message);
    process.exit(1);
  }
  console.log(`✓ Miembro insertado en junta ${juntaId} (cédula ${cedula})`);
  return data.id;
}

async function ensureIngreso(juntaId, miembroId, recibo) {
  const { count } = await admin
    .from('ingresos')
    .select('id', { count: 'exact', head: true })
    .eq('junta_id', juntaId);
  if (count > 0) return;

  const { error } = await admin.from('ingresos').insert({
    junta_id: juntaId,
    miembro_id: miembroId,
    concepto: 'Cuota ordinaria de verificación',
    monto: 10.0,
    fecha: '2024-01-15',
    metodo_pago: 'efectivo',
    numero_recibo: recibo,
  });
  if (error) {
    console.error('❌ Error insertando ingreso de prueba:', error.message);
    process.exit(1);
  }
  console.log(`✓ Ingreso insertado en junta ${juntaId}`);
}

async function ensurePredio(juntaId, miembroId, codigo) {
  const { count } = await admin
    .from('predios')
    .select('id', { count: 'exact', head: true })
    .eq('junta_id', juntaId);
  if (count > 0) return;

  const { error } = await admin.from('predios').insert({
    junta_id: juntaId,
    miembro_id: miembroId,
    codigo_catastral: codigo,
    superficie: 1.5,
  });
  if (error) {
    console.error('❌ Error insertando predio de prueba:', error.message);
    process.exit(1);
  }
  console.log(`✓ Predio insertado en junta ${juntaId}`);
}

// ---------------------------------------------------------------------------
// 3. Sign in (password grant, anon key) — plain fetch
// ---------------------------------------------------------------------------
async function signIn(email) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', apikey: ANON_KEY },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const body = await res.json();
  if (!res.ok || !body.access_token) {
    console.error(`❌ No se pudo iniciar sesión como ${email}:`, body.error_description ?? body.msg ?? res.status);
    process.exit(1);
  }
  return body.access_token;
}

// ---------------------------------------------------------------------------
// 4. Isolation checks — direct PostgREST REST with the user's JWT
// ---------------------------------------------------------------------------
async function fetchTable(token, tabla) {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${tabla}?select=*`, {
    headers: { apikey: ANON_KEY, Authorization: `Bearer ${token}` },
  });
  return { status: res.status, body: await res.json() };
}

function check(userLabel, tabla, resultado, ownJuntaId, otherJuntaId) {
  if (resultado.status === 403) {
    console.log(`[PASS] ${userLabel}/${tabla}: 403 (sin acceso), ninguna fila de la junta opuesta`);
    return true;
  }
  if (!Array.isArray(resultado.body)) {
    console.error(
      `[FAIL] ${userLabel}/${tabla}: respuesta inesperada (HTTP ${resultado.status}):`,
      JSON.stringify(resultado.body)
    );
    return false;
  }
  const propias = resultado.body.filter((r) => r.junta_id === ownJuntaId);
  const opuestas = resultado.body.filter((r) => r.junta_id === otherJuntaId);
  const extranas = resultado.body.filter(
    (r) => r.junta_id !== ownJuntaId && r.junta_id !== otherJuntaId
  );

  if (opuestas.length > 0 || extranas.length > 0) {
    console.log(
      `[FAIL] ${userLabel}/${tabla}: se encontraron filas de la junta opuesta (${opuestas.length})` +
      (extranas.length ? ` u otras juntas (${extranas.length})` : '')
    );
    return false;
  }
  console.log(`[PASS] ${userLabel}/${tabla}: ${propias.length} filas, ninguna de la junta opuesta`);
  return true;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('--- Fase de preparación (service role) ---\n');

  // Junta 1 (creada por seed.mjs)
  const { data: j1, error: e1 } = await admin
    .from('juntas')
    .select('id')
    .eq('nombre', JUNTA1_NOMBRE)
    .maybeSingle();
  if (e1 || !j1) {
    console.error(
      `❌ No se encontró "${JUNTA1_NOMBRE}". Ejecuta primero: node scripts/seed.mjs`
    );
    process.exit(1);
  }
  const junta1 = j1.id;
  console.log(`✓ Junta 1 encontrada (id: ${junta1})`);

  // Junta 2 (auto-provisionada, idempotente)
  const junta2 = await upsertJunta(JUNTA2);
  console.log(`✓ Junta 2 asegurada (id: ${junta2})`);

  // Admin de la junta 2
  await ensureUser('b-admin@demo.com', 'admin', 'Admin Junta Dos', junta2);

  // Miembros + datos mínimos en las tres tablas por junta
  const miembro1 = await ensureMiembro(junta1, '01', 'miembro@demo.com');
  const miembro2 = await ensureMiembro(junta2, '02', 'b-miembro@demo.com');
  await ensureIngreso(junta1, miembro1, 'VISO-0001');
  await ensureIngreso(junta2, miembro2, 'VISO-0002');
  await ensurePredio(junta1, miembro1, 'VISO-P-0001');
  await ensurePredio(junta2, miembro2, 'VISO-P-0002');

  console.log('\n--- Inicio de sesión (anon key) ---\n');
  const tokenA = await signIn('admin@demo.com');
  const tokenB = await signIn('b-admin@demo.com');
  console.log('✓ Sesiones obtenidas para admin@demo.com y b-admin@demo.com');

  console.log('\n--- Verificación de aislamiento (RLS) ---\n');
  const TABLAS = ['miembros', 'ingresos', 'predios'];
  const usuarios = [
    { label: 'A', token: tokenA, own: junta1, other: junta2 },
    { label: 'B', token: tokenB, own: junta2, other: junta1 },
  ];

  const resultados = [];
  for (const usuario of usuarios) {
    for (const tabla of TABLAS) {
      const res = await fetchTable(usuario.token, tabla);
      resultados.push(
        check(usuario.label, tabla, res, usuario.own, usuario.other)
      );
    }
  }

  const fallos = resultados.filter((r) => !r).length;
  if (fallos === 0) {
    console.log('\n✅ AISLAMIENTO VERIFICADO: todas las pruebas pasaron.');
    process.exit(0);
  } else {
    console.log(`\n❌ FALLO DE AISLAMIENTO: ${fallos} prueba(s) fallaron.`);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('❌ Error inesperado:', err?.message ?? err);
  process.exit(1);
});
