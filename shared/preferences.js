/**
 * 主题 / 字体偏好 — localStorage 持久化，全站共用
 */
const HubPrefs = {
  KEY: 'learning-hub-prefs',
  defaults: {
    theme: 'dark',
    fontSize: 'md',
    codePanel: 'auto',
    quizMode: 'all',
    connectorStyle: 'horizontal',
    narrate: 'off'
  },

  load() {
    try {
      return { ...this.defaults, ...JSON.parse(localStorage.getItem(this.KEY) || '{}') };
    } catch {
      return { ...this.defaults };
    }
  },

  save(prefs) {
    localStorage.setItem(this.KEY, JSON.stringify(prefs));
    this.apply(prefs);
    window.dispatchEvent(new CustomEvent('hubprefschange', { detail: prefs }));
  },

  resolvedTheme(prefs) {
    const t = prefs?.theme ?? this.load().theme;
    if (t === 'auto') {
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return t === 'light' ? 'light' : 'dark';
  },

  apply(prefs) {
    prefs = prefs || this.load();
    const root = document.documentElement;
    root.dataset.theme = this.resolvedTheme(prefs);
    root.dataset.font = prefs.fontSize || 'md';
    if (globalThis.VML?.clearSurfCache) VML.clearSurfCache();
  },

  mount(container) {
    if (!container || container.querySelector('.pref-bar')) return;
    const prefs = this.load();

    const bar = document.createElement('div');
    bar.className = 'pref-bar';
    bar.innerHTML = `
      <div class="pref-group" role="group" aria-label="主题">
        <span class="pref-label">主题</span>
        <button type="button" class="pref-btn" data-theme="dark" title="深色">🌙</button>
        <button type="button" class="pref-btn" data-theme="light" title="浅色">☀️</button>
        <button type="button" class="pref-btn" data-theme="auto" title="跟随系统">A</button>
      </div>
      <div class="pref-group" role="group" aria-label="字号">
        <span class="pref-label">字号</span>
        <button type="button" class="pref-btn icon" data-font="sm" title="较小">A−</button>
        <button type="button" class="pref-btn icon" data-font="md" title="标准">A</button>
        <button type="button" class="pref-btn icon" data-font="lg" title="较大">A+</button>
      </div>
      <div class="pref-group" role="group" aria-label="代码面板">
        <span class="pref-label">代码</span>
        <button type="button" class="pref-btn" data-code="never" title="隐藏">关</button>
        <button type="button" class="pref-btn" data-code="auto" title="L1+ 自动">自动</button>
        <button type="button" class="pref-btn" data-code="always" title="始终显示">开</button>
      </div>
      <div class="pref-group" role="group" aria-label="连线">
        <span class="pref-label">连线</span>
        <button type="button" class="pref-btn" data-conn="horizontal" title="水平">—</button>
        <button type="button" class="pref-btn" data-conn="ortho" title="折线">⌐</button>
        <button type="button" class="pref-btn" data-conn="direct" title="斜线">╱</button>
      </div>
      <div class="pref-group" role="group" aria-label="旁白">
        <span class="pref-label">旁白</span>
        <button type="button" class="pref-btn" data-narrate="off" title="关闭语音讲解">关</button>
        <button type="button" class="pref-btn" data-narrate="on" title="语音讲解，讲完自动进帧">开</button>
      </div>`;

    const syncUI = () => {
      const p = this.load();
      bar.querySelectorAll('[data-theme]').forEach(b => {
        b.classList.toggle('on', b.dataset.theme === p.theme);
      });
      bar.querySelectorAll('[data-font]').forEach(b => {
        b.classList.toggle('on', b.dataset.font === p.fontSize);
      });
      bar.querySelectorAll('[data-code]').forEach(b => {
        b.classList.toggle('on', b.dataset.code === (p.codePanel || 'auto'));
      });
      bar.querySelectorAll('[data-conn]').forEach(b => {
        b.classList.toggle('on', b.dataset.conn === (p.connectorStyle || 'horizontal'));
      });
      bar.querySelectorAll('[data-narrate]').forEach(b => {
        b.classList.toggle('on', b.dataset.narrate === (p.narrate || 'off'));
      });
    };

    bar.querySelectorAll('[data-theme]').forEach(btn => {
      btn.onclick = () => {
        this.save({ ...this.load(), theme: btn.dataset.theme });
        syncUI();
      };
    });
    bar.querySelectorAll('[data-font]').forEach(btn => {
      btn.onclick = () => {
        this.save({ ...this.load(), fontSize: btn.dataset.font });
        syncUI();
      };
    });
    bar.querySelectorAll('[data-code]').forEach(btn => {
      btn.onclick = () => {
        this.save({ ...this.load(), codePanel: btn.dataset.code });
        syncUI();
      };
    });
    bar.querySelectorAll('[data-conn]').forEach(btn => {
      btn.onclick = () => {
        this.save({ ...this.load(), connectorStyle: btn.dataset.conn });
        syncUI();
      };
    });
    bar.querySelectorAll('[data-narrate]').forEach(btn => {
      btn.onclick = () => {
        this.save({ ...this.load(), narrate: btn.dataset.narrate });
        syncUI();
      };
    });

    container.appendChild(bar);
    syncUI();
  },

  initEarly() {
    this.apply(this.load());
    if (window.matchMedia) {
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
        if (this.load().theme === 'auto') this.apply();
      });
    }
  }
};

HubPrefs.initEarly();
globalThis.HubPrefs = HubPrefs;
