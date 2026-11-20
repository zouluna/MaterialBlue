/**
 * MaterialBlue Plugin API
 * MaterialBlue.plugins.register(...) による拡張登録とライフサイクル管理を行う。
 */

import { hooks as defaultHooks } from './hooks.js';

export class PluginManager {
  constructor(hooksRegistry = defaultHooks) {
    this.hooks = hooksRegistry;
    this._plugins = new Map();
  }

  register(pluginDef) {
    if (!pluginDef || typeof pluginDef.name !== 'string' || !pluginDef.name.trim()) {
      throw new TypeError('Plugin definition must include a non-empty "name" string');
    }
    const name = pluginDef.name.trim();
    if (this._plugins.has(name)) {
      this.unregister(name);
    }
    const enabled = pluginDef.enabled !== false;
    const record = { definition: pluginDef, enabled, disposers: [] };
    this._plugins.set(name, record);
    if (enabled) {
      this._activate(record);
    }
    this.hooks.call('plugin.registered', name, pluginDef);
    return pluginDef;
  }

  unregister(name) {
    const record = this._plugins.get(name);
    if (!record) return false;
    this._deactivate(record);
    this._plugins.delete(name);
    this.hooks.call('plugin.unregistered', name);
    return true;
  }

  setEnabled(name, enabled) {
    const record = this._plugins.get(name);
    if (!record) return false;
    const next = Boolean(enabled);
    if (record.enabled === next) return true;
    record.enabled = next;
    if (next) {
      this._activate(record);
    } else {
      this._deactivate(record);
    }
    this.hooks.call('plugin.toggled', name, next);
    return true;
  }

  get(name) {
    return this._plugins.get(name)?.definition ?? null;
  }

  list() {
    return Array.from(this._plugins.entries()).map(([name, rec]) => ({
      name,
      version: rec.definition.version || '0.0.0',
      description: rec.definition.description || '',
      enabled: rec.enabled,
    }));
  }

  _activate(record) {
    const def = record.definition;
    const bind = (hookName, fn) => {
      if (typeof fn === 'function') {
        record.disposers.push(this.hooks.on(hookName, fn.bind(def)));
      }
    };
    bind('post.render', def.onPostRender);
    bind('notification.render', def.onNotificationRender);
    bind('timeline.loaded', def.onTimelineLoaded);
    bind('post.action', def.onAction);
    if (def.hooks && typeof def.hooks === 'object') {
      for (const [hookName, fn] of Object.entries(def.hooks)) {
        bind(hookName, fn);
      }
    }
    if (typeof def.init === 'function') {
      try {
        def.init({ hooks: this.hooks, plugin: def });
      } catch (err) {
        console.error(`[MaterialBlue plugins] Error in init() of "${def.name}":`, err);
      }
    }
  }

  _deactivate(record) {
    while (record.disposers.length > 0) {
      const dispose = record.disposers.pop();
      try { dispose(); } catch {}
    }
  }
}

export const plugins = new PluginManager(defaultHooks);

export function ensureMaterialBlueGlobal(extra = {}) {
  const root = typeof globalThis !== 'undefined' ? globalThis : window;
  if (!root.MaterialBlue) {
    root.MaterialBlue = {};
  }
  root.MaterialBlue.hooks = defaultHooks;
  root.MaterialBlue.plugins = plugins;
  Object.assign(root.MaterialBlue, extra);
  return root.MaterialBlue;
}
