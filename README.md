# Factorium

Juego de automatización 2D con vista cenital, para navegador (PC y tablet). Estás en Veyra, un planeta alienígena: extraes recursos, los transportas con cintas, los fundes y vas desbloqueando hitos hasta el gran proyecto final. Sin enemigos. El mundo, las máquinas, las recetas y el arte son originales.

## Estado: fase 1 (base)

- Manejas un dron (WASD en PC, joystick en móvil) que explora el mapa. La niebla oculta lo que no has descubierto.
- Mapa con biomas, lagos y yacimientos finitos de Ferrita, Cobalina y Musgo ámbar. Los más lejanos son más grandes y ricos.
- Edificios: Cinta, Cinta Mk2, Taladro, Taladro Mk2, Horno, Prensa, Ensambladora, Caja, Divisor y la Baliza de aterrizaje.
- 11 objetos y recetas encadenadas: mineral → lingote → chapa, eje e hilo → engranaje y bobina.
- 10 objetivos de entrega en la Baliza (por ejemplo, 300 Lingote de cobalina), con recompensa, y 4 hitos que desbloquean edificios.
- Máquinas con luz de estado, humo, chispas y panel al tocarlas (receta, contenido, girar, mover y quitar).
- Minimapa, autoguardado cada 30 s y al cerrar, y exportar/importar partida.

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
