# Diseño de tipos más allá de generics básicos

Repaso práctico. Lee el contrato, traza los ejemplos e intenta el ejercicio antes de abrir la respuesta. Algunos bloques comparten contexto; solo `ts check` identifica comprobaciones independientes.

## Qué relación conserva el generic

identity relaciona entrada y salida mediante T. Un generic usado una sola vez puede no aportar nada. groupBy conserva tipos de elemento y clave; mapLimit entrada y resultado; getField clave y valor. Elige el API mínimo que expresa la relación.

```ts check
function identity<T>(value: T): T { return value; }
```

## Typeof, keyof e indexed access

typeof en posición de tipo extrae el tipo de un valor; keyof sus claves; indexed access sus valores. Evita mantener listas duplicadas de configuración. Object.keys suele devolver string[] porque un objeto estructural puede tener más propiedades runtime. Afirmar (keyof T)[] requiere supuestos más fuertes.

```ts check
const sourceNames = { primary: "MLS", secondary: "Partner" } as const;
type SourceKey = keyof typeof sourceNames; // "primary" | "secondary"
type SourceName = (typeof sourceNames)[SourceKey]; // "MLS" | "Partner"
```

## Mapped types

Transforman el tipo de cada campo. Un patch clearable añade null y optional a campos editables; no incluyas IDs por accidente. El tipo no aplica el patch: una función debe validar, distinguir ausencia y construir el estado.

```ts check
type ClearablePatch<T> = {
  [K in keyof T]?: T[K] | null;
};
type Editable = { price: number; description: string };
type Patch = ClearablePatch<Editable>;
```

## Conditional types e infer

infer extrae una parte que coincide. ReturnType obtiene retorno y Awaited modela await sin ejecutar funciones. Un parámetro desnudo a la izquierda de extends distribuye sobre union; envolver en tuplas comprueba la unión completa. Sirve para leer bibliotecas, pero una firma normal suele ser mejor para una tarea pequeña.

```ts check
type Returned<F> = F extends (...args: never[]) => infer R ? R : never;
type Example = Returned<() => Promise<number>>; // Promise<number>
```

```ts check
async function load() { return { id: "A", price: 500 }; }
type Loaded = Awaited<ReturnType<typeof load>>;
```

```ts check
type KeepStrings<T> = T extends string ? T : never;
type A = KeepStrings<"x" | 42>; // "x"

type AllStrings<T> = [T] extends [string] ? true : false;
type B = AllStrings<"x" | 42>; // false
```

## Overloads

Expresan entradas y salidas correspondientes. El caller ve overloads, no la firma de implementación. Una entrada union puede no encajar en ninguno: añade overload union o usa una firma union si no necesitas correlación exacta. Mantén el conjunto explicable.

```ts check
function normalize(value: string): string;
function normalize(value: readonly string[]): string[];
function normalize(value: string | readonly string[]): string | string[] {
  return typeof value === "string" ? value.trim() : value.map(x => x.trim());
}
```

## Assertions, funciones assertion y satisfies

as y ! afirman sin comprobar runtime. Una función assertion sí puede verificar y estrechar tras éxito o lanzar ante fallo. satisfies comprueba compatibilidad y as const conserva literales. Configuración externa sigue necesitando validación ejecutada.

```ts check
function assertString(value: unknown): asserts value is string {
  if (typeof value !== "string") throw new Error("Expected a string");
}
function upper(value: unknown): string {
  assertString(value);
  return value.toUpperCase();
}
```

```ts check
type Route = "home" | "listings";
const routes = {
  home: "/",
  listings: "/listings",
} as const satisfies Record<Route, string>;
```

## IDs con brands

Una intersección con unique symbol evita mezclar casualmente IDs string. Localiza la assertion en un parser que comprueba la condición. La marca no añade un símbolo a la cadena real; restablece la garantía tras JSON. Úsala si el riesgo justifica complejidad.

```ts check
declare const listingIdBrand: unique symbol;
type ListingId = string & { readonly [listingIdBrand]: true };

function parseListingId(value: unknown): ListingId {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error("Invalid listing ID");
  }
  return value as ListingId;
}
```

## Funciones y variancia

Si el API puede llamar con cualquier Animal, un callback que requiere Dog falla con un gato. strictFunctionTypes protege funciones ordinarias; métodos tienen excepciones. Explica valores que el caller puede pasar y los que el callback admite.

```ts check
type Animal = { name: string };
type Dog = Animal & { bark(): void };
type Handler = (animal: Animal) => void;
const onlyDogs = (dog: Dog) => dog.bark();
// @ts-expect-error: intentional type error
const handler: Handler = onlyDogs;
```

## Práctica

Crea diccionario de handlers added y removed. added lleva métrica numérica; removed lleva reason. Cada handler acepta solo su variante.

### Spoiler

Recorre Event["kind"] y usa Extract<Event,{kind:K}>. La llamada dinámica `handlers[event.kind](event)` puede perder correlación; switch suele ser más claro que ocultarlo con any.

```ts check
type Event =
  | { kind: "added"; price: number }
  | { kind: "removed"; reason: string };

type Handlers = {
  [K in Event["kind"]]: (event: Extract<Event, { kind: K }>) => void;
};

const handlers: Handlers = {
  added: event => console.log(event.price),
  removed: event => console.log(event.reason),
};
```

## Comprobar comprensión

Explica cada parámetro de tipo, garantía runtime de parser y cuándo usar union, overload o generic. Si el tipo auxiliar supera en complejidad a la función, revisa el API.

## Referencias oficiales

- [TypeScript: generics](https://www.typescriptlang.org/docs/handbook/2/generics.html)
- [TypeScript: conditional-types](https://www.typescriptlang.org/docs/handbook/2/conditional-types.html)
- [TypeScript: utility-types](https://www.typescriptlang.org/docs/handbook/utility-types.html)
