// Autoguardado en el navegador y exportar/importar partida.
const KEY = 'factorium.save.v1';

export function saveLocal(game) {
  try {
    localStorage.setItem(KEY, JSON.stringify(game.serialize()));
    return true;
  } catch (err) {
    console.warn('No se pudo guardar', err);
    return false;
  }
}

export function loadLocal() {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function clearLocal() {
  try { localStorage.removeItem(KEY); } catch { /* sin almacenamiento */ }
}

export function exportFile(game) {
  const blob = new Blob([JSON.stringify(game.serialize())], { type: 'application/json' });
  const a = document.createElement('a');
  const d = new Date();
  a.href = URL.createObjectURL(blob);
  a.download = `factorium-${d.toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export function readFile(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => { try { resolve(JSON.parse(fr.result)); } catch (e) { reject(e); } };
    fr.onerror = reject;
    fr.readAsText(file);
  });
}
