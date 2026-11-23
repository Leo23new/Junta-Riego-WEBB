# Tecnología
- Interfaz web responsiva: React, Vite, TypeScript y Tailwind CSS.
- Base de datos PostgreSQL en Supabase, con Auth, Storage y la API REST de Supabase. No hay backend propio.
- Aislamiento multi-tenant: columna junta_id en cada tabla de negocio y políticas RLS.
- El rol del usuario se guarda en una tabla perfiles, nunca en user_metadata.
- Variables de entorno en .env.local; la clave service_role solo se usa en el script de datos de prueba y nunca en el frontend.
- La aplicación se ejecuta solo en local, en http://127.0.0.1:8081 (Vite con host 127.0.0.1 y puerto 8081 fijo).