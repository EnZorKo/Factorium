// Datos del juego: objetos, edificios, recetas e hitos.
// Todo el contenido es original de Factorium (planeta Veyra).

export const TILE = 32; // píxeles por casilla a zoom 1
export const MAP_W = 192;
export const MAP_H = 192;
export const UPS = 60; // ticks de simulación por segundo

// Objetos. color = color del icono, shape = forma del icono.
export const ITEMS = {
  ferrita:      { name: 'Ferrita',             color: '#b5523b', dark: '#6e2a1c', shape: 'ore' },
  cobalina:     { name: 'Cobalina',            color: '#3f8fd6', dark: '#1d4a7a', shape: 'ore' },
  musgo:        { name: 'Musgo ámbar',         color: '#e0a83a', dark: '#8a5a14', shape: 'moss' },
  lingFerrico:  { name: 'Lingote férrico',     color: '#a9adb3', dark: '#5b6067', shape: 'ingot' },
  lingCobalina: { name: 'Lingote de cobalina', color: '#5fb6f0', dark: '#2a6596', shape: 'ingot' },
  pastilla:     { name: 'Pastilla de musgo',   color: '#f2c15a', dark: '#94661b', shape: 'pellet' },
};
export const ITEM_IDS = Object.keys(ITEMS);
export const ITEM_INDEX = Object.fromEntries(ITEM_IDS.map((id, i) => [id, i]));

// Recursos del terreno -> objeto que se extrae.
export const RESOURCES = {
  1: { item: 'ferrita',  name: 'Ferrita' },
  2: { item: 'cobalina', name: 'Cobalina' },
  3: { item: 'musgo',    name: 'Musgo ámbar' },
};

// Recetas de horno: entrada -> salida.
export const FURNACE_RECIPES = {
  ferrita:  { out: 'lingFerrico',  inCount: 1, time: 1.6 },
  cobalina: { out: 'lingCobalina', inCount: 1, time: 1.6 },
  musgo:    { out: 'pastilla',     inCount: 3, time: 2.0 },
};

// Edificios. size en casillas; cost en objetos del inventario.
// speed de cinta en casillas por segundo.
export const BUILDINGS = {
  cinta:     { name: 'Cinta',         kind: 'belt',     size: 1, speed: 1.875, cost: { lingFerrico: 1 }, key: '1',
               desc: 'Mueve objetos. Arrastra para trazar una línea.' },
  taladro:   { name: 'Taladro',       kind: 'miner',    size: 2, rate: 0.5, cost: { lingFerrico: 6, lingCobalina: 4 }, key: '2',
               desc: 'Extrae del recurso que tiene debajo. Saca por delante.' },
  horno:     { name: 'Horno',         kind: 'furnace',  size: 2, cost: { ferrita: 12 }, key: '3',
               desc: 'Funde mineral en lingotes. Recibe por cualquier lado y saca por delante.' },
  caja:      { name: 'Caja',          kind: 'chest',    size: 1, capacity: 200, cost: { lingFerrico: 4 }, key: '4',
               desc: 'Guarda objetos. Tócala para recogerlos.' },
  divisor:   { name: 'Divisor',       kind: 'splitter', size: 1, cost: { lingFerrico: 2, lingCobalina: 2 }, key: '5',
               desc: 'Reparte lo que entra por detrás entre delante, izquierda y derecha.' },
  cinta2:    { name: 'Cinta Mk2',     kind: 'belt',     size: 1, speed: 3.75, cost: { lingFerrico: 2, lingCobalina: 1 }, key: '6', upgradeOf: 'cinta',
               desc: 'El doble de rápida. Colócala encima de una cinta para mejorarla.' },
  taladro2:  { name: 'Taladro Mk2',   kind: 'miner',    size: 2, rate: 1.0, cost: { lingFerrico: 10, lingCobalina: 8, pastilla: 4 }, key: '7', upgradeOf: 'taladro',
               desc: 'Extrae el doble de rápido. Colócalo encima de un taladro para mejorarlo.' },
  baliza:    { name: 'Baliza de aterrizaje', kind: 'hub', size: 3, cost: {}, hidden: true,
               desc: 'Tu base. Todo lo que entra va a tu inventario.' },
};

// Hitos: el primero viene desbloqueado.
export const MILESTONES = [
  { id: 'aterrizaje', name: 'Aterrizaje', cost: {},
    unlocks: ['cinta', 'taladro', 'horno', 'caja'],
    text: 'Coloca taladros sobre los recursos y lleva el mineral a un horno con cintas.' },
  { id: 'reparto', name: 'Reparto', cost: { lingFerrico: 120, lingCobalina: 60, pastilla: 20 },
    unlocks: ['divisor', 'cinta2', 'taladro2'],
    text: 'Entrega lingotes y pastillas para desbloquear divisores y mejoras Mk2.' },
  { id: 'chispa', name: 'Primera chispa', cost: null, unlocks: [],
    text: 'Electricidad, prensa y ensambladora llegarán en la fase 2.' },
];

export const START_INVENTORY = { lingFerrico: 40, lingCobalina: 12, ferrita: 24 };
