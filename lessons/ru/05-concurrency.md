# Реализуем mapLimit

Цель: написать рабочий ограничитель конкурентных операций без библиотеки и объяснить его поведение при ошибках. Полная реализация находится также в `examples/core.ts`; её проверяют автоматические тесты.

## 1. Сначала контракт

Функция принимает массив, положительный целый limit и async-callback. Возвращает результаты в порядке входа. Одновременно активны не более limit callback-вызовов. Пустой вход возвращает пустой результат. Некорректный limit отклоняется даже для пустого входа.

Для ошибок выбираем точное правило: как только worker наблюдает первую ошибку, новые элементы больше не берём; уже начатые операции дожидаются завершения; затем отклоняем общий Promise первой наблюдённой ошибкой. Это не мгновенный fail-fast и не отмена. Зависшая операция задержит завершение — поэтому timeout операции является отдельной ответственностью.

Не меняем входной массив во время работы. Пример рассчитан на обычный плотный массив.

## 2. Почему workers, а не пачки

Пачки по три тоже ограничивают concurrency, но ждут самого медленного элемента каждой пачки. Если один запрос занимает секунду, а два других 10 мс, два места простаивают почти секунду. Workers берут следующий элемент сразу после освобождения места.

Представь несколько кассиров и одну очередь. Каждый берёт следующего покупателя, обслуживает и возвращается к очереди. Число кассиров и есть лимит.

```ts
async function mapLimit<T, R>(
  items: readonly T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new RangeError("limit must be a positive integer");
  }

  const iterator = items.entries();
  const results: R[] = new Array(items.length);
  let failed = false;
  let firstError: unknown;

  async function worker(): Promise<void> {
    while (!failed) {
      const next = iterator.next();
      if (next.done) return;
      const [index, item] = next.value;
      try {
        results[index] = await fn(item, index);
      } catch (error) {
        if (!failed) {
          failed = true;
          firstError = error;
        }
        return;
      }
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, () => worker()),
  );
  if (failed) throw firstError;
  return results;
}
```

## 3. Почему два workers не возьмут один элемент

Получение `iterator.next()` синхронно и происходит до await. В одном JS-потоке эти вызовы не исполняются одновременно. Worker A уже продвинул итератор, прежде чем управление сможет перейти к worker B. Отдельный mutex здесь не нужен.

Этот довод относится к общей очереди внутри одного JS-потока. Он не доказывает безопасность read-modify-write в базе, нескольких процессах или worker threads с shared memory.

`results[index]` сохраняет порядок входа независимо от порядка завершения. Если использовать `results.push`, получится порядок завершения — другой контракт.

Почему отдельный `failed`, а не проверка `firstError !== undefined`? В JavaScript разрешён `throw undefined`. Значение ошибки не годится как признак её наличия.

Try охватывает и вызов fn, и его await, поэтому ловит и синхронное исключение callback, и rejection. Promise.all здесь объединяет только workers, каждый из которых перехватывает свою ошибку. Поэтому общий await действительно дожидается уже запущенных операций.

## 4. Частичные результаты

Если нужно обработать все записи и вернуть индивидуальные ошибки, перехвати ошибку внутри callback и верни Result. Для mapLimit callback тогда завершился успешно, даже если бизнес-операция не удалась.

```ts
type Outcome<T> =
  | { ok: true; value: T }
  | { ok: false; error: unknown };

const outcomes = await mapLimit(items, 4, async (item): Promise<Outcome<Saved>> => {
  try {
    return { ok: true, value: await save(item) };
  } catch (error) {
    return { ok: false, error };
  }
});
```

Это не «проглотить ошибку»: ошибка представлена в результате и будет учтена вызывающим кодом. Решение о частичном успехе должно быть явным.

## 5. Что лимит не гарантирует

Четыре workers — не четыре запроса в секунду. Если запрос длится 10 мс, throughput может быть гораздо выше. Rate limit регулирует старт операций во времени; concurrency limit — число одновременно незавершённых операций.

Если один callback запускает пять запросов через Promise.all, limit 4 допускает до двадцати запросов. Лимитировать нужно на правильном уровне. CPU-heavy callback всё ещё блокирует event loop. Массив входа и результатов занимает O(n) памяти: это не streaming-решение для бесконечного потока.

## Практика

Limit равен 2. A длится 100 мс, B — 10 мс, C — 10 мс. В каком порядке они стартуют и заканчиваются? В каком порядке возвращаются результаты? Что изменится, если B отклонится?

### Спойлер

Сначала стартуют A и B. Через примерно 10 мс B освобождает worker, начинается C. Затем заканчивается C, потом A. Результат всё равно `[resultA, resultB, resultC]`. Если B отклонится, worker выставит failed, C не начнётся, уже запущенный A завершится, и затем mapLimit отклонится ошибкой B. Это описание предполагает указанные длительности и отсутствие других ошибок.

#### Правдоподобная ошибка: ограничить уже запущенные promises

```ts check
async function demonstrateEagerStart(): Promise<number[]> {
  let release: () => void = () => {};
  const gate = new Promise<void>(resolve => { release = resolve; });
  const started: number[] = [];
  const load = async (id: number): Promise<number> => {
    started.push(id);
    await gate;
    return id;
  };
  const promises = [1, 2, 3].map(load);
  // All three are active now; awaiting promises one by one cannot undo that.
  const beforeWaiting = [...started]; // [1, 2, 3]
  release();
  await Promise.all(promises);
  return beforeWaiting;
}
```

Workers должны получать элементы или функции запуска, а не работающие promises. При лимите два третий load не должен начинаться до завершения одного из первых. Gate показывает, что все вызовы начались и заблокированы ещё до ожидания потребителем. Фиксированные пары держат лимит, но простаивают после раннего завершения одной задачи; свободный worker должен сразу брать следующую.

## Что проверить тестами

Пустой вход, limit 1, limit больше длины, неправильный limit, максимум активных операций, порядок результата при разной длительности, ошибка и отсутствие новых стартов после её наблюдения. Дополнительно — `throw undefined` и синхронный throw.

> I'll use a fixed number of workers sharing an iterator. Each worker stores its result at the original index. On failure I'll stop scheduling and wait for in-flight work before rejecting.
