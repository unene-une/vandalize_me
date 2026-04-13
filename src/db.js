const DB_NAME = 'OekakiPracticeDB';
const DB_VERSION = 1;
const STORE_NAME = 'records';

let db = null;

export const initDB = () => {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = (e) => reject('IndexedDB error: ' + e.target.errorCode);
    request.onsuccess = (e) => {
      db = e.target.result;
      resolve(db);
    };
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      const oldVersion = e.oldVersion;
      
      // v1
      if (oldVersion < 1) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'date' });
          store.createIndex('by_date', 'date', { unique: true });
        }
      }
      // 将来のマイグレーション用
      // if (oldVersion < 2) { ... }
    };
  });
};

// 安全なDB取得ラッパー
const getDB = async () => {
  if (!db) {
    await initDB();
  }
  return db;
};

export const saveRecord = async (record) => {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction([STORE_NAME], 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.put(record);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
};

export const getRecords = async () => {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction([STORE_NAME], 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
};

export const deleteRecord = async (date) => {
  const database = await getDB();
  return new Promise((resolve, reject) => {
    const tx = database.transaction([STORE_NAME], 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(date);
    req.onsuccess = () => resolve();
    req.onerror = () => reject(req.error);
  });
};
