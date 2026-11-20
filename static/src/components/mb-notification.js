import { hooks } from '../core/hooks.js';

const REASON_ICONS = Object.freeze({
  like: 'favorite',
  repost: 'repeat',
  follow: 'person_add',
  mention: 'alternate_email',
  reply: 'reply',
  quote: 'format_quote',
});

export class MbNotification extends HTMLElement {
  constructor() {
    super();
    this._notification = null;
    this._client = null;
    this._t = (key) => key;
    this._formatters = {};
  }

  set notification(value) { this._notification = value ?? null; this.render(); }
  get notification() { return this._notification; }
  set client(value) { this._client = value ?? null; }
  set translator(fn) { if (typeof fn === 'function') this._t = fn; }
  set formatters(value) { this._formatters = value || {}; }

  connectedCallback() {
    if (this._notification && !this.hasChildNodes()) this.render();
  }

  render() {
    this.replaceChildren();
    const n = this._notification;
    if (!n || typeof n !== 'object') return;

    const item = document.createElement('div');
    item.className = 'mb-notification';
    if (!n.isRead) item.classList.add('is-unread');

    const header = document.createElement('div');
    header.className = 'mb-notification-header';
    const icon = document.createElement('md-icon');
    icon.className = `mb-notification-icon reason-${n.reason || 'unknown'}`;
    icon.textContent = REASON_ICONS[n.reason] || 'notifications';
    header.appendChild(icon);

    const summary = document.createElement('div');
    summary.className = 'mb-notification-summary';
    const actorName = document.createElement('span');
    actorName.className = 'mb-notification-actor';
    actorName.textContent = n.author?.displayName || n.author?.handle || '';
    summary.appendChild(actorName);

    const label = document.createElement('span');
    label.className = 'mb-notification-label';
    const key = `notification.label.${n.reason || 'fallback'}`;
    const translated = this._t(key);
    label.textContent = translated !== key ? ` ${translated}` : ` (${n.reason || 'notification'})`;
    summary.appendChild(label);

    header.appendChild(summary);
    item.appendChild(header);

    if (n.post && typeof n.post === 'object') {
      const postEl = document.createElement('mb-post');
      postEl.translator = this._t;
      postEl.formatters = this._formatters;
      postEl.client = this._client;
      postEl.post = n.post;
      item.appendChild(postEl);
    }

    this.appendChild(item);
    hooks.call('notification.render', n, this);
  }
}

export function registerMbNotification() {
  if (typeof customElements !== 'undefined' && !customElements.get('mb-notification')) {
    customElements.define('mb-notification', MbNotification);
  }
}
