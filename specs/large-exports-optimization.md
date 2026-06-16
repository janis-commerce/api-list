# Checkpoint de generación para exports grandes (flujo unificado vía `_id`)

> Repos: `services/janis-batch-service` + `packages/api-list` (multi-repo, mismo spec en ambos) · Branch: `feature/large-exports-optimization`
> Estado: borrador · Creado: 2026-06-12
> Definición: `~/code/definitions/large-exports-optimization/` (v5, cerrada)

## Objetivo

Eliminar el techo de ~1,5M de rows en los exports: cuando la generación de main files agota el presupuesto de una invocación Lambda, el export se reinicia con orden `_id` y continúa por segmentos con checkpoint/resume orquestado por batch hasta completar, sin límite de tamaño. Los exports que hoy completan no cambian en nada.

## Contexto

Incidente del 2026-06-11: export de órdenes de carrefourbr en prod (`6a2ae3f5d648df78fcaf88e2`, 1,5M+ rows, filtro abril→julio, sort `commerceDateCreated desc`). `JanisOmsService-prod-ExportQueueConsumer` (provisto por `@janiscommerce/api-list`) genera **todo** el export en una invocación con timeout 900s (máximo de Lambda): murió 2 veces por timeout exacto (16:51:07 y 17:07:47 UTC, `Duration: 900000ms`), el retry de SQS repitió el trabajo idéntico desde cero, el mensaje fue a DLQ y el `ExportDLQQueueConsumer` mandó `{ exportId }` sin `errorMessage` a la cola `setExportError` de batch → export en `error` con "Unknown error (failed after retries)". Datos medidos: ~150s por part de 250k rows → techo determinístico ~1,55M rows (~6 parts). Arriba de eso, **todo export falla siempre** y el botón de retry (`canRetry`) re-dispara el mismo timeout.

## Reparto de responsabilidades (regla de diseño)

**api-list es tonto, batch es inteligente.** api-list nunca decide ni interpreta sorts/cursores/modos: ejecuta los `params` que recibe tal cual (como hoy) y emite una única señal nueva cuando corta por presupuesto. Batch construye SIEMPRE los params completos (sort de restart, filtro de cursor) porque es quien sabe en qué estado está el export.

```
api-list → batch:  part message + { lastId } siempre, + { stopped: true } en la part de corte
batch → api-list:  exportRequested con params COMPLETOS (order/filters ya resueltos) + startPart
                   (generation viaja dentro de messageData → api-list lo devuelve por passthrough, sin código)
```

Flujo: intento 1 con params originales → si `stopped` y el doc no está en modo `_id` → **restart** (reset + `order: { id: 'asc' }` + `startPart: 1`) → si `stopped` en modo `_id` → **checkpoint/resume** (`filters` + `id > lastId`, `startPart` siguiente). Máximo un restart por export; el resume se repite hasta `isLastPart`.

## Alcance

✅ Incluye — `packages/api-list` (cambio mínimo):

- **Presupuesto**: default **720s** (12 min), overridable por env var `EXPORT_GENERATION_BUDGET_MS` (ms) leída por invocación (tuneable en caliente sin deploy). Evaluado dentro del callback del `getPaged` al cerrar cada part: si `elapsed + duración estimada de la próxima part (última part × factor de seguridad)` supera el presupuesto, se corta.
- **Mecánica del corte**: el part message de la part recién cerrada sale con `stopped: true`; acto seguido el callback lanza un error sentinel (`ExportBudgetExceededError`) para frenar la iteración del cursor (el `for await` del getPaged nativo cierra el cursor del server en salida temprana). El catch alrededor de `getPaged` lo distingue vía `error.previousError` (el getPaged nativo envuelve en `MongoDBError` preservando el original) y termina OK; cualquier otro error sigue al flujo actual (error queue).
- **`lastId` en todos los part messages**: el `_id` de la última row de cada part (el consumer ya tiene la row en mano; batch lo usa solo cuando corresponde).
- **`startPart`**: si el record trae `startPart`, la numeración de parts arranca ahí (default 1).
- **Sin inteligencia de sort/cursor**: el consumer NO interpreta modos ni construye filtros — corre `record.params` como hoy.
- `ExportDLQConsumer`: agregar `errorMessage` descriptivo (hoy manda el `messageData` pelado → el usuario ve "Unknown error").
- `export-serverless-helper-hooks.js`: `memorySize` del consumer principal 2048 → **3072**.

