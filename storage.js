// IndexedDB wrapper for Connect-5 game data storage
class GameStorage {
    constructor() {
        this.dbName = 'Connect5DB';
        this.dbVersion = 1;
        this.storeName = 'gameData';
        this.db = null;
        this.isIndexedDBSupported = this.checkIndexedDBSupport();
    }

    checkIndexedDBSupport() {
        return 'indexedDB' in window;
    }

    async init() {
        if (!this.isIndexedDBSupported) {
            console.warn('IndexedDB not supported, falling back to localStorage');
            return;
        }

        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.dbVersion);

            request.onerror = () => {
                console.error('IndexedDB failed to open:', request.error);
                reject(request.error);
            };

            request.onsuccess = () => {
                this.db = request.result;
                console.log('✅ IndexedDB initialized successfully');
                resolve(this.db);
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                
                // Create object store if it doesn't exist
                if (!db.objectStoreNames.contains(this.storeName)) {
                    db.createObjectStore(this.storeName, { keyPath: 'key' });
                    console.log('📦 Created IndexedDB object store');
                }
            };
        });
    }

    async setItem(key, value) {
        // Fallback to localStorage if IndexedDB not supported
        if (!this.isIndexedDBSupported || !this.db) {
            localStorage.setItem(key, value);
            return;
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.put({ key, value });

            request.onsuccess = () => resolve();
            request.onerror = () => {
                console.error('IndexedDB setItem failed, falling back to localStorage');
                localStorage.setItem(key, value);
                reject(request.error);
            };
        });
    }

    async getItem(key) {
        // Fallback to localStorage if IndexedDB not supported
        if (!this.isIndexedDBSupported || !this.db) {
            return localStorage.getItem(key);
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readonly');
            const store = transaction.objectStore(this.storeName);
            const request = store.get(key);

            request.onsuccess = () => {
                const result = request.result;
                resolve(result ? result.value : null);
            };

            request.onerror = () => {
                console.error('IndexedDB getItem failed, falling back to localStorage');
                resolve(localStorage.getItem(key));
            };
        });
    }

    async removeItem(key) {
        // Fallback to localStorage if IndexedDB not supported
        if (!this.isIndexedDBSupported || !this.db) {
            localStorage.removeItem(key);
            return;
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.delete(key);

            request.onsuccess = () => resolve();
            request.onerror = () => {
                console.error('IndexedDB removeItem failed, falling back to localStorage');
                localStorage.removeItem(key);
                reject(request.error);
            };
        });
    }

    async clear() {
        // Fallback to localStorage if IndexedDB not supported
        if (!this.isIndexedDBSupported || !this.db) {
            localStorage.clear();
            return;
        }

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction([this.storeName], 'readwrite');
            const store = transaction.objectStore(this.storeName);
            const request = store.clear();

            request.onsuccess = () => resolve();
            request.onerror = () => {
                console.error('IndexedDB clear failed, falling back to localStorage');
                localStorage.clear();
                reject(request.error);
            };
        });
    }
}

// Create global instance
window.gameStorage = new GameStorage();

// Initialize on page load
window.gameStorage.init().catch(err => {
    console.warn('Failed to initialize IndexedDB, using localStorage fallback:', err);
});
