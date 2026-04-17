# Shadow iOS — CLAUDE.md
## Instrucciones para el agente de construccion

---

## CREDENCIALES

Este archivo NO contiene credenciales reales. Los valores
estan referenciados como variables de entorno (${VAR_NAME})
y se cargan desde el archivo .env del root del proyecto.

Onboarding de nuevo developer:
1. cp .env.example .env
2. Editar .env con los valores reales
3. Las credenciales reales estan en el gestor de secretos del
   equipo (nunca commitearlas)

---

## IDENTIDAD Y ROL

Eres el arquitecto senior de Shadow iOS, un sistema de automatizacion total para el negocio de ropa Primal VZla (Venezuela). Tu trabajo es construir automatizaciones de nivel produccion usando n8n, Supabase, Shopify y Evolution API.

Tienes acceso directo a:
- **n8n** via MCP — puedes crear, modificar y activar workflows en vivo
- **Supabase** via MCP — puedes crear tablas, ejecutar SQL y consultar datos en vivo

Trabajas como un senior backend engineer especializado en automatizaciones. No pides permiso para cada micro-decision. Ejecutas, verificas, y reportas resultados.

---

## PRINCIPIOS DE TRABAJO

### 1. Ejecuta primero, explica despues
No des largas explicaciones antes de hacer el trabajo. Ejecuta las herramientas, y cuando termines reporta que hiciste y el resultado.

### 2. Valida siempre
Despues de crear cualquier cosa (tabla, workflow, webhook), verifica que funciona con una prueba real antes de marcar como completado.

### 3. Usa templates antes de construir desde cero
Para workflows de n8n, siempre busca templates existentes primero con las herramientas del MCP.

### 4. Manejo de errores
Si algo falla, intenta resolverlo solo hasta 3 veces antes de reportar el problema con contexto completo.

### 5. Sin placeholders
Nunca dejes `{{TODO}}` o valores de ejemplo en el codigo. Si falta un dato, pregunta especificamente cual necesitas.

---

## CONTEXTO DEL NEGOCIO — PRIMAL VZLA

**Tipo de negocio:** Tienda de ropa fitness/streetwear (marca YoungLA, Venezuela)
**Canales de venta:** WhatsApp (principal), Shopify, Instagram DMs
**Metodos de pago:** Cash USD, Zelle, Bolivares (Pago Movil/transferencia)
**Logistica:**
  - Delivery Caracas: motociclistas externos (Larry, Miguel, Farfan, Jhosty, Omar, Daniela, Riyeson, Gustavo, Marcos, Fabian, Diego, Johan, etc.)
  - Envios nacionales: Zoom, MRW, Tealca
**Tasa de cambio:** Binance P2P USDT/VES — confidencial, no mencionar al cliente
**Agente IA activo:** Kira (WhatsApp bot en n8n + Evolution API + Claude API)
**Admin WhatsApp:** ${ADMIN_WHATSAPP}

---

## CONEXIONES A SERVICIOS

### Supabase — shadow-ios (base de datos de este proyecto)
```
URL:              ${SUPABASE_URL}
anon key:         ${SUPABASE_ANON_KEY}
service_role key: ${SUPABASE_SERVICE_ROLE_KEY}
```
(Ver .env para valores reales. Onboarding: cp .env.example .env && llenar valores)

Usar service_role key para operaciones de escritura y creacion de tablas.
Este es un proyecto NUEVO y SEPARADO del Supabase que usa Kira.

### n8n
```
URL:     ${N8N_URL}
API Key: ${N8N_API_KEY}
```

### Shopify
```
Shop:        primalvzla.myshopify.com
OAuth cred:  "Shopify-Primal-Access Token account" (ya configurada en n8n)
Client ID:   ${SHOPIFY_CLIENT_ID}
```
Shopify usa OAuth2. NO usar Admin Tokens. Usar la credencial OAuth2 existente en n8n.
Para webhooks de Shopify: usar nodo "Shopify Trigger" en n8n — registra el webhook automaticamente.

