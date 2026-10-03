# Trabajo asíncrono y event loop

Repaso práctico. Lee el contrato, traza los ejemplos e intenta el ejercicio antes de abrir la respuesta. Algunos bloques comparten contexto; solo `ts check` identifica comprobaciones independientes.

## Cuándo empieza el trabajo

El executor de Promise se ejecuta inmediatamente. Una función async empieza al llamarla y se suspende en await. Guardar promises ya creadas no aplaza su trabajo: para controlar el inicio, guarda funciones o deja que los workers invoquen la operación. await no envía cálculo de CPU a otro hilo.

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

```ts
const first = fetchFirst();
const second = fetchSecond();
const a = await first;
const b = await second;
```

## Secuencial o concurrente

Un bucle con await ejecuta una operación después de otra. Promise.all espera operaciones independientes y conserva el orden de entrada de los resultados. map llama a todos los callbacks inmediatamente: Promise.all no limita concurrencia. Distingue dependencias de ejecución y orden de la salida.

```ts
const results = [];
for (const item of items) {
  results.push(await processItem(item));
}
```

```ts
const results = await Promise.all(items.map(processItem));
```

```ts
const outcomes = await Promise.allSettled(items.map(processItem));
for (const outcome of outcomes) {
  if (outcome.status === "fulfilled") console.log(outcome.value);
  else console.error(outcome.reason);
}
```

## Errores y await perdido

Una promise sin await puede escapar de try/catch, acabar después del resultado o rechazar sin handler. Espera dentro de try si quieres capturar el rechazo. Promise.all rechaza ante el primer fallo observado, pero no cancela el resto. allSettled recoge todos los resultados. finally limpia recursos; un return o throw allí puede sustituir el resultado original.

```ts
async function broken(items: Item[]) {
  items.forEach(async item => {
    await save(item);
  });
  return "done";
}
```

```ts
async function load() {
  try {
    return await fetchData();
  } catch (error) {
    throw new Error("Load failed", { cause: error });
  }
}
```

## Orden del event loop

El código síncrono acaba antes que los callbacks de promises. La continuación de await es una microtarea; los timers se ejecutan después y su retraso es un mínimo, no un instante garantizado. Cálculo síncrono prolongado bloquea callbacks y una cadena infinita de microtareas puede impedir otro trabajo. Node tiene colas adicionales; evita universalizar un ejemplo de navegador.

```ts
console.log("A");
setTimeout(() => console.log("B"), 0);
Promise.resolve()
  .then(() => console.log("C"))
  .then(() => console.log("D"));
queueMicrotask(() => console.log("E"));
console.log("F");
```

## Carreras en un solo hilo

Dos operaciones pueden leer un estado antes de que cualquiera vuelva de await y escriba. Un read-await-write no es atómico por tener un solo hilo JS. Usa cola por clave, escritura condicional o una transacción adecuada. Concurrencia y paralelismo de CPU son conceptos diferentes.

```ts
async function increment() {
  const old = counter;
  await delay();
  counter = old + 1;
}
```

## Práctica

Predice el orden de logs síncronos, Promise.then y setTimeout. Explica por qué try/catch alrededor de una llamada sin await no captura un rechazo posterior.

### Spoiler

Primero van los logs síncronos, después microtareas y luego el timer en el contexto mostrado. Espera dentro de try/catch o añade un handler de rechazo. Revisa si await separa la lectura y escritura de un estado compartido.

## Explicar concurrencia

Especifica por separado orden de salida, máximo de trabajo activo y política de fallo. Puedes ejecutar concurrentemente y devolver resultados en orden escribiéndolos por índice de entrada.

## Referencias oficiales

- [MDN: all](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/all)
