# Eventos, idempotencia y base de datos

Repaso práctico. Lee el contrato, traza los ejemplos e intenta el ejercicio antes de abrir la respuesta. Algunos bloques comparten contexto; solo `ts check` identifica comprobaciones independientes.

## Duplicados y versiones antiguas

Una entrega duplicada pregunta si ya procesaste el evento; una actualización antigua pregunta si existe una versión posterior de la entidad. Las claves son diferentes. Las versiones de fuentes distintas no se comparan automáticamente. Usa una clave compuesta salvo que el dominio defina un orden común. Resolver identidad entre proveedores es otro problema de negocio.

## La carrera de buscar e insertar

Dos callers pueden observar que no hay registro antes de insertar. Una comprobación JS no sustituye una restricción única en la base. La condición debe combinarse con la escritura. Una transacción no elimina la necesidad de elegir bien unicidad, aislamiento y sentencia atómica.

```ts
const existing = await db.find(id);
if (!existing) await db.insert(record);
else await db.update(id, record);
```

## Upsert condicional

INSERT ON CONFLICT con condición de versión mantiene el máximo pese a concurrencia. RETURNING diferencia aplicado y omitido. La restricción única debe coincidir con el conflict target. Aquí las versiones iguales se omiten y deben tener payload inmutable o una política de conflicto. Esto protege estado, no efectos externos.

```sql
CREATE TABLE listings (
  source_id text NOT NULL,
  listing_id text NOT NULL,
  version bigint NOT NULL CHECK (version >= 0),
  price_cents bigint NOT NULL CHECK (price_cents >= 0),
  PRIMARY KEY (source_id, listing_id)
);

INSERT INTO listings (source_id, listing_id, version, price_cents)
VALUES ($1, $2, $3, $4)
ON CONFLICT (source_id, listing_id)
DO UPDATE SET
  version = EXCLUDED.version,
  price_cents = EXCLUDED.price_cents
WHERE EXCLUDED.version > listings.version
RETURNING source_id, listing_id, version;
```

## Efectos idempotentes

Un correo o pago no se vuelve seguro al repetirlo solo por usar upsert condicional. Guarda marcador inbox y cambios de base en la misma transacción; outbox registra publicación pendiente atómicamente. El consumidor aún necesita idempotencia o deduplicación. Explica la ventana entre commit y entrega en lugar de prometer exactly-once sin condiciones.

## Borrado y eventos antiguos

Borrar físicamente v5 permite que v3 recree la entidad. Un tombstone conserva borrado y versión para rechazar lo antiguo. Su retención depende de replay y recuperación. Si la fuente reinicia versiones, necesitas un epoch u otro identificador de generación.

## Escribir SQL a mano

ROW_NUMBER por clave selecciona la fila reciente con desempate determinista. LEFT JOIN debe conservar filas sin coincidencia; respeta la semántica de null al contar. Elige índices según predicados y joins, y mira el plan real. Los ejemplos SQL requieren esquema y base apropiados para ejecutarse.

```sql
SELECT source_id, listing_id, price_cents, updated_at
FROM (
  SELECT e.*,
    ROW_NUMBER() OVER (
      PARTITION BY source_id, listing_id
      ORDER BY updated_at DESC, event_id DESC
    ) AS rn
  FROM listing_events e
) ranked
WHERE rn = 1;
```

```sql
SELECT source_id, COUNT(*) AS total, AVG(price_cents) AS avg_price
FROM listings
GROUP BY source_id;
```

## Práctica

v5 y v3 de la misma entidad terminan en orden inverso. ¿Qué protege el estado? ¿Qué cambia si envían correos?

### Spoiler

Una escritura condicional atómica mantiene v5. Para el correo necesitas identidad de entrega, inbox/outbox duradero y consumidor tolerante a replay. Un Set local desaparece al reiniciar y no coordina workers de procesos distintos.

## Referencias oficiales

- [Node.js: sql-insert](https://www.postgresql.org/docs/current/sql-insert.html)
