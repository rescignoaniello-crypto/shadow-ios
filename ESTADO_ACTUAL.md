# Shadow iOS — Estado Actual

## Ultima actualizacion: 2026-04-18 (sesion nocturna)

---

## SPRINT 0 — COMPLETADO

Infraestructura base: 6 tablas Supabase, 8 workflows n8n, importacion Excel, Evolution API webhook con webhookBase64=true, fanout W07.

---

## SPRINT 1 — COMPLETADO

### Comandos W06 Dashboard listener (44 nodos, 9 comandos)

| # | Comando | Formato | Origen | Accion | Respuesta |
|---|---------|---------|--------|--------|-----------|
| A | delivery | `delivery #XXXX Nombre TEL destino DIR cobrar $XX` | Dashboard | Insert deliveries + plantilla PyP | "Delivery #XXXX registrado." |
| B | rider | `Bryant` (nombre solo) | PyP | Update delivery → asignado | "Delivery #XXXX asignado a bryant." |
| C | recibido | `recibido $45 bryant` | **PyP** | Update delivery cobrado + ingreso cash_usd | "Recibido $45 de bryant. Delivery cerrado." |
| D | pagado | `pagado #XXXX zelle $45` | Dashboard | Update order + ingreso wallet | "Pago #XXXX registrado." |
| E | saldo | `saldo` | Dashboard | Query cash_movements + tasa | Saldos 4 wallets + total USD |
| F | envio | `envio #XXXX mrw TRACKING` | Dashboard | Update order despachado + WhatsApp cliente | "Despachado por MRW. Tracking enviado." |
| G | gasto | `gasto $25 gasolina` | Dashboard | Egreso cash_usd (o wallet especificado) | "Gasto $25 registrado." |
| H | cambio | `cambio $200 cash zelle` | Dashboard | 2x insert (egreso + ingreso) | "Cambio registrado." |
| I | pagopyp | `pagopyp $25` o `pagopyp $50 bs` | Dashboard | Egreso wallet (default zelle) | "Pago PyP $25 registrado." |

---

## SPRINT 2 — COMPLETADO

### Lectura automatica de comprobantes (W07 cadena C:, 17 nodos)

GPT-4o-mini Vision detecta automaticamente:
- **Zelle** → wallet=zelle, monto USD
- **Pago Movil** → wallet=bolivares, conversion USD con tasa
- **Binance** → wallet=binance, monto USDT
- **Transferencia** → wallet=bolivares

Flujo con deduplicacion:
1. Fran escribe `#2060` en grupo Comprobantes (contexto pendiente, 5min TTL)
2. Fran reenvia/envia imagen del comprobante
3. Shadow lee imagen → extrae datos pago → busca contexto pendiente → busca order
4. Verifica duplicados por referencia → si ya existe, ignora
5. Registra en cash_movements + confirma en Dashboard

Grupo Comprobantes JID: `120363409525696846@g.us`

---

## SPRINT 3 — COMPLETADO

### Alertas proactivas (W01 reconstruido, 8 nodos, ACTIVO)

- Cron 8am VET (12:00 UTC)
- Fetch Binance P2P → promedia top 5 → upsert exchange_rates
- Morning briefing al Dashboard: tasa + saldos de caja + pedidos estancados >24h
- Error handling: si Binance falla, usa ultima tasa conocida

---

## SPRINT 4 — COMPLETADO

### Tracking automatico en grupo Comprobantes (W07, 4 nodos track)

