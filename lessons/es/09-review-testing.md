# Code review, depuración y pruebas

Repaso práctico. Lee el contrato, traza los ejemplos e intenta el ejercicio antes de abrir la respuesta. Algunos bloques comparten contexto; solo `ts check` identifica comprobaciones independientes.

## Revisar un importer roto

Busca async forEach sin espera, deduplicación con ámbito equivocado, truthiness que elimina cero, assertion que finge validar y una carrera read-then-write. Comprueba tanto el informe devuelto como cuándo termina realmente la función. Revisa el contrato antes de optimizar.

```ts
async function importListings(records: any[]) {
  const errors: string[] = [];
  records.forEach(async record => {
    try {
      if (!record.price) return;
      const current = await db.find(record.id);
      if (!current) {
        await db.insert(record);
      } else {
        await db.update(record.id, record);
      }
    } catch (error: any) {
      errors.push(error.message);
    }
  });
  return { imported: records.length, errors };
}
```

### Spoiler

Compara la implementación con el contrato y explica qué comprobación establece cada garantía antes de intentar otra variante.

## Explicar el bug con evidencia

Da una entrada concreta, resultado esperado y comportamiento real. Señala el invariante incumplido. Para async, muestra la secuencia temporal de operaciones. Un reproducer mínimo comunica más que una opinión sobre estilo.

## Probar mediante dependencias

Inyecta repositorio o transporte. El fake registra llamadas, aplaza finalización o devuelve el error elegido. Comprueba validación, ámbito de claves, finalización real y política de fallos. No copies la implementación al test; simula solo la frontera necesaria. Promises diferidas hacen determinista la concurrencia.

```ts
interface Repository {
  upsertIfNewer(update: ListingUpdate): Promise<"applied" | "stale">;
}
```

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { mapLimit } from "./core.ts";

test("respects concurrency", async () => {
  let active = 0;
  let peak = 0;
  const result = await mapLimit([1, 2, 3, 4], 2, async value => {
    active++;
    peak = Math.max(peak, active);
    await new Promise(resolve => setTimeout(resolve, 5));
    active--;
    return value * 2;
  });
  assert.deepEqual(result, [2, 4, 6, 8]);
  assert.equal(peak, 2);
});
```

## Casos de borde

Incluye vacío, cero, null, campos ausentes, duplicados, versiones iguales e inversas, límite inválido, throw síncrono, throw undefined y finalización inversa. Comprueba no mutación cuando se promete. Concurrencia, orden de salida y orden por clave requieren comprobaciones distintas.

## Un ciclo de depuración mínimo

Reproduce el fallo más pequeño, clasifícalo como contrato, datos, tipos, ejecución o scheduling y cambia una causa. Añade regresión para comportamiento importante. Ejecuta typecheck y test relevante. Los logs deben identificar la operación sin volcar secretos o payloads enormes.

## Práctica

Un callback del limiter rechaza mientras otros siguen activos. ¿Qué decisiones debe comprobar el test?

### Spoiler

Comprueba nuevos inicios, espera o cancelación del trabajo activo, selección del error y momento del rechazo. El test debe seguir la política elegida, no suponer que todos los limiters funcionan igual.

## Explicar la corrección

Describe entrada desencadenante, cambio de comportamiento y prueba. “Ahora espera la finalización del repositorio” expresa una garantía observable; mencionar await por sí solo no.
