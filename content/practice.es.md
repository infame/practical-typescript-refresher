# Práctica en el dominio elegido

## 1. Validar una actualización

Implementa parseEntity(unknown). Exige sourceId, eventId y entityId propios, strings no vacíos tras trim; version entero seguro no negativo y metric número finito no negativo. Rechaza null, arrays, números como strings y campos ausentes. Devuelve objeto nuevo e ignora campos extra. La métrica es un contrato simplificado, no una regla universal de ese negocio.

### Spoiler

Excluye null y arrays y comprueba tipo y condición de cada campo. Si otro contrato acepta strings, valida sintaxis antes de convertir. La assertion Record local solo se aplica a un objeto comprobado: cada valor sigue validándose en runtime. No afirma que toda la entrada sea válida.

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

La entrada ya es válida. eventId es único dentro de sourceId y replay inmutable cuenta una vez. Elige máxima version por sourceId/entityId, primera en empate y orden de primera aparición. No modifiques entrada. Prueba dos fuentes con mismo ID, versiones inversas, duplicados y separadores dentro de IDs.

### Spoiler

Usa dos claves independientes: Set para entregas y Map para ganadores. Una pareja JSON evita colisiones de separadores. Cambia solo ante versión mayor; Map conserva posición. Es deduplicación del batch, no inbox duradero, y retiene O(eventos + entidades) claves.

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

Acepta entidades válidas, limit entero seguro positivo y save(entity): Promise<void>. Limita operaciones activas, conserva orden y continúa tras fallo individual devolviendo unión ok por entidad. Límite inválido rechaza incluso vacío. Throw síncrono y throw undefined también son fallos.

### Spoiler

Captura dentro del callback limiter y devuelve errores esperados como valores. Espera save antes de éxito y comprueba Error. mapLimit se importa del capítulo 5 y examples/core.ts. Anota unión para conservar discriminadores literales.

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

## Comprobar tu intento

Prueba cero, campos ausentes, duplicados, versiones iguales y antiguas, ámbitos, finalización inversa, throw síncrono y límite inválido. Ejecuta npm run check y npm test. Cambia la política de fallo o añade un campo y repite sin respuesta.
