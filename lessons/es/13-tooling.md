# Compilador, módulos y ejecución de TS

Repaso práctico. Lee el contrato, traza los ejemplos e intenta el ejercicio antes de abrir la respuesta. Algunos bloques comparten contexto; solo `ts check` identifica comprobaciones independientes.

## Comprobar, transformar y ejecutar

Son pasos distintos. Aquí tsc --noEmit comprueba y Node 24 ejecuta sintaxis compatible quitando tipos. Ejecutar no implica typecheck ni todas las transformaciones de tsconfig. Lee scripts, engines y configuración. npm ci instala según lockfile y detecta discrepancias; install cambia dependencias.

```sh
npm ci
npm run check
npm test
npm run build
npm start
```

## Strict y opciones adicionales

strict activa varias comprobaciones, pero noUncheckedIndexedAccess y exactOptionalPropertyTypes son opciones separadas. Comprueba índices o usa tupla no vacía; ! no arregla el contrato. verbatimModuleSyntax favorece import type explícito. Configuración para Node directo no es universal para bundlers.

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "allowImportingTsExtensions": true
  }
}
```

## Target y lib no instalan APIs

target controla supuestos de lenguaje emitido; lib describe APIs al checker. Añadir toSorted a tipos no lo instala en un runtime antiguo. @types/node no actualiza Node. Alinea entorno soportado, engines, declaraciones y CI.

## ESM, CommonJS e import type

type: module define ESM para .js; .mjs y .cjs son explícitos. module y moduleResolution corresponden al cargador real. import type se borra; una interface no es constructor runtime. Ejecución TS directa usa extensiones adecuadas; compilación ESM necesita otra política coherente. paths no enseña al runtime a resolver aliases.

```ts
import { mapLimit } from "./core.ts";
import type { Repository } from "./core.ts";
```

## Declaraciones no crean implementaciones

.d.ts y declare describen valores externos, no los crean. Revisa instalación, exports, declaraciones y resolución. declare module "*" con any oculta errores en vez de arreglar un módulo faltante.

```ts check
declare const API_URL: string;

