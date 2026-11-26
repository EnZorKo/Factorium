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
  ferrita:      { name: 'Ferrita',             color: '#c45a40', dark: '#6e2a1c', shape: 'ore' },
  cobalina:     { name: 'Cobalina',            color: '#3f8fd6', dark: '#1d4a7a', shape: 'ore' },
  musgo:        { name: 'Musgo ámbar',         color: '#e0a83a', dark: '#8a5a14', shape: 'moss' },
  lingFerrico:  { name: 'Lingote férrico',     color: '#b4b8be', dark: '#5b6067', shape: 'ingot' },
  lingCobalina: { name: 'Lingote de cobalina', color: '#5fb6f0', dark: '#2a6596', shape: 'ingot' },
  pastilla:     { name: 'Pastilla de musgo',   color: '#f2c15a', dark: '#94661b', shape: 'pellet' },
  chapa:        { name: 'Chapa',               color: '#9ea4ab', dark: '#4d5258', shape: 'plate' },
  eje:          { name: 'Eje',                 color: '#c3c7cc', dark: '#5f646a', shape: 'rod' },
  hilo:         { name: 'Hilo conductor',      color: '#4fb3e8', dark: '#1f5a80', shape: 'wire' },
  engranaje:    { name: 'Engranaje',           color: '#b7bcc2', dark: '#55595f', shape: 'gear' },
  bobina:       { name: 'Bobina',              color: '#3fa0d8', dark: '#3a3d42', shape: 'coil' },
};
export const ITEM_IDS = Object.keys(ITEMS);

// Recursos del terreno -> objeto que se extrae.
export const RESOURCES = {
  1: { item: 'ferrita',  name: 'Ferrita',     color: '#d0603f' },
  2: { item: 'cobalina', name: 'Cobalina',    color: '#4a9ee6' },
  3: { item: 'musgo',    name: 'Musgo ámbar', color: '#e8b13e' },
};

// Recetas de horno (se eligen solas según lo que entra).
export const FURNACE_RECIPES = {
  ferrita:  { out: 'lingFerrico',  inCount: 1, time: 1.6 },
  cobalina: { out: 'lingCobalina', inCount: 1, time: 1.6 },
  musgo:    { out: 'pastilla',     inCount: 3, time: 2.0 },
};

// Recetas de fábrica (se eligen tocando la máquina).
export const RECIPES = {
  chapa:     { machine: 'prensa',       in: { lingFerrico: 2 },          out: 'chapa',     n: 1, time: 1.5 },
  eje:       { machine: 'prensa',       in: { lingFerrico: 1 },          out: 'eje',       n: 1, time: 1.0 },
  hilo:      { machine: 'prensa',       in: { lingCobalina: 1 },         out: 'hilo',      n: 2, time: 1.0 },
  engranaje: { machine: 'ensambladora', in: { chapa: 2, eje: 1 },        out: 'engranaje', n: 1, time: 3.0 },
  bobina:    { machine: 'ensambladora', in: { hilo: 3, eje: 1 },         out: 'bobina',    n: 1, time: 3.0 },
};

