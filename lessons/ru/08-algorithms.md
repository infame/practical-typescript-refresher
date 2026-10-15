# Алгоритмические шаблоны на TypeScript

Цель: узнавать структуру задачи и спокойно писать базовое решение. Ниже тренировочные шаблоны для практических задач. Всегда сначала уточни контракт и оцени простое решение.

## 1. Hash map: Two Sum

Нужно найти индексы двух разных элементов, сумма которых равна target. Для каждого числа ищем дополнение среди уже просмотренных. Проверка до вставки не позволяет использовать один элемент дважды.

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

Время `O(n)`, память `O(n)`. Не пиши `if (previous)`: индекс 0 допустим. Для `[3, 3]`, target 6 возвращаем `[0, 1]`. Уточни, нужен один ответ или все пары: это разные задачи.

## 2. Two pointers на отсортированном массиве

Если числа уже отсортированы, держим указатели на концах. Сумма слишком мала — увеличиваем левый элемент; слишком велика — уменьшаем правый. Так отбрасываем заведомо неподходящие пары.

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

Non-`null` assertions здесь опираются на доказанные границы цикла и плотный массив; это не способ скрыть отсутствие проверки внешних данных. Время `O(n)`, дополнительная память `O(1)`. Если пришлось сначала сортировать, учти `O(n log n)` и потерю исходных индексов.

## 3. Sliding window: самая длинная подстрока без повторов

Окно хранит диапазон, в котором символы уникальны. Правый край расширяется на каждом шаге; левый перескакивает за предыдущее вхождение повторившегося символа, но никогда не движется назад.

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

`O(n)` по числу Unicode code points. `for...of` идёт по code points, не по UTF-16 units, но составной видимый символ с модификаторами может включать несколько code points. Для задачи уточни ASCII/code points/graphemes. Не усложняй без требования, но знай границу.

Почему Math.max? В `abba` последнее a было до текущего левого края. Без max окно ошибочно сдвинется назад.

## 4. Stack: скобки

Для открывающей скобки кладём ожидаемую закрывающую. Для закрывающей проверяем вершину. Пустой стек в конце обязателен: строка `((` не должна пройти.

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

Этот контракт игнорирует прочие символы. Если вход должен состоять только из скобок, неизвестные символы надо отвергать. Время `O(n)`, память `O(n)`.

## 5. Интервалы

Для объединения диапазонов отсортируй по началу. Держи последний объединённый диапазон. Если следующий пересекается, расширь конец до максимального; иначе начни новый.

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

Входные пары не мутируем. Здесь касающиеся интервалы объединяются. Для полуоткрытых диапазонов и иной семантики касания сравнение нужно изменить. Предполагаем start ≤ end. Сложность `O(n log n)`.

## 6. Binary search: первая позиция не меньше target

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

Интервал поиска полуоткрытый `[left, right)`. Ответ может равняться длине: все элементы меньше target. Проверяй пустой массив, значение до всех, после всех и дубликаты. Не смешивай разные варианты границ из разных шаблонов.

## 7. BFS, DFS и heap

BFS — очередь, подходит для кратчайшего пути по количеству рёбер в невзвешенном графе. Помечай вершину посещённой при добавлении в очередь, иначе она попадёт туда много раз. Вместо повторного `shift()` используй массив и индекс head: `while (head < queue.length) { const node = queue[head++]; ... }`. Для долгоживущей очереди учитывай освобождение памяти.

DFS — стек или рекурсия, подходит для обхода и связности. Глубокая рекурсия может переполнить стек JS. Для цикла в ориентированном графе одного visited недостаточно: нужно различать вершины в текущем пути и полностью обработанные.

Для top K на большом потоке min-heap размера K даёт `O(n log K)`, память `O(K)`. В стандартном JS нет встроенного общего PriorityQueue: уточни доступные библиотеки. На маленьком массиве сортировка часто проще и достаточна. Сложный DP оставь после уверенного освоения этих шаблонов.

## Практика

Без выполнения: `twoSum([2, 7, 2], 4)`; `longestUnique("abba")`; `lowerBound([1, 3, 3, 8], 3)`; объединение `[1,4], [2,3], [4,6]`.

### Спойлер

Индексы `[0, 2]`; длина 2; позиция 1; интервал `[1,6]`. Во вложенном интервале нельзя просто присвоить end следующего диапазона: поэтому используется max.

## Как не зависнуть

Произнеси простой вариант, назови повторяющуюся работу, выбери структуру для её устранения. Если не видишь оптимизацию, напиши корректный простой код и проверь примеры. Рабочее решение с честной сложностью лучше, чем молчание в поисках идеального шаблона.
