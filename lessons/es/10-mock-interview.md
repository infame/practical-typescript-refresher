# Simulación de entrevista backend

Un ejercicio de 45–60 minutos sobre procesamiento de datos backend. Aclara el contrato, escribe la implementación y después compárala con el spoiler.

La referencia ejecutable está en `examples/core.ts`; sus tests, en `examples/core.test.ts`. Los bloques siguientes comparten contexto.

## El ejercicio

Implementa `importUpdates(raw, repository, concurrency)`. La entrada es `readonly unknown[]`.

Cada actualización válida contiene:

- `sourceId`: una cadena no vacía ni compuesta solo por espacios que identifica el sistema o fuente.
- `eventId`: una cadena no vacía ni compuesta solo por espacios que identifica un evento dentro de esa fuente.
- `listingId`: una cadena no vacía ni compuesta solo por espacios que identifica la entidad dentro de esa fuente.
- `version`: un entero seguro no negativo que ordena el estado de esa entidad.
- `price`: un número finito no negativo. Las cadenas numéricas son inválidas; cero es válido.

La clave de estado es **`(sourceId, listingId)`**. Conserva la máxima `version` almacenada por clave. Las versiones iguales son inmutables y se omiten. Este ejercicio no tiene efectos externos adicionales.

El importador debe:

1. Devolver exactamente un resultado por entrada, en el orden de entrada.
2. Informar una entrada mal formada como `invalid`, con índice y explicación.
3. Informar una escritura completada como `applied` o `stale`, con índice y `eventId`.
4. Informar un error del repositorio como `failed` y continuar con las demás entradas.
5. Mantener como máximo `concurrency` llamadas activas al repositorio y esperar a que terminen.
6. No modificar los objetos de entrada.

`concurrency` debe ser un entero positivo; un valor inválido rechaza toda la llamada, incluso con un lote vacío. Los errores de registros individuales forman parte del informe.

**No elimines valores `eventId` repetidos antes de procesar.** Hace falta un resultado por entrada. La condición atómica de versión proporciona idempotencia del estado; deduplicar entregas es otro contrato.

## Plan de una hora

| Tiempo | Objetivo |
| --- | --- |
| 0–5 min | Aclarar ámbito de claves, versiones iguales, fallos parciales y orden. |
| 5–15 min | Definir tipos e implementar validación. |
| 15–30 min | Conectar el limitador, el repositorio y el informe. |
| 30–45 min | Probar entrada inválida, versiones fuera de orden y una escritura fallida. |
| 45–60 min | Explicar garantías, complejidad y extensiones. |

Prepara el entorno antes del cronómetro. Si falta tiempo, termina primero un camino secuencial correcto y añade después concurrencia limitada.

## Contratos iniciales

`Repository.upsertIfNewer` debe ser **atómico**: comparar la versión y escribir en una sola operación del almacenamiento. El importador no puede sustituir esa garantía por una lectura y escritura separadas. No necesitas implementar una base de datos real.

Separa responsabilidades:

- `parseUpdate` valida un valor externo y devuelve un `ListingUpdate` nuevo.
- `mapLimit` limita el trabajo activo y conserva las posiciones de resultado.
- `importUpdates` convierte fallos esperados por registro en valores del informe.

```ts
type ListingUpdate = {
  sourceId: string;
  eventId: string;
  listingId: string;
  version: number;
  price: number;
};

interface Repository {
  upsertIfNewer(update: ListingUpdate): Promise<"applied" | "stale">;
}

type ImportResult =
  | { status: "applied" | "stale"; index: number; eventId: string }
  | { status: "invalid"; index: number; message: string }
  | { status: "failed"; index: number; eventId: string; message: string };
```

## Práctica

Implementa parser, limitador e importador antes de abrir la respuesta. Incluye estos casos:

- La entidad A en v5, seguida de A en v3.
- Una cadena numérica inválida y un cero válido.
- La entidad B en v1 cuya escritura falla.
- Una actualización A/v5 repetida.
- Concurrencia inválida, también con entrada vacía.