// Edificios. size en casillas; cost en objetos del inventario.
// speed de cinta en casillas por segundo.
export const BUILDINGS = {
  cinta:        { name: 'Cinta',        kind: 'belt',     size: 1, speed: 1.875, cost: { lingFerrico: 1 }, key: '1',
                  desc: 'Mueve objetos. Arrastra para trazar una línea.' },
  taladro:      { name: 'Taladro',      kind: 'miner',    size: 2, rate: 0.5, cost: { lingFerrico: 6, lingCobalina: 4 }, key: '2',
                  desc: 'Ponlo sobre un recurso. Saca el mineral por la flecha.' },
  horno:        { name: 'Horno',        kind: 'furnace',  size: 2, cost: { ferrita: 12 }, key: '3',
                  desc: 'Funde mineral en lingotes. Recibe por cualquier lado y saca por la flecha.' },
  caja:         { name: 'Caja',         kind: 'chest',    size: 1, capacity: 200, cost: { lingFerrico: 4 }, key: '4',
                  desc: 'Guarda objetos. Tócala para recogerlos.' },
  divisor:      { name: 'Divisor',      kind: 'splitter', size: 1, cost: { lingFerrico: 2, lingCobalina: 2 }, key: '5',
                  desc: 'Reparte lo que entra por detrás entre delante, izquierda y derecha.' },
  cinta2:       { name: 'Cinta Mk2',    kind: 'belt',     size: 1, speed: 3.75, cost: { lingFerrico: 2, lingCobalina: 1 }, key: '6', upgradeOf: 'cinta',
                  desc: 'El doble de rápida. Ponla encima de una cinta para mejorarla.' },
  prensa:       { name: 'Prensa',       kind: 'crafter',  size: 2, cost: { lingFerrico: 20, lingCobalina: 10 }, key: '7', defaultRecipe: 'chapa',
                  desc: 'Convierte lingotes en piezas. Tócala para elegir receta.' },
  ensambladora: { name: 'Ensambladora', kind: 'crafter',  size: 3, cost: { chapa: 20, eje: 20, hilo: 20 }, key: '8', defaultRecipe: 'engranaje',
                  desc: 'Une dos piezas en una más compleja. Tócala para elegir receta.' },
  taladro2:     { name: 'Taladro Mk2',  kind: 'miner',    size: 2, rate: 1.0, cost: { lingFerrico: 10, lingCobalina: 8, pastilla: 4 }, key: '9', upgradeOf: 'taladro',
                  desc: 'Extrae el doble de rápido. Ponlo encima de un taladro para mejorarlo.' },
  baliza:       { name: 'Baliza de aterrizaje', kind: 'hub', size: 3, cost: {}, hidden: true,
                  desc: 'Tu base. Todo lo que entra va a tu inventario.' },
};

// Hitos: el primero viene desbloqueado.
export const MILESTONES = [
  { id: 'aterrizaje', name: 'Aterrizaje', cost: {},
    unlocks: ['cinta', 'taladro', 'horno', 'caja'],
    text: 'Coloca taladros sobre los recursos y lleva el mineral a un horno.' },
  { id: 'reparto', name: 'Reparto', cost: { lingFerrico: 40, lingCobalina: 20 },
    unlocks: ['divisor', 'cinta2'],
    text: 'Divisores para repartir y cintas el doble de rápidas.' },
  { id: 'taller', name: 'Taller', cost: { lingFerrico: 100, lingCobalina: 50, pastilla: 10 },
    unlocks: ['prensa'],
    text: 'La Prensa convierte lingotes en Chapa, Eje e Hilo conductor.' },
  { id: 'ensamblaje', name: 'Ensamblaje', cost: { chapa: 60, eje: 60, hilo: 60 },
    unlocks: ['ensambladora', 'taladro2'],
    text: 'La Ensambladora une piezas: Engranajes y Bobinas. Y taladros más rápidos.' },
  { id: 'chispa', name: 'Primera chispa', cost: null, unlocks: [],
    text: 'Electricidad, nuevas máquinas y biomas llegarán en la fase 2.' },
];

// Objetivos: entregas en la Baliza, en orden. Cómo conseguirlo lo decide quien juega.
export const TASKS = [
  { item: 'lingFerrico',  n: 100, reward: { lingCobalina: 20 } },
  { item: 'lingCobalina', n: 100, reward: { lingFerrico: 40 } },
  { item: 'pastilla',     n: 50,  reward: { lingFerrico: 40 } },
  { item: 'lingFerrico',  n: 300, reward: { lingCobalina: 40 } },
  { item: 'lingCobalina', n: 300, reward: { lingFerrico: 80 } },
  { item: 'chapa',        n: 200, reward: { lingFerrico: 80 } },
  { item: 'eje',          n: 200, reward: { lingCobalina: 60 } },
  { item: 'hilo',         n: 300, reward: { lingFerrico: 100 } },
  { item: 'engranaje',    n: 100, reward: { chapa: 50 } },
  { item: 'bobina',       n: 100, reward: {} },
];

export const START_INVENTORY = { lingFerrico: 40, lingCobalina: 12, ferrita: 12 };
