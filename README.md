# videoportfolio

Portfolio frontend en React + Vite que consume contenido desde Cloudflare R2.

## Workers vs Pages (rápido)

- **Cloudflare Pages**: hosting para frontend estático (tu caso).
- **Cloudflare Workers**: backend/serverless para lógica o APIs (no obligatorio para este proyecto).

## Despliegue en Cloudflare Pages (paso a paso)

1. En local, desde la raíz del proyecto, instala dependencias:
   - `npm install`
2. Genera la versión de producción:
   - `npm run build`
3. Verifica que se crea `dist/` (salida lista para publicar).
4. En Cloudflare, entra en **Workers & Pages**.
5. Haz clic en **Create application** → **Pages**.
6. Conecta tu repositorio de GitHub.
7. Configura el build:
   - **Build command**: `npm run build`
   - **Build output directory**: `dist`
8. En tu proyecto de Pages, abre **Settings** → **Environment variables** y agrega:
   - `VITE_R2_PUBLIC_URL` = URL pública real de tu bucket R2 (por ejemplo `https://pub-XXXX.r2.dev` o tu dominio de media).
9. Ejecuta el deploy.
10. En **Custom domains**, conecta tu dominio comprado (raíz o `www`).
11. Espera propagación DNS/SSL y prueba la URL pública final.

## Nota sobre rutas del frontend

Este repo incluye fallback SPA para Cloudflare Pages (`public/_redirects`) para que rutas como `/seccion/...` funcionen también al recargar directamente.
