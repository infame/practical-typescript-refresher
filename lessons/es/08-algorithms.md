# Patrones de algoritmos en TypeScript

Repaso práctico. Lee el contrato, traza los ejemplos e intenta el ejercicio antes de abrir la respuesta. Algunos bloques comparten contexto; solo `ts check` identifica comprobaciones independientes.

## Hash map: Two Sum

Guarda valores vistos y sus índices. Busca el complemento antes de insertar la posición actual para no usar dos veces el mismo elemento. Aclara si necesitas una respuesta o todas y cómo tratar duplicados. Las búsquedas esperadas `O(n)` sustituyen el doble bucle a cambio de memoria `O(n)`.

```ts
function twoSum(nums: readonly number[], target: number): [number, number] | null {
  const seen = new Map<number, number>();
  for (const [index, value] of nums.entries()) {
    const previous = seen.get(target - value);
    if (previous !== undefined) return [previous, index];
    seen.set(value, index);
  }
  return null;
}
```

## Dos punteros con entrada ordenada

Mueve izquierda o derecha según la suma esté por debajo o encima del objetivo. El patrón exige orden: compruébalo o incluye el coste de ordenar y reconstruir índices originales. No copies la técnica a una entrada desordenada sin su invariante.

```ts
function hasPair(sorted: readonly number[], target: number): boolean {
  let left = 0;
  let right = sorted.length - 1;
  while (left < right) {
    const sum = sorted[left]! + sorted[right]!;
    if (sum === target) return true;
    if (sum < target) left++;
    else right--;
  }
  return false;
}
```

## Ventana deslizante

Mantén una ventana sin repetidos y la última posición de cada carácter. Mueve su inicio solo hacia delante con max; un repetido anterior a la ventana no debe hacerte retroceder. Los índices de strings JS cuentan unidades UTF-16, no grafemas percibidos. Define el modelo de texto antes de prometer comportamiento Unicode.

```ts
function longestUnique(text: string): number {
  const last = new Map<string, number>();
  let left = 0;
  let best = 0;
  let right = 0;
  for (const char of text) {
    const previous = last.get(char);
    if (previous !== undefined) left = Math.max(left, previous + 1);
    last.set(char, right);
    best = Math.max(best, right - left + 1);
    right++;
  }
  return best;
}
```

## Pila: paréntesis

Guarda cierres esperados y compara cada cierre con el tope. Rechaza desacuerdos y una pila no vacía al terminar. Define qué ocurre con otros caracteres. push y pop al final son apropiados; shift al principio desplaza elementos repetidamente.

```ts
function balanced(text: string): boolean {
  const opening = new Map([["(", ")"], ["[", "]"], ["{", "}"]]);
  const closing = new Set([")", "]", "}"]);
  const expected: string[] = [];
  for (const char of text) {
    const close = opening.get(char);
    if (close !== undefined) expected.push(close);
    else if (closing.has(char) && expected.pop() !== char) return false;
  }
  return expected.length === 0;
}
```

## Combinar intervalos

Ordena una copia por inicio y combina según la política de extremos. Extiende el final con max: asignar directamente el siguiente final falla con intervalos anidados. Aclara si los intervalos que se tocan se unen y si los extremos son inclusivos. El coste es `O(n log n)` por ordenar.

```ts
function mergeIntervals(input: readonly (readonly [number, number])[]): [number, number][] {
  const sorted = [...input].sort((a, b) => a[0] - b[0]);
  const result: [number, number][] = [];
  for (const [start, end] of sorted) {
    const previous = result[result.length - 1];
    if (previous !== undefined && start <= previous[1]) {
      previous[1] = Math.max(previous[1], end);
    } else {
      result.push([start, end]);
    }
  }
  return result;
}
```

## Búsqueda binaria: primer valor al menos target

Usa [left, right) con right igual a la longitud. Mantén la respuesta en el rango y reduce un lado en cada paso. Devuelve length si ninguno cumple. Calcula el punto medio con los límites actuales; prueba vacío, extremos y target mayor que todo.

```ts
function lowerBound(values: readonly number[], target: number): number {
  let left = 0;
  let right = values.length;
  while (left < right) {
    const mid = left + Math.floor((right - left) / 2);
    if (values[mid]! < target) left = mid + 1;
    else right = mid;
  }
  return left;
}
```

## BFS, DFS y heaps

BFS explora niveles y encuentra caminos mínimos en grafos sin pesos. DFS sirve para alcance y ciclos. Marca visitados al encolar y usa un índice de cabeza en lugar de shift. Un heap extrae prioridad en `O(log n)`, pero no mantiene un array completamente ordenado. Esta introducción no sustituye una preparación avanzada de programación dinámica.

## Práctica

Resuelve Two Sum en [2,7,11,15] con 9; longitud sin repetidos en "abba"; primer índice ≥5 en [1,5,5,9]; combina [1,6] con [2,3].

### Spoiler

Resultados: [0,1], longitud 2, índice 1 y [1,6]. Explica el invariante antes de optimizar. max protege tanto el final de intervalos como el avance de la ventana.

## Si te atascas

Escribe una solución sencilla correcta, estima coste, encuentra trabajo repetido y elige la estructura que lo elimina. Traza un contraejemplo pequeño. Reconocer un patrón no basta: justifica que su invariante corresponde al contrato.
