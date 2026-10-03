# Volver a TypeScript: el lenguaje

Repaso práctico. Lee el contrato, traza los ejemplos e intenta el ejercicio antes de abrir la respuesta. Algunos bloques comparten contexto; solo `ts check` identifica comprobaciones independientes.

## Tipos y valores

Un valor existe al ejecutar; un tipo describe valores permitidos al checker. Anotaciones, aliases e interfaces ordinarios se borran y no validan JSON. Algunas construcciones como enum generan código. Usa string, number y boolean en minúscula, no wrappers. number incluye enteros y fracciones; bigint es distinto y no se mezcla directamente en aritmética.

```ts check
const limit: number = 4;
type Options = { limit: number };
```

## Inferencia y widening

let permite reasignación y suele ampliar un literal a string. const conserva un literal primitivo, pero los campos de objetos siguen siendo modificables. Anota el contrato de un estado. as const conserva literales y readonly; satisfies verifica forma pero puede mantener un literal estrecho. Da contexto a colecciones vacías; no memorices que todo array vacío siempre es never[].

```ts check
let status = "queued";
const mode = "queued";
const job = { status: "queued" };
```

```ts check
type Job = { status: "queued" | "done" };
const job: Job = { status: "queued" };
job.status = "done";
```

```ts check
const state: { tags: string[] } = { tags: [] };
state.tags.push("new");
```

## Tipado estructural

La compatibilidad depende normalmente de campos, no del nombre declarado. Una variable con campos adicionales puede ser compatible. Un literal nuevo recibe además comprobación de exceso de propiedades. Esto no crea un esquema exacto en ejecución ni borra campos. Dos aliases de string siguen siendo compatibles; brands distinguen IDs si hace falta.

```ts check
type Identified = { id: string };
function show(value: Identified): string {
  return value.id;
}
const listing = { id: "A", price: 500 };
show(listing);
```

```ts check
type Identified = { id: string };
function show(value: Identified): string { return value.id; }
// @ts-expect-error: intentional type error
show({ id: "A", price: 500 });
```

## Uniones e intersecciones

A | B permite alternativas y requiere narrowing para operaciones específicas. A & B exige ambos contratos; campos incompatibles pueden producir never. Una intersección no sobrescribe el tipo de un campo: usa Omit primero. Estados excluyentes suelen necesitar unión.

```ts check
function format(value: string | number): string {
  return typeof value === "number" ? value.toFixed(2) : value.trim();
}
```

```ts check
type Impossible = { id: string } & { id: number };

```

## Optional y undefined

Con exactOptionalPropertyTypes, field?: number permite ausencia pero no undefined explícito salvo union. Al leer, sigue pudiendo aparecer undefined. field: number | undefined requiere el campo. PATCH diferencia ausencia y null. in incluye heredados; Object.hasOwn comprueba propiedad propia, pero no necesariamente basta para narrowing del valor.

```ts check
type Options = { retries?: number };
const omitted: Options = {};
```

## Arrays, tuplas y readonly

Un array ordinario no garantiza longitud mínima. Con noUncheckedIndexedAccess un índice puede faltar. Las tuplas describen posiciones; sus etiquetas no crean campos runtime. Usa entradas readonly si solo lees. La protección es superficial y otro alias puede modificar el mismo objeto.

```ts check
const prices: number[] = [100, 200];
const point: readonly [x: number, y: number] = [10, 20];
```

## Firmas de funciones

El contexto infiere tipos de callbacks. Un parámetro optional permite al caller omitirlo; no hagas index opcional si siempre se pasa solo porque algunos callbacks lo ignoran. Rest reúne argumentos. async devuelve Promise<T>. Un callback () => void puede devolver un valor: quien llama promete ignorarlo, no demuestra ausencia de retorno.

```ts check
type Formatter = (price: number, currency?: string) => string;
const format: Formatter = (price, currency = "USD") => `${currency} ${price}`;
```

## This y closures

this de un método normal depende de cómo se invoca y puede perderse al pasar el método. bind, wrapper o campo arrow preservan el receptor. Una closure conserva acceso a una variable, no una fotografía automática. let crea binding por iteración; var puede compartir uno que cambia.

```ts check
class Counter {
  value = 0;
  increment() { this.value++; }
}
const counter = new Counter();
const safe = () => counter.increment();
safe();
```

## Práctica

¿Por qué un status inferido falla ante una unión literal? ¿Por qué Readonly<{tags: string[]}> permite push? ¿Qué diferencia hay entre optional y obligatorio con undefined?

### Spoiler

El campo puede inferirse como string: anota el contrato. Readonly impide sustituir tags, pero el array necesita readonly string[] para impedir modificarlo por esa vista. Un campo optional puede faltar; un campo obligatorio con union debe existir.

## Cuándo avanzar

Explica tipo y valor, escribe un callback, distingue ausencia y null y valida unknown sin assertions. Después conecta estas reglas con JavaScript runtime y contratos prácticos.

## Referencias oficiales

- [TypeScript: everyday-types](https://www.typescriptlang.org/docs/handbook/2/everyday-types.html)
- [TypeScript: exactOptionalPropertyTypes](https://www.typescriptlang.org/tsconfig/exactOptionalPropertyTypes.html)
