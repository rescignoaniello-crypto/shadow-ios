# Shadow iOS — Work Log

Bitacora de trabajo sesion por sesion. Formato segun autonomous-work-protocol skill.

---

## 2026-04-16 — Sprint 0 (endurecimiento)

### Sesion: trabajo coordinado con arquitecto

#### Tarea 1 — Consolidar repo monorepo con split de secrets

**Estado**: completado

**Pasos completados**:
- [x] Crear .env con credenciales reales (no va al repo)
- [x] Crear .env.example con placeholders (va al repo)
- [x] Reescribir CLAUDE.md sin credenciales (referencias a ${VAR_NAME})
- [x] Actualizar .gitignore completo
- [x] Eliminar dashboard/.git (consolidar en monorepo)
- [x] Reescribir README.md con arquitectura y setup
- [x] Crear WORK_LOG.md
- [x] Validacion final (5 checks de seguridad)

**Archivos creados**:
- .env (credenciales reales, excluido de git)
- .env.example (plantilla limpia, va al repo)
- WORK_LOG.md (este archivo)

**Archivos modificados**:
- CLAUDE.md (removidas todas las credenciales, reemplazadas por ${VAR_NAME})
- .gitignore (reescrito completo con cobertura exhaustiva)
- README.md (reescrito con arquitectura, setup y estructura)

**Decisiones tomadas**:
- Split de secrets: .env (privado) + .env.example (publico) + CLAUDE.md sin credenciales
- Consolidar dashboard/.git en monorepo unico del root
- Patron de referencia: ${VAR_NAME} en CLAUDE.md apunta a .env

**Hallazgos adicionales durante validacion**:
- .claude/mcp.json -> excluido del repo + .example creado
- scripts/import-excel-history.js -> refactorizado a process.env (dotenv, ES modules)
- SHADOW_IOS_MASTER.md -> excluido del repo (queda como referencia local)
- dashboard/src/lib/supabase.ts -> verificado limpio (usa env vars)

**Estado final Tarea 1**: 100% completada, lista para Tarea 2

**Proximo paso**: Tarea 2 — externalizar credenciales de workflows n8n

---

#### Tarea 2 — Externalizar credenciales de workflows n8n

**Estado**: en progreso

##### FASE A — Mapeo y plan

**IDs de credenciales encontradas**:
- supabaseApi: id=`x8buzsXlNOri8ISa`, name="Supabase account" (la unica de tipo supabaseApi)
- evolutionApi: id=`vabu5FHInLG8vGmD`, name="Evolution account"
- shopifyOAuth2Api: id=`hkN5bDuOp689jPuQ`, name="Shopify-Primal-Access Token account"

**Nota**: La credencial "Supabase Shadow iOS" que el humano creo podria ser la misma "Supabase account" renombrada, o n8n la auto-resuelve a la unica existente del tipo supabaseApi. Funcional es lo mismo.

**Mapeo por workflow**:

| Workflow | ID | Total nodos | Nodos hardcoded | Tipos |
|---|---|---|---|---|
| W01 Tasa cambio | 3sj3qGPw5oECiLDB | 1 | 0 | (sin Supabase, solo HTTP a Binance) |
| W02 Shopify pedido | GUanijFyA7biDyRX | 7 | 2 | HTTP Request (Supabase insert) |
| W03 Kira venta | qvySBgmDdvTHatVO | 8 | 3 | HTTP Request (Supabase insert x3) |
| W04 Resumen diario | v67cGduUEFLwFnbq | 8 | 3 | HTTP Request (Supabase GET x3) |
| W05 Rate webhook | 9w3OqxiB8pZcOfvp | 3 | 0 | (usa dataTable nativo) |
| W06 Dashboard listener | X16QoSlg2WyXocbj | 23 | 10 | HTTP Request (Supabase CRUD x10) |
| W07 Evolution fanout | ha7xPM5H4nMKHQSl | 3 | 0 | (sin credenciales) |
| W08 Shopify updated | 4FYpMkhhMkXw1PEo | 3 | 1 | HTTP Request (Supabase PATCH) |
| **TOTAL** | | | **19 nodos** | |

**Workflows sin cambios necesarios**: W01, W05, W07 (0 credenciales hardcoded)
**Workflows a migrar**: W02 (2), W03 (3), W04 (3), W06 (10), W08 (1) = 19 nodos

**Estrategia elegida**: authentication=predefinedCredentialType + nodeCredentialType=supabaseApi
- n8n inyecta headers apikey + Authorization automaticamente
- Solo mantener Content-Type y Prefer como headers manuales
- No requiere cambiar logica ni URLs — solo autenticacion

##### FASE B — Piloto W08

- Backup descargado
- Nodo "Patch order" migrado a credencial predefinida
- PUT exitoso, workflow sigue activo
- Re-exportado limpio (0 JWTs)
- **Patron validado**

