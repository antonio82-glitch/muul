# Múul

Plataforma de comercios de la Riviera Maya — marketplace, pagos con escrow y reservas.

```
M ú u l
       └─ "juntos" en maya yucateco
```

---

## Stack

- **Next.js 15** (App Router, RSC, TypeScript estricto)
- **Supabase** (Postgres + PostGIS, Auth, Storage, Realtime, RLS)
- **Drizzle ORM** + driver `postgres-js`
- **Stripe Connect Express** (multimerchant, escrow, multicurrency)
- **next-intl** (ES/EN server-side)
- **Tailwind CSS** con tokens de la marca Múul
- Deploy en **Vercel**

---

## Setup local — primera vez

### 1. Requisitos previos

- Node.js 20+ y pnpm 9+ (o npm 10+)
- Una cuenta gratuita en [Supabase](https://supabase.com)
- Una cuenta Stripe en modo test ([dashboard](https://dashboard.stripe.com))
- Stripe CLI ([instalar](https://docs.stripe.com/stripe-cli)) — para webhooks

### 2. Clona e instala

```bash
git clone <tu-repo> muul
cd muul
pnpm install   # o npm install
```

### 3. Crea el proyecto en Supabase

1. Ve a [supabase.com/dashboard](https://supabase.com/dashboard) → **New project**
2. Elige región **us-east-1** (cerca de Riviera Maya)
3. Espera a que aparezca el dashboard (~2 minutos)
4. Ve a **Settings → Database → Connection string** y copia la cadena del **pooler en modo Transaction** (puerto 6543)
5. Ve a **Settings → API** y copia:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY` (¡secreto!)

### 4. Configura `.env.local`

```bash
cp .env.example .env.local
# edita .env.local y pega tus credenciales
```

### 5. Activa Stripe Connect en modo test

1. Dashboard de Stripe → **Settings → Connect → Get started**
2. Elige **Platform or Marketplace**
3. En **Branding** pon "Múul" como nombre
4. Copia las llaves de `pk_test_...` y `sk_test_...` a `.env.local`

### 6. Genera y aplica las migraciones

```bash
# Generar el SQL de Drizzle a partir del schema TypeScript
pnpm db:generate

# Aplicar migraciones (Drizzle se conecta al pooler)
pnpm db:migrate
```

> ⚠️ **Importante**: después de la migración de Drizzle, ejecuta también el archivo
> `lib/db/migrations/0001_extensions_and_rls.sql` directamente en el SQL Editor
> del dashboard de Supabase. Esto activa PostGIS y las RLS policies.
> Drizzle no maneja extensiones ni RLS por sí solo.

### 7. Datos de prueba

```bash
pnpm db:seed
```

Carga categorías y un par de pickup points en Tulum y Playa del Carmen.

### 8. Levanta el dev server

```bash
pnpm dev
```

Abre [localhost:3000](http://localhost:3000) — debe redirigir a `/es`.

### 9. (Opcional) Recibir webhooks de Stripe localmente

En otra terminal:

```bash
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

Copia el `whsec_...` que imprime y pégalo en `.env.local` como `STRIPE_WEBHOOK_SECRET`.

---

## Estructura del proyecto

```
muul/
├── app/
│   ├── [locale]/                 # /es y /en
│   │   ├── (marketplace)/        # rutas públicas
│   │   │   ├── descubre/
│   │   │   ├── m/[slug]/         # perfil de comercio
│   │   │   └── l/[slug]/         # detalle de listing
│   │   ├── (merchant)/           # dashboard del comercio
│   │   │   ├── onboarding/
│   │   │   ├── dashboard/
│   │   │   └── catalogo/
│   │   ├── layout.tsx
│   │   └── page.tsx
│   └── api/
│       ├── merchants/onboard/    # crea merchant + Stripe Connect
│       ├── checkout/intent/      # crea PaymentIntent con split
│       ├── discovery/nearby/     # geo search
│       ├── tickets/[token]/      # verificar/canjear QR
│       └── webhooks/stripe/      # eventos de Stripe
├── components/
│   ├── ui/                       # primitives (Button, Input, Card)
│   └── brand/                    # Wordmark Múul
├── lib/
│   ├── db/
│   │   ├── schema.ts             # 14 tablas con Drizzle
│   │   ├── migrations/           # SQL generado + RLS manual
│   │   ├── index.ts              # cliente Drizzle
│   │   ├── migrate.ts
│   │   └── seed.ts
│   ├── supabase/
│   │   ├── server.ts             # createServerClient + admin
│   │   ├── client.ts             # browser
│   │   └── middleware.ts         # session refresh
│   ├── stripe/
│   │   ├── client.ts             # SDK
│   │   └── connect.ts            # onboarding + checkout helpers
│   ├── i18n/
│   │   ├── config.ts
│   │   ├── request.ts
│   │   └── messages/{es,en}.json
│   ├── geo/                      # PostGIS queries
│   ├── qr/                       # generación + verificación
│   └── utils.ts                  # cn, formatMoney, slugify
├── middleware.ts                 # locale + auth + geo
├── tailwind.config.ts            # tokens de marca Múul
└── drizzle.config.ts
```

---

## Comandos útiles

| Comando            | Para qué                                           |
| ------------------ | -------------------------------------------------- |
| `pnpm dev`         | Dev server con Turbopack                           |
| `pnpm build`       | Build de producción                                |
| `pnpm typecheck`   | Verifica TypeScript sin emitir                     |
| `pnpm lint`        | ESLint                                             |
| `pnpm db:generate` | Genera SQL de migración a partir de `schema.ts`    |
| `pnpm db:migrate`  | Aplica migraciones pendientes                      |
| `pnpm db:push`     | Sincroniza schema sin migración (solo en dev)      |
| `pnpm db:studio`   | Abre Drizzle Studio (GUI para la DB)               |
| `pnpm db:seed`     | Carga datos de prueba                              |

---

## Flujo de pagos (resumen)

```
1. Comercio se registra → /api/merchants/onboard
   ↓ crea cuenta Stripe Connect Express
   ↓ devuelve link de KYC (8 min)

2. Comercio completa KYC en Stripe
   ↓ Stripe envía webhook account.updated
   ↓ marcamos merchant.status = 'active'

3. Cliente paga un servicio → /api/checkout/intent
   ↓ creamos orden + PaymentIntent con captura manual
   ↓ application_fee = 8% del total
   ↓ destination = cuenta del comercio

4. Cliente confirma pago en el browser (Stripe.js)
   ↓ Stripe envía webhook payment_intent.succeeded
   ↓ orden pasa a status 'paid'
   ↓ se emite QR ticket (booking.qr_token)

5. Cliente llega al servicio, comercio escanea su QR
   ↓ POST /api/tickets/[token]
   ↓ marca booking como 'redeemed'
   ↓ captura el pago en Stripe (libera escrow)
   ↓ split automático: 92% al comercio, 8% a Múul

6. Stripe paga al comercio en T+2 días hábiles
```

---

## Deploy en Vercel

1. Push a GitHub
2. [vercel.com/new](https://vercel.com/new) → importa el repo
3. Pega todas las variables de `.env.local` en el panel de Environment Variables
4. Cambia `NEXT_PUBLIC_APP_URL` a tu dominio de producción
5. En el dashboard de Stripe, registra el webhook endpoint:
   `https://muul.mx/api/webhooks/stripe`
6. Copia el `whsec_...` de producción y actualízalo en Vercel

---

## Próximos pasos (no implementados aún)

Esto cubre la fase 02 del plan. Falta lo siguiente para producción completa:

- [ ] Generación automática de slots a partir de `services.schedule` (admin tool)
- [ ] Edición y archivado de listings (PATCH/DELETE)
- [ ] Upload UI de imágenes con preview (la API `/api/uploads/sign` ya existe)
- [ ] Mapa interactivo en `/descubre` con Mapbox (el API `/api/discovery/nearby` ya existe)
- [ ] Búsqueda full-text con `pg_trgm`
- [ ] Sistema de reseñas post-orden (tabla y RLS ya están)
- [ ] Booking creation cuando se compra un servicio (actualmente la orden se crea, falta el booking + slot decrement)
- [ ] Notificaciones WhatsApp con Cloud API
- [ ] OAuth con Google/Apple (además del magic link)

---

## Licencia

Privado — © 2026 Múul. Todos los derechos reservados.
