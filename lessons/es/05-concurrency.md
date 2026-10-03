# Implementar un límite de concurrencia

Repaso práctico. Lee el contrato, traza los ejemplos e intenta el ejercicio antes de abrir la respuesta. Algunos bloques comparten contexto; solo `ts check` identifica comprobaciones independientes.

## Definir el contrato

mapLimit acepta un array, un límite entero positivo y un callback async. Devuelve resultados en orden y ejecuta como máximo limit callbacks a la vez. Esta versión deja de programar al observar un fallo, espera el trabajo activo y rechaza con el primer error observado. Valida limit incluso con entrada vacía. Usa un booleano separado porque undefined puede ser un error lanzado.

## Workers en lugar de lotes

Crea como máximo min(limit, items.length) workers con un iterador síncrono compartido. Cada uno toma un índice, espera y guarda ahí su resultado. Al acabar, toma otra entrada sin esperar al más lento de un lote fijo. De este modo aprovechas la capacidad disponible y conservas el orden de salida.

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

## Por qué no duplican entradas

Tomar el siguiente elemento ocurre síncronamente antes de await: otro worker no puede intercalarse dentro de esa operación en este diseño de un solo hilo. No es una garantía para worker_threads o varios procesos. Tras el fallo, los activos terminan y consultan el indicador antes de pedir otra entrada.

## Fallos parciales como datos

Para continuar tras errores individuales, captura dentro del callback y devuelve una unión de éxito o fallo. El limiter conserva su política para fallos inesperados del wrapper. No sustituyas silenciosamente todo por null si el usuario necesita el motivo y la posición.

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

## Qué no garantiza el límite

Limitar concurrencia no limita peticiones por segundo ni implementa cancelación, presupuesto de reintentos u orden por clave. Una tarea bloqueada puede ocupar un worker para siempre. Arrays enormes siguen consumiendo memoria; un flujo ilimitado requiere backpressure y resultados incrementales.

## Práctica

Implementa sin mirar la respuesta. Prueba retrasos diferentes, un fallo temprano, throw síncrono, throw undefined y límite inválido con entrada vacía.

### Spoiler

Reserva el índice antes de await, guarda el primer error y un indicador independiente. Espera todos los workers activos antes de relanzar. No afirmes que el trabajo activo fue cancelado si solamente dejaste de programar nuevas entradas.

## Probar comportamiento

Cuenta operaciones activas y máximo, controla la finalización con promises diferidas y comprueba orden y ausencia de nuevos inicios tras observar un fallo. Evita tests basados en tiempos de reloj. Incluye límite uno y límite mayor que la longitud.

