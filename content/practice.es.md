# Práctica en el dominio elegido

## 1. Validar una actualización

Implementa `parseEntity(value: unknown): EntityUpdate`. Lanza un `Error` si la entrada no es válida; no devuelvas `null` ni `undefined` en ese caso. Exige `sourceId`, `eventId` y `entityId` propios, strings no vacíos tras trim; version entero seguro no negativo y metric número finito no negativo. Rechaza `null`, arrays, números como strings y campos ausentes.

Devuelve objeto nuevo e ignora campos extra. La métrica es un contrato simplificado, no una regla universal de ese negocio.

### Spoiler

Excluye `null` y arrays y comprueba tipo y condición de cada campo. Si otro contrato acepta strings, valida sintaxis antes de convertir. La assertion `Record` local solo se aplica a un objeto comprobado: cada valor sigue validándose en runtime. No afirma que toda la entrada sea válida.

```ts
export type EntityUpdate = {
  sourceId: string;
  eventId: string;
  entityId: string;
  version: number;
  metric: number;
};
export function parseEntity(value: unknown): EntityUpdate {
  if (typeof value !== 'object' || value === null || Array.isArray(value))
    throw new Error('Expected object');
  const object = value;
  function text(key: string): string {
    if (!Object.hasOwn(object, key)) throw new Error(`Missing ${key}`);
    const field = (object as Record<string, unknown>)[key];
    if (typeof field !== 'string' || !field.trim()) throw new Error(`Invalid ${key}`);
    return field.trim();
  }
  if (
    !('version' in value) ||
    typeof value.version !== 'number' ||
    !Number.isSafeInteger(value.version) ||
    value.version < 0
  )
    throw new Error('Invalid version');
  if (
    !('metric' in value) ||
    typeof value.metric !== 'number' ||
    !Number.isFinite(value.metric) ||
    value.metric < 0
  )
    throw new Error('Invalid metric');
  return {
    sourceId: text('sourceId'),
    eventId: text('eventId'),
    entityId: text('entityId'),
    version: value.version,
    metric: value.metric,
  };
}
```

## 2. Deduplicar y elegir versión

La entrada ya es válida. `eventId` es único dentro de `sourceId` y replay inmutable cuenta una vez. Elige máxima version por `sourceId`/`entityId`, primera en empate y orden de primera aparición. No modifiques entrada. Prueba dos fuentes con mismo ID, versiones inversas, duplicados y separadores dentro de IDs.

### Spoiler

Usa dos claves independientes: `Set` para entregas y `Map` para ganadores. Una pareja JSON evita colisiones de separadores. Cambia solo ante versión mayor; `Map` conserva posición. Es deduplicación del batch, no inbox duradero, y retiene `O(eventos + entidades)` claves.

```ts
export type EntityUpdate = {
  sourceId: string;
  eventId: string;
  entityId: string;
  version: number;
  metric: number;
};
export function latestEntities(input: readonly EntityUpdate[]): EntityUpdate[] {
  const seen = new Set<string>();
  const latest = new Map<string, EntityUpdate>();
  for (const entity of input) {
    const eventKey = JSON.stringify([entity.sourceId, entity.eventId]);
    if (seen.has(eventKey)) continue;
    seen.add(eventKey);
    const entityKey = JSON.stringify([entity.sourceId, entity.entityId]);
    const current = latest.get(entityKey);
    if (!current || entity.version > current.version) latest.set(entityKey, entity);
  }
  return [...latest.values()];
}
```

## 3. Procesar con fallos parciales

Acepta entidades válidas, limit entero seguro positivo y `save(entity)`: `Promise<void>`. Limita operaciones activas, conserva orden y continúa tras fallo individual devolviendo unión ok por entidad. Límite inválido rechaza incluso vacío. Throw síncrono y `throw undefined` también son fallos.

### Spoiler

Captura dentro del callback limiter y devuelve errores esperados como valores. Espera save antes de éxito y comprueba `Error`. `mapLimit` se importa del capítulo 5 y `examples/core.ts`. Anota unión para conservar discriminadores literales.

```ts
import { mapLimit } from './core.ts';
export type EntityUpdate = {
  sourceId: string;
  eventId: string;
  entityId: string;
  version: number;
  metric: number;
};
export type Outcome = { ok: true; entity: EntityUpdate } | { ok: false; error: string };
export async function processEntities(
  input: readonly EntityUpdate[],
  limit: number,
  save: (entity: EntityUpdate) => Promise<void>,
): Promise<Outcome[]> {
  if (!Number.isSafeInteger(limit) || limit < 1) throw new RangeError('Invalid limit');
  return mapLimit<EntityUpdate, Outcome>(input, limit, async (entity) => {
    try {
      await save(entity);
      return { ok: true, entity };
    } catch (error) {
      return { ok: false, error: error instanceof Error ? error.message : String(error) };
    }
  });
}
```

## Revisa tu solución

Escribe y ejecuta tu implementación en tu editor habitual de TypeScript. Recorre las comprobaciones siguientes y después abre cada spoiler para comparar el razonamiento. El botón Copiar código copia el ejemplo mostrado; no ejecuta ni comprueba tu solución.

### Comprobaciones del parser

- Entrada válida con espacios alrededor de los IDs y `metric: 0` → IDs sin espacios, cero conservado y un objeto nuevo. Los campos adicionales se ignoran.
- `null`, un array, un campo ausente, un ID vacío, una versión negativa o fraccionaria, una cadena numérica, `NaN` o `Infinity` → lanzar un `Error`.
- Una cadena obligatoria heredada del prototipo → rechazarla; el contrato exige propiedades propias.

### Comprobaciones de deduplicación

- Una entidad con versiones `3, 1, 3` → gana el primer registro de versión 3.
- Repetir el mismo `sourceId`/`eventId` → una sola entrega cuenta. El mismo ID de entidad en dos fuentes → dos resultados independientes.
- IDs con separadores → las claves siguen siendo distintas. El orden corresponde a la primera aparición de cada entidad; la entrada no cambia.

### Comprobaciones async

- Las escrituras terminan en orden inverso → los resultados conservan el orden de entrada; el máximo de escrituras activas no supera `limit`.
- Una escritura rechaza o lanza `undefined` → esa posición tiene `ok: false`; los elementos siguientes continúan. `ok: true` aparece solo cuando termina la escritura.
- Entrada vacía con límite válido → `[]`. Un límite inválido, incluso con entrada vacía → rechazo con `RangeError`.

Ejecuta el comprobador de tipos y las pruebas de tu proyecto sobre **tu implementación**. Por último, cambia una condición, como el desempate o la política de fallos, cierra las respuestas e implementa la variación por tu cuenta.
