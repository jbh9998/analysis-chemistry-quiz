(() => {
  "use strict";

  const SYNC_API = "https://api.jsonstorage.net/v1/json";

  class SyncManager {
    constructor() {
      this.syncId = localStorage.getItem("quiz_sync_id");
      this.syncKey = localStorage.getItem("quiz_sync_key");
      this.lastSyncTime = 0;
      this.syncInterval = null;
    }

    isEnabled() {
      return !!(this.syncId && this.syncKey);
    }

    async createSync() {
      const syncKey = this.generateKey();
      const initialData = {
        practiced: {},
        wrong: {},
        stats: { answered: 0, correct: 0 },
        imported: [],
        version: 1,
        lastModified: Date.now()
      };

      try {
        const response = await fetch(SYNC_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(initialData)
        });

        if (!response.ok) throw new Error("创建同步失败");

        const result = await response.json();
        const syncId = result.uri.split("/").pop();

        this.syncId = syncId;
        this.syncKey = syncKey;
        localStorage.setItem("quiz_sync_id", syncId);
        localStorage.setItem("quiz_sync_key", syncKey);

        return { syncId, syncKey };
      } catch (error) {
        console.error("创建同步失败:", error);
        throw error;
      }
    }

    async loadSync(syncId, syncKey) {
      try {
        const response = await fetch(`${SYNC_API}/${syncId}`, {
          headers: { "Content-Type": "application/json" }
        });

        if (!response.ok) throw new Error("加载同步数据失败");

        const data = await response.json();

        this.syncId = syncId;
        this.syncKey = syncKey;
        localStorage.setItem("quiz_sync_id", syncId);
        localStorage.setItem("quiz_sync_key", syncKey);

        return data;
      } catch (error) {
        console.error("加载同步数据失败:", error);
        throw error;
      }
    }

    async pushData(data) {
      if (!this.isEnabled()) return false;

      const payload = {
        ...data,
        version: (data.version || 0) + 1,
        lastModified: Date.now()
      };

      try {
        const response = await fetch(`${SYNC_API}/${this.syncId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (!response.ok) throw new Error("上传数据失败");

        this.lastSyncTime = Date.now();
        return true;
      } catch (error) {
        console.error("上传数据失败:", error);
        return false;
      }
    }

    async pullData() {
      if (!this.isEnabled()) return null;

      try {
        const response = await fetch(`${SYNC_API}/${this.syncId}`);

        if (!response.ok) throw new Error("拉取数据失败");

        const data = await response.json();
        this.lastSyncTime = Date.now();
        return data;
      } catch (error) {
        console.error("拉取数据失败:", error);
        return null;
      }
    }

    startAutoSync(callback, intervalMs = 30000) {
      if (this.syncInterval) {
        clearInterval(this.syncInterval);
      }

      this.syncInterval = setInterval(async () => {
        const data = await this.pullData();
        if (data && callback) {
          callback(data);
        }
      }, intervalMs);
    }

    stopAutoSync() {
      if (this.syncInterval) {
        clearInterval(this.syncInterval);
        this.syncInterval = null;
      }
    }

    disableSync() {
      this.stopAutoSync();
      this.syncId = null;
      this.syncKey = null;
      localStorage.removeItem("quiz_sync_id");
      localStorage.removeItem("quiz_sync_key");
    }

    getSyncCode() {
      if (!this.isEnabled()) return null;
      return `${this.syncId}:${this.syncKey}`;
    }

    parseSyncCode(code) {
      const parts = code.trim().split(":");
      if (parts.length === 2) {
        return { syncId: parts[0], syncKey: parts[1] };
      }
      return null;
    }

    generateKey() {
      return Array.from(crypto.getRandomValues(new Uint8Array(16)))
        .map(b => b.toString(16).padStart(2, "0"))
        .join("");
    }
  }

  window.SyncManager = SyncManager;
})();
