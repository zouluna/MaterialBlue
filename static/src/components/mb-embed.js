import { hooks } from '../core/hooks.js';

function safeExternalUrl(url) {
  if (typeof url !== 'string') return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.href;
    }
  } catch {
    return null;
  }
  return null;
}

export class MbEmbed extends HTMLElement {
  constructor() {
    super();
    this._embed = null;
    this._t = (key, fallback) => fallback ?? key;
  }

  set embed(value) {
    this._embed = value ?? null;
    this.render();
  }

  get embed() {
    return this._embed;
  }

  set translator(translator) {
    if (typeof translator === 'function') {
      this._t = translator;
    }
  }

  connectedCallback() {
    if (this._embed && !this.hasChildNodes()) {
      this.render();
    }
  }

  render() {
    this.replaceChildren();
    const embed = this._embed;
    if (!embed || typeof embed !== 'object') return;

    const wrapper = document.createElement('div');
    wrapper.className = 'mb-embed';
    const type = String(embed.$type || '');

    if (type.includes('recordWithMedia')) {
      this._renderRecordWithMedia(wrapper, embed);
    } else if (type.includes('images') || Array.isArray(embed.images)) {
      this._renderImages(wrapper, embed.images || []);
    } else if (type.includes('video') || embed.playlist) {
      this._renderVideo(wrapper, embed);
    } else if (type.includes('external') || embed.external) {
      this._renderExternal(wrapper, embed.external || embed);
    } else if (type.includes('record') || embed.record) {
      this._renderRecord(wrapper, embed.record || embed);
    } else {
      this._renderUnsupported(wrapper, type);
    }

    if (wrapper.hasChildNodes()) {
      this.appendChild(wrapper);
      hooks.call('embed.render', embed, this);
    }
  }

