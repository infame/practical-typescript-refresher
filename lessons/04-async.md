# Асинхронность и event loop

Цель: понимать, когда работа запускается, что именно ждёт await и что случается при ошибке. Представляй async как координацию операций, а не автоматическое выполнение JavaScript на нескольких ядрах.

## 1. Когда начинается работа

Вызов async-функции сразу выполняет её синхронную часть до первого await. Функция возвращает Promise. Await приостанавливает продолжение конкретной async-функции, а не весь процесс.

```ts
async function example() {
  console.log("B");
  await Promise.resolve();
  console.log("D");
}
console.log("A");
const promise = example();
console.log("C");
await promise;
// A, B, C, D
```

Даже await уже исполненного Promise переносит продолжение в microtask. Executor в `new Promise(executor)` вызывается синхронно. Сам Promise обычно представляет уже начатую работу; это не ленивое описание будущей операции.

```ts
const first = fetchFirst();
const second = fetchSecond();
const a = await first;
const b = await second;
```

Обе операции вызваны до первого await. Но такой способ ожидания неудобен для ошибок: second может отклониться до того, как до него дойдёт обработчик. Для независимых операций лучше сразу объединить их через Promise.all.

## 2. Последовательно или конкурентно

```ts
const results = [];
for (const item of items) {
  results.push(await processItem(item));
}
```

Здесь одновременно активна одна операция. Это может быть правильно, если порядок обязателен или следующий шаг зависит от предыдущего. Если каждая операция занимает 100 мс, десять последовательных операций займут примерно секунду без учёта накладных расходов.

```ts
const results = await Promise.all(items.map(processItem));
```

`map` вызывает processItem для всех элементов; Promise.all собирает результаты. Для независимых I/O это может существенно сократить общее время. Но одновременно можно перегрузить API, connection pool или память. Promise.all не устанавливает лимит.

Результаты Promise.all идут в порядке входа, даже если операции завершились иначе. При первом rejection общий Promise отклоняется. Остальные операции автоматически не отменяются и могут успеть выполнить побочные эффекты.

При частичном успехе полезен Promise.allSettled:

```ts
const outcomes = await Promise.allSettled(items.map(processItem));
for (const outcome of outcomes) {
  if (outcome.status === "fulfilled") console.log(outcome.value);
  else console.error(outcome.reason);
}
```

Он ждёт завершения всех Promise, но тоже не ограничивает concurrency. «Дождаться всех» и «не перегрузить downstream» — две разные задачи.

## 3. Ошибки и потерянный await

```ts
async function broken(items: Item[]) {
  items.forEach(async item => {
    await save(item);
  });
  return "done";
}
```

forEach игнорирует возвращаемые Promise. Функция вернёт done, пока сохранения ещё выполняются; ошибки могут остаться необработанными. Используй for...of с await либо Promise.all с map — в зависимости от контракта.

Другой тонкий случай:

```ts
async function load() {
  try {
    return await fetchData();
  } catch (error) {
    throw new Error("Load failed", { cause: error });
  }
}
```

Здесь await нужен, чтобы rejection попал в локальный catch. Если вернуть Promise без await, более позднее отклонение не будет поймано этим catch. В простом wrapper без локальной обработки ошибок можно просто `return fetchData()`.

Не превращай любую ошибку в `[]`: вызывающий код не сможет отличить «данных нет» от «сервис недоступен». Либо пробрасывай ошибку, либо возвращай явно помеченный результат.

## 4. Event loop без лишней магии

Синхронный JavaScript выполняется до конца текущего стека. Продолжения Promise и queueMicrotask выполняются через очередь microtasks. Таймер не прерывает текущий стек: нулевая задержка не означает «сейчас».

```ts
console.log("A");
setTimeout(() => console.log("B"), 0);
Promise.resolve()
  .then(() => console.log("C"))
  .then(() => console.log("D"));
queueMicrotask(() => console.log("E"));
console.log("F");
```

Для этого самодостаточного примера: A, F, C, E, D, B. Первый then уже в очереди, второй then добавляется после выполнения первого, поэтому E оказывается раньше D.

Не распространяй это на все возможные сочетания Node nextTick, setImmediate, I/O callbacks и ESM/CJS: их порядок зависит от контекста. На практике важнее не блокировать event loop большим синхронным вычислением.

`async function heavy() { expensiveCalculation(); }` не делает расчёт неблокирующим. Для CPU-heavy работы рассматривают worker threads или отдельные процессы. Конкурентное ожидание сети и параллельное вычисление на ядрах — разные вещи.

## 5. Гонки возможны и на одном JS-потоке

```ts
async function increment() {
  const old = counter;
  await delay();
  counter = old + 1;
}
```

Два вызова могут прочитать одно значение до await и записать одинаковый результат. Чередование происходит на точках ожидания. В базе такую read-modify-write операцию часто заменяют атомарным `SET counter = counter + 1`.

## Практика

Три запроса начаты через Promise.all: A завершится через 50 мс, B отклонится через 10 мс, C сохранит запись через 80 мс. Когда сработает catch? Сохранится ли C? Как получить отчёт по всем трём?

### Спойлер

Catch сможет сработать после rejection B, не ожидая A и C. C продолжает работу и может сохранить запись. Отмена требует отдельного протокола, например AbortSignal, который должна поддерживать операция; уже совершённый эффект он не откатывает. Для отчёта по всем трём используй allSettled. Для ограничения числа активных запросов нужен отдельный worker pool.

## Что сказать на интервью

> Promise.all preserves input order and rejects on the first rejection, but it does not cancel the remaining work or limit concurrency.

Семантику агрегирования Promise можно сверить в [MDN Promise.all](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all).
