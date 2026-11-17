// Mini-surcouche IndexedDB : sauvegarde locale (brouillon en cours, plus tard l'historique).
const NOM = 'vintedassist';
const VERSION = 1;
let dbPromise;

function ouvrir() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(NOM, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains('brouillons')) db.createObjectStore('brouillons');
        if (!db.objectStoreNames.contains('historique')) db.createObjectStore('historique', { keyPath: 'id' });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

async function tx(store, mode, fn) {
  const db = await ouvrir();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, mode);
    const req = fn(t.objectStore(store));
    t.oncomplete = () => resolve(req?.result);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

export const dbGet = (store, key) => tx(store, 'readonly', s => s.get(key));
export const dbPut = (store, value, key) => tx(store, 'readwrite', s => s.put(value, key));
export const dbDelete = (store, key) => tx(store, 'readwrite', s => s.delete(key));
export const dbGetAll = store => tx(store, 'readonly', s => s.getAll());
