// Datos del juego: objetos, edificios, recetas, hitos y tutorial.
// Todo el contenido es original de Factorium (planeta Veyra).

export const TILE = 32; // píxeles por casilla a zoom 1
export const MAP_W = 192;
export const MAP_H = 192;
export const UPS = 60; // ticks de simulación por segundo
export const REVEAL_R = 11; // radio que descubre el dron (casillas)
export const MINE_RANGE = 6; // distancia máxima para extraer a mano

// Objetos. color = color del icono, shape = forma del icono.
export const ITEMS = {
  ferrita:      { name: 'Mineral de hierro',   color: '#b0624a', dark: '#5e2c20', shape: 'ore' },
  cobalina:     { name: 'Mineral de cobre',    color: '#d0813f', dark: '#3d7a62', shape: 'ore' },
  musgo:        { name: 'Carbón',              color: '#3a3a3e', dark: '#141416', shape: 'ore' },
  lingFerrico:  { name: 'Lingote de hierro',     color: '#b4b8be', dark: '#5b6067', shape: 'ingot' },
  lingCobalina: { name: 'Lingote de cobre',    color: '#e0884a', dark: '#8a4a22', shape: 'ingot' },
  pastilla:     { name: 'Coque',               color: '#5a5a60', dark: '#1e1e22', shape: 'pellet' },
  chapa:        { name: 'Placa de hierro',   color: '#9ea4ab', dark: '#4d5258', shape: 'plate' },
  eje:          { name: 'Varilla de hierro', color: '#c3c7cc', dark: '#5f646a', shape: 'rod' },
  hilo:         { name: 'Cable de cobre',      color: '#e0884a', dark: '#8a4a22', shape: 'wire' },
  engranaje:    { name: 'Engranaje',           color: '#b7bcc2', dark: '#55595f', shape: 'gear' },
  bobina:       { name: 'Bobina',              color: '#3fa0d8', dark: '#3a3d42', shape: 'coil' },
  bastidor:     { name: 'Bastidor',            color: '#8f969d', dark: '#3f4349', shape: 'frame' },
  actuador:     { name: 'Actuador',            color: '#e08a3c', dark: '#4a4e53', shape: 'actuator' },
  traccion:     { name: 'Unidad de tracción',  color: '#4fd1bd', dark: '#2b2e31', shape: 'drive' },
};
export const ITEM_IDS = Object.keys(ITEMS);

// Recursos del terreno -> objeto que se extrae.
export const RESOURCES = {
  1: { item: 'ferrita',  name: 'Hierro', color: '#c06a50' },
  2: { item: 'cobalina', name: 'Cobre',  color: '#d0813f' },
  3: { item: 'musgo',    name: 'Carbón', color: '#2a2a2e' },
};

// Recetas de horno (se eligen solas según lo que entra).
export const FURNACE_RECIPES = {
  ferrita:  { out: 'lingFerrico',  inCount: 1, time: 1.6 },
  cobalina: { out: 'lingCobalina', inCount: 1, time: 1.6 },
  musgo:    { out: 'pastilla',     inCount: 2, time: 2.0 },
};

// Recetas de fábrica (se eligen tocando la máquina).
export const RECIPES = {
  chapa:     { machine: 'prensa',       in: { lingFerrico: 2 },          out: 'chapa',     n: 1, time: 1.5 },
  eje:       { machine: 'prensa',       in: { lingFerrico: 1 },          out: 'eje',       n: 1, time: 1.0 },
  hilo:      { machine: 'prensa',       in: { lingCobalina: 1 },         out: 'hilo',      n: 2, time: 1.0 },
  engranaje: { machine: 'ensambladora', in: { chapa: 2, eje: 1 },        out: 'engranaje', n: 1, time: 3.0 },
  bobina:    { machine: 'ensambladora', in: { hilo: 3, eje: 1 },         out: 'bobina',    n: 1, time: 3.0 },
  bastidor:  { machine: 'ensambladora', in: { chapa: 4, eje: 6 },        out: 'bastidor',  n: 1, time: 5.0 },
  actuador:  { machine: 'ensambladora', in: { engranaje: 2, bobina: 2 }, out: 'actuador',  n: 1, time: 6.0 },
  traccion:  { machine: 'ensambladora', in: { bastidor: 1, actuador: 2, hilo: 10 }, out: 'traccion', n: 1, time: 12.0 },
};

