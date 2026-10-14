# Contratos prácticos de TypeScript

Repaso práctico. Lee el contrato, traza los ejemplos e intenta el ejercicio antes de abrir la respuesta. Algunos bloques comparten contexto; solo `ts check` identifica comprobaciones independientes.

## Unknown, any y narrowing

any desactiva comprobaciones importantes. unknown admite cualquier valor, pero exige verificarlo antes de usarlo. En la frontera comprueba objeto, null, arrays, campos obligatorios, tipos y restricciones; después construye un resultado normalizado. typeof null es object. as no valida ni convierte. JSON.parse puede fallar antes de comprobar la estructura. Un parser normaliza y explica errores; el compilador confía en la promesa de un type guard, no demuestra su implementación.

```ts check
type Listing = { id: string; price: number };

function parseListing(value: unknown): Listing {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error("Expected an object");
  }
  if (!("id" in value) || typeof value.id !== "string" || !value.id.trim()) {
    throw new Error("Invalid id");
  }
  if (!("price" in value) || typeof value.price !== "number" ||
      !Number.isFinite(value.price) || value.price < 0) {
    throw new Error("Invalid price");
  }
  return { id: value.id, price: value.price };
}
```

## Uniones discriminadas

Un booleano de éxito con data y error opcionales permite estados imposibles. Define cada estado como un miembro con discriminador literal y datos obligatorios. La comprobación del discriminador permite narrowing. never sirve para comprobar exhaustividad cuando no quedan variantes, pero no valida datos externos. Devuelve errores esperados como valores si el lote debe continuar; lanza si la operación no puede seguir.

```ts
type WeakResult<T> = {
  success: boolean;
  data?: T;
  error?: string;
};
```

```ts
type Result<T> =
  | { ok: true; value: T }
  | { ok: false; error: string };

function describe(result: Result<Listing>): string {
  if (result.ok) {
    return `${result.value.id}: ${result.value.price}`;
  }
  return result.error;
}
```

```ts check
type ListingEvent =
  | { kind: "price_changed"; id: string; price: number }
  | { kind: "removed"; id: string; reason: string };

function assertNever(value: never): never {
  throw new Error(`Unexpected event: ${JSON.stringify(value)}`);
}

function summarize(event: ListingEvent): string {
  switch (event.kind) {
    case "price_changed": return `${event.id}: ${event.price}`;
    case "removed": return `${event.id}: ${event.reason}`;
    default: return assertNever(event);
  }
}
```

## Generics conservan relaciones

T relaciona elementos de entrada y salida; K relaciona la clave seleccionada y la del Map. Normalmente se infieren. any pierde la relación y unknown obliga a volver a comprobar datos conocidos. K extends keyof T restringe las claves; T[K] obtiene el tipo del campo. Este extends es una restricción de tipos, no herencia en ejecución.

```ts check
function groupBy<T, K>(
  items: readonly T[],
  keyOf: (item: T) => K,
): Map<K, T[]> {
  const groups = new Map<K, T[]>();
  for (const item of items) {
    const key = keyOf(item);
    const group = groups.get(key);
    if (group) group.push(item);
    else groups.set(key, [item]);
  }
  return groups;
}

const byPrice = groupBy(
  [{ id: "A", price: 500 }],
  listing => listing.price,
); // Map<number, { id: string; price: number }[]>
```

```ts check
function getField<T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}
const price = getField({ id: "A", price: 500 }, "price"); // number

```

## Utility types y fronteras

Pick selecciona campos, Omit los excluye, Partial los hace opcionales y Readonly impide asignarlos mediante ese tipo. No eliminan campos reales ni congelan objetos profundamente. Limita PATCH a campos editables. Un Record de claves finitas es útil; un índice disperso necesita gestionar ausencias. type permite uniones y tuplas; interface describe objetos extensibles. as const y satisfies no validan en ejecución. En catch, comprueba Error o convierte el valor alternativo a texto.

```ts check
type Listing = { id: string; price: number; source: string };
type Summary = Pick<Listing, "id" | "price">;
type CreateListing = Omit<Listing, "id">;
type PatchListing = Partial<Pick<Listing, "price">>;
type FrozenListing = Readonly<Listing>;
```

```ts check
const handlers = {
  queued: "Pending",
  done: "Finished",
} satisfies Record<"queued" | "done", string>;
```

## Práctica

Representa applied, stale y failed. Todos tienen ID; solo failed tiene message. Cuenta únicamente los applied.

### Spoiler

Una unión discriminada por status impide failed sin message y permite leer message tras narrowing. Si necesitas una razón de descarte, añádela a stale, no como campo opcional de todas las variantes.

```ts check
type ImportResult =
  | { status: "applied"; id: string }
  | { status: "stale"; id: string }
  | { status: "failed"; id: string; message: string };

function countApplied(results: readonly ImportResult[]): number {
  return results.filter(result => result.status === "applied").length;
}
```

#### Error plausible: afirmar el tipo de datos externos

```ts check
type Item = { id: string; price: number };
const raw: unknown = { id: "A", price: "free" };
const item = raw as Item;
const total = item.price + 1; // runtime: "free1", not a number.
```

El código pasa typecheck, pero el resultado viola el contrato numérico. as cambia la visión del compilador sin convertir la cadena. Comprueba objeto, null/arrays y cada campo antes de construir un Item nuevo. Incluye cadenas, campos ausentes, cero y números no finitos en las pruebas.

## Explicar la frontera

Indica dónde se valida y cuáles son los errores esperados. El contrato útil entrega un valor validado o un fallo explícito; una assertion no transforma datos desconocidos en seguros.

## Referencias oficiales

- [TypeScript: narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html)
