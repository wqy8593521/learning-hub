/**
 * 首页文档站 — VitePress 风格指南 + 侧栏课程目录
 */
const HubDocs = {
  REPO: 'https://github.com/wqy8593521/learning-hub',
  PAGES: {
    intro: {
      title: '项目介绍',
      html: `
        <h1>Learning Hub</h1>
        <p class="lead">可 Fork 的、Agent 驱动的<strong>可视化后端学习库</strong>——把面经考点变成可交互的 SVG 机制动画，支持 L0/L1/L2 剖面、插题测验与口语旁白。</p>
        <div class="vp-hero-actions">
          <a class="vp-btn primary" href="#quickstart">快速开始</a>
          <a class="vp-btn" href="__REPO__" target="_blank" rel="noopener">GitHub 仓库</a>
          <a class="vp-btn" href="#lesson/concurrent-hashmap">试看一课</a>
        </div>

        <h2 id="what">这是什么</h2>
        <p>传统面经是<strong>静态文字</strong>：HashMap 扩容、Redis 持久化、MySQL 事务隔离……背了忘、忘了背。Learning Hub 用 <strong>VML（.learn）</strong> 把机制画成逐步展开的动画，配合 <strong>L0 现象 → L1 机制 → L2 底层</strong> 三层剖面，让你「看见」而不是「死记」。</p>
        <ul>
          <li><strong>零构建</strong>：纯静态 HTML/JS，clone 即用，GitHub Pages 一键部署</li>
          <li><strong>Agent 生产</strong>：Cursor / Codex 按 Skill 写 <code>lesson.learn</code>，人只审内容</li>
          <li><strong>可 Fork</strong>：删示例、加自己的课，变成你的个人可视化知识库</li>
        </ul>

        <h2 id="stack">技术栈</h2>
        <table>
          <thead><tr><th>文件</th><th>作用</th></tr></thead>
          <tbody>
            <tr><td><code>lesson.learn</code></td><td>VML 动画 DSL（Python 风格缩进）</td></tr>
            <tr><td><code>lesson.quiz</code></td><td>插题 DSL + 错题本（localStorage）</td></tr>
            <tr><td><code>lesson.narrate</code></td><td>口语旁白稿，可预生成 MP3</td></tr>
            <tr><td><code>manifest.yaml</code></td><td>科目 / 章节 / 标签元数据</td></tr>
          </tbody>
        </table>

        <h2 id="flow">内容流水线</h2>
        <pre><code>Agent 写 lesson.learn / lesson.quiz / lesson.narrate（可选）
        ↓
  node bin/learning-hub.js validate
        ↓
  node bin/learning-hub.js narrate（可选）
        ↓
  node bin/learning-hub.js sync → library/index.json
        ↓
  GitHub Pages / 本地 serve</code></pre>
      `
    },
    interview: {
      title: '面经怎么用',
      html: `
        <h1>面经怎么用</h1>
        <p class="lead">本库课程按<strong>后端八股 / 面经考点</strong>组织，覆盖 Java 并发、JVM、Redis、MySQL、Spring、分布式等高频面试方向。</p>

        <h2 id="map">与 JavaGuide 的关系</h2>
        <p>如果你用过 <a href="https://javaguide.cn/" target="_blank" rel="noopener">JavaGuide</a> 或 VitePress 类教程，<strong>左侧</strong>是指南 + 课程目录，<strong>右侧</strong>是当前指南页的页内目录。点课后中间显示学习摘要与机制动画。</p>
        <blockquote>文字讲「是什么」，动画讲「怎么动」——建议先看 L0 建立直觉，再切 L1/L2 应对深挖。</blockquote>

        <h2 id="depth">L0 / L1 / L2 剖面</h2>
        <ul>
          <li><strong>L0 现象</strong>：面试先答得出的结论（如「缓存击穿打穿 DB」）</li>
          <li><strong>L1 机制</strong>：关键步骤与组件交互（锁、队列、协议包）</li>
          <li><strong>L2 底层</strong>：源码级 / 协议级细节（AQS、B+ 树页分裂）</li>
        </ul>
        <p>播放器底栏可切换剖面；部分课在 L1+ 会展开<strong>代码面板</strong>。</p>

        <h2 id="quiz">测验与错题本</h2>
        <p>含 <code>lesson.quiz</code> 的课会在每步结束后插题。答错自动记入<strong>错题本</strong>（见侧栏「错题本」），数据存在浏览器 localStorage，换设备不同步。</p>

        <h2 id="narrate">旁白</h2>
        <p>顶栏偏好里可开「旁白」。有 <code>audio/</code> 的课播预生成 MP3；否则回退浏览器 TTS。快捷键 <code>N</code> 切换。</p>

        <h2 id="tags">如何按考点找课</h2>
        <p>顶栏搜索框可搜科目、章节、标签（如 <code>Redis</code>、<code>后端八股</code>）。课程列表在<strong>左侧栏</strong>，按 manifest 中的 <code>subject</code> / <code>chapter</code> 分组。</p>
      `
    },
    quickstart: {
      title: '快速开始',
      html: `
        <h1>快速开始</h1>
        <p class="lead">5 分钟在本地跑起来，浏览现有课程或开始加自己的课。</p>

        <h2 id="clone">克隆与预览</h2>
        <pre><code>git clone https://github.com/wqy8593521/learning-hub.git
cd learning-hub

node bin/learning-hub.js validate
node bin/learning-hub.js serve
# → http://localhost:3456</code></pre>

        <h2 id="browse">浏览课程</h2>
        <p>打开首页后，左侧选科目章节，主区域以<strong>上下布局</strong>播放动画；<code>空格</code> 播放/暂停，<code>←</code> <code>→</code> 切步。</p>

        <h2 id="new-lesson">加一门新课</h2>
        <pre><code>node bin/learning-hub.js init mysql-btree-index --title "MySQL B+树索引"
# 编辑 library/mysql-btree-index/lesson.learn（可用 Cursor Skill）
node bin/learning-hub.js validate library/mysql-btree-index
node bin/learning-hub.js sync
node bin/learning-hub.js serve</code></pre>
        <div class="vp-tip">详细 Agent 工作流见仓库内 <code>workflows/new-lesson.md</code> 与 <code>AGENTS.md</code>。</div>
      `
    },
    fork: {
      title: '自建学习库',
      html: `
        <h1>Fork 自建学习库</h1>
        <p class="lead">把本仓库 Fork 成<strong>你的</strong>可视化知识库，写进简历、面试时直接演示。</p>

        <h2 id="steps">推荐步骤</h2>
        <ol>
          <li>Fork <a href="https://github.com/wqy8593521/learning-hub" target="_blank" rel="noopener">wqy8593521/learning-hub</a> 到你的 GitHub</li>
          <li>删除或保留 <code>library/</code> 下示例课</li>
          <li>用 <code>init</code> + Agent 持续往 <code>library/</code> 加课</li>
          <li>每加一课：<code>validate</code> → <code>sync</code> → commit → push</li>
          <li>启用 GitHub Pages（见下）并把链接写进 README / 简历</li>
        </ol>

        <h2 id="pages">发布到 GitHub Pages</h2>
        <ol>
          <li>仓库 <strong>Settings → Pages</strong></li>
          <li><strong>Build and deployment → Source</strong> 选 <strong>GitHub Actions</strong></li>
          <li>Push 到 <code>main</code>，<code>.github/workflows/pages.yml</code> 会自动 validate → sync → deploy</li>
        </ol>
        <div class="vp-warning">若未先在 Settings 里选 GitHub Actions 作为 Pages 源，CI 可能报 <code>Get Pages site failed</code>。</div>

        <h2 id="customize">可定制项</h2>
        <ul>
          <li><code>manifest.yaml</code> 的 <code>subject</code> / <code>chapter</code> 决定侧栏分组</li>
          <li>改仓库名不影响使用；首页 GitHub 链接可在 <code>shared/hub-docs.js</code> 的 <code>REPO</code> 修改</li>
          <li><code>sync</code> 会从 <code>templates/lesson/</code> 生成各课 <code>index.html</code>（不提交 git）</li>
        </ul>
      `
    },
    agent: {
      title: 'Agent 生成课',
      html: `
        <h1>Agent 生成课</h1>
        <p class="lead">Agent <strong>只写内容文件</strong>（<code>.learn</code> / <code>.quiz</code> / <code>.narrate</code>），不写播放器 JavaScript。</p>

        <h2 id="cursor">Cursor</h2>
        <p>使用 Skill：<code>.cursor/skills/visual-lesson-generator/SKILL.md</code></p>
        <p>触发示例：「用 visual-lesson-generator 生成 Redis 持久化机制课」</p>

        <h2 id="generic">通用 Agent</h2>
        <p>阅读 <code>AGENTS.md</code> + <code>workflows/new-lesson.md</code> + <code>shared/vml-cheatsheet.md</code>，参考 <code>library/redis-cache-breakdown/</code>。</p>

        <h2 id="constraints">硬约束</h2>
        <ul>
          <li>每课 ≤ 5 step，每 step ≤ 4 frames</li>
          <li><code>cap</code> 每条 ≤ 20 字</li>
          <li>优先高阶 VML 组件（<code>flow</code> <code>cols</code> <code>chain</code> 等）</li>
          <li><code>validate</code> 失败必须修复后再 <code>sync</code></li>
        </ul>

        <h2 id="cli">CLI 命令</h2>
        <table>
          <thead><tr><th>命令</th><th>说明</th></tr></thead>
          <tbody>
            <tr><td><code>validate [path]</code></td><td>校验课程包</td></tr>
            <tr><td><code>sync</code></td><td>生成 library/index.json</td></tr>
            <tr><td><code>init &lt;id&gt; --title "..."</code></td><td>脚手架新课</td></tr>
            <tr><td><code>narrate [path]</code></td><td>Edge TTS 生成旁白 MP3</td></tr>
            <tr><td><code>serve [-p 3456]</code></td><td>本地静态服务</td></tr>
          </tbody>
        </table>
      `
    },
    wrong: {
      title: '错题本',
      html: `<h1>错题本</h1>
        <p class="lead">做题答错会自动记录（localStorage），方便复习薄弱考点。</p>
        <div id="wrongList"></div>
        <button class="btn-clear" id="clearWrong" type="button">清空错题本</button>`
    }
  },

  getPageHtml(id) {
    const page = this.PAGES[id];
    if (!page) return '';
    if (id === 'intro') {
      return page.html.replace('__REPO__', this.REPO);
    }
    return page.html;
  },

  GUIDE_LINKS: [
    { id: 'intro', label: '项目介绍' },
    { id: 'interview', label: '面经怎么用' },
    { id: 'quickstart', label: '快速开始' },
    { id: 'fork', label: '自建学习库' },
    { id: 'agent', label: 'Agent 生成课' },
    { id: 'wrong', label: '错题本' }
  ],

  init() {
    this.docEl = document.getElementById('doc');
    this.docWrap = document.getElementById('docWrap');
    this.lessonView = document.getElementById('lessonView');
    this.lessonSummary = document.getElementById('lessonSummary');
    this.docTocEl = document.getElementById('docToc');
    this.docTocBlock = document.getElementById('docTocBlock');
    this.guideNav = document.getElementById('guideNav');
    this.courseNav = document.getElementById('courseNav');
    this.searchInput = document.getElementById('search');
    this.lessonMap = {};

    this.renderGuideNav();
    this.bindHash();
    this.bindSearch();
    this.bindMobileMenu();
    this.bindCourseNav();

    fetch('library/index.json')
      .then(r => r.json())
      .then(data => {
        this.tree = data.tree || [];
        this.lessons = data.lessons || [];
        this.lessons.forEach(l => { this.lessonMap[l.id] = l; });
        HubCatalog.renderSidebar(this.tree, this.courseNav, '');
        this.route();
      })
      .catch(() => {
        this.tree = [];
        this.lessons = [];
        this.route();
      });
  },

  bindCourseNav() {
    this.courseNav?.addEventListener('click', e => {
      const a = e.target.closest('a[data-lesson]');
      if (!a) return;
      e.preventDefault();
      location.hash = `lesson/${a.dataset.lesson}`;
    });
    this.docEl?.addEventListener('click', e => {
      const a = e.target.closest('a[data-lesson]');
      if (!a) return;
      e.preventDefault();
      location.hash = `lesson/${a.dataset.lesson}`;
    });
  },

  renderLessonSummary(lesson) {
    if (!this.lessonSummary) return;
    const pre = lesson.prerequisites?.length
      ? `<p class="lesson-summary-pre">前置：${lesson.prerequisites.map(p => esc(p)).join('、')}</p>`
      : '';
    this.lessonSummary.innerHTML = `
      <p class="lesson-summary-crumb">${esc(lesson.subject || '')}${lesson.chapter ? ' · ' + esc(lesson.chapter) : ''}</p>
      <h1 class="lesson-summary-title">${esc(lesson.title)}</h1>
      <p class="lesson-summary-meta">${lesson.steps} 步 · L0–L2${lesson.quiz ? ' · 含测验' : ''}</p>
      <div class="lesson-summary-tags">${lesson.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>
      ${pre}`;
  },

  route() {
    const raw = location.hash.slice(1);
    if (this._suppressHash) {
      this._suppressHash = false;
      return;
    }
    if (raw.startsWith('lesson/')) {
      this.showLesson(raw.slice(7));
      return;
    }

    const slash = raw.indexOf('/');
    const pageId = slash > 0 ? raw.slice(0, slash) : raw;
    const anchor = slash > 0 ? raw.slice(slash + 1) : null;

    if (pageId && this.PAGES[pageId]) {
      const onPage = this.docEl?.dataset.page === pageId && !document.body.classList.contains('has-lesson');
      if (!onPage) this.showPage(pageId);
      if (anchor) this.scrollToAnchor(anchor, !onPage);
      return;
    }

    if (!raw) {
      this.showPage('intro');
      return;
    }

    // 仅锚点跳转（如 #what），不切换指南页
    const currentPage = this.docEl?.dataset.page;
    if (currentPage && this.PAGES[currentPage] && !document.body.classList.contains('has-lesson')) {
      if (document.getElementById(raw)) {
        this.scrollToAnchor(raw);
        this._suppressHash = true;
        history.replaceState(null, '', `#${currentPage}`);
        return;
      }
    }

    this.showPage('intro');
  },

  scrollToAnchor(id, afterRender) {
    const run = () => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      this.syncTocActive(id);
    };
    if (afterRender) setTimeout(run, 0);
    else run();
  },

  syncTocActive(id) {
    if (!this.docTocEl) return;
    this.docTocEl.querySelectorAll('.vp-rail-toc-link').forEach(a => {
      const aid = a.dataset.anchor || (a.getAttribute('href') || '').split('/').pop();
      a.classList.toggle('active', aid === id);
    });
  },

  renderGuideNav() {
    this.guideNav.innerHTML = this.GUIDE_LINKS.map(l =>
      `<a class="vp-sidebar-link" href="#${l.id}" data-page="${l.id}">${esc(l.label)}</a>`
    ).join('');
  },

  bindHash() {
    window.addEventListener('hashchange', () => this.route());
  },

  showLesson(id) {
    const lesson = this.lessonMap[id];
    if (!lesson) {
      HubEmbedPlayer.showPlaceholder();
      this.docWrap?.removeAttribute('hidden');
      this.docEl.innerHTML = `<h1>课程未找到</h1><p class="lead">id: ${esc(id)}</p>`;
      this.docTocBlock.hidden = true;
      return;
    }

    this.docEl.dataset.page = `lesson-${id}`;
    this.renderLessonSummary(lesson);
    this.guideNav.querySelectorAll('.vp-sidebar-link').forEach(a => a.classList.remove('active'));
    if (this.searchInput) this.searchInput.value = '';
    this.docTocBlock.hidden = true;
    document.title = `${lesson.title} · Learning Hub`;
    HubEmbedPlayer.open(lesson);
    this.closeSidebar();
  },

  showPage(id) {
    if (!this.PAGES[id]) id = 'intro';
    HubEmbedPlayer.showPlaceholder();
    this.docWrap?.removeAttribute('hidden');
    this.docEl.innerHTML = this.getPageHtml(id);
    this.docEl.dataset.page = id;
    document.title = `${this.PAGES[id].title} · Learning Hub`;

    this.guideNav.querySelectorAll('.vp-sidebar-link').forEach(a => {
      a.classList.toggle('active', a.dataset.page === id);
    });

    if (id === 'wrong') this.renderWrongBook();
    this.buildToc();
    if (this.searchInput) this.searchInput.value = '';
    this.closeSidebar();
  },

  buildToc() {
    if (!this.docTocEl || !this.docTocBlock) return;
    const headings = this.docEl.querySelectorAll('h2[id], h3[id]');
    if (!headings.length || document.body.classList.contains('has-lesson')) {
      this.docTocBlock.hidden = true;
      this.docTocEl.innerHTML = '';
      return;
    }
    const pageId = this.docEl.dataset.page || 'intro';
    this.docTocBlock.hidden = false;
    this.docTocEl.innerHTML = [...headings].map(h => {
      const cls = h.tagName === 'H3' ? ' vp-rail-toc-link--sub' : '';
      return `<a class="vp-rail-toc-link${cls}" href="#${pageId}/${h.id}" data-anchor="${h.id}">${esc(h.textContent)}</a>`;
    }).join('');

    if (this._tocObserver) this._tocObserver.disconnect();
    this._tocObserver = new IntersectionObserver(entries => {
      entries.forEach(e => {
        if (e.isIntersecting) this.syncTocActive(e.target.id);
      });
    }, { root: this.docWrap, rootMargin: '-72px 0px -70% 0px', threshold: 0 });
    headings.forEach(h => this._tocObserver.observe(h));
  },

  bindSearch() {
    if (!this.searchInput) return;
    this.searchInput.addEventListener('input', e => {
      const q = e.target.value.trim();
      if (q) {
        this.renderSearch(q);
        this.guideNav.querySelectorAll('.vp-sidebar-link').forEach(a => a.classList.remove('active'));
      } else {
        this.route();
        HubCatalog.renderSidebar(this.tree || [], this.courseNav, '');
      }
    });
  },

  renderSearch(q) {
    const filtered = HubCatalog.filterTree(this.tree || [], q);
    const flat = [];
    filtered.forEach(s => s.chapters.forEach(ch => ch.lessons.forEach(l => flat.push(l))));

    if (!flat.length) {
      this.docEl.innerHTML = `<h1>搜索</h1><p class="lead">「${esc(q)}」</p><div class="vp-empty">没有匹配的课程</div>`;
      this.docTocBlock.hidden = true;
      HubEmbedPlayer.showPlaceholder();
      return;
    }

    this.docEl.innerHTML = `
      <h1>搜索</h1>
      <p class="lead">找到 ${flat.length} 门课 · 「${esc(q)}」</p>
      <div class="vp-search-results">
        ${flat.map(l => HubCatalog.lessonCard(l)).join('')}
      </div>`;
    this.docTocBlock.hidden = true;
    HubEmbedPlayer.showPlaceholder();
    HubCatalog.renderSidebar(this.tree || [], this.courseNav, q);
  },

  renderWrongBook() {
    const el = document.getElementById('wrongList');
    const btn = document.getElementById('clearWrong');
    if (!el) return;
    const items = WrongBook.list();
    if (!items.length) {
      el.innerHTML = '<div class="wrong-empty">暂无错题 — 做题错了会自动记在这里</div>';
    } else {
      el.innerHTML = items.map(w =>
        `<div class="wrong-item"><strong>${esc(w.concept)}</strong> · ${esc(w.ask)} <span style="color:#f87171">×${w.count}</span></div>`
      ).join('');
    }
    if (btn) btn.onclick = () => { WrongBook.clear(); this.renderWrongBook(); };
  },

  bindMobileMenu() {
    const sidebar = document.getElementById('sidebar');
    const mask = document.getElementById('sidebarMask');
    const btn = document.getElementById('menuBtn');
    if (!sidebar || !btn) return;
    const open = () => { sidebar.classList.add('open'); mask?.classList.add('show'); };
    const close = () => { sidebar.classList.remove('open'); mask?.classList.remove('show'); };
    btn.onclick = () => sidebar.classList.contains('open') ? close() : open();
    mask?.addEventListener('click', close);
    this.closeSidebar = close;
  }
};

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
