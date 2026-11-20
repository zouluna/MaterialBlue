import { hooks } from '../core/hooks.js';

function defaultFormatCount(count) {
  if (!Number.isFinite(count) || count <= 0) return '';
  if (count >= 1000) {
    return `${(count / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  }
  return String(count);
}

export class MbActions extends HTMLElement {
  constructor() {
    super();
    this._post = null;
    this._client = null;
    this._formatCount = defaultFormatCount;
    this._t = (key) => key;
  }

  set post(value) { this._post = value ?? null; this.render(); }
  get post() { return this._post; }
  set client(value) { this._client = value ?? null; }
  get client() { return this._client; }
  set formatCount(fn) { if (typeof fn === 'function') this._formatCount = fn; }
  set translator(fn) { if (typeof fn === 'function') this._t = fn; }

  connectedCallback() {
    if (this._post && !this.hasChildNodes()) this.render();
  }

  render() {
    this.replaceChildren();
    const post = this._post;
    if (!post || typeof post !== 'object') return;

    const row = document.createElement('div');
    row.className = 'mb-actions';
    const liked = Boolean(post.viewer?.like);
    const reposted = Boolean(post.viewer?.repost);
    const saved = Boolean(this._client?.isSaved?.(post.uri) || post.viewer?.bookmarked);

    row.appendChild(this._createButton({ action: 'reply', icon: 'chat_bubble_outline', label: 'Reply', count: post.replyCount ?? 0, active: false }));
    row.appendChild(this._createButton({ action: 'repost', icon: reposted ? 'repeat_on' : 'repeat', label: 'Repost', count: post.repostCount ?? 0, active: reposted }));
    row.appendChild(this._createButton({ action: 'quote', icon: 'format_quote', label: 'Quote', count: post.quoteCount ?? 0, active: false }));
    row.appendChild(this._createButton({ action: 'like', icon: liked ? 'favorite' : 'favorite_border', label: 'Like', count: post.likeCount ?? 0, active: liked, extraClass: 'favorite-icon' }));
    row.appendChild(this._createButton({ action: 'bookmark', icon: saved ? 'bookmark' : 'bookmark_border', label: 'Bookmark', count: null, active: saved, extraClass: 'save-icon' }));
    row.appendChild(this._createButton({ action: 'share', icon: 'share', label: 'Share', count: null, active: false }));

    this.appendChild(row);
    hooks.call('actions.render', post, this);
  }

  _createButton({ action, icon, label, count, active, extraClass = '' }) {
    const btn = document.createElement('md-text-button');
    btn.className = `mb-action-btn mb-action-${action}`;
    btn.dataset.action = action;
    btn.setAttribute('aria-label', label);
    if (active) btn.classList.add('is-active');

    const iconEl = document.createElement('md-icon');
    iconEl.className = `mb-action-icon ${extraClass}`.trim();
    if (active) iconEl.classList.add('is-filled');
    iconEl.textContent = icon;
    btn.appendChild(iconEl);

    if (count !== null && count !== undefined) {
      const formatted = this._formatCount(count);
      if (formatted) {
        const badge = document.createElement('span');
        badge.className = 'mb-action-count';
        badge.textContent = formatted;
        btn.appendChild(badge);
      }
    }

    btn.addEventListener('click', (event) => {
      event.stopPropagation();
      this._handleAction(action);
    });
    return btn;
  }

  async _handleAction(action) {
    const post = this._post;
    if (!post) return;
    const detail = { action, post, element: this };
    const shouldContinue = this.dispatchEvent(new CustomEvent('mb:action', { detail, bubbles: true, cancelable: true }));
    hooks.call('post.action', detail);
    if (!shouldContinue) return;
    if (action === 'share') { await this._performShare(post); return; }
    if (!this._client) return;
    if (action === 'like') await this._performLike(post);
    else if (action === 'repost') await this._performRepost(post);
    else if (action === 'bookmark') await this._performBookmark(post);
  }

  async _performLike(post) {
    const likeUri = post.viewer?.like;
    if (likeUri) {
      await this._client.unlike(likeUri);
      post.viewer = { ...post.viewer, like: undefined };
      post.likeCount = Math.max(0, (post.likeCount || 1) - 1);
    } else {
      const res = await this._client.like(post.uri, post.cid);
      post.viewer = { ...post.viewer, like: res?.uri || 'liked' };
      post.likeCount = (post.likeCount || 0) + 1;
    }
    this.render();
  }

  async _performRepost(post) {
    const repostUri = post.viewer?.repost;
    if (repostUri) {
      await this._client.unrepost(repostUri);
      post.viewer = { ...post.viewer, repost: undefined };
      post.repostCount = Math.max(0, (post.repostCount || 1) - 1);
    } else {
      const res = await this._client.repost(post.uri, post.cid);
      post.viewer = { ...post.viewer, repost: res?.uri || 'reposted' };
      post.repostCount = (post.repostCount || 0) + 1;
    }
    this.render();
  }

  async _performBookmark(post) {
    const saved = Boolean(this._client.isSaved?.(post.uri));
    if (saved) {
      await this._client.unsave(post.uri, post.cid);
      post.viewer = { ...post.viewer, bookmarked: false };
    } else {
      await this._client.save(post.uri, post.cid);
      post.viewer = { ...post.viewer, bookmarked: true };
    }
    this.render();
  }

  async _performShare(post) {
    const handle = post.author?.handle;
    const rkey = typeof post.uri === 'string' ? post.uri.split('/').pop() : '';
    const url = handle && rkey ? `https://bsky.app/profile/${handle}/post/${rkey}` : post.uri;
    if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
      try { await navigator.share({ title: post.author?.displayName || handle || 'Bluesky Post', text: post.record?.text || '', url }); return; } catch {}
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText && url) {
      try { await navigator.clipboard.writeText(url); } catch {}
    }
  }
}

export function registerMbActions() {
  if (typeof customElements !== 'undefined' && !customElements.get('mb-actions')) {
    customElements.define('mb-actions', MbActions);
  }
}
