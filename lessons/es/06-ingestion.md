# Obtener datos: páginas, timeouts y reintentos

Repaso práctico. Lee el contrato, traza los ejemplos e intenta el ejercicio antes de abrir la respuesta. Algunos bloques comparten contexto; solo `ts check` identifica comprobaciones independientes.

## Un fallo HTTP no siempre rechaza

fetch puede resolver para 404, 429 o 500. Comprueba status u ok; luego analiza el cuerpo y valida su estructura. `Promise.race` deja de esperar pero no cancela la operación perdedora. Usa `AbortSignal` cuando la operación lo soporte y limpia timers en finally. Los ejemplos explican patrones, no una política universal de producción.

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

## Qué fallos reintentar

Reintenta solo fallos transitorios que el contrato permita repetir: algunos fallos de red, 429 y determinados 5xx. Un error de validación suele necesitar otra entrada. Limita intentos y tiempo total, usa backoff exponencial, jitter y considera Retry-After. Perder la respuesta de una escritura no demuestra que no se aplicó; necesitas idempotencia. Evita multiplicar reintentos en cada capa.

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

## Paginación con cursor

Obtén una página, procésala y avanza al siguiente cursor. Detecta cursores repetidos para no entrar en bucle. El API define consistencia y semántica del cursor; deduplicar no recupera registros que nunca llegaron. Define si un fallo detiene, reintenta o permite reanudar. No avances el checkpoint antes de completar los efectos duraderos.

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

```ts
for await (const batch of pages(loadPage)) {
  await mapLimit(batch, 8, processRecord);
}
```

## Checkpoint y backpressure

Procesa cada página con un límite y guarda su cursor tras el éxito. Así no retienes todo el dataset. El consumidor debe frenar al productor o mantener un buffer acotado. Un checkpoint representa efectos completados, no solo datos recibidos. La recuperación debe tolerar volver a procesar trabajo ya hecho.

## Práctica

El API repite un cursor sin fin y a veces devuelve 429. ¿Qué guardas, qué reintentas y cuándo escribes el checkpoint?

### Spoiler

Conserva cursores visitados u otra garantía de avance, limita reintentos y presupuesto temporal. Procesa la página con concurrencia acotada y después confirma el checkpoint. No conviertas payloads malformados en páginas vacías exitosas. El procesamiento debe soportar replay.

## Referencias oficiales

- [Node.js: stream](https://nodejs.org/api/stream.html)