##### FASE C — Migracion de W02, W03, W04, W06

- Script de migracion automatizado: detecta nodos HTTP Request con JWTs, reemplaza auth
- W02: 2 nodos migrados (Insert order, Insert line items)
- W03: 3 nodos migrados (Insert order, Insert order_items, Insert cash_movements)
- W04: 3 nodos migrados (Get orders today, Get cash today, Get pending deliveries)
- W06: 10 nodos migrados (A/B/C/D: Lookup, Insert, Update, Find)
- Todos los PUT exitosos, todos siguen activos

##### FASE D — Validacion final

**D.1 Grep workflows**: VACIO (0 JWTs en JSONs exportados)
**D.2 Grep full repo**: VACIO (0 JWTs en todo el repo)
**D.3 Smoke tests**:

| Workflow | Modificado | Re-exportado | Sigue activo | Test |
|---|---|---|---|---|
| W01 Tasa cambio | No (0 hardcoded) | Si | false (diseño) | N/A |
| W02 Shopify pedido | Si (2 nodos) | Si | true | OK |
| W03 Kira venta | Si (3 nodos) | Si | true | OK |
| W04 Resumen diario | Si (3 nodos) | Si | true | OK |
| W05 Rate webhook | No (0 hardcoded) | Si | true | curl OK: Bs=635 |
| W06 Dashboard listener | Si (10 nodos) | Si | true | OK |
| W07 Evolution fanout | No (0 hardcoded) | Si | true | OK |
| W08 Shopify updated | Si (1 nodo) | Si | true | OK |

**Backups**: eliminados (ya no necesarios)

**Estado final Tarea 2**: 100% completada
- 19 nodos migrados de hardcoded a credencial predefinida
- 0 JWTs en el repo completo
- Todos los workflows operacionales

**Proximo paso**: Tarea 3

---

#### Tarea 3 — Git init + push a GitHub

**Estado**: completado

**Pasos ejecutados**:
- Pre-flight checks: 3/3 VACIOS (cero credenciales en archivos trackeables)
- git init + branch main
- git config user.email=rescignoaniello@gmail.com, user.name=Aniello Rescigno
- git add -A (41 archivos, 4265 lineas)
- git diff --cached: 0 JWTs reales encontrados
- First commit: 1376a7a
- Remote origin: https://github.com/rescignoaniello-crypto/shadow-ios.git
- Push a main: exitoso
- Fix URL commit: 43341ae (corregido username en README.md)
- Post-validation: .env NO subido, mcp.json NO subido, SHADOW_IOS_MASTER NO subido

**41 archivos trackeados**:
- .claude/mcp.json.example, .env.example, .gitignore
- CLAUDE.md, README.md, WORK_LOG.md
- dashboard/ (14 archivos: src, config, package)
- n8n/workflows/ (8 JSONs limpios)
- scripts/ (2 archivos)
- supabase/migrations/ (1 archivo)
- package.json, package-lock.json

**Resultado**: repo privado inicializado y sincronizado con GitHub

**Proximo paso**: Tarea 4

---

#### Tarea 4 — system_alerts + retry W02 + migracion Evolution

**Estado**: completado

**Cambios Supabase**:
- Migracion 002_system_alerts.sql ejecutada (manual por humano en SQL Editor)
- Tabla system_alerts con 3 indices parciales y 1 comentario
- Validada: insert + query + delete OK

**Cambios W02 (retry + fallback)**:
- Nodo "Notify admin": retryOnFail=true, maxTries=3, wait=5000ms
- onError: continueRegularOutput (no bloquea el workflow)
- Nuevo nodo IF "Notify failed?" -> detecta $json.error
- Nuevo nodo HTTP "Log system alert" -> inserta en system_alerts (rama true)
- Nuevo nodo NoOp "Notify OK" -> rama exitosa (false)
- Total nodos W02: 7 -> 10

**Migracion Evolution API**:
- 7 nodos tenian key 3FDA...D424E hardcoded en 3 workflows
- W02: 1 nodo (Notify admin)
- W04: 1 nodo (Send WhatsApp admin)
- W06: 5 nodos (A: Send template, A: Confirm, B: Notify, C: Confirm, D: Confirm)
- Todos migrados a credencial "Evolution account" (id vabu5FHInLG8vGmD)
- 0 API keys Evolution hardcoded en repo

**Test controlado**:
- Tabla system_alerts: insert/query/delete validados via REST API
- Test E2E completo del retry: pendiente ejecucion manual (API n8n no soporta mock payload para manualTrigger)
- El patron retry+fallback esta configurado y activo

**Validacion final**:
- grep JWTs repo: VACIO
- grep Evolution key repo: VACIO
- W02 active=true, W04 active=true, W06 active=true
- W05 webhook rate: OK (Bs=635)

**Proximo paso**: Sprint 1 — comandos faltantes