Comprueba el orden de resultados, las versiones finales y la finalización del trabajo activo. Distingue la garantía de estado final de la clasificación de cada escritura.

### Spoiler

Si A/v5 se aplica antes de A/v3, sus resultados son `applied` y `stale`. Si v3 llega primero al almacenamiento, ambas pueden ser `applied`; el estado final sigue siendo v5.

**El contrato garantiza la máxima versión final, no una clasificación idéntica de cada registro con cualquier orden de ejecución.** La entrada inválida produce `invalid`; el fallo de B produce `failed`; una versión igual no modifica el estado.

```ts
async function importUpdates(
  raw: readonly unknown[],
  repository: Repository,
  concurrency: number,
): Promise<ImportResult[]> {
  return mapLimit(raw, concurrency, async (value, index): Promise<ImportResult> => {
    let update: ListingUpdate;
    try {
      update = parseUpdate(value);
    } catch (error) {
      return { status: "invalid", index, message: messageOf(error) };
    }
    try {
      const status = await repository.upsertIfNewer(update);
      return { status, index, eventId: update.eventId };
    } catch (error) {
      return {
        status: "failed", index, eventId: update.eventId,
        message: messageOf(error),
      };
    }
  });
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
```

El parser crea un objeto validado nuevo. Los bloques `catch` locales convierten fallos individuales en resultados, por lo que una escritura fallida no detiene el lote. `mapLimit` conserva posiciones y espera el trabajo activo.

## Extensión: efectos y replay

Supón que una actualización `applied` también debe enviar una notificación. Una caída tras escribir pero antes de enviar hace que el replay sea `stale`, y puede perderse la notificación.

Registra el efecto de forma duradera, por ejemplo con un outbox en la misma transacción que la actualización. La entrega aún necesita una política de idempotencia o deduplicación. Un set en memoria no proporciona coordinación duradera.

## Extensión: flujo ilimitado

La API actual conserva toda la entrada y salida: **`O(n)` de memoria**. Para un flujo grande usa iteración asíncrona, trabajo activo acotado e informe incremental.

Define backpressure y un checkpoint duradero. Un orden de salida estricto permite que el primer elemento lento retrase otros ya completados; limita también ese búfer, no solo el trabajo activo.

## Extensión: orden por clave

Un límite global de concurrencia no serializa actualizaciones de una entidad. La escritura atómica de máxima versión basta para este contrato de selección de estado.

Incrementos, transiciones o efectos intermedios pueden necesitar una cola por partición, un bloqueo por clave u otra operación de negocio atómica. Define el orden requerido antes de elegir el mecanismo.

## Extensión: reintentos

Reintenta solo fallos transitorios seleccionados de operaciones seguras para repetir, con intentos y tiempo total acotados.

Un timeout puede significar «se escribió, pero se perdió la respuesta». Repetir el upsert puede devolver `stale` y conservar un estado correcto. Si importa distinguir `applied` de `stale`, define cómo informar el resultado incierto del primer intento.

## Evaluar la tentativa

Revisa cinco aspectos:

- **Contrato:** ¿son explícitos el ámbito, los empates y el orden de resultados?
- **Validación:** ¿se gestionan entrada inválida y cero válido?
- **Concurrencia:** ¿se limita el trabajo activo y se espera su finalización?
- **Fallos:** ¿se conservan otros resultados y la garantía de estado final?
- **Explicación:** ¿puedes justificar la implementación con tests útiles?

Ejecuta `npm test` y `npm run check`. El repositorio en memoria es un doble de prueba; una base de datos real necesita tests de integración para escrituras atómicas y restricciones.

## Antes de la entrevista

Confirma con el reclutador el lenguaje, entorno, duración y reglas sobre documentación o AI. Practica cómo ejecutar compilador y tests antes de la ronda.

Explica requisitos, algoritmo, implementación, ejemplos, complejidad y límites en ese orden. Tras revisar la respuesta, cambia una entrada o política de fallos e implementa la variante por tu cuenta.
