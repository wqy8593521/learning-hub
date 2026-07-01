/**
 * 错题本 — localStorage，按 concept 聚合（非 Anki）
 */
const WrongBook = {
  KEY: 'learning-hub-wrong-book',

  _load() {
    try { return JSON.parse(localStorage.getItem(this.KEY) || '{}'); }
    catch { return {}; }
  },
  _save(data) { localStorage.setItem(this.KEY, JSON.stringify(data)); },

  record({ lessonId, concept, ask, correct }) {
    const data = this._load();
    const id = `${lessonId}:${concept}`;
    if (correct) {
      if (data[id]) {
        data[id].count = Math.max(0, data[id].count - 1);
        if (data[id].count === 0) delete data[id];
      }
    } else {
      data[id] = {
        lessonId, concept, ask,
        count: (data[id]?.count || 0) + 1,
        lastAt: new Date().toISOString()
      };
    }
    this._save(data);
  },

  list() {
    return Object.values(this._load()).sort((a, b) => b.count - a.count || b.lastAt.localeCompare(a.lastAt));
  },

  weakConcepts(lessonId) {
    return this.list().filter(x => x.lessonId === lessonId).map(x => x.concept);
  },

  clear() { localStorage.removeItem(this.KEY); }
};
