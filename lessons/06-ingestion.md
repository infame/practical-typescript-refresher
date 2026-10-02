# Загрузка данных: страницы, timeout и retry

Цель: загрузить данные из внешнего API так, чтобы частичный сбой не превращался в молчаливую потерю данных. Здесь важны границы ответственности: транспорт, проверка данных, обработка и сохранение прогресса.

## 1. HTTP-ошибка не всегда rejection

fetch обычно отклоняется при сетевой ошибке или отмене, но HTTP 404/429/500 возвращает Response. Нужно проверить response.ok. Парсинг JSON тоже может завершиться ошибкой, и успешный JSON ещё не гарантирует нужную структуру.

```ts
async function fetchJson(url: string, timeoutMs: number): Promise<unknown> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new RangeError("timeoutMs must be positive and finite");
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) {
      await response.body?.cancel();
      throw new Error(`HTTP ${response.status}`);
    }
    const value: unknown = await response.json();
    return value;
  } finally {
    clearTimeout(timer);
  }
}
```

Timer действует и во время чтения тела, потому что response.json ожидается внутри try. Это учебный GET-helper: для политики retry лучше отдельный HttpError с числовым status и Retry-After, а не разбор строки message. Очень большие timeout нужно ограничивать с учётом диапазона таймеров runtime.

Promise.race с таймером только прекращает ожидание победившего результата; сам запрос автоматически не отменяется. AbortSignal передаёт запрос на отмену поддерживающей его операции. Он не откатывает уже выполненную запись на удалённом сервере. Таймер также не способен прервать блокирующий синхронный JS.

## 2. Какие ошибки повторять

Обычно имеет смысл повторять временные сетевые сбои, 429 и некоторые 5xx. Ошибка валидации или 400 из-за неверного запроса чаще требует исправления данных. 401 требует решения вопроса авторизации, а не бесконечного повторения того же запроса.

Повтор безопасен только с учётом операции. GET обычно допускает повтор, но POST с побочным эффектом может требовать idempotency key. Timeout записи не доказывает, что запись не произошла: сервер мог успеть сохранить данные, а ответ потерялся.

```ts
const sleep = (ms: number) =>
  new Promise<void>(resolve => setTimeout(resolve, ms));

async function retry<T>(
  operation: () => Promise<T>,
  attempts: number,
  shouldRetry: (error: unknown) => boolean,
): Promise<T> {
  if (!Number.isInteger(attempts) || attempts < 1) {
    throw new RangeError("attempts must be a positive integer");
  }
  for (let attempt = 0; attempt < attempts; attempt++) {
    try {
      return await operation();
    } catch (error) {
      if (attempt === attempts - 1 || !shouldRetry(error)) throw error;
      const ceiling = Math.min(5000, 200 * 2 ** attempt);
      await sleep(Math.random() * ceiling);
    }
  }
  throw new Error("Unreachable");
}
```

attempts включает первую попытку: attempts 3 — максимум три вызова, не четыре. Нужна функция, создающая новую операцию: повторное ожидание одного rejected Promise не отправляет новый запрос.

Exponential backoff увеличивает паузы; jitter разносит клиентов во времени. Для 429 учитывай Retry-After, который может быть числом секунд или HTTP-датой. Отдельно ограничивай весь бюджет времени: пять попыток по 10 секунд плюс паузы могут превысить срок запроса. Отмена пользователя должна прекращать и retry, и ожидание паузы; учебный sleep выше этого не реализует.

## 3. Cursor pagination

Cursor следующей страницы обычно узнаётся только после текущего ответа, поэтому нельзя просто запустить все страницы одновременно. Внутри страницы записи можно обрабатывать через mapLimit.

```ts
type Page<T> = { items: T[]; nextCursor: string | null };

async function* pages<T>(
  load: (cursor: string | undefined) => Promise<Page<T>>,
): AsyncGenerator<T[]> {
  let cursor: string | undefined;
  const seen = new Set<string>();
  while (true) {
    const page = await load(cursor);
    yield page.items;
    if (page.nextCursor === null) return;
    if (seen.has(page.nextCursor)) throw new Error("Cursor cycle");
    seen.add(page.nextCursor);
    cursor = page.nextCursor;
  }
}
```

`null` — конец по нашему контракту. Проверка через `if (!nextCursor)` была бы неверной, если пустая строка является допустимым cursor. Пустая страница сама по себе не обязательно означает конец.

```ts
for await (const batch of pages(loadPage)) {
  await mapLimit(batch, 8, processRecord);
}
```

Здесь следующая страница не загружается, пока текущая не обработана. Это простой способ не накапливать неограниченное количество работы. Память под записи ограничена страницей и её обработкой, но Set для защиты от циклов растёт с количеством cursors; при очень длинном импорте нужен отдельный ограниченный подход или лимит страниц.

## 4. Checkpoint и backpressure

Если записать checkpoint до успешной обработки страницы, падение может привести к пропуску данных. Если после — падение между обработкой и checkpoint приведёт к повторной обработке. Обычно выбирают второй вариант вместе с идемпотентностью. Это позволяет восстановиться без потери, хотя повторная доставка возможна.

При частичных ошибках реши: не продвигать checkpoint и повторить страницу либо надёжно сохранить неуспешные записи в retry-очередь перед продвижением. Просто вывести ошибку в console и перейти дальше — потеря данных.

Для больших файлов используй streams/async iteration вместо чтения всего файла в память. Backpressure означает, что медленный потребитель ограничивает скорость производителя. Node pipeline помогает связывать потоки и передавать ошибки; детали API — в [официальной документации Node streams](https://nodejs.org/api/stream.html).

## Практика

Страница содержит 100 записей. 99 сохранены, одна упала. Ты уже получил nextCursor. Можно ли его сохранить и идти дальше? Что будет, если вместо этого повторить всю страницу?

### Спойлер

Продвигать cursor безопасно, только если неуспешная запись уже надёжно поставлена на повтор или контракт допускает её пропуск. Повтор всей страницы допустим при идемпотентных записях: 99 обработанных событий не должны создавать повторные эффекты. Нужны счётчики applied/skipped/failed и контекст ошибки, чтобы не путать успешную загрузку с частичной.

> I'll separate transport retries from record validation, process one page with bounded concurrency, and advance the checkpoint only after the page has been durably handled.
