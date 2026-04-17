# Shadow iOS — Estado Actual

## Ultima actualizacion: 2026-04-17

---

## SPRINT 0 — COMPLETADO

Infraestructura base construida:
- 6 tablas en Supabase (orders, order_items, cash_movements, deliveries, exchange_rates, inventory_movements)
- 8 workflows en n8n (tasa diaria, Shopify sync, Kira webhook, resumen diario, rate webhook, Dashboard listener, fanout, Shopify updates)
- Importacion de datos historicos desde Excel
- Evolution API webhook configurado con webhookBase64=true
- Fanout W07 separando grupos (Shadow) de privados (Kira)

---

## SPRINT 1 — COMPLETADO

### Comandos del Dashboard (W06 — 41 nodos)

| # | Comando | Formato | Origen | Accion | Respuesta |
|---|---------|---------|--------|--------|-----------|
| A | delivery | `delivery #XXXX Nombre TEL destino DIR cobrar $XX` | Dashboard | Inserta en deliveries, envia plantilla a PyP | "Delivery #XXXX registrado. Plantilla enviada a PyP." |
| B | rider | `Bryant` (solo nombre) | PyP | Detecta motorizado, actualiza delivery a asignado | "Delivery #XXXX asignado a bryant." (en Dashboard) |
| C | recibido | `recibido $45 bryant` | **PyP** | Update delivery cobrado + insert cash_movements (cash_usd, ingreso) | "Recibido $45 de bryant. Delivery cerrado. Caja +$45 cash." (en Dashboard) |
| D | pagado | `pagado #XXXX zelle $45` | Dashboard | Update order confirmado + insert cash_movements | "Pago #XXXX registrado. Pedido confirmado." |
| E | saldo | `saldo` | Dashboard | Consulta cash_movements + tasa del dia | Saldos de 4 wallets + total equivalente USD |
| F | envio | `envio #XXXX mrw 011800605000505` | Dashboard | Update order: carrier, tracking, status=despachado. Envia tracking al cliente por WhatsApp | "Despachado por MRW. Tracking enviado a Nombre (Ciudad)." |
| G | gasto | `gasto $25 gasolina` o `gasto $100 zelle mercaderia` | Dashboard | Insert cash_movements (egreso, wallet segun comando) | "Gasto $25 registrado: gasolina. Caja -$25 cash." |
| H | cambio | `cambio $200 cash zelle` | Dashboard | 2x insert cash_movements (egreso origen + ingreso destino). Si involucra bs, consulta tasa | "Cambio registrado: $200 cash -> zelle." |

### Detalle de cada comando

**envio** — carriers soportados: mrw, zoom, tealca, domesa, dhl. Actualiza carrier, tracking_number, delivery_type='envio', status='despachado'. Si el cliente tiene telefono registrado, le envia mensaje con tracking. Si no tiene telefono, avisa en Dashboard.

**recibido** — IMPORTANTE: Aniello escribe esto en el grupo **PyP** (no Dashboard). La confirmacion siempre va al grupo Dashboard. Shadow NUNCA responde conversacionalmente en PyP.

**gasto** — wallet opcional como segunda palabra: `gasto $50 zelle comida` → egreso en zelle. Sin wallet → default cash_usd. Wallets: cash/cash_usd, zelle, bs/bolivares, binance.

**cambio** — siempre genera 2 movimientos. Si involucra bolivares, consulta la tasa via W05 rate webhook y calcula el equivalente.

---

## SPRINT 2 — EN PROGRESO

### Tarea 1: Lectura automatica de comprobantes Zelle — COMPLETADA

**Que se hizo:**
- Cadena de procesamiento inline en W07 (8 nodos Z:)
- Detecta mensajes tipo imageMessage en chats privados
- GPT-4o-mini Vision analiza la imagen (credencial OpenAI existente)
- Si es Zelle: extrae monto/referencia/fecha/nombre
- Busca pedido pendiente por telefono del cliente
- Registra pago en cash_movements (zelle, ingreso)
- Actualiza order status=confirmado
- Confirma en Dashboard: "Zelle $45 Nombre #XXXX — registrado."
- Si no es Zelle: para graciosamente (NOT_ZELLE)
- Kira sigue recibiendo el mensaje en paralelo

