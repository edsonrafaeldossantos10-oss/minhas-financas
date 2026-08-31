// ---------------------------------------------------------------------------
// Camada de armazenamento local (IndexedDB). Tudo fica no aparelho.
//
// Regra de ouro deste arquivo: NUNCA apagar dados existentes durante um
// upgrade de versão. onupgradeneeded só cria object stores/índices que ainda
// não existem — nunca faz db.deleteObjectStore nem limpa dados. Se um dia for
// necessário migrar o formato de um registro, isso deve ser feito com uma
// rotina de migração explícita que LÊ e RE-GRAVA os dados, nunca apagando
// antes de confirmar que a gravação funcionou.
// ---------------------------------------------------------------------------

const DB_NAME = 'minhas-financas-db';
const DB_VERSION = 1;

const STORES = {
  transacoes: 'id',
  contas: 'id',
  cartoes: 'id',
  recorrentes: 'id',
  metas: 'id',
  categorias: 'id',
  configuracoes: 'chave',
};

let dbPromise = null;

function openDB() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = (event) => {
      const db = req.result;

      if (!db.objectStoreNames.contains('transacoes')) {
        const s = db.createObjectStore('transacoes', { keyPath: 'id' });
        s.createIndex('data', 'data');
        s.createIndex('tipo', 'tipo');
        s.createIndex('contaId', 'contaId');
        s.createIndex('cartaoId', 'cartaoId');
        s.createIndex('categoria', 'categoria');
        s.createIndex('compraId', 'compraId');
        s.createIndex('recorrenteId', 'recorrenteId');
      }
      if (!db.objectStoreNames.contains('contas')) {
        db.createObjectStore('contas', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('cartoes')) {
        db.createObjectStore('cartoes', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('recorrentes')) {
        db.createObjectStore('recorrentes', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('metas')) {
        db.createObjectStore('metas', { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains('categorias')) {
        const s = db.createObjectStore('categorias', { keyPath: 'id' });
        s.createIndex('tipo', 'tipo');
      }
      if (!db.objectStoreNames.contains('configuracoes')) {
        db.createObjectStore('configuracoes', { keyPath: 'chave' });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
    req.onblocked = () => console.warn('Abertura do banco bloqueada por outra aba aberta.');
  });
  return dbPromise;
}

function tx(storeName, mode) {
  return openDB().then((db) => db.transaction(storeName, mode).objectStore(storeName));
}

const DB = {
  async put(storeName, value) {
    const store = await tx(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.put(value);
      req.onsuccess = () => resolve(value);
      req.onerror = () => reject(req.error);
    });
  },

  async bulkPut(storeName, values) {
    const store = await tx(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      values.forEach((v) => store.put(v));
      store.transaction.oncomplete = () => resolve();
      store.transaction.onerror = () => reject(store.transaction.error);
    });
  },

  async get(storeName, key) {
    const store = await tx(storeName, 'readonly');
    return new Promise((resolve, reject) => {
      const req = store.get(key);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  },

  async getAll(storeName) {
    const store = await tx(storeName, 'readonly');
    return new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onsuccess = () => resolve(req.result || []);
      req.onerror = () => reject(req.error);
    });
  },

  async delete(storeName, key) {
    const store = await tx(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.delete(key);
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  async deleteWhere(storeName, predicate) {
    const all = await this.getAll(storeName);
    const toDelete = all.filter(predicate);
    const store = await tx(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      toDelete.forEach((item) => store.delete(item.id));
      store.transaction.oncomplete = () => resolve(toDelete.length);
      store.transaction.onerror = () => reject(store.transaction.error);
    });
  },

  async clear(storeName) {
    const store = await tx(storeName, 'readwrite');
    return new Promise((resolve, reject) => {
      const req = store.clear();
      req.onsuccess = () => resolve();
      req.onerror = () => reject(req.error);
    });
  },

  async exportAll() {
    const data = {};
    for (const storeName of Object.keys(STORES)) {
      data[storeName] = await this.getAll(storeName);
    }
    return {
      appId: 'minhas-financas',
      exportVersion: 1,
      dbVersion: DB_VERSION,
      exportadoEm: new Date().toISOString(),
      dados: data,
    };
  },

  async importAll(payload) {
    if (!payload || payload.appId !== 'minhas-financas' || !payload.dados) {
      throw new Error('Arquivo de backup inválido.');
    }
    for (const storeName of Object.keys(STORES)) {
      const items = payload.dados[storeName];
      if (!Array.isArray(items)) continue;
      await this.clear(storeName);
      if (items.length) await this.bulkPut(storeName, items);
    }
  },
};

function uid() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}

function nowISO() {
  return new Date().toISOString();
}
