const STORAGE_KEY_SETTINGS = 'materialblue.v2.settings';
const STORAGE_KEY_PLUGINS = 'materialblue.v2.plugins';

const DEFAULT_SETTINGS = Object.freeze({
  theme: 'system',
  language: 'ja',
  compactMode: false,
});

function createEvt(name, detail) {
  if (typeof CustomEvent !== 'undefined') {
    return new CustomEvent(name, { detail });
  }
  const ev = new Event(name);
  ev.detail = detail;
  return ev;
}

export class AppState extends EventTarget {
  constructor() {
    super();
    this._settings = this._readStorage(STORAGE_KEY_SETTINGS, { ...DEFAULT_SETTINGS });
    this._pluginStates = this._readStorage(STORAGE_KEY_PLUGINS, {});
    this._timeline = [];
    this._notifications = [];
    this._api = null;
  }

  attachAPI(api) {
    this._api = api;
  }

  get settings() {
    return { ...this._settings };
  }

  get timeline() {
    return this._timeline;
  }

  get notifications() {
    return this._notifications;
  }

  async updateSettings(patch, options = { syncRemote: true }) {
    this._settings = { ...this._settings, ...patch };
    this._writeStorage(STORAGE_KEY_SETTINGS, this._settings);
    this.dispatchEvent(createEvt('settings:change', this.settings));
    if (options.syncRemote !== false && this._api?.getSessionDid()) {
      try {
        await this._api.saveSettings(this._settings);
      } catch (err) {
        console.warn('[MaterialBlue state] Remote settings sync failed:', err);
      }
    }
  }

  async syncFromRemote() {
    if (!this._api?.getSessionDid()) return;
    try {
      const remote = await this._api.loadSettings();
      if (remote && typeof remote === 'object') {
        const { $type: _t, updatedAt: _u, ...rest } = remote;
        await this.updateSettings(rest, { syncRemote: false });
      }
    } catch (err) {
      console.warn('[MaterialBlue state] Failed to load remote settings:', err);
    }
  }

  setTimeline(feed) {
    this._timeline = Array.isArray(feed) ? feed : [];
    this.dispatchEvent(createEvt('timeline:change', this._timeline));
  }

  setNotifications(notifications) {
    this._notifications = Array.isArray(notifications) ? notifications : [];
    this.dispatchEvent(createEvt('notifications:change', this._notifications));
  }

  async setPluginEnabled(pluginName, enabled) {
    this._pluginStates[pluginName] = Boolean(enabled);
    this._writeStorage(STORAGE_KEY_PLUGINS, this._pluginStates);
    this.dispatchEvent(createEvt('plugins:change', { pluginName, enabled }));
    if (this._api?.getSessionDid()) {
      try {
        await this._api.savePluginState(pluginName, enabled);
      } catch (err) {
        console.warn('[MaterialBlue state] Remote plugin state sync failed:', err);
      }
    }
  }

  isPluginEnabled(pluginName) {
    if (Object.prototype.hasOwnProperty.call(this._pluginStates, pluginName)) {
      return Boolean(this._pluginStates[pluginName]);
    }
    return true;
  }

  _readStorage(key, fallback) {
    try {
      if (typeof localStorage === 'undefined') return fallback;
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return { ...fallback, ...JSON.parse(raw) };
    } catch {
      return fallback;
    }
  }

  _writeStorage(key, value) {
    try {
      if (typeof localStorage === 'undefined') return;
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  }
}

export const state = new AppState();