```

## Variables de entorno como entrada

Son strings o undefined. Valida formato, convierte y comprueba rango al inicio. as number no convierte texto. Un puerto exige dígitos y rango 1–65535. Distingue valor por defecto de cadena vacía o entrada inválida.

```ts
function readPort(value: string | undefined): number {
  if (value === undefined) return 4173;
  if (!/^\d+$/.test(value)) throw new Error("PORT must be digits");
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT out of range");
  }
  return port;
}
```

## Leer errores del compilador

Busca el punto donde un literal se amplió, un campo puede faltar, el callback es estrecho o JSON se afirmó seguro. Module-not-found runtime requiere revisar archivo, ruta, extensión y formato, no añadir any.

## Práctica

Una interface Repository se importa como constructor; un alias paths falla en Node; el archivo se ejecuta con argumento mal tipado. ¿Qué revisas?

### Spoiler

Usa import type y una implementación real. Proporciona resolver runtime o ruta relativa válida para el alias. Ejecuta typecheck aparte y valida datos externos: quitar tipos no es comprobarlos.

## Un ciclo fiable

Lee scripts, engines y tsconfig; instala por lockfile; ejecuta checker y un test; implementa y repite comprobaciones relevantes. Prepara el entorno antes del ejercicio cronometrado.

## Referencias oficiales

- [TypeScript: theory](https://www.typescriptlang.org/docs/handbook/modules/theory.html)
- [Node.js: typescript](https://nodejs.org/api/typescript.html)

## Clínica de errores del compilador: diez reparaciones

Lee el diagnóstico, sigue el valor hasta su declaración e intenta repararlo antes de abrir la respuesta. Cada bloque se comprueba por separado con las opciones strict del repositorio. @ts-expect-error marca fallos intencionales; quítalo en un archivo de prueba para ver el diagnóstico. Son ejemplos para comprobar tipos, no scripts que debas ejecutar sin cambios: las líneas erróneas aún se ejecutan en runtime.

Referencias: [narrowing](https://www.typescriptlang.org/docs/handbook/2/narrowing.html), [relaciones genéricas](https://www.typescriptlang.org/docs/handbook/2/generics.html), [sobrecargas](https://www.typescriptlang.org/docs/handbook/2/functions.html), [propiedades opcionales](https://www.typescriptlang.org/tsconfig/exactOptionalPropertyTypes.html).

### 1. Un campo mutable se amplió a string

La llamada falla aunque la variable sea const. Localiza el valor cuyo tipo se amplió.

```ts check
type Status = "queued" | "done";
function accept(status: Status): Status { return status; }
const job = { status: "queued" };
// @ts-expect-error: mutable property inferred as string, not Status.
accept(job.status);
```

### Spoiler

const fija la variable, no la propiedad mutable, cuyo tipo es string. Declara el contrato al construir el objeto. as const sirve para configuración fija, pero haría readonly esta propiedad. Comprueba una transición válida y el rechazo de una cadena ajena.

```ts check
type Status = "queued" | "done";
const job: { status: Status } = { status: "queued" };
job.status = "done";
// @ts-expect-error: not a state in this domain.
job.status = "running";
```

### 2. Una propiedad opcional puede faltar

El compilador no puede garantizar una cadena para todo llamador. Corrige el contrato o trata la ausencia.

```ts check
function token(options: { token?: string }): string {
  // @ts-expect-error: options.token can be undefined.
  return options.token.trim();
}
```

### Spoiler

Guarda el valor localmente y compruébalo antes de llamar métodos. Aquí ausencia y token vacío son errores. ! oculta el aviso sin crear el token; un valor por defecto solo sirve si el contrato permite acceso anónimo.

```ts check
function token(options: { token?: string }): string {
  const value = options.token;
  if (value === undefined || value.trim() === "") throw new Error("Missing token");
  return value.trim();
}
token({ token: " abc " }); // "abc"; token({}) rejects.
```

### 3. Un índice no garantiza un elemento

Con noUncheckedIndexedAccess incluso el índice cero puede faltar.

```ts check
function firstId(items: readonly { id: string }[]): string {
  // @ts-expect-error: empty arrays have no first item.
  return items[0].id;
}
```

### Spoiler

Define el comportamiento vacío. Esta API devuelve undefined, así que su tipo lo incluye. Si se prohíbe el vacío, valida y lanza un error o acepta una tupla no vacía. Una aserción no modifica el array recibido.

```ts check
function firstId(items: readonly { id: string }[]): string | undefined {
  const first = items[0];
  return first?.id;
}
firstId([]); // undefined
firstId([{ id: "A" }]); // "A"
```

### 4. Ausencia y undefined explícito son distintos

exactOptionalPropertyTypes rechaza esta asignación; leer la propiedad aún puede dar undefined.

```ts check
type Patch = { name?: string };
// @ts-expect-error: present undefined is not an allowed field value.
const patch: Patch = { name: undefined };
```

### Spoiler

Omite la propiedad para no actualizar. Añade undefined a la unión solo si ese valor explícito pertenece al contrato. Object.hasOwn distingue ambos objetos; JSON normalmente omite propiedades undefined, por lo que el transporte necesita una política propia.

```ts check
type Patch = { name?: string };
const unchanged: Patch = {};
type ExplicitPatch = { name?: string | undefined };
const present: ExplicitPatch = { name: undefined };
Object.hasOwn(unchanged, "name"); // false
Object.hasOwn(present, "name"); // true
```

### 5. Un getter genérico perdió la relación clave/valor

La firma amplia acepta claves válidas, pero pierde cuál se pidió.

```ts check
function field<T>(value: T, key: keyof T): T[keyof T] { return value[key]; }
const person = { age: 42, name: "Ada" };
// @ts-expect-error: result is string | number, not specifically number.
const age: number = field(person, "age");
```

### Spoiler

Da a la clave su propio parámetro K extends keyof T y devuelve T[K]. Una aserción en la llamada oculta la relación perdida. Prueba una propiedad numérica, otra de cadena y una clave inexistente.

```ts check
function field<T, K extends keyof T>(value: T, key: K): T[K] { return value[key]; }
const person = { age: 42, name: "Ada" };
const age: number = field(person, "age");
const name: string = field(person, "name");
// @ts-expect-error: missing key.
field(person, "email");
```

### 6. Una unión no coincide con ninguna sobrecarga

La implementación maneja ambas entradas, pero el llamador solo ve las sobrecargas.

```ts check
function normalize(value: string): string;
function normalize(value: readonly string[]): string[];
function normalize(value: string | readonly string[]): string | string[] {
  return typeof value === "string" ? value.trim() : value.map(x => x.trim());
}
function call(value: string | readonly string[]) {
  // @ts-expect-error: neither single-variant overload accepts this union.
  return normalize(value);
}
```

### Spoiler

Expón una sobrecarga de unión si esos argumentos son válidos, o usa una única firma de unión si no necesitas correlación exacta. La sobrecarga adicional conserva resultados precisos para variantes conocidas; un llamador de unión obtiene una unión.

```ts check
function normalize(value: string): string;
function normalize(value: readonly string[]): string[];
function normalize(value: string | readonly string[]): string | string[];
function normalize(value: string | readonly string[]): string | string[] {
  return typeof value === "string" ? value.trim() : value.map(x => x.trim());
}
const one: string = normalize(" a ");
function call(value: string | readonly string[]): string | string[] { return normalize(value); }
```

### 7. Una vista readonly no tiene push

El consumidor prometió no mutar el array a través de esta referencia.

```ts check
function addTag(tags: readonly string[], next: string): string[] {
  // @ts-expect-error: readonly arrays prohibit push through this view.
  tags.push(next);
  return [...tags];
}
```

### Spoiler

Devuelve un array nuevo. Eso protege la entrada a través de esta API, sin congelar el objeto. Readonly<{tags: string[]}> impide sustituir tags, pero permite tags.push. Usa una propiedad readonly y un array readonly para ambos niveles.

```ts check
function addTag(tags: readonly string[], next: string): string[] { return [...tags, next]; }
const source = ["old"];
const result = addTag(source, "new"); // source remains ["old"].
type State = { readonly tags: readonly string[] };
const state: State = { tags: source };
// @ts-expect-error: nested view is readonly too.
state.tags.push("other");
```

### 8. Un switch exhaustivo omitió una variante

Asignar el valor restante a never revela la variante sin tratar.

```ts check
type Result = { kind: "ok"; value: number } | { kind: "failed"; message: string };
function describe(result: Result): string {
  switch (result.kind) {
    case "ok": return String(result.value);
    default:
      // @ts-expect-error: failed has not been handled.
      const missing: never = result;
      return String(missing);
  }
}
```

### Spoiler

Trata todos los miembros antes de comprobar never. Añadir una variante futura debería producir un error aquí. Un fallback vacío aceptaría ese caso silenciosamente. La garantía cubre la unión declarada; JSON externo aún requiere validación.

```ts check
type Result = { kind: "ok"; value: number } | { kind: "failed"; message: string };
function describe(result: Result): string {
  switch (result.kind) {
    case "ok": return String(result.value);
    case "failed": return result.message;
    default: {
      const unreachable: never = result;
      throw new Error(`Unexpected result: ${String(unreachable)}`);
    }
  }
}
```

### 9. Un valor capturado es unknown

JavaScript permite lanzar valores que no tienen message.

```ts check
function message(run: () => void): string {
  try { run(); return "ok"; } catch (error) {
    // @ts-expect-error: a caught unknown is not automatically Error.
    return error.message;
  }
}
```

### Spoiler

Comprueba Error antes de leer message. Define una conversión para otros valores ordinarios: String(undefined) es "undefined". Objetos especiales también pueden fallar al convertirse; un límite de logging que nunca deba lanzar requiere otra política. Tener mensaje no implica que el fallo sea reintentable.

```ts check
function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
errorMessage(new Error("offline")); // "offline"
errorMessage(undefined); // "undefined"
```

### 10. Una interfaz no es un constructor en ejecución

El compilador indica que se está usando un tipo como valor.

```ts check
interface RecordData { id: string }
// @ts-expect-error: interfaces are erased; no constructor exists.
const record = new RecordData();
```

### Spoiler

Construye un objeto que cumpla la interfaz o proporciona una clase/factoría real. Un import type describe un contrato y se elimina. declare describe una implementación esperada en otro lugar; no la crea. Comprueba las importaciones runtime por separado.

```ts check
interface RecordData { id: string }
const record: RecordData = { id: "A" };
class StoredRecord implements RecordData {
  id: string;
  constructor(id: string) { this.id = id; }
}
const stored: RecordData = new StoredRecord("B");
```
