/**
 * 首页目录树 — 科目 / 章节 / 课程
 */
const HubCatalog = {
  filterLessons(lessons, query) {
    const q = query.trim().toLowerCase();
    if (!q) return lessons;
    return lessons.filter(l =>
      l.title.toLowerCase().includes(q) ||
      (l.subject || '').toLowerCase().includes(q) ||
      (l.chapter || '').toLowerCase().includes(q) ||
      l.tags.some(t => t.toLowerCase().includes(q))
    );
  },

  filterTree(tree, query) {
    const q = query.trim().toLowerCase();
    if (!q) return tree;
    return tree.map(subject => {
      const chapters = subject.chapters.map(ch => {
        const lessons = this.filterLessons(ch.lessons, q);
        return lessons.length ? { ...ch, lessons } : null;
      }).filter(Boolean);
      return chapters.length ? { ...subject, chapters } : null;
    }).filter(Boolean);
  },

  lessonCard(l) {
    const quiz = l.quiz ? '<span class="pill quiz">测验</span>' : '';
    return `
      <a class="lesson-card" href="#lesson/${escAttr(l.id)}" data-lesson="${escAttr(l.id)}">
        <div class="lesson-card-head">
          <h4>${esc(l.title)}</h4>
          ${quiz}
        </div>
        <div class="tags">${l.tags.map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div>
        <div class="meta">${l.steps} 步 · L0–L2 · ${l.createdAt}</div>
      </a>`;
  },

  /** 左侧栏课程目录 */
  renderSidebar(tree, container, query) {
    const filtered = this.filterTree(tree, query);
    if (!filtered.length) {
      container.innerHTML = '<div class="vp-sidebar-empty">暂无课程</div>';
      return;
    }
    container.innerHTML = filtered.map(subject => `
      <div class="vp-sidebar-subject">${esc(subject.title)}</div>
      ${subject.chapters.map(ch => `
        <div class="vp-sidebar-chapter">${esc(ch.title)}</div>
        ${ch.lessons.map(l => `
          <a class="vp-sidebar-lesson" href="#lesson/${escAttr(l.id)}" data-lesson="${escAttr(l.id)}">
            ${esc(l.title)}${l.quiz ? '<span class="pill">测</span>' : ''}
          </a>
        `).join('')}
      `).join('')}
    `).join('');
  },

  render(tree, container, query) {
    const filtered = this.filterTree(tree, query);
    if (!filtered.length) {
      container.innerHTML = '';
      return 0;
    }
    container.innerHTML = filtered.map(subject => `
      <section class="subject-block" data-subject="${escAttr(subject.id)}">
        <details class="subject-details" open>
          <summary class="subject-head">
            <span class="subject-title">${esc(subject.title)}</span>
            <span class="subject-count">${countLessons(subject)} 课</span>
          </summary>
          <div class="chapter-list">
            ${subject.chapters.map(ch => `
              <section class="chapter-block" data-chapter="${escAttr(ch.id)}">
                <details class="chapter-details" open>
                  <summary class="chapter-head">
                    <span class="chapter-title">${esc(ch.title)}</span>
                    <span class="chapter-count">${ch.lessons.length}</span>
                  </summary>
                  <div class="lesson-list">
                    ${ch.lessons.map(l => this.lessonCard(l)).join('')}
                  </div>
                </details>
              </section>
            `).join('')}
          </div>
        </details>
      </section>
    `).join('');
    return countAll(filtered);
  }
};

function countLessons(subject) {
  return subject.chapters.reduce((n, ch) => n + ch.lessons.length, 0);
}

function countAll(tree) {
  return tree.reduce((n, s) => n + countLessons(s), 0);
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escAttr(s) {
  return esc(s).replace(/"/g, '&quot;');
}