// Edificios. size en casillas; cost en objetos del inventario.
// speed de cinta en casillas por segundo.
export const BUILDINGS = {
  cinta:        { name: 'Cinta',        kind: 'belt',     size: 1, speed: 1.875, cost: { lingFerrico: 1 }, key: '1',
                  desc: 'Mueve objetos. Arrastra para trazar una línea.' },
  taladro:      { name: 'Taladro',      kind: 'miner',    size: 2, rate: 0.5, power: 90, cost: { lingFerrico: 6, lingCobalina: 4 }, key: '2',
                  desc: 'Ponlo sobre un recurso. Saca el mineral por la flecha. Necesita energía.' },
  horno:        { name: 'Horno eléctrico', kind: 'furnace', size: 2, power: 90, cost: { ferrita: 12 }, key: '3',
                  desc: 'Funde mineral en lingotes. Recibe por cualquier lado y saca por la flecha. Necesita energía.' },
  caja:         { name: 'Caja',         kind: 'chest',    size: 1, capacity: 200, cost: { lingFerrico: 4 }, key: '4',
                  desc: 'Guarda objetos. Tócala para recogerlos.' },
  poste:        { name: 'Poste eléctrico', kind: 'pole',  size: 1, supply: 3, wire: 9, cost: { lingFerrico: 2, lingCobalina: 1 }, key: '5',
                  desc: 'Da energía a las máquinas de su zona (7×7) y se une por cable a postes cercanos.' },
  divisor:      { name: 'Divisor',      kind: 'splitter', size: 1, cost: { lingFerrico: 2, lingCobalina: 2 }, key: '6',
                  desc: 'Reparte lo que entra por detrás entre delante, izquierda y derecha.' },
  cinta2:       { name: 'Cinta Mk2',    kind: 'belt',     size: 1, speed: 3.75, cost: { lingFerrico: 2, lingCobalina: 1 }, key: '7', upgradeOf: 'cinta',
                  desc: 'El doble de rápida. Ponla encima de una cinta para mejorarla.' },
  prensa:       { name: 'Prensa',       kind: 'crafter',  size: 2, power: 75, cost: { lingFerrico: 20, lingCobalina: 10 }, key: '8', defaultRecipe: 'chapa',
                  desc: 'Convierte lingotes en piezas. Tócala para elegir receta. Necesita energía.' },
  ensambladora: { name: 'Ensambladora', kind: 'crafter',  size: 3, power: 150, cost: { chapa: 20, eje: 20, hilo: 20 }, key: '9', defaultRecipe: 'engranaje',
                  desc: 'Une varias piezas en una más compleja. Tócala para elegir receta. Necesita energía.' },
  taladro2:     { name: 'Taladro Mk2',  kind: 'miner',    size: 2, rate: 1.0, power: 180, cost: { lingFerrico: 10, lingCobalina: 8, pastilla: 4 }, key: '0', upgradeOf: 'taladro',
                  desc: 'Extrae el doble de rápido. Ponlo encima de un taladro para mejorarlo.' },
  bomba:        { name: 'Bomba de agua', kind: 'pump',    size: 1, cost: { lingFerrico: 8, lingCobalina: 2 }, key: 'b',
                  desc: 'Ponla en la orilla, tocando el agua. Abastece hasta 4 calderas por tubería.' },
  tuberia:      { name: 'Tubería',      kind: 'pipe',     size: 1, cost: { lingFerrico: 1 }, key: 'p',
                  desc: 'Lleva agua de la bomba a las calderas. Arrastra para trazar.' },
  caldera:      { name: 'Caldera',      kind: 'boiler',   size: 2, cost: { lingFerrico: 20, ferrita: 10 }, key: 'k',
                  desc: 'Quema carbón o coque y calienta agua. Pon generadores tocándola (hasta 2).' },
  generador:    { name: 'Generador de vapor', kind: 'generator', size: 3, output: 900, cost: { lingFerrico: 30, lingCobalina: 15 }, key: 'g',
                  desc: 'Da 900 kW con el vapor de una caldera que lo toque. Conéctalo a un poste.' },
  baliza:       { name: 'Baliza de aterrizaje', kind: 'hub', size: 3, supply: 6, wire: 9, output: 180, cost: {}, hidden: true,
                  desc: 'Tu base. Todo lo que entra va a tu inventario. Da 180 kW de energía de emergencia a su alrededor.' },
};