✅ Incluye — `services/janis-batch-service` (toda la orquestación):

- **`StartExport`**: persiste en el doc `generation: 1` y los **params originales** (EJSON, tal como se publican) para poder reconstruir los mensajes de restart/resume sin re-pedirlos al servicio. `generation` viaja dentro de `messageData`.
- **Validación de generation**: todo consumer de export (`processMainFile`, `processDependencyFile`) descarta mensajes cuya `generation` (en el body, vía passthrough de messageData) no coincida con la del doc.
- **Manejo de `stopped: true`** en `ProcessMainFileConsumer` (con generation vigente), después de procesar la part normalmente:
  - Doc **sin** `sortFallback` (intento 1) → **restart**: resetea el estado de generación (`parts`, `processFiles`, `total` acumulado), incrementa `generation`, setea `sortFallback: true`, history `exportGenerationRestarted`, y publica `exportRequested` con los params originales con `order` reemplazado por `{ id: 'asc' }`, `startPart: 1` y la nueva generation.
  - Doc **en modo `_id`** (`sortFallback: true`, o export cuyo sort original ya era `id` — ver atajo) → **checkpoint/resume**: persiste `{ lastId, nextPart }` en el doc con update **condicional** (single writer; si no matchea, no despacha) + history `mainFileGenerationCheckpoint`, y publica `exportRequested` con los params + `filters` mergeado con `id > lastId` (`id < lastId` si el orden es desc), `startPart: nextPart` y la misma generation.
- **Atajo sin restart**: si el `order` de los params originales ya es exactamente por `id`, batch marca el export como checkpointeable desde el intento 1 (un `stopped` va directo a resume, sin quemar el restart).
- **Retry API** (`src/api/export/retry/post.js`): si el export en `error` tiene checkpoint persistido, el retry despacha el resume desde el checkpoint (preserva las parts/xlsx ya generados) en vez de regenerar desde cero. Sin checkpoint → comportamiento actual.
- **Guard de dependencias**: el retry/redelivery de un part message cuya part ya está completa no re-dispara el procesamiento de dependencias.
- **Cierre por segmento vacío**: si un resume no encuentra rows (corte justo en el fin del dataset), el part message con `rowsCount: 0` + `isLastPart` debe completar el export como procesado con las parts existentes (no como `ended` vacío).

❌ NO incluye:

- Keyset cursor multi-campo con `excludeIds` (descartado en la definición v5).
- Cambios en `@janiscommerce/sqs-consumer` ni en `@janiscommerce/mongodb` (el sentinel se resuelve en api-list).
- Mensajes `restartRequired`/`forcedSort`/`continuation` interpretados por api-list — no existen: la única señal del consumer es `stopped` + `lastId`.
- Cambios en la notificación al usuario (mail/webhook/UI) por el `sortFallback` — solo queda registrado en el doc para soporte.
- Cambios en el flujo viejo de export (state machine `ProcessExport`) ni en el flujo de import.
- Paralelización de parts (fan-out por rangos) — evolución futura.
- Soporte de cursor cuando los filtros originales ya filtran por `id` (caso degenerado: un export filtrado por ids está acotado; documentar como limitación).
- Workaround manual para el export fallido de carrefourbr.
- Kill-switch / flags de activación (activación reactiva pura, por construcción).

## Criterios de aceptación

`packages/api-list`:

