# Compilador, módulos y ejecución de TS

Repaso práctico. Lee el contrato, traza los ejemplos e intenta el ejercicio antes de abrir la respuesta. Algunos bloques comparten contexto; solo `ts check` identifica comprobaciones independientes.

## Comprobar, transformar y ejecutar

Son pasos distintos. Aquí tsc --noEmit comprueba y Node 24 ejecuta sintaxis compatible quitando tipos. Ejecutar no implica typecheck ni todas las transformaciones de tsconfig. Lee scripts, engines y configuración. npm ci instala según lockfile y detecta discrepancias; install cambia dependencias.

```sh
npm ci
npm run check
npm test
npm run build
npm start
```

## Strict y opciones adicionales

strict activa varias comprobaciones, pero noUncheckedIndexedAccess y exactOptionalPropertyTypes son opciones separadas. Comprueba índices o usa tupla no vacía; ! no arregla el contrato. verbatimModuleSyntax favorece import type explícito. Configuración para Node directo no es universal para bundlers.

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "verbatimModuleSyntax": true,
    "noEmit": true,
    "allowImportingTsExtensions": true
  }
}
```

## Target y lib no instalan APIs

target controla supuestos de lenguaje emitido; lib describe APIs al checker. Añadir toSorted a tipos no lo instala en un runtime antiguo. @types/node no actualiza Node. Alinea entorno soportado, engines, declaraciones y CI.

## ESM, CommonJS e import type

type: module define ESM para .js; .mjs y .cjs son explícitos. module y moduleResolution corresponden al cargador real. import type se borra; una interface no es constructor runtime. Ejecución TS directa usa extensiones adecuadas; compilación ESM necesita otra política coherente. paths no enseña al runtime a resolver aliases.

```ts
import { mapLimit } from "./core.ts";
import type { Repository } from "./core.ts";
```

## Declaraciones no crean implementaciones

.d.ts y declare describen valores externos, no los crean. Revisa instalación, exports, declaraciones y resolución. declare module "*" con any oculta errores en vez de arreglar un módulo faltante.

```ts check
declare const API_URL: string;

```

## Variables de entorno como entrada

Son strings o undefined. Valida formato, convierte y comprueba rango al inicio. as number no convierte texto. Un puerto exige dígitos y rango 1–65535. Distingue valor por defecto de cadena vacía o entrada inválida.

```ts
function readPort(value: string | undefined): number {
  if (value === undefined) return 4173;
  if (!/^\d+$/.test(value)) throw new Error("PORT must be digits");
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT out of range");
  }
  return port;
}
```

## Leer errores del compilador

Busca el punto donde un literal se amplió, un campo puede faltar, el callback es estrecho o JSON se afirmó seguro. Module-not-found runtime requiere revisar archivo, ruta, extensión y formato, no añadir any.

## Práctica

Una interface Repository se importa como constructor; un alias paths falla en Node; el archivo se ejecuta con argumento mal tipado. ¿Qué revisas?

### Spoiler

Usa import type y una implementación real. Proporciona resolver runtime o ruta relativa válida para el alias. Ejecuta typecheck aparte y valida datos externos: quitar tipos no es comprobarlos.

## Un ciclo fiable

Lee scripts, engines y tsconfig; instala por lockfile; ejecuta checker y un test; implementa y repite comprobaciones relevantes. Prepara el entorno antes del ejercicio cronometrado.

## Referencias oficiales

- [TypeScript: theory](https://www.typescriptlang.org/docs/handbook/modules/theory.html)
- [Node.js: typescript](https://nodejs.org/api/typescript.html)
