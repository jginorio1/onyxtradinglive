# Onyx Copy Trading — Plan técnico (Fase 1)

Master → esclavas, con copia por **balance %**, **riesgo % (RR)** o **pips**, escalado
automático grande↔pequeña, mapeo inteligente de símbolos y log en la web.

Arquitectura **híbrida**: relay en la nube (1–3 s, cross-máquina, además diversifica IP)
en Fase 1; puente local de milisegundos en Fase 2.

> Aviso de cumplimiento: se ofrece como **gestor multicuenta / copiadora**. Copiar entre
> cuentas puede violar las reglas de las prop firms. Cada trader es responsable de cumplir
> los términos de su firma. Onyx no lo posiciona como herramienta para evadir detección.

---

## 1. Flujo general

1. La **EA Master** (en el terminal del master) detecta apertura/cierre/modificación de
   una orden y hace `POST /api/v1/copy/master` con su API key de cuenta y el evento.
2. El **relay** busca los enlaces master→esclava activos, y por cada esclava genera un
   **comando** (acción + símbolo base + parámetros de tamaño) que encola en `copy_commands`.
3. La **EA Slave** hace `GET /api/v1/copy/slave` cada ~1 s, recibe sus comandos pendientes,
   **resuelve el símbolo local**, calcula el **lote** según el modo, aplica **humanización**
   (Fase 3) y ejecuta. Luego confirma con `POST /api/v1/copy/slave` (ack + resultado).
4. Cada paso se guarda en `copy_log`, visible en el **panel web** en vivo.

El **tamaño** se calcula en la EA esclava (conoce su balance, dígitos y valor de pip
reales del broker). El servidor solo envía la **intención** (modo + parámetros).

---

## 2. Base de datos (supabase/copy_trading.sql)

- **copy_links** — un enlace master→esclava por fila.
  - `id, owner_id (user), master_account_id, slave_account_id`
  - `mode` = `balance` | `risk` | `pips` | `fixed`
  - `multiplier` (fixed/balance), `risk_pct` (risk), `pip_risk` (pips), `max_lot`
  - `symbol_map` jsonb — overrides manuales `{ "US100":"NAS100" }`
  - `filters` jsonb — `{ symbols:[], sessions:[], minLot, maxSpread }`
  - `humanize` jsonb — `{ delayMs:[0,3000], lotVar:0.08, sltpJitterPips:2, skipEvery:0 }`
  - `reverse` bool (copiar invertido), `enabled` bool, `created_at`
- **copy_commands** — cola por esclava (lo que la EA slave debe ejecutar).
  - `id, link_id, slave_account_id, action (open|close|modify), master_ticket`
  - `base_symbol, side, volume_hint, sl, tp, price, status (pending|done|failed|skipped)`
  - `payload jsonb, created_at, taken_at, done_at, error`
- **copy_log** — registro para el panel (append-only, se poda a X días).
  - `id, owner_id, link_id, kind, symbol, detail jsonb, ok bool, latency_ms, created_at`

Índices: `copy_commands(slave_account_id,status)`, `copy_log(owner_id,created_at desc)`.

---

## 3. Endpoints

### EA (se autentican con la API key de cuenta, como /api/v1/sync)
- `POST /api/v1/copy/master` — body `{ event, ticket, symbol, side, volume, sl, tp, price }`.
  Valida la key → cuenta master. Crea comandos para cada esclava activa. Devuelve `{ ok }`.
- `GET  /api/v1/copy/slave` — key de la esclava → devuelve comandos `pending` (marca `taken`).
- `POST /api/v1/copy/slave` — body `{ command_id, ok, error?, slave_ticket?, latency_ms? }`.
  Marca el comando `done|failed` y escribe en `copy_log`.

### Panel (sesión web del trader / owner)
- `GET  /api/copy/links` — enlaces del trader + estado.
- `POST /api/copy/links` — crear/editar/borrar enlace (mode, params, filtros, humanize).
- `GET  /api/copy/log?from&to` — log paginado (+ export CSV/PDF con el RangeBar).

---

## 4. Cálculo de tamaño (en la EA esclava)

- **fixed**: `lote_esclava = lote_master × multiplier` (con `max_lot`).
- **balance**: `lote = lote_master × (balance_esclava / balance_master) × multiplier`.
  → escala grande↔pequeña solo.
- **risk (RR)**: dado el SL en pips del master, `riesgo$ = balance_esclava × risk_pct`,
  `lote = riesgo$ / (SL_pips × valor_pip_por_lote_del_broker_esclava)`.
- **pips**: iguala distancia SL/TP en pips; lote a un riesgo fijo en pips.

Siempre redondear al `lot_step` del broker y respetar `min/max lot`.

---

## 5. Mapeo de símbolos (lib/copySymbols.ts) — ya incluido

- `normalizeSymbol("EURUSD.sim") → "EURUSD"` (quita sufijos/prefijos comunes).
- Tabla de **alias**: GOLD↔XAUUSD, US100↔NAS100↔USTEC↔NDX, US30↔DOW↔YM,
  GER40↔DE40↔GER30, US500↔SPX500↔SP500, etc.
- `resolveLocalSymbol(base, availableSymbols[])` — la EA esclava recorre su Market Watch
  y elige el nombre real que corresponde al símbolo base (con su sufijo).
- Si no hay coincidencia → **no ejecuta**, marca `skipped` y avisa en el log.

Cuidado con **dígitos (3 vs 5)**, **contract size** y **valor de pip**: se leen del broker
esclavo en la EA, nunca se asumen.

---

## 6. EAs (ea/OnyxCopyMaster.mq5, ea/OnyxCopySlave.mq5) — plantillas incluidas

- **Master**: en `OnTradeTransaction` detecta cambios y hace el POST del evento.
- **Slave**: en `OnTimer` (cada 1 s) hace el GET de comandos, resuelve símbolo, calcula
  lote, ejecuta y confirma. Requiere permitir WebRequest a tu dominio en MT5.

Son plantillas: tu desarrollador MQL las termina (manejo de errores, reintentos, firma).

---

## 7. Controles de riesgo (Fase 2)

Lote máximo por esclava, pérdida diaria máxima (pausa la copia), lista blanca de símbolos,
spread máximo, filtro de sesión, y "pausar si drawdown > X%".

## 8. Humanización (Fase 3 · con aviso)

Retraso aleatorio 0–N s, variación de lote ±%, jitter de SL/TP ±pips, y "saltar 1 de cada N".
Se ofrece como opción de gestión multicuenta, no como evasión de prop firm.

---

## 9. Fases

- **F1** (web): tablas + relay/API + mapeo de símbolos + panel + log + copia por nube. Plantillas EA.
- **F2**: puente local de milisegundos + controles de riesgo.
- **F3**: humanización + multi-broker + afinado.