### Evolution API (WhatsApp)
```
URL:                    ${EVOLUTION_URL}
Instancia prueba:       ${EVOLUTION_INSTANCE_PRUEBA}  |  Key: ${EVOLUTION_API_KEY_PRUEBA}
Instancia correcciones: ${EVOLUTION_INSTANCE_CORRECCIONES}  |  Key: ${EVOLUTION_API_KEY_CORRECCIONES}
```
Para notificaciones al admin usar instancia "prueba".

---

## SCHEMA DE BASE DE DATOS

Todas estas tablas deben existir en el proyecto shadow-ios de Supabase.

### orders
```sql
CREATE TABLE orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  shopify_order_id TEXT UNIQUE,
  order_number TEXT,
  client_name TEXT,
  client_phone TEXT,
  client_city TEXT,
  client_cedula TEXT,
  channel TEXT CHECK (channel IN ('whatsapp','shopify','instagram','manual')),
  status TEXT DEFAULT 'pendiente_pago' CHECK (status IN (
    'pendiente_pago','confirmado','en_preparacion',
    'en_ruta','entregado','completado','cancelado'
  )),
  delivery_type TEXT CHECK (delivery_type IN ('delivery','envio','pickup')),
  carrier TEXT,
  tracking_number TEXT,
  delivery_address TEXT,
  subtotal_usd DECIMAL(10,2),
  delivery_cost_usd DECIMAL(10,2) DEFAULT 0,
  total_usd DECIMAL(10,2),
  total_bs DECIMAL(10,2),
  exchange_rate DECIMAL(10,4),
  payment_method TEXT CHECK (payment_method IN ('cash','zelle','bolivares','binance','mixto')),
  amount_paid_usd DECIMAL(10,2),
  amount_paid_bs DECIMAL(10,2),
  change_given DECIMAL(10,2) DEFAULT 0,
  notes TEXT,
  kira_conversation_id TEXT
);
```

### order_items
```sql
CREATE TABLE order_items (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  order_id UUID REFERENCES orders(id) ON DELETE CASCADE,
  sku TEXT,
  product_name TEXT NOT NULL,
  size TEXT,
  color TEXT,
  quantity INTEGER DEFAULT 1,
  unit_price_usd DECIMAL(10,2),
  unit_cost_usd DECIMAL(10,2),
  total_price_usd DECIMAL(10,2)
);
```

### cash_movements
```sql
CREATE TABLE cash_movements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  date DATE DEFAULT CURRENT_DATE,
  movement_type TEXT CHECK (movement_type IN ('ingreso','egreso','cambio','transferencia')),
  wallet TEXT CHECK (wallet IN ('cash_usd','bolivares','zelle')),
  amount DECIMAL(10,2) NOT NULL,
  exchange_rate DECIMAL(10,4),
  amount_usd_equivalent DECIMAL(10,2),
  concept TEXT,
  order_id UUID REFERENCES orders(id),
  balance_after DECIMAL(10,2)
);
```

### deliveries
```sql
CREATE TABLE deliveries (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  date DATE DEFAULT CURRENT_DATE,
  order_id UUID REFERENCES orders(id),
  rider_name TEXT,
  destination TEXT,
  delivery_cost DECIMAL(10,2),
  status TEXT DEFAULT 'pendiente' CHECK (status IN (
    'pendiente','asignado','en_ruta','entregado','cobrado','fallido'
  )),
  is_cash_on_delivery BOOLEAN DEFAULT FALSE,
  cash_to_collect_usd DECIMAL(10,2),
  cash_to_collect_bs DECIMAL(10,2),
  cash_collected BOOLEAN DEFAULT FALSE,
  cash_collected_amount DECIMAL(10,2),
  notes TEXT,
  delivered_at TIMESTAMPTZ
);
```

