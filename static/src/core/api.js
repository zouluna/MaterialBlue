export const LEXICONS = Object.freeze({
  SETTINGS: 'app.materialblue.settings',
  PLUGIN: 'app.materialblue.plugin',
  BOOKMARK: 'app.materialblue.bookmark',
  PREFERENCE: 'app.materialblue.preference',
  FEED: 'app.materialblue.feed',
});

export class MaterialBlueAPI {
  constructor(bskyClient) {
    this.client = bskyClient;
  }

  getSessionDid() {
    if (!this.client) return null;
    if (typeof this.client.getDid === 'function') {
      return this.client.getDid();
    }
    return this.client.agent?.session?.did ?? this.client.session?.did ?? null;
  }

  getAgent() {
    return this.client?.agent ?? null;
  }

  async getRecord(collection, rkey = 'self') {
    const agent = this.getAgent();
    const repo = this.getSessionDid();
    if (!agent || !repo) return null;
    try {
      const res = await agent.com.atproto.repo.getRecord({ repo, collection, rkey });
      return res?.data?.value ?? null;
    } catch (err) {
      const msg = String(err?.message || err || '');
      if (err?.status === 400 || msg.includes('RecordNotFound') || msg.includes('Could not locate record')) {
        return null;
      }
      throw err;
    }
  }

  async putRecord(collection, record, rkey = 'self') {
    const agent = this.getAgent();
    const repo = this.getSessionDid();
    if (!agent || !repo) {
      throw new Error('Not authenticated: cannot write ATProto record');
    }
    const res = await agent.com.atproto.repo.putRecord({
      repo,
      collection,
      rkey,
      record: { $type: collection, ...record },
    });
    return res?.data ?? null;
  }

  async listRecords(collection, limit = 50) {
    const agent = this.getAgent();
    const repo = this.getSessionDid();
    if (!agent || !repo) return [];
    const res = await agent.com.atproto.repo.listRecords({ repo, collection, limit });
    return res?.data?.records ?? [];
  }

  async deleteRecord(collection, rkey) {
    const agent = this.getAgent();
    const repo = this.getSessionDid();
    if (!agent || !repo) return false;
    await agent.com.atproto.repo.deleteRecord({ repo, collection, rkey });
    return true;
  }

  async loadSettings() {
    return this.getRecord(LEXICONS.SETTINGS, 'self');
  }

  async saveSettings(settings) {
    return this.putRecord(LEXICONS.SETTINGS, {
      ...settings,
      updatedAt: new Date().toISOString(),
    }, 'self');
  }

  async savePluginState(pluginName, enabled, config = {}) {
    const safeKey = pluginName.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 64) || 'plugin';
    return this.putRecord(LEXICONS.PLUGIN, {
      plugin: pluginName,
      enabled: Boolean(enabled),
      config,
      updatedAt: new Date().toISOString(),
    }, safeKey);
  }
}