**Decision de arquitectura:** Se intento crear W09 como workflow separado, pero los sub-workflows creados via n8n API no se ejecutan (error de validacion). Solucion: cadena inline en W07.

**Decision temporal:** Se usa GPT-4o-mini (credencial openAiApi existente) en vez de Claude Haiku. Cuando se tenga la API key de Anthropic, cambiar el nodo Z: GPT Vision a Anthropic.

### Pendientes Sprint 2

- [ ] Probar con comprobante Zelle real (enviar foto al chat de Primal)
- [ ] Lectura de comprobantes Pago Movil / transferencia Bs
- [ ] Comando `pagopyp $XX [zelle/bs]` para pagos a la agencia PyP

---

## INFRAESTRUCTURA ACTIVA

### Workflows n8n

| ID | Nombre | Funcion | Nodos | Estado |
|----|--------|---------|-------|--------|
| 3sj3qGPw5oECiLDB | Shadow iOS — 01 Tasa de cambio diaria | Cron 8am: fetch Binance P2P, upsert exchange_rates | — | Inactivo |
| GUanijFyA7biDyRX | Shadow iOS — 02 Shopify nuevo pedido | Shopify Trigger: nuevo pedido → orders + order_items + notif WhatsApp | — | Activo |
| qvySBgmDdvTHatVO | Shadow iOS — 03 Kira nueva venta | Webhook: venta cerrada por Kira → orders + cash_movements | — | Activo |
| v67cGduUEFLwFnbq | Shadow iOS — 04 Resumen diario | Cron 10pm: resumen de caja, pedidos y deliveries al admin | — | Activo |
| 9w3OqxiB8pZcOfvp | Shadow iOS — 05 Rate webhook (GET) | GET /webhook/rate → retorna tasa del dia {Bs, Dolar} | — | Activo |
| X16QoSlg2WyXocbj | Shadow iOS — 06 Dashboard listener | Webhook: recibe mensajes de grupos, procesa 8 comandos | 41 | Activo |
| ha7xPM5H4nMKHQSl | Shadow iOS — 07 Evolution fanout | Webhook: recibe TODOS los mensajes, rutea a Shadow/Kira/Zelle | 15 | Activo |
| 4FYpMkhhMkXw1PEo | Shadow iOS — 08 Shopify order updated | Shopify Trigger: pedido actualizado → sync status en orders | — | Activo |

### Credenciales n8n referenciadas

| ID | Nombre | Tipo | Usado en |
|----|--------|------|----------|
| x8buzsXlNOri8ISa | Supabase Shadow iOS | supabaseApi | W06, W07 (Z: nodos) |
| vabu5FHInLG8vGmD | Evolution account | evolutionApi | W06, W07 |
| sQmAvby8rLOnB3r6 | OpenAi account | openAiApi | W07 (Z: GPT Vision) |

### Grupos WhatsApp

| Grupo | JID | Uso |
|-------|-----|-----|
| Dashboard | 120363427557786772@g.us | Comandos operacionales (Aniello → Shadow) |
| Delivery PyP Primal | 120363399646672357@g.us | Plantillas a PyP + deteccion motorizado + recibido |
| Polaris GROUP | 120363404711910391@g.us | Interno Kira, no tocar |

---

## W06 DASHBOARD LISTENER — COMANDOS ACTIVOS

### Arquitectura interna

```
WA webhook → Route intent (Code) → Switch intent (8 cases)
  ├─ delivery → A: Parse → Lookup → Build → Insert → Send PyP → Confirm
  ├─ rider    → B: Find pending → Prep → Update → Notify
  ├─ recibido → C: Parse → Find delivery → Update → Insert cash → Confirm
  ├─ pagado   → D: Parse → Lookup → Update → Insert cash → Confirm
  ├─ saldo    → E: Fetch balances → Fetch rate → Format → Send
  ├─ envio    → F: Parse → Lookup → Update → Prep notify → Notify client → Confirm
  ├─ gasto    → G: Parse → Insert cash → Confirm
  └─ cambio   → H: Parse → Fetch rate → Build movements → Insert → Confirm
```