### exchange_rates
```sql
CREATE TABLE exchange_rates (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  date DATE UNIQUE DEFAULT CURRENT_DATE,
  rate_binance DECIMAL(10,4),
  rate_bcv DECIMAL(10,4),
  rate_used DECIMAL(10,4),
  source TEXT DEFAULT 'binance',
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### inventory_movements
```sql
CREATE TABLE inventory_movements (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  date DATE DEFAULT CURRENT_DATE,
  movement_type TEXT CHECK (movement_type IN ('entrada','salida','ajuste')),
  sku TEXT,
  product_name TEXT,
  size TEXT,
  color TEXT,
  quantity INTEGER,
  order_id UUID REFERENCES orders(id),
  reason TEXT,
  notes TEXT
);
```

---

## FLUJOS N8N A CONSTRUIR

### Flujo 1 — Tasa de cambio diaria
- Trigger: Cron 8:00 AM Venezuela (UTC-4 -> 12:00 UTC)
- Fetch Binance P2P: POST https://p2p.binance.com/bapi/c2c/v2/friendly/c2c/adv/search
  Body: `{"fiat":"VES","crypto":"USDT","tradeType":"BUY","page":1,"rows":3}`
- Promediar los primeros 3 precios
- Insertar en tabla `exchange_rates` (upsert por fecha)

### Flujo 2 — Shopify nuevo pedido -> Supabase
- Trigger: Shopify Trigger node (evento: Order Created)
- Usar credencial OAuth2 "Shopify-Primal-Access Token account"
- Extraer datos del pedido y cliente
- Buscar tasa del dia en `exchange_rates`
- Insertar en `orders` (channel='shopify', status='confirmado')
- Insertar line items en `order_items`
- Notificar al admin por WhatsApp via Evolution API

### Flujo 3 — Shopify status update -> Supabase
- Trigger: Shopify Trigger (Order Updated / Order Fulfilled)
- Mapear status Shopify -> Shadow iOS status
- Actualizar registro en `orders`

### Flujo 4 — Kira webhook (venta WhatsApp -> Supabase)
- Trigger: Webhook en /webhook/kira-new-sale
- Recibir payload con datos de la venta cerrada por Kira
- Insertar en `orders` (channel='whatsapp') y `order_items`
- Registrar en `cash_movements`
- Retornar order_id a Kira

### Flujo 5 — Resumen diario al admin
- Trigger: Cron 10:00 PM Venezuela (02:00 UTC)
- Consultar Supabase: ventas del dia, caja por wallet, deliveries pendientes
- Formatear resumen en WhatsApp markdown
- Enviar a ${ADMIN_WHATSAPP} via Evolution API instancia "prueba"

**Formato del resumen:**
```
*Resumen del dia - Primal*
{fecha}

*CAJA*
Cash USD: ${total_cash}
Zelle: ${total_zelle}
Bolivares: Bs {total_bs} (= ${bs_en_usd})
Total: ${gran_total}

*PEDIDOS HOY*
Nuevos: {nuevos} | En ruta: {en_ruta} | Entregados: {entregados}

*DELIVERIES PENDIENTES*
{lista_riders_y_destinos}

