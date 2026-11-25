# Factorium

Juego de automatización 2D con vista cenital, para navegador (PC y tablet). Estás en Veyra, un planeta alienígena: extraes recursos, los transportas con cintas, los fundes y vas desbloqueando hitos hasta el gran proyecto final. Sin enemigos. El mundo, las máquinas, las recetas y el arte son originales.

## Estado: fase 1 (base)

- Mapa generado con semilla: biomas, lagos y vetas de Ferrita, Cobalina y Musgo ámbar.
- Edificios: Cinta, Taladro, Horno, Caja y Baliza de aterrizaje (tu base). El hito «Reparto» desbloquea Divisor, Cinta Mk2 y Taladro Mk2.
- Construir y borrar en rejilla, girar y trazar cintas arrastrando. Al borrar se devuelve todo.
- Autoguardado en el navegador cada minuto y al cerrar, más exportar/importar la partida.
- Controles de ratón y teclado, y táctiles (un dedo mueve, dos dedos hacen zoom).

## Jugar en local

No necesita instalación ni compilación. Sirve la carpeta con cualquier servidor estático:

```
python3 -m http.server 8000
```

y abre http://localhost:8000.

- `?bench=10000` crea una prueba de rendimiento con 10.000 cintas llenas.
- F3 muestra fps, ticks y tiempos.

## Publicar en tu web

Sube `index.html`, `style.css` y la carpeta `src/` a cualquier hosting estático (tu web, GitHub Pages, Netlify…). No hay dependencias externas.

## Rendimiento

- La simulación va a 60 ticks/s fijos, separada del dibujo.
- Las cintas se procesan de delante hacia atrás (las líneas se compactan sin huecos) y se saltan las que están vacías.
- Solo se dibuja lo visible. El terreno se cachea en bloques de 32×32 casillas y con zoom lejano se usa un dibujo simplificado.
- Medido en Chromium sin GPU: 10.560 cintas con 21.120 objetos cuestan unos 0,4 ms por tick de simulación y entre 1,5 y 3,6 ms de dibujo por frame.

## Estructura

| Archivo | Contenido |
| --- | --- |
| `src/config.js` | objetos, edificios, recetas e hitos |
| `src/world.js` | generación del mapa |
| `src/sim.js` | simulación, construcción y guardado |
| `src/sprites.js` | sprites generados por código |
| `src/render.js` | dibujo |
| `src/input.js` | ratón, teclado y táctil |
| `src/main.js` | bucle principal e interfaz |