GPT Vision detecta guias de envio (MRW, Zoom, Tealca, DHL):
1. Extrae carrier + tracking + destinatario
2. Busca pedido por contexto pendiente (#XXXX)
3. Actualiza order: carrier, tracking, status=despachado
4. Envia tracking al cliente por WhatsApp
5. Confirma en Dashboard: "Guia MRW 0118... — Nombre #XXXX despachado."

---

## INFRAESTRUCTURA ACTIVA

### Workflows n8n

| ID | Nombre | Funcion | Nodos | Estado |
|----|--------|---------|-------|--------|
| 3sj3qGPw5oECiLDB | 01 Tasa de cambio diaria | Cron 8am: Binance → exchange_rates + briefing matutino | 8 | **Activo** |
| GUanijFyA7biDyRX | 02 Shopify nuevo pedido | Order Created → orders + notif WhatsApp | — | Activo |
| qvySBgmDdvTHatVO | 03 Kira nueva venta | Webhook venta Kira → orders + cash | — | Activo |
| v67cGduUEFLwFnbq | 04 Resumen diario | Cron 10pm: resumen caja al admin | 8 | Activo |
| 9w3OqxiB8pZcOfvp | 05 Rate webhook | GET /webhook/rate → {Bs, Dolar} | — | Activo |
| X16QoSlg2WyXocbj | 06 Dashboard listener | 9 comandos WhatsApp | 44 | Activo |
| ha7xPM5H4nMKHQSl | 07 Evolution fanout | Rutea msgs + Zelle reader + Tracking auto | 38 | Activo |
| 4FYpMkhhMkXw1PEo | 08 Shopify order updated | Order Updated → sync status | — | Activo |

### Grupos WhatsApp

| Grupo | JID | Uso |
|-------|-----|-----|
| Dashboard | 120363427557786772@g.us | Comandos operacionales + confirmaciones |
| Delivery PyP | 120363399646672357@g.us | Plantillas delivery + recibido |
| Comprobantes | 120363409525696846@g.us | Fotos de comprobantes/guias → auto-proceso |
| Polaris | 120363404711910391@g.us | Interno Kira, no tocar |

---

## SALDOS CIERRE 17/04/2026

| Wallet | Saldo |
|--------|-------|
| Cash USD | $2,368.00 |
| Zelle | $3,371.60 |
| Bolivares | Bs 1,352,855.31 (~$2,155.54) |
| Binance | $0.00 |
| **Total equivalente** | **$7,895.14** |

Tasa usada: Bs 627.62/USD (15/04/2026 — W01 actualizara mañana 8am)

---

## ARQUITECTURA W07 (FANOUT) — 38 NODOS

```
Evolution webhook → Classify (_isGroup, _isImage, _isComprobantes)
  ├─ Grupo (@g.us) → Is comprobantes?
  │   ├─ Comprobantes + imagen → C: chain (pago O guia)
  │   │   ├─ C: GPT Vision (doc_type: payment|shipping|unknown)
  │   │   ├─ C: Is payment?
  │   │   │   ├─ Payment → dedup → find order → insert cash → update order → confirm
  │   │   │   └─ Shipping → find order → update tracking → notify client → confirm
  │   │   └─ Dedup: verifica referencia unica antes de insertar
  │   ├─ Comprobantes + texto #XXXX → C: Save context (pending 5min)
  │   └─ Otro grupo → Shadow iOS W06
  └─ Privado → Is image?
      ├─ Imagen → Z: Zelle reader + Kira (paralelo)
      └─ No imagen → Kira + Shadow iOS
```

---

## REGLAS DE NEGOCIO INMUTABLES

1. Tasa Binance P2P — NUNCA decir "Binance" al cliente
2. Nombres de riders → minusculas
3. Shadow NUNCA responde en PyP — solo plantillas
4. "recibido" viene de PyP, confirmacion va a Dashboard
5. Kira solo chats privados — W07 garantiza

---

## PENDIENTES CONOCIDOS

- **#2059 Winder Lopez ($85)** — payment_method=null en Shopify, sin cash_movement
- **W01 test real** — primera ejecucion programada mañana 8am VET
- **API key Anthropic** — migrar GPT-4o-mini → Claude Haiku cuando disponible
- **Comprobante Zelle real** — testeado con mock, falta validar con foto real de produccion
- **#2050 David** — sin telefono registrado