export const FUEL = { musgo: 4000, pastilla: 9000 }; // kJ por unidad
export const PUMP_BOILERS = 4;
export const BOILER_GENS = 2;

// Hitos: el primero viene desbloqueado.
export const MILESTONES = [
  { id: 'aterrizaje', name: 'Aterrizaje', cost: {},
    unlocks: ['cinta', 'taladro', 'horno', 'caja', 'poste'],
    text: 'La Baliza da algo de energía a su alrededor. Usa postes para llevarla más lejos.' },
  { id: 'vapor', name: 'Energía de vapor', cost: { lingFerrico: 50, lingCobalina: 25 },
    unlocks: ['bomba', 'tuberia', 'caldera', 'generador'],
    text: 'Bomba en el agua → tubería → caldera con carbón → generador tocando la caldera → poste.' },
  { id: 'reparto', name: 'Reparto', cost: { lingFerrico: 120, lingCobalina: 60 },
    unlocks: ['divisor', 'cinta2'],
    text: 'Divisores para repartir y cintas el doble de rápidas.' },
  { id: 'taller', name: 'Taller', cost: { lingFerrico: 200, lingCobalina: 100, pastilla: 30 },
    unlocks: ['prensa'],
    text: 'La Prensa convierte lingotes en Placas, Varillas y Cable de cobre.' },
  { id: 'ensamblaje', name: 'Ensamblaje', cost: { chapa: 100, eje: 100, hilo: 100 },
    unlocks: ['ensambladora', 'taladro2'],
    text: 'La Ensambladora une piezas: Engranaje, Bobina, Bastidor, Actuador y Unidad de tracción. Y taladros más rápidos.' },
  { id: 'renovables', name: 'Renovables', cost: null, unlocks: [],
    text: 'Paneles solares y baterías llegarán en la próxima fase.' },
];

// Hoja de ruta de energía (se muestra en Hitos).
export const ROADMAP = ['Renovables: paneles solares y baterías', 'Petróleo: extracción, refinería y generadores de combustible', 'Nuclear: uranio, reactor e intercambiadores de calor'];

// Objetivos: entregas en la Baliza, en orden. Cómo conseguirlo lo decide quien juega.
export const TASKS = [
  { item: 'chapa',     n: 150, reward: { lingCobalina: 40 } },
  { item: 'engranaje', n: 200, reward: { lingFerrico: 150 } },
  { item: 'bobina',    n: 200, reward: { lingFerrico: 150 } },
  { item: 'bastidor',  n: 150, reward: { lingCobalina: 150 } },
  { item: 'actuador',  n: 250, reward: { chapa: 200 } },
  { item: 'traccion',  n: 100, reward: { eje: 300 } },
  { item: 'actuador',  n: 800, reward: { hilo: 500 } },
  { item: 'traccion',  n: 400, reward: {} },
];

export const START_INVENTORY = { lingFerrico: 60, lingCobalina: 20, ferrita: 24 };
