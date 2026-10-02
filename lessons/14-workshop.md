# Практикум: восстановить навык написания

Чтение создаёт узнавание, а упражнение показывает, можешь ли ты восстановить решение без подсказки. Здесь четыре задания с полными ответами. Решения также находятся в `examples/workshop.ts` и проверяются тестами. Не читай этот файл до собственной попытки.

## 1. Внешняя запись: parser

Время: 15 минут. Напиши parsePriceRecord(raw: unknown), возвращающий новый объект `{id:string, price:number}`. ID — непустая после trim строка; верни trimmed ID. Цена — конечное неотрицательное число либо строка десятичного формата: цифры, необязательная точка и цифры после неё. Пустоту, boolean, exponent, hex, Infinity, массивы и null отклоняй. Лишние поля не возвращай. Вход не меняй.

Почему отдельный формат? Number понимает больше представлений, чем разрешено в этом контракте. Парсинг нужно подчинить входному протоколу.

### Спойлер

```ts
export function parsePriceRecord(raw: unknown): { id: string; price: number } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error("Expected an object");
  }
  if (!("id" in raw) || typeof raw.id !== "string" || raw.id.trim() === "") {
    throw new Error("Invalid id");
  }
  if (!("price" in raw)) throw new Error("Missing price");
  let price: number;
  if (typeof raw.price === "number") {
    price = raw.price;
  } else if (typeof raw.price === "string" && /^\d+(\.\d+)?$/.test(raw.price.trim())) {
    price = Number(raw.price.trim());
  } else {
    throw new Error("Invalid price format");
  }
  if (!Number.isFinite(price) || price < 0) throw new Error("Invalid price");
  return { id: raw.id.trim(), price };
}
```

Проверь ноль числом и строкой, пробелы вокруг допустимого значения, пустую строку, `"1e3"`, `"12usd"`, очень длинную строку с переполнением в Infinity. Regex задаёт формат, а isFinite проверяет числовой результат. Это два разных слоя.

## 2. PATCH без случайной мутации

Время: 10 минут. Current содержит id, price:number|null, tags:readonly string[]. Patch может содержать price и tags. Отсутствие — сохранить; null цены — очистить; ноль — установить. Возвращаем новый объект и новый массив tags даже при отсутствии tags в patch.

### Спойлер

```ts
export type Current = { id: string; price: number | null; tags: readonly string[] };
export type Patch = { price?: number | null; tags?: readonly string[] };

export function applyPatch(current: Current, patch: Patch): Current {
  return {
    id: current.id,
    price: patch.price === undefined ? current.price : patch.price,
    tags: [...(patch.tags ?? current.tags)],
  };
}
```

Не делай `{...current,...patch}` без разбора семантики: это оставит общую ссылку на массив. Вход здесь уже типизирован и валиден. Parser для неизвестного PATCH был бы отдельной задачей.

## 3. Кэш async-запросов и concurrent callers

Время: 20 минут. Напиши memoizeAsync(load), возвращающий функцию загрузки по ключу. Одновременные вызовы одного ключа должны разделять один in-flight запрос. Успешный результат кэшируется, включая undefined. После ошибки следующий вызов должен повторить запрос. Синхронный throw load должен стать rejection. TTL и отмена не нужны.

Это другая задача, чем кэширование только готового значения: два вызова могут прийти до завершения первого и оба запустить загрузку. Нужно сохранить Promise сразу.

### Спойлер

```ts
export function memoizeAsync<K, V>(
  load: (key: K) => Promise<V>,
): (key: K) => Promise<V> {
  const cache = new Map<K, Promise<V>>();
  return key => {
    const existing = cache.get(key);
    if (existing !== undefined) return existing;

    const pending = Promise.resolve()
      .then(() => load(key))
      .catch(error => {
        cache.delete(key);
        throw error;
      });
    cache.set(key, pending);
    return pending;
  };
}
```

Promise создаётся и кладётся в Map до вызова load в microtask. Поэтому синхронный throw тоже попадёт в rejection, а concurrent callers найдут тот же pending. Мы проверяем Promise в Map, а не его value: успешный undefined не теряется. Catch удаляет неуспешную операцию и повторно бросает ошибку — вызывающие стороны узнают о сбое.

Map хранит успешные Promise неограниченно. Для production-кэша обычно нужны ограничение размера, срок жизни и политика инвалидации. Если добавишь принудительную инвалидацию во время in-flight загрузки, catch старой операции не должен удалить уже созданную новую — понадобится проверка идентичности Promise перед удалением. В нашем контракте такой операции нет.

## 4. Частичные ошибки как данные

Время: 15 минут. Есть массив ID и load(id). Верни по результату на каждый ID в исходном порядке, concurrency ограничен. Ошибка одного ID не останавливает другие. В failed верни message: Error.message либо String(error). Используй mapLimit из главы 5.

### Спойлер

```ts
import { mapLimit } from "./core.ts";

export type Outcome<T> =
  | { status: "loaded"; id: string; value: T }
  | { status: "failed"; id: string; message: string };

export function loadAll<T>(
  ids: readonly string[],
  limit: number,
  load: (id: string) => Promise<T>,
): Promise<Outcome<T>[]> {
  return mapLimit(ids, limit, async (id): Promise<Outcome<T>> => {
    try {
      return { status: "loaded", id, value: await load(id) };
    } catch (error) {
      return {
        status: "failed", id,
        message: error instanceof Error ? error.message : String(error),
      };
    }
  });
}
```

Callback успешно возвращает failed-вариант вместо rejection, поэтому mapLimit продолжает обработку. Ошибка invalid limit остаётся ошибкой всего вызова. Не подменяй failed пустым value: вызывающий код должен отличать отсутствие данных от ошибки.

## 5. Как измерять результат

Задача решена полностью, когда верны контракт, типы и крайние случаи. Частичный результат — полезная информация: например, основной сценарий работает, но parser принимает boolean или кэш запоминает rejection навсегда.

Запиши число задач, решённых без ответа, и причины ошибок. После разбора попробуй новую вариацию: другую форму данных, другую политику повторов, равные версии или неизвестный thrown value. Если просто перепечатать решение, тесты станут зелёными, но перенос навыка останется непроверенным.

Публичный benchmark репозитория находится в [документе оценки](../docs/EVALUATION.md). Он различает тесты корректности реализаций и эксперимент с обучением: хороший пример не доказывает, что читатель научился его писать.