- [ ] Un export que completa dentro del presupuesto se comporta idéntico a hoy (mismas queries, mismo sort, un solo segmento, `isLastPart` al final) — con cualquier sort, incluso sin `sortBy`.
- [ ] Una generación que agota el presupuesto corta en límite de part: la part recién cerrada viaja con `stopped: true`, la iteración del cursor se frena (sentinel) y el consumer termina sin error (mensaje ACKeado, sin envío a error queue).
- [ ] Todos los part messages incluyen `lastId` (el `_id` de la última row de la part).
- [ ] Un record con `startPart` numera las parts desde ese valor; sin `startPart`, desde 1.
- [ ] El consumer ejecuta `record.params` tal cual — no interpreta sorts, modos ni construye filtros.
- [ ] Los campos de `messageData` (incluida `generation`) se devuelven por passthrough en todos los mensajes salientes, sin código nuevo.
- [ ] Un error real del callback (no sentinel) mantiene el flujo actual: error queue + batchItemFailures.
- [ ] `ExportDLQConsumer` envía `errorMessage` descriptivo en el mensaje a la error queue.
- [ ] El consumer principal queda con `memorySize: 3072` en los hooks; el DLQ consumer no cambia.

`services/janis-batch-service`:

- [ ] `StartExport` persiste `generation: 1` + los params originales en el doc, y publica `exportRequested` con `generation` dentro de `messageData`.
- [ ] Un part/dependency message con `generation` distinta a la del doc se descarta sin efectos sobre el doc ni dispatch de dependencias.
- [ ] Un part message con `stopped: true` sobre un export en intento 1 dispara el restart: reset de parts/processFiles/total, `generation: 2`, `sortFallback: true`, history `exportGenerationRestarted`, y publica `exportRequested` con `order: { id: 'asc' }`, `startPart: 1` y `generation: 2`.
- [ ] Un part message con `stopped: true` sobre un export en modo `_id` persiste el checkpoint `{ lastId, nextPart }` (update condicional) + history `mainFileGenerationCheckpoint` y publica `exportRequested` con `filters` + `id > lastId` y `startPart` correcto; si el update condicional no matchea, no publica.
- [ ] El redelivery del mismo part message con `stopped` no produce un segundo dispatch.
- [ ] Un export cuyo `order` original ya es por `id` checkpointea desde el intento 1, sin restart.
- [ ] Un segundo restart sobre el mismo export lo marca en `error` con `errorMessage` explicativo (defensivo).
- [ ] `POST /export/retry` de un export `error` con checkpoint persistido despacha el resume desde el checkpoint; sin checkpoint mantiene el comportamiento actual.
- [ ] El retry/redelivery de un part message de una part ya completa no re-dispara dependencias.
- [ ] Un resume cuyo dataset restante está vacío (part `rowsCount: 0` + `isLastPart`) completa el export como procesado con las parts existentes.
- [ ] Un export generado con api-list viejo (mensajes sin `generation`/`stopped`/`lastId`) se procesa exactamente como hoy.

## Plan de archivos

`packages/api-list`:

- `lib/export/export-consumer.js` (edit) — presupuesto 720s + corte en part boundary, `stopped`/`lastId`, sentinel, `startPart`.
- `lib/export/errors/export-budget-exceeded-error.js` (nuevo) — sentinel (o inline en el consumer, a criterio del developer).
- `lib/export/export-dlq-consumer.js` (edit) — `errorMessage` descriptivo.
- `lib/export/export-serverless-helper-hooks.js` (edit) — `memorySize: 3072`.
- `tests/export/export-consumer.js` (edit) — completa sin corte (sin cambios de comportamiento), corte con `stopped`+sentinel, `startPart`, error real vs sentinel.
- `tests/export/export-dlq-consumer.js` (edit) — errorMessage.
- `README.md` (edit) — contrato de mensajes (`stopped`, `lastId`, `startPart`) y comportamiento de exports grandes.

`services/janis-batch-service`:

- `src/models/export.js` (edit) — campos `generation`, `sortFallback`, checkpoint, params persistidos.
- `src/lambda/export/StartExport.js` (edit) — persistencia de params + `generation` en doc y messageData.
- `src/sqs-consumer/export/process-file-base-consumer.js` (edit) — validación de `generation` compartida.
- `src/sqs-consumer/export/process-main-file-consumer.js` (edit) — manejo de `stopped` (restart/resume) + guard de dependencias en parts completas.
- `src/sqs-consumer/export/process-dependency-file-consumer.js` (edit) — descarte por `generation`.
- `src/helpers/` (nuevo, nombre a definir por developer) — construcción y publicación de `exportRequested` (params completos con order/filters de restart/resume), compartida entre `StartExport`, `ProcessMainFileConsumer` y retry API.
- `src/api/export/retry/post.js` (edit) — resume desde checkpoint.
- `tests/` espejo de cada archivo tocado.

