# LotoMaster · Baloto y Revancha

Herramienta web gratuita para cada sorteo de Baloto (lunes, miércoles y sábado):

- **Tu jugada:** genera combinaciones de 5 números + superbalota que evitan los patrones más jugados, para no compartir el premio si ganas. Con varias combinaciones, no repite más de 2 números entre ellas ni la superbalota.
- **¿Conviene jugar hoy?:** valor esperado de Baloto y Revancha según el acumulado anunciado.
- **Último resultado** y verificación de tu tiquete en Baloto y Revancha.
- **Mis jugadas:** guarda tus combinaciones en el navegador y las revisa automáticamente cuando sale el resultado.
- **Historial:** cuántas veces habría ganado cualquier combinación desde mayo de 2017.

> Nadie puede predecir el Baloto. Todas las combinaciones tienen la misma probabilidad (1 en 15.401.568). El análisis de 1.042 sorteos no encontró ningún patrón que supere al azar. LotoMaster no aumenta la probabilidad de ganar; reduce el riesgo de compartir el premio y muestra cuándo una apuesta devuelve más.

## Cómo funciona

| Parte | Archivo |
|---|---|
| Página | `index.html`, `assets/style.css`, `assets/app.js` (sin dependencias) |
| Datos | `data/draws.json` (Baloto y Revancha desde 2017), `data/meta.json` (acumulados) |
| Actualización | `scripts/update.py` (solo biblioteca estándar de Python) |
| Automatización | `.github/workflows/actualizar-y-publicar.yml` |

GitHub Actions ejecuta `update.py` después de cada sorteo y una vez al día, guarda los datos nuevos y vuelve a publicar la página en GitHub Pages. Todo corre en el plan gratuito de GitHub para repositorios públicos.

## Publicar en GitHub Pages (una sola vez)

1. Sube estos archivos a un repositorio **público** (por ejemplo `lotomaster`).
2. En el repositorio: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. En **Actions**, abre "Actualizar resultados y publicar" y pulsa **Run workflow**.
4. La página queda en `https://<tu-usuario>.github.io/lotomaster/`.

Para actualizar a mano en tu computador: `python scripts/update.py`.

## Fuentes

- Resultados: [resultadobaloto.com](https://www.resultadobaloto.com/)
- Precios y reglas: [baloto.com](https://baloto.com/novedadesbaloto) ($6.000 Baloto, $3.000 Revancha)
- Plan de premios: [resultados-de-loteria.com](https://resultados-de-loteria.com/baloto/premios)

LotoMaster no está afiliado a Baloto, a la Operadora Nacional de Juegos ni a Coljuegos. Juego para mayores de 18 años.
