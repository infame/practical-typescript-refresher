# Simulación de entrevista backend

Repaso práctico. Lee el contrato, traza los ejemplos e intenta el ejercicio antes de abrir la respuesta. Algunos bloques comparten contexto; solo `ts check` identifica comprobaciones independientes.

## El ejercicio

Implementa importUpdates(raw, repository, concurrency). Entradas unknown con sourceId, eventId e ID de entidad no vacíos, version entero seguro no negativo y métrica finita no negativa. Mantén máximo por fuente/entidad y omite versiones iguales. Informa entradas inválidas, aplicadas, antiguas y fallidas. Versiones iguales tienen payload inmutable; no hay efectos externos adicionales.

## Plan de una hora

Primero aclara validación, ámbito de claves, orden y fallos. Define tipos y un camino completo, después limiter e informe. Reserva el final para casos límite y explicación. Una solución simple correcta con supuestos claros es mejor que una abstracción incompleta. Prepara el entorno antes del tiempo medido.

## Contratos iniciales

El repositorio ofrece upsertIfNewer atómico; el importer no debe leer y escribir por separado. El parser valida unknown. El helper concurrente es genérico; el caller decide si errores por registro son valores. examples/core.ts es la referencia ejecutable; los ejemplos por dominio conservan el algoritmo.

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

Escribe antes de abrir la respuesta. Prueba entrada inválida, cero, v5 antes de v3, igualdad, fallo de escritura y finalización del trabajo activo.

### Spoiler

Valida en la frontera, elige claves correctas, limita concurrencia y espera las llamadas incluidas en el contrato de retorno. La referencia usa escritura atómica y registra errores esperados en el informe.

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

## Extensión: efectos y replay

Si se envía un mensaje o cambia otro recurso, seleccionar versiones no basta. Añade inbox/outbox e idempotencia downstream; explica recuperación en cada punto de caída. La deduplicación en memoria no es coordinación duradera.

## Extensión: flujo ilimitado

Sustituye arrays completos por async iteration, trabajo acotado e informe incremental. Define backpressure y checkpoint duradero. No conserves cada eventId indefinidamente sin política de retención o almacenamiento.

## Extensión: orden por clave

Un límite global no serializa una entidad. Máximo atómico es correcto para este contrato de estado. Incrementos, transiciones y efectos intermedios pueden requerir particiones, lock por clave u otro protocolo transaccional.

## Extensión: reintentos

Reintenta fallos transitorios seleccionados con intentos y tiempo acotados. Determina qué operación soporta replay; un timeout no prueba que la escritura no ocurrió. Separa retry, deduplicación y selección de versión.

## Evaluar la tentativa

Cuenta requisitos y tests, pero también assertions inseguras, supuestos sin explicar y ayudas usadas. Leer una respuesta no equivale a implementarla. Repite con entradas y políticas distintas.

## Antes de la entrevista

Ejecuta el proyecto, revisa configuración y practica con tiempo. Este ejercicio es backend/datos, no una garantía universal. Frontend, frameworks, system design y algoritmos avanzados requieren preparación aparte.