## Decisiones

- **api-list tonto, batch inteligente** (refinamiento post-v5, Juan): api-list nunca setea sorts ni interpreta modos — batch manda los params completos siempre y concentra el 100% del control del checkpoint. La señal del consumer se reduce a `stopped` + `lastId`; `restartRequired`/`forcedSort`/`continuation` como conceptos de api-list desaparecen. Minimiza el diff del package (el código compartido por 5+ services) y concentra el riesgo en batch, que es un solo deploy.
- **Flujo unificado vía `_id`** (v5): un solo mecanismo de checkpoint. El intento 1 nunca checkpointea (camino feliz byte-idéntico); el restart con `_id asc` convierte cualquier export en checkpointeable con cursor trivial. Trade-off aceptado: todo export multi-segmento sale en orden `_id` (≈ inserción) y quema un presupuesto (~12 min) antes del restart.
- **Corte por sentinel en el callback del `getPaged`**: el cierre de part ya ocurre dentro del callback; tras enviar el part message con `stopped`, un throw frena el `for await` (el driver cierra el cursor del server en salida temprana). El getPaged nativo envuelve el throw en `MongoDBError` preservando `previousError` → detección limpia sin tocar `@janiscommerce/mongodb`. Costo residual: la page en vuelo (~10k rows) se descarta.
- **Presupuesto 720s** (no 840s): con parts de 135-150s ±10% medidas en el incidente, 840s deja 60s de margen real; 720s deja 180s (sobrevive una part 2× más lenta). Costo: ~1 part menos por segmento — despreciable. Vive en api-list, al lado del `timeout: 900` que el propio package define en sus hooks. **Overridable por env var** `EXPORT_GENERATION_BUDGET_MS` (default 720s, leída por invocación): el número hardcodeado haría el corte intesteable fuera de prod (solo el dataset patológico cruza 720s) — la env var permite forzar el corte con datasets chicos en QA y un canary controlado en prod, y tunear en caliente.
- **Params originales persistidos en el doc**: batch los necesita para reconstruir restart/resume sin re-pedir el only-params al servicio (evita drift si el schema cambia a mitad de export).
- **Epoch completo (`generation`) vía messageData**: sin marker, una part zombie de la generación descartada pasaría el guard `exists:false` post-reset y mezclaría archivos con el orden viejo (corrupción, no solo desperdicio). El passthrough de `messageData` existente lo transporta sin código en api-list.
- **Orquestación en batch (no self-requeue)**: batch es single writer del checkpoint en el doc (update condicional) — sin estado compartido no hay árbitro para los forks de doble entrega de SQS/SNS.
- **Corte en part boundary**: parts siempre uniformes de 250k (decisión de UX); sin archivos parciales ni estado de gzip a medio escribir.
- **`sortFallback` solo en el doc**: soporte puede explicar el orden si el cliente pregunta; no se tocan notificaciones.
- **Memoria 3072 MB** (convención Janis 1→2→3 GB): costo validado con CloudWatch 30 días — total actual $4,31/mes en las 5 cuentas (OMS/Picking/Delivery/WMS/Pricing), peor caso del bump +$2,16/mes. gzip corre en el threadpool de libuv → el core extra (1,16 → 1,74 vCPU) acelera parts.
- **Rollout batch → api-list → bump por servicio (OMS primero)**: api-list nuevo contra batch viejo dejaría exports colgados (`stopped` que nadie orquesta).
- **Resume sin cursor nativo de Mongo**: los cursor ids no son persistibles entre invocaciones (idle 10 min, sesión 30 min, atados al nodo); el equivalente serializable es el cursor por valor. El `getPaged` nativo de `@janiscommerce/mongodb` ignora `params.page`, así que "reanudar por page" no existe.

## Abiertas

—