Tasa: Bs {tasa}/USD
```

---

## REGLAS DE NEGOCIO IMPORTANTES

1. **Tasa de cambio:** Siempre Binance P2P. NUNCA mencionar "Binance" al cliente — decir "tasa del dia".
2. **Deliveries cash:** El rider cobra en efectivo al entregar. Registrar en `deliveries.is_cash_on_delivery = true`.
3. **Nombres de riders:** Normalizar siempre a minusculas. "Larry", "LARRY", "larry" -> "larry".
4. **Fechas Excel:** Los seriales de Excel se convierten con: `new Date((serial - 25569) * 86400 * 1000)`
5. **Status de Shopify -> Shadow iOS:**
   - pending/authorized/paid -> confirmado
   - fulfilled -> entregado
   - refunded/voided -> cancelado

---

## ORDEN DE EJECUCION — MODULO 1

Ejecutar en este orden exacto:

**PASO 1** — Crear todas las tablas en Supabase (usar MCP de Supabase)
  -> Verificar que las 6 tablas existen y son consultables
  -> Insertar tasa inicial de prueba en exchange_rates

**PASO 2** — Crear flujo de tasa de cambio en n8n (usar MCP de n8n)
  -> Activarlo y probarlo manualmente
  -> Verificar que inserto en Supabase

**PASO 3** — Crear flujo Shopify -> Supabase
  -> Activar
  -> Probar con un pedido de prueba en Shopify

**PASO 4** — Crear flujo Kira webhook
  -> Probar con payload de ejemplo
  -> Verificar insercion en Supabase

**PASO 5** — Crear flujo resumen diario
  -> Probar enviando el resumen manualmente

**PASO 6** — Script de importacion del Excel historico
  -> Archivo: PRIMAL-INVENTORY_SALES-2026.xlsx
  -> Parsear hojas VENTAS, CAJA, deliveries
  -> Importar todo a Supabase preservando fechas historicas

---

## STACK TECNICO

- **Automatizaciones:** n8n (self-hosted en Contabo via Easypanel)
- **Base de datos:** Supabase (PostgreSQL)
- **WhatsApp:** Evolution API
- **E-commerce:** Shopify (OAuth2)
- **IA del agente:** Claude API (claude-haiku-4-5 para tareas rapidas, claude-sonnet-4-6 para razonamiento)
- **Dashboard (Modulo 2, proxima fase):** Next.js + Tailwind + Vercel

---

## ESTRUCTURA DEL PROYECTO

```
shadow-ios/
├── CLAUDE.md                    <- este archivo
├── .claude/
│   └── mcp.json                 <- configuracion MCPs
├── .env                         <- variables de entorno (NO en git)
├── .env.example                 <- plantilla de credenciales (SI en git)
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql
├── n8n/
│   └── workflows/               <- JSONs de los flujos exportados
├── scripts/
│   ├── import-excel-history.js
│   └── test-all.js
└── dashboard/                   <- Modulo 2 (Next.js app)
```

---

## MODULO 3 — FLUJOS DE DELIVERY Y CAJA POR WHATSAPP

### Contexto operacional

Primal VZla maneja deliveries a traves de la agencia **Pidelo y Punto (PyP)**.
El bot de Kira (instancia `prueba` de Evolution API) esta en 3 grupos:

| Grupo | ID | Proposito |
|---|---|---|
| Dashboard | `${GROUP_DASHBOARD}` | Aniello le escribe al bot para registrar todo |
| Delivery PyP Primal | `${GROUP_PYP}` | Bot monitorea y manda plantillas a PyP |
| Polaris GROUP | `${GROUP_POLARIS}` | Interno, no usar |

### Flujo A — Registrar delivery nuevo

**Trigger:** Mensaje de Aniello en grupo Dashboard con patron:
```
delivery #XXXX NombreCliente TELEFONO destino DIRECCION cobrar $XX
delivery #XXXX NombreCliente TELEFONO destino DIRECCION pagado
```

**Logica n8n:**
1. Webhook escucha grupo Dashboard (Evolution API webhook en n8n)
2. Detectar si el mensaje empieza con "delivery"
3. Parsear con Claude API: extraer order_number, client_name, phone, address, amount_to_collect, is_paid
4. Insertar en tabla `deliveries` de Supabase con status='pendiente'
5. Buscar el order_id en tabla `orders` por order_number (shopify_order_id o order_number)
6. Generar y mandar plantilla de PyP al grupo `${GROUP_PYP}`:

```
*_Plantilla de Servicios_*

*Servicio* : Delivery

*N de Pedido:* #{{order_number}}

*Punto de Retiro* : Prados del este, Calle la ceiba, 5ta Urupagua 80p*

*Punto de Entrega* : {{address}}

*Referencia*: {{reference}}

*Nombre:* {{client_name}}

*Tlf / Alternativo:* {{phone}}

*Vuelto a Recibir:* {{change_note}}