### Route intent — deteccion por grupo

| Grupo | Comandos detectados |
|-------|-------------------|
| Dashboard | delivery, pagado, saldo, envio, gasto, cambio |
| PyP | recibido/cobrado, nombre de motorizado (rider) |

---

## REGLAS DE NEGOCIO INMUTABLES

1. **Tasa Binance P2P** — NUNCA mencionar "Binance" al cliente. Decir "tasa del dia".
2. **Nombres de riders** — normalizar siempre a minusculas.
3. **Shadow en PyP** — NUNCA responde conversacionalmente en el grupo PyP. Solo envia plantillas como respuesta a un comando desde Dashboard.
4. **Recibido desde PyP** — Aniello escribe "recibido $X rider" en PyP. La confirmacion va al Dashboard.
5. **Kira solo privados** — Kira opera SOLO en chats privados (@s.whatsapp.net). El fanout W07 garantiza esto.

---

## SALDOS Y FECHA CERO

**Fecha de inicio de operaciones Shadow iOS:** 16/04/2026

**Saldos iniciales (importados del Excel historico):**

| Wallet | Saldo |
|--------|-------|
| Cash USD | $2,818.00 |
| Zelle | $3,206.60 |
| Bolivares | Bs 918,840.02 |
| Binance | $0.00 |

Estos saldos representan la suma de todos los movimientos importados hasta el 16/04/2026.

---

## DECISIONES DE ARQUITECTURA

### Fanout W07 (grupos vs privados)

```
Evolution webhook → Classify (isGroup + isImage + fromMe)
  ├─ Grupo (@g.us) → Shadow iOS W06 (solo Shadow procesa grupos)
  └─ Privado (@s.whatsapp.net) → Is image?
      ├─ Imagen → Z: cadena Zelle (inline) + Kira (paralelo)
      └─ No imagen → Kira + Shadow iOS (ambos reciben)
```

**Por que inline en W07:** Los sub-workflows creados via n8n API fallan con "workflow has issues" al ser invocados via executeWorkflow. Workaround: procesar directamente en W07 con nodos Z:.

### GPT-4o-mini temporal para Vision

Se usa la credencial OpenAI existente (`openAiApi` id: sQmAvby8rLOnB3r6) con GPT-4o-mini para analisis de imagenes. Cuando se configure la API key de Anthropic, cambiar a Claude Haiku 4.5 (mas barato, mejor en espanol).

### Status 'despachado'

Se agrego 'despachado' al CHECK constraint de orders.status (migracion 002). Usado por el comando `envio` para marcar pedidos enviados por carrier.

### Credenciales en Code nodes

Los Code nodes de n8n en esta version NO soportan `$credentials` ni `this.getCredentials()`. Solucion: usar HTTP Request nodes con `predefinedCredentialType` para todas las llamadas autenticadas. Los Code nodes solo procesan datos.

---

## PENDIENTES CONOCIDOS

- **Pedido #2050 (David)** — no tiene telefono registrado. El comando envio no le envio tracking por WhatsApp. Pendiente actualizar client_phone en Supabase.
- **Tasa de cambio** — W01 (cron diario) esta inactivo. La tasa se actualizo manualmente. Pendiente reactivar o verificar que funciona.
- **W01 inactivo** — el workflow de tasa diaria esta desactivado. Verificar si es intencional.
- **API key Anthropic** — no configurada. Cuando se tenga, crear credencial n8n y migrar Z: GPT Vision de OpenAI a Claude Haiku.
- **Comprobante Zelle real** — la cadena Z: fue testeada con imagenes de prueba (NOT_ZELLE correcto). Falta validar con un comprobante Zelle real.
