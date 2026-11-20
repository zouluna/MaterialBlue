import { hooks } from '../core/hooks.js';

export class MbPost extends HTMLElement {
  constructor() {
    super();
    this._item = null;
    this._post = null;
    this._client = null;
    this._formatRelativeTime = null;
    this._formatCompactNumber = null;
    this._t = (key, params) => {
      if (key === 'post.repostedBy' && params?.name) {
        return `Reposted by ${params.name}`;
      }
      return key;
    };
  }

  set post(value) {
    if (!value) {
      this._item = null;
      this._post = null;
      this.replaceChildren();
      return;
    }
    if (value.post && typeof value.post === 'object') {
      this._item = value;
      this._post = value.post;
    } else {
      this._item = { post: value };
      this._post = value;
    }
    if (this._post?.uri) {
      this.dataset.postUri = this._post.uri;
    }
    this.render();
  }

  get post() {
    return this._post;
  }

  set client(value) {
    this._client = value ?? null;
    const actions = this.querySelector('mb-actions');
    if (actions) actions.client = this._client;
  }

  set translator(fn) {
    if (typeof fn === 'function') this._t = fn;
  }

  set formatters({ relativeTime, compactNumber } = {}) {
    if (typeof relativeTime === 'function') this._formatRelativeTime = relativeTime;
    if (typeof compactNumber === 'function') this._formatCompactNumber = compactNumber;
  }

  connectedCallback() {
    if (this._post && !this.hasChildNodes()) this.render();
  }

  render() {
    this.replaceChildren();
    const post = this._post;
    const item = this._item;
    if (!post || typeof post !== 'object') return;

    const article = document.createElement('article');
    article.className = 'mb-post';
    if (post.uri) article.dataset.postUri = post.uri;

    if (item?.reason?.$type === 'app.bsky.feed.defs#reasonRepost') {
      const reposter = item.reason.by;
      const reposterName = reposter?.displayName || reposter?.handle || '';
      const overline = document.createElement('div');
      overline.className = 'mb-post-overline';
      const icon = document.createElement('md-icon');
      icon.textContent = 'repeat';
      overline.appendChild(icon);
      const label = document.createElement('span');
      label.textContent = this._t('post.repostedBy', { name: reposterName });
      overline.appendChild(label);
      article.appendChild(overline);
    }

    article.appendChild(this._createHeader(post));

    if (item?.reply) {
      const replyContext = this._createReplyContext(item.reply);
      if (replyContext) article.appendChild(replyContext);
    }

    const record = post.record || {};
    if (typeof record.text === 'string' && record.text.length > 0) {
      const body = document.createElement('div');
      body.className = 'mb-post-body';
      body.textContent = record.text;
      article.appendChild(body);
    }

    const embedData = post.embed || record.embed;
    if (embedData) {
      const embedEl = document.createElement('mb-embed');
      embedEl.translator = this._t;
      embedEl.embed = embedData;
      article.appendChild(embedEl);
    }

    const actionsEl = document.createElement('mb-actions');
    actionsEl.client = this._client;
    actionsEl.translator = this._t;
    if (this._formatCompactNumber) actionsEl.formatCount = this._formatCompactNumber;
    actionsEl.post = post;
    article.appendChild(actionsEl);

    this.appendChild(article);
    hooks.call('post.render', post, this);
  }

  _createHeader(post) {
    const header = document.createElement('header');
    header.className = 'mb-post-header';

    const avatarWrap = document.createElement('div');
    avatarWrap.className = 'mb-post-avatar';
    if (post.author?.avatar) {
      const img = document.createElement('img');
      img.src = post.author.avatar;
      img.alt = post.author.displayName || post.author.handle || '';
      img.loading = 'lazy';
      avatarWrap.appendChild(img);
    } else {
      const icon = document.createElement('md-icon');
      icon.textContent = 'account_circle';
      avatarWrap.appendChild(icon);
    }
    header.appendChild(avatarWrap);

    const authorLine = document.createElement('div');
    authorLine.className = 'post-author-line mb-post-author';
    const nameEl = document.createElement('span');
    nameEl.className = 'post-author-name';
    nameEl.textContent = post.author?.displayName || post.author?.handle || '';
    authorLine.appendChild(nameEl);

    if (post.author?.handle) {
      const handleEl = document.createElement('span');
      handleEl.className = 'post-author-id';
      handleEl.textContent = `@${post.author.handle}`;
      authorLine.appendChild(handleEl);
    }

    const createdAt = post.record?.createdAt || post.indexedAt;
    if (createdAt) {
      const timeEl = document.createElement('time');
      timeEl.className = 'mb-post-time';
      timeEl.dateTime = createdAt;
      timeEl.textContent = this._formatRelativeTime ? this._formatRelativeTime(createdAt) : new Date(createdAt).toLocaleString();
      authorLine.appendChild(timeEl);
    }
    header.appendChild(authorLine);
    return header;
  }

  _createReplyContext(reply) {
    const candidates = [reply.root, reply.parent].filter((p) => p && p.uri);
    if (candidates.length === 0) return null;
    const seen = new Set();
    const thread = [];
    for (const p of candidates) {
      if (!seen.has(p.uri)) {
        seen.add(p.uri);
        thread.push(p);
      }
    }
    const container = document.createElement('div');
    container.className = 'mb-post-reply-thread';
    for (const replyPost of thread) {
      const card = document.createElement('div');
      card.className = 'mb-post-reply-card';
      const author = document.createElement('div');
      author.className = 'post-author-line';
      const name = document.createElement('span');
      name.className = 'post-author-name';
      name.textContent = replyPost.author?.displayName || replyPost.author?.handle || '';
      author.appendChild(name);
      card.appendChild(author);
      if (replyPost.record?.text) {
        const text = document.createElement('div');
        text.className = 'mb-post-reply-text';
        text.textContent = replyPost.record.text;
        card.appendChild(text);
      }
      container.appendChild(card);
    }
    return container;
  }
}

export function registerMbPost() {
  if (typeof customElements !== 'undefined' && !customElements.get('mb-post')) {
    customElements.define('mb-post', MbPost);
  }
}
