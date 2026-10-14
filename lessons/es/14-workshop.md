# Taller: escribir el código

Repaso práctico. Lee el contrato, traza los ejemplos e intenta el ejercicio antes de abrir la respuesta. Algunos bloques comparten contexto; solo `ts check` identifica comprobaciones independientes.

## Parser de entrada externa

Implementa parseRecord(unknown) con ID string normalizado y métrica number | null. Admite número finito no negativo, null o decimal string estricto con trim. Rechaza boolean, vacío, hex, exponentes e Infinity. Devuelve objeto nuevo e ignora campos adicionales. Define gramática antes de Number; el ejemplo exige dígitos y una fracción opcional no vacía.

### Spoiler

Comprueba objeto, ID y contenido normalizado. Trata null aparte, verifica sintaxis decimal completa y luego finitud y signo. Prueba cero, espacios, .5 frente a 0.5 y coerciones peligrosas. Implementaciones en examples/workshop.ts.

```ts
export function parsePriceRecord(raw: unknown): { id: string; price: number } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error("Expected an object");
  }
  if (!("id" in raw) || typeof raw.id !== "string" || raw.id.trim() === "") {
    throw new Error("Invalid id");
  }
  if (!("price" in raw)) throw new Error("Missing price");
  let price: number;
  if (typeof raw.price === "number") {
    price = raw.price;
  } else if (typeof raw.price === "string" && /^\d+(\.\d+)?$/.test(raw.price.trim())) {
    price = Number(raw.price.trim());
  } else {
    throw new Error("Invalid price format");
  }
  if (!Number.isFinite(price) || price < 0) throw new Error("Invalid price");
  return { id: raw.id.trim(), price };
}
```

## PATCH sin mutación

Campos ausentes conservan valores; null limpia la métrica nullable; cero es válido y tags vacío limpia tags. Devuelve objeto y array nuevos incluso sin cambios. El contrato prohíbe undefined explícito.

### Spoiler

Elige métrica mediante comprobación de undefined, no ??, porque null tiene significado. Copia tags seleccionado. Spread superficial comparte referencias. Prueba cambiar resultado y array del patch después de llamar.

```ts
export type Current = { id: string; price: number | null; tags: readonly string[] };
export type Patch = { price?: number | null; tags?: readonly string[] };

export function applyPatch(current: Current, patch: Patch): Current {
  return {
    id: current.id,
    price: patch.price === undefined ? current.price : patch.price,
    tags: [...(patch.tags ?? current.tags)],
  };
}
```

#### Error plausible: fallback nullish y copia superficial

```ts check
const current = { id: "A", price: 10, tags: ["old"] };
const patch: { price?: number | null } = { price: null };
const wrong = { ...current, price: patch.price ?? current.price };
wrong.tags.push("new");
// wrong.price is 10, not null; current.tags is now ["old", "new"].
```

null borra price, así que ?? convierte incorrectamente un borrado en ausencia de cambio. Comprueba undefined para price. Spread crea un objeto nuevo, pero comparte tags: copia el array seleccionado incluso sin cambios. Comprueba null y modifica los tags devueltos para verificar independencia. Cero, ausencia y un array de reemplazo vacío cubren ramas distintas.

## Caché async y callers concurrentes

Coalesce cargas pendientes por clave y conserva éxitos, también undefined. Elimina cargas fallidas para permitir retry; throw síncrono se convierte en promise rechazada. Define identidad e invalidación aparte: este ejemplo no tiene TTL ni capacidad máxima.

### Spoiler

Guarda la promise antes de otra llamada. Promise.resolve().then ejecuta loader después de insertar y captura throw síncrono. Borra al rechazar. Distingue ausencia de una entrada y éxito undefined; no caches rechazos para siempre.

```ts
export function memoizeAsync<K, V>(
  load: (key: K) => Promise<V>,
): (key: K) => Promise<V> {
  const cache = new Map<K, Promise<V>>();
  return key => {
    const existing = cache.get(key);
    if (existing !== undefined) return existing;

    const pending = Promise.resolve()
      .then(() => load(key))
      .catch(error => {
        cache.delete(key);
        throw error;
      });
    cache.set(key, pending);
    return pending;
  };
}
```

