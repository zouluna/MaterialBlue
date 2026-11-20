import { hooks } from './core/hooks.js';
import { plugins, ensureMaterialBlueGlobal } from './core/plugin.js';
import { MaterialBlueAPI, LEXICONS } from './core/api.js';
import { state } from './core/state.js';
import { registerMbEmbed } from './components/mb-embed.js';
import { registerMbActions } from './components/mb-actions.js';
import { registerMbPost } from './components/mb-post.js';
import { registerMbNotification } from './components/mb-notification.js';

export function initMaterialBlueV2(bskyClient = null) {
  registerMbEmbed();
  registerMbActions();
  registerMbPost();
  registerMbNotification();

  const api = bskyClient ? new MaterialBlueAPI(bskyClient) : null;
  if (api) {
    state.attachAPI(api);
  }

  return ensureMaterialBlueGlobal({
    version: '2.0.0-alpha',
    hooks,
    plugins,
    state,
    api,
    LEXICONS,
  });
}

if (typeof window !== 'undefined') {
  initMaterialBlueV2(null);
}