  _renderImages(container, images) {
    if (!Array.isArray(images) || images.length === 0) return;
    const grid = document.createElement('div');
    grid.className = 'mb-embed-images';
    grid.dataset.count = String(Math.min(images.length, 4));

    for (const img of images) {
      const src = safeExternalUrl(img?.fullsize || img?.thumb || img?.thumbnail);
      if (!src) continue;
      const thumbUrl = safeExternalUrl(img?.thumb || img?.thumbnail) || src;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mb-embed-image-btn';
      btn.setAttribute('aria-label', img?.alt || 'Embedded image');

      const imgEl = document.createElement('img');
      imgEl.className = 'mb-embed-image';
      imgEl.src = thumbUrl;
      imgEl.alt = typeof img?.alt === 'string' ? img.alt : '';
      imgEl.loading = 'lazy';

      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        window.open(src, '_blank', 'noopener,noreferrer');
      });
      btn.appendChild(imgEl);
      grid.appendChild(btn);
    }
    if (grid.hasChildNodes()) container.appendChild(grid);
  }

  _renderVideo(container, embed) {
    const box = document.createElement('div');
    box.className = 'mb-embed-video';
    const thumbUrl = safeExternalUrl(embed.thumbnail);
    const playlistUrl = safeExternalUrl(embed.playlist);

    if (thumbUrl) {
      const poster = document.createElement('img');
      poster.className = 'mb-embed-video-thumb';
      poster.src = thumbUrl;
      poster.alt = typeof embed.alt === 'string' ? embed.alt : 'Video thumbnail';
      poster.loading = 'lazy';
      box.appendChild(poster);
    }

    const badge = document.createElement('span');
    badge.className = 'mb-embed-video-badge';
    badge.textContent = 'VIDEO';
    box.appendChild(badge);

    if (playlistUrl) {
      const link = document.createElement('a');
      link.className = 'mb-embed-video-link';
      link.href = playlistUrl;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.textContent = embed.alt || 'Open video stream';
      link.addEventListener('click', (e) => e.stopPropagation());
      box.appendChild(link);
    }
    container.appendChild(box);
  }

  _renderExternal(container, ext) {
    if (!ext || typeof ext !== 'object') return;
    const href = safeExternalUrl(ext.uri);
    const card = document.createElement(href ? 'a' : 'div');
    card.className = 'mb-embed-external';
    if (href) {
      card.href = href;
      card.target = '_blank';
      card.rel = 'noopener noreferrer';
      card.addEventListener('click', (e) => e.stopPropagation());
    }
    const thumbUrl = safeExternalUrl(ext.thumb);
    if (thumbUrl) {
      const img = document.createElement('img');
      img.className = 'mb-embed-external-thumb';
      img.src = thumbUrl;
      img.alt = '';
      img.loading = 'lazy';
      card.appendChild(img);
    }
    const body = document.createElement('div');
    body.className = 'mb-embed-external-body';
    const title = document.createElement('div');
    title.className = 'mb-embed-external-title';
    title.textContent = ext.title || href || '';
    body.appendChild(title);
    if (ext.description) {
      const desc = document.createElement('div');
      desc.className = 'mb-embed-external-desc';
      desc.textContent = ext.description;
      body.appendChild(desc);
    }
    if (href) {
      const host = document.createElement('div');
      host.className = 'mb-embed-external-host';
      try { host.textContent = new URL(href).hostname; } catch { host.textContent = href; }
      body.appendChild(host);
    }
    card.appendChild(body);
    container.appendChild(card);
  }

  _renderRecord(container, recordView) {
    if (!recordView || typeof recordView !== 'object') return;
    const inner = recordView.record || recordView;
    const type = String(inner.$type || recordView.$type || '');
    const card = document.createElement('div');
    card.className = 'mb-embed-record';

    if (type.includes('viewNotFound') || type.includes('viewBlocked') || type.includes('viewDetached')) {
      card.classList.add('is-unavailable');
      card.textContent = type.includes('Blocked') ? 'Blocked post' : type.includes('NotFound') ? 'Post not found' : 'Quoted post unavailable';
      container.appendChild(card);
      return;
    }

    const author = inner.author;
    if (author) {
      const header = document.createElement('div');
      header.className = 'mb-embed-record-author';
      const nameEl = document.createElement('span');
      nameEl.className = 'mb-embed-record-name';
      nameEl.textContent = author.displayName || author.handle || '';
      header.appendChild(nameEl);
      if (author.handle) {
        const handleEl = document.createElement('span');
        handleEl.className = 'mb-embed-record-handle';
        handleEl.textContent = `@${author.handle}`;
        header.appendChild(handleEl);
      }
      card.appendChild(header);
    }

    const text = inner.value?.text ?? inner.text ?? inner.displayName ?? '';
    if (text) {
      const textEl = document.createElement('div');
      textEl.className = 'mb-embed-record-text';
      textEl.textContent = text;
      card.appendChild(textEl);
    }

    if (Array.isArray(inner.embeds) && inner.embeds.length > 0) {
      const nested = document.createElement('mb-embed');
      nested.embed = inner.embeds[0];
      card.appendChild(nested);
    }
    container.appendChild(card);
  }

  _renderRecordWithMedia(container, embed) {
    const group = document.createElement('div');
    group.className = 'mb-embed-record-with-media';
    if (embed.media) {
      const mediaEl = document.createElement('mb-embed');
      mediaEl.embed = embed.media;
      group.appendChild(mediaEl);
    }
    if (embed.record) {
      const recordEl = document.createElement('mb-embed');
      recordEl.embed = embed.record;
      group.appendChild(recordEl);
    }
    if (group.hasChildNodes()) container.appendChild(group);
  }

  _renderUnsupported(container, type) {
    if (!type) return;
    const note = document.createElement('div');
    note.className = 'mb-embed-unsupported';
    note.textContent = `Unsupported embed: ${type}`;
    container.appendChild(note);
  }
}

export function registerMbEmbed() {
  if (typeof customElements !== 'undefined' && !customElements.get('mb-embed')) {
    customElements.define('mb-embed', MbEmbed);
  }
}