## Fallos parciales como datos

Carga IDs con límite, conserva posiciones y devuelve una unión por ID. Continúa tras rechazo y throw síncrono. Límite inválido rechaza la operación completa.

### Spoiler

Captura dentro del callback mapLimit, devuelve failure discriminado y normaliza el mensaje con Error o String(error). Anota el tipo de resultado si inferencia amplía el discriminador.

```ts
import { mapLimit } from "./core.ts";

export type Outcome<T> =
  | { status: "loaded"; id: string; value: T }
  | { status: "failed"; id: string; message: string };

export function loadAll<T>(
  ids: readonly string[],
  limit: number,
  load: (id: string) => Promise<T>,
): Promise<Outcome<T>[]> {
  return mapLimit(ids, limit, async (id): Promise<Outcome<T>> => {
    try {
      return { status: "loaded", id, value: await load(id) };
    } catch (error) {
      return {
        status: "failed", id,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  });
}
```

## Medir la tentativa

Anota requisitos resueltos, tests, ayudas y punto de bloqueo. Tras leer respuesta, cambia entrada o política y vuelve a escribir desde cero. Quiz comprueba reconocimiento, no código independiente. Continúa con práctica por dominio y simulación.

## Quince trampas: referencia para volver a TS

Úsala después de tu intento. Si una fila sorprende, repasa la explicación y prueba otra entrada antes de marcar el capítulo. Es una lista de repaso, no una puntuación.

| Trampa | Regla y contraejemplo | Repasar |
| --- | --- | --- |
| `as T` | No valida ni convierte JSON; comprueba unknown en el límite. | [Contratos prácticos de TypeScript](./03-typescript.md) |
| `typeof null` | Es "object"; excluye null y arrays antes de comprobar campos. | [Contratos prácticos de TypeScript](./03-typescript.md) |
| `const` | Fija una variable; una propiedad mutable puede ampliarse a string. | [Volver a TypeScript: el lenguaje](./11-language-refresh.md) |
| `x?: T` | Permite ausencia; undefined explícito requiere una unión con exactOptionalPropertyTypes. | [Volver a TypeScript: el lenguaje](./11-language-refresh.md) |
| `Readonly<T>` | Es superficial; otro alias aún puede modificar el valor original. | [Trampas de JavaScript en algoritmos correctos](./02-javascript.md) |
| `array[0]` | Puede faltar; comprueba el valor o declara un contrato no vacío. | [Compilador, módulos y ejecución de TS](./13-tooling.md) |
| `\|\|` / `??` | Conserva cero válido; null en PATCH puede significar borrar, no fallback. | [Taller: escribir el código](./14-workshop.md) |
| Spread | Copia un nivel; clona arrays anidados que pertenezcan al resultado. | [Trampas de JavaScript en algoritmos correctos](./02-javascript.md) |
| `Set<object>` | Compara referencias; deduplicar por campos exige claves explícitas. | [Colecciones y procesamiento de datos](./01-collections.md) |
| Event / entity | Usa claves distintas para repetición y selección de la última versión. | [Eventos, idempotencia y base de datos](./07-database.md) |
| `sort()` | Muta y compara cadenas por defecto; define comparador y copia. | [Trampas de JavaScript en algoritmos correctos](./02-javascript.md) |
| `Promise.all` | Conserva orden de entrada; no limita inicios ni cancela otras operaciones. | [Trabajo asíncrono y event loop](./04-async.md) |
| Timeout | Promise.race deja de esperar; la cancelación cooperativa debe llegar a la operación. | [Obtener datos: páginas, timeouts y reintentos](./06-ingestion.md) |
| Generic getter | Usa K extends keyof T y T[K] para conservar el tipo de la propiedad elegida. | [Diseño de tipos más allá de generics básicos](./12-type-design.md) |
| Run / check | Ejecutar con éxito no implica pasar typecheck; realiza ambos pasos. | [Compilador, módulos y ejecución de TS](./13-tooling.md) |
