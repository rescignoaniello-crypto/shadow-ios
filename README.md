# Shadow iOS

Sistema de automatizacion total para negocios manejados con IA.
Primera implementacion: Primal VZla (tienda de ropa, Venezuela).

## Arquitectura

```
┌──────────────┐    ┌──────────────┐    ┌──────────────┐
│   Shopify    │───>│     n8n      │───>│   Supabase   │
└──────────────┘    │  (workflows) │    │  (Postgres)  │
                    └──────┬───────┘    └──────┬───────┘
┌──────────────┐           │                   │
│ Evolution API│──────────>│                   v
│  (WhatsApp)  │           │            ┌──────────────┐
└──────────────┘           │            │  Dashboard   │
                           v            │  (Next.js)   │
                    ┌──────────────┐    └──────────────┘
                    │    Admin     │
                    │  WhatsApp    │
                    └──────────────┘
```

## Componentes

- **n8n**: 8 workflows orquestando Shopify, WhatsApp y Supabase
- **Supabase**: base de datos PostgreSQL (orders, cash_movements, deliveries, etc)
- **Evolution API**: integracion WhatsApp (comandos + notificaciones)
- **Dashboard**: Next.js 14 + Tailwind + Recharts (en dashboard/)

## Setup local

```bash
# 1. Clonar
git clone https://github.com/rescignoaniello-crypto/shadow-ios.git
cd shadow-ios

# 2. Configurar credenciales
cp .env.example .env
# Editar .env con valores reales

# 3. Correr dashboard
cd dashboard
npm install
npm run dev
```

Abrir http://localhost:3000

## Documentacion

- `CLAUDE.md` — instrucciones tecnicas completas (contexto Claude Code)
- `ARCHITECTURE.md` — detalle de arquitectura (proximamente)
- `OPERATIONS.md` — guia operativa para el equipo (proximamente)
- `CONTRIBUTING.md` — como contribuir (proximamente)

## Estructura

```
shadow-ios/
├── dashboard/            Next.js app (Modulo 2)
├── n8n/workflows/        8 workflows exportados
├── scripts/              utilidades (importacion Excel, tests e2e)
├── supabase/migrations/  schema SQL
├── .claude/              configuracion Claude Code
├── CLAUDE.md
├── .env.example          plantilla de credenciales
└── README.md
```

## Estado

- Modulo 1 (Operaciones) — Supabase + workflows base
- Modulo 2 (Dashboard) — Next.js con 6 secciones en vivo
- Modulo 3 (WhatsApp) — listener con 4 flujos operacionales
- Sprint 0 — endurecimiento de fundaciones (en curso)
- Sprint 1 — comandos faltantes (saldo, gasto, cambio, envio, pagopyp)
