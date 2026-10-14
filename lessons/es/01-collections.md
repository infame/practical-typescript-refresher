# Colecciones y procesamiento de datos

Repaso práctico. Lee el contrato, traza los ejemplos e intenta el ejercicio antes de abrir la respuesta. Algunos bloques comparten contexto; solo `ts check` identifica comprobaciones independientes.

## Conservar la versión más reciente

Usa un Map por identificador de entidad. Compara la versión nueva con la guardada y sustituye solo si es mayor. La última entrada no tiene por qué ser la más reciente; una comparación estricta conserva la primera en caso de empate. Un recorrido requiere O(n) operaciones y O(k) registros, además del coste de procesar las claves. No hace falta ordenar.

```ts
type ListingUpdate = {
  listingId: string;
  version: number;
  price: number;
};

function latestByListing(
  updates: readonly ListingUpdate[],
): ListingUpdate[] {
  const latest = new Map<string, ListingUpdate>();

  for (const update of updates) {
    const current = latest.get(update.listingId);
    if (current === undefined || update.version > current.version) {
      latest.set(update.listingId, update);
    }
  }
  return [...latest.values()];
}
```

## Agrupar y unir por clave

Construye una vez el índice de los datos secundarios y recorre los principales. Esta unión conserva las entidades sin historial con un array vacío. El resultado mantiene el orden de las entidades y del historial de entrada salvo que se exija otro. get devuelve la misma referencia guardada: push no requiere volver a ejecutar set. Copia los arrays si cada resultado debe poder modificarse de forma independiente.

```ts
type Listing = { id: string; title: string };
type PriceChange = {
  eventId: string;
  listingId: string;
  price: number;
  timestamp: number;
};

function attachHistory(
  listings: readonly Listing[],
  changes: readonly PriceChange[],
): Array<Listing & { history: PriceChange[] }> {
  const grouped = new Map<string, PriceChange[]>();

  for (const change of changes) {
    const group = grouped.get(change.listingId);
    if (group === undefined) {
      grouped.set(change.listingId, [change]);
    } else {
      group.push(change);
    }
  }

  return listings.map(listing => ({
    ...listing,
    history: grouped.get(listing.id) ?? [],
  }));
}
```

## Eliminar entregas repetidas

La identidad de una entidad y la de un evento son distintas. Una entidad puede tener muchos cambios legítimos. Deduplica por eventId dentro de su ámbito, por ejemplo (sourceId, eventId); selecciona versiones por (sourceId, entityId). Un Set de objetos compara referencias, no campos. Actualizar una clave de Map no cambia su posición de iteración.

```ts
function deduplicate(changes: readonly PriceChange[]): PriceChange[] {
  const seen = new Set<string>();
  const result: PriceChange[] = [];

  for (const change of changes) {
    if (seen.has(change.eventId)) continue;
    seen.add(change.eventId);
    result.push(change);
  }
  return result;
}
```

## Evitar trabajo cuadrático

filter o find dentro de otro recorrido vuelve a examinar los mismos datos. Construye un índice para búsquedas repetidas. Copiar el acumulador con spread en cada paso de reduce también puede generar trabajo cuadrático. Define unicidad y valores ausentes antes de elegir la estructura. JSON.stringify de una pareja o Maps anidados evitan colisiones de separadores; las claves largas siguen teniendo coste.

## Práctica

Para A/v3, B/v1, A/v2, A/v5, B/v1 conserva la primera entrada si las versiones empatan. Después escribe un contador de eventos por entidad.

### Spoiler

Quedan A/v5 y el primer B/v1. Para contar, usa counts.set(id, (counts.get(id) ?? 0) + 1). Seleccionar una versión, deduplicar una entrega y contar eventos son operaciones con claves y políticas diferentes.

#### Error plausible: deduplicar por entidad

```ts check
const events = [
  { eventId: "E1", entityId: "A", version: 1 },
  { eventId: "E2", entityId: "A", version: 2 },
];
const seen = new Set<string>();
const wrong = events.filter(event => {
  if (seen.has(event.entityId)) return false;
  seen.add(event.entityId);
  return true;
});
// wrong contains only E1/version 1.
```

E2 es una actualización nueva, no una repetición. Se exige versión 2, pero deduplicar por entidad la elimina antes de elegir versión. Usa identidad de evento para entrega e identidad de entidad para estado; añade sourceId si hay varias fuentes. Sustituir con >= también rompe la política de conservar el primer empate.

## Explicar la decisión

Explica la clave, la regla de conflicto, el coste y el orden garantizado. Decir que mantienes la versión máxima por entidad comunica más que nombrar Map. Prueba también identificadores repetidos y caracteres de separación.
