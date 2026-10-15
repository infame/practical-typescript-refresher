# Trampas de JavaScript en algoritmos correctos

Repaso práctico. Lee el contrato, traza los ejemplos e intenta el ejercicio antes de abrir la respuesta. Algunos bloques comparten contexto; solo `ts check` identifica comprobaciones independientes.

## Referencias y copias superficiales

`const` impide reasignar la variable, no modificar su objeto. Spread copia un solo nivel: cambiar un objeto o array anidado mediante la copia puede modificar el original. `readonly` y `Object.freeze` tampoco implican una protección profunda universal. Copia los niveles que el contrato requiere y modifica el resultado en una prueba para comprobar la independencia.

```ts
const a = { id: "A" };
const b = { id: "A" };
const c = a;
a === b; // false
a === c; // true
new Set([a, b]).size; // 2
```

```ts
const source = { id: "A", address: { city: "Austin" }, tags: ["new"] };
const copy = { ...source };
copy.id = "B";
copy.address.city = "Denver";
copy.tags.push("featured");

const updated = {
  ...source,
  address: { ...source.address, city: "Boston" },
  tags: [...source.tags, "verified"],
};
```

## Arrays y ordenación

sort modifica el array y compara como texto por defecto. Para números usa (a, b) => a - b y copia primero si debes conservar la entrada. `toSorted` crea una copia, pero necesita soporte del entorno.

`map` transforma, `filter` selecciona y `reduce` acumula.

Con `noUncheckedIndexedAccess` un índice puede devolver `undefined`; compruébalo o expresa un array no vacío mediante una tupla.

```ts
[100, 20, 3].sort();
[100, 20, 3].sort((a, b) => a - b); // [3, 20, 100]
```

```ts
const sorted = [...items].sort(compare);

const alsoSorted = items.toSorted(compare);
```

## Valores ausentes

|| sustituye cualquier valor falsy, también 0 y la cadena vacía. ?? sustituye solo null o undefined. Optional chaining evita acceder a un receptor nullish pero no valida JSON. filter(Boolean) elimina más que los ausentes. Distingue ausencia, undefined explícito, null y cero válido. Object.hasOwn comprueba campos propios; in también mira los heredados.

```ts
0 || 3;         // 3
0 ?? 3;         // 0
"" ?? "name";   // ""
null ?? 3;      // 3
const { price = 100 } = { price: null }; // null
```

```ts
const nextPrice = patch.price === undefined ? oldPrice : patch.price;
```

## Números y fechas

`Number` admite conversiones que el contrato puede prohibir: cadena vacía, hexadecimal o exponentes. Valida la sintaxis decimal antes de convertir si necesitas un formato estricto. Comprueba finitud y enteros seguros cuando corresponda. `NaN` no es igual a sí mismo. Define unidades, zona horaria y tratamiento de fechas inválidas. La aritmética binaria en coma flotante no representa dinero decimal exactamente.

```ts
Number(" ");          // 0
Number(null);         // 0
Number("500usd");     // NaN
parseInt("500usd", 10); // 500
parseInt("12.9", 10); // 12
```

```ts
function parsePrice(value: unknown): number {
  if (typeof value !== "number" && typeof value !== "string") {
    throw new Error("Expected number or string");
  }
  if (typeof value === "string" && value.trim() === "") {
    throw new Error("Empty price");
  }
  const price = Number(value);
  if (!Number.isFinite(price) || price < 0) throw new Error("Invalid price");
  return price;
}
```

```ts
const a = Date.parse("2026-10-01T10:00:00+02:00"); // 08:00 UTC
const b = Date.parse("2026-10-01T09:00:00Z");      // 09:00 UTC
a < b; // true
```

Por ejemplo, `0.1 + 0.2 !== 0.3`. Si el contrato usa una moneda de dos decimales, unidades menores enteras dentro del rango seguro evitan esos errores fraccionarios; otras monedas necesitan su propia escala.

Conserva IDs como "00123" como cadenas.

`Date.parse` devuelve milisegundos o `NaN`, mientras una API puede enviar segundos; indica la unidad en el nombre del campo. Incluye zona horaria explícita, normaliza una vez y compara timestamps, no cadenas ISO con offsets distintos.

## Práctica

Predice una ordenación numérica, el valor por defecto cuando la entrada es cero y una modificación de un array anidado tras spread.

```ts
const source: Array<{ id: string; tags: string[] }> = [
  { id: "A", tags: [] }, { id: "B", tags: [] },
];
const result = source.map(x => ({ ...x }));
const first = result[0];
if (first === undefined) throw new Error("Expected a first element");
first.id = "X";
first.tags.push("new");
result.reverse();
const retries = 0 || 3;
```

### Spoiler

El `source` original conserva los IDs A, B en ese orden. Su primer array `tags` ahora es `["new"]`: la copia superficial comparte ese array anidado. `result` tiene IDs B, X después de invertirlo. `retries` vale 3; `0 ?? 3` conserva el cero explícito.

Copia también `tags` si necesitas mutaciones independientes.

La ordenación por defecto anterior produce `[100, 20, 3]` por comparación de cadenas; el comparador numérico produce `[3, 20, 100]`.

## Separar las comprobaciones

Antes de cada if, decide si compruebas presencia, tipo o validez de negocio. Son preguntas diferentes: un número puede existir y tener el tipo correcto, pero ser negativo o infinito.
