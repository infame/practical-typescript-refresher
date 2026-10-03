# Repaso práctico de TypeScript

[Abrir el entrenamiento](https://infame.github.io/practical-typescript-refresher/es/) · [English](README.md) · [Русский](README.ru.md)

Para quienes ya programan pero han olvidado detalles de TypeScript. **Detectar lagunas → repasar → escribir código → revisar la solución.** Los 14 capítulos, el diagnóstico y la práctica están disponibles en inglés, ruso y español. Inglés es el idioma predeterminado.

El diagnóstico tiene 12 preguntas. Los errores y «No lo sé» generan explicaciones, capítulos recomendados y enlaces a MDN / TypeScript / Node. La puntuación mide respuestas, no competencia para programar. No hay registro, analítica ni envío de respuestas.

Arriba a la derecha elige idioma y dominio: catálogo, analítica, trabajos en segundo plano o perfiles. Los contratos de los tres ejercicios son iguales; cambian nombres de entidades y campos en los ejemplos. Se conservan página y recorrido. La búsqueda indexa explicaciones y código, incluidas soluciones, y enlaza a la sección correspondiente. El progreso se guarda localmente y se comparte entre idiomas.

Dos recorridos: recuperar el lenguaje o practicar entrevistas de backend. Se cubren tipos, colecciones, concurrencia, validación, procesamiento de datos y fallos. SQL, eventos duraderos, algoritmos y Node son introducciones. React/DOM, frameworks, seguridad, diseño de sistemas, DP avanzada y transacciones distribuidas requieren preparación aparte. No es un curso exhaustivo ni una garantía de aprobar cualquier entrevista.

## Uso local

Requiere Node.js 24+ y npm.

```sh
npm ci
npm run verify
npm start
```

Abre http://127.0.0.1:4173/es/. Usa un servidor HTTP: los módulos del navegador no están preparados para file://.

Fuentes: `lessons/es/`, `lessons/en/` y `lessons/` (ruso). Preguntas, interfaz y práctica compartida: `content/`. Implementaciones comprobadas: `examples/`. Ejecuta `npm run build` tras editar.

[Contribuir](CONTRIBUTING.md) · [Contratos de práctica](docs/DOMAIN-PRACTICE.md) · [Auditoría](docs/AUDIT.md) · [Evaluación](docs/EVALUATION.md)

Las pruebas de ejemplos y un experimento con LLM no demuestran eficacia educativa en personas. El evaluador `npm run eval -- /absolute/path/to/solution.ts` ejecuta código en tu equipo; usa una solución propia o revisada.

Si te sirve, una estrella ayuda a que otros encuentren el proyecto. Las correcciones son bienvenidas. Licencia MIT; atribución en THIRD_PARTY_NOTICES.md.