*Esta pago*: {{is_paid_text}}
```

7. Confirmar en grupo Dashboard: "Delivery #XXXX registrado. Plantilla enviada a PyP."

### Flujo B — Detectar motorizado asignado

**Trigger:** Mensaje en grupo PyP (`${GROUP_PYP}`)

**Patrones a detectar (PyP responde con solo el nombre del motorizado):**
- "Bryant", "Robert", "Hector", "Omar", "Wilmer", "Luis" (y variaciones)
- Tambien: "Bryant con $220", "Robert afuera"

**Logica:**
1. Webhook escucha grupo PyP
2. Si el mensaje es solo un nombre de motorizado conocido -> buscar el delivery mas reciente en status='pendiente' -> actualizar a status='asignado', rider_name=nombre
3. Notificar en Dashboard: "Delivery #XXXX asignado a {{rider}}. En camino."

**Lista de motorizados conocidos:**
bryant, robert, hector, omar, wilmer, luis, anderson, caldera, ostos, vargas, fabian, diego, johan, kevin, kelvin, abraham, oguir, leonel, ronald, jaider, riyeson, gustavo, marcos, daniela

### Flujo C — Confirmar cash recibido

**Trigger:** Mensaje de Aniello en grupo Dashboard con patron:
```
recibido $XX nombreMotorizado
recibido $XX
cobrado #XXXX $XX
```

**Logica:**
1. Parsear monto y nombre del motorizado
2. Buscar delivery en status='asignado' o 'en_ruta' con ese rider
3. Actualizar delivery: status='cobrado', cash_collected=true, cash_collected_amount=monto
4. Insertar en cash_movements: wallet='cash_usd', movement_type='ingreso', amount=monto, concept='Delivery cobrado - {{rider}}'
5. Confirmar en Dashboard: "Recibido $XX de {{rider}}. Delivery #XXXX cerrado. Caja actualizada."

### Flujo D — Registrar pago de cliente (pagos recibidos)

**Trigger:** Mensaje en Dashboard:
```
pagado #XXXX zelle $45
pagado #XXXX cash $45
pagado #XXXX bs 28000
pagado #XXXX mixto cash $20 zelle $25
```

**Logica:**
1. Parsear order_number, metodo(s) de pago, monto(s)
2. Actualizar order status='confirmado' en Supabase
3. Insertar en cash_movements por cada wallet usado
4. Si habia delivery pendiente de cobro, actualizar is_cash_on_delivery segun corresponda
5. Confirmar en Dashboard: "Pago #XXXX registrado. Pedido confirmado."

### Tabla de estados de delivery

```
pendiente -> asignado -> en_ruta -> entregado -> cobrado
                                              -> (si ya estaba pagado) -> completado
```

### Datos de conexion Evolution API

```
URL:          ${EVOLUTION_URL}
API Key:      ${EVOLUTION_API_KEY_PRUEBA}
Instancia:    ${EVOLUTION_INSTANCE_PRUEBA}

Endpoint enviar mensaje a grupo:
POST /message/sendText/${EVOLUTION_INSTANCE_PRUEBA}
Body: { "number": "{{groupId}}", "text": "{{mensaje}}" }

Endpoint webhook (ya configurado en n8n):
El webhook de n8n recibe los mensajes de todos los grupos via Evolution API webhook
Filtrar por: body.data.key.remoteJid === groupId
```

### Orden de construccion — Modulo 3

**PASO 1** — Crear workflow n8n "Shadow iOS — 06 Dashboard listener"
- Webhook receptor de mensajes de Evolution API
- Router: si viene de Dashboard -> procesar comandos, si viene de PyP -> detectar motorizado
- Subflows por tipo de comando

**PASO 2** — Flujo A: registro delivery + plantilla PyP
- Parser de mensaje con Claude API (model: claude-haiku-4-5-20251001 para ahorrar creditos)
- Insert en Supabase deliveries
- Send plantilla al grupo PyP

**PASO 3** — Flujo B: deteccion motorizado
- Pattern matching de nombre de motorizado
- Update delivery en Supabase

**PASO 4** — Flujo C: confirmacion cash
- Parser de "recibido $XX rider"
- Update delivery + insert cash_movement

**PASO 5** — Flujo D: registro pago cliente
- Parser de "pagado #XXXX metodo $monto"
- Update order + insert cash_movements

**PASO 6** — Configurar webhook de Evolution API para apuntar al n8n
- URL webhook: ${N8N_URL}/webhook/shadow-ios-wa-listener
- Activar en instancia `prueba`

### Ejemplo de conversacion en grupo Dashboard

```
Aniello: delivery #2048 Jonathan Marquez 04242756161 destino av la colina cobrar $45
Bot:     Delivery #2048 registrado. Plantilla enviada a PyP.
         Esperando confirmacion de motorizado...

[En grupo PyP]
Bot PyP: Plantilla de Servicios...
PyP:     Bryant

Bot Dashboard: Delivery #2048 asignado a Bryant. En camino.

[Mas tarde]
Aniello: recibido $45 bryant
Bot:     Recibido $45 de Bryant. Delivery #2048 cerrado. Caja +$45 cash.
```
