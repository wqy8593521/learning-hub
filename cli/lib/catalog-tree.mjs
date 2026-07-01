/** 将扁平课程列表组装为 科目 → 章节 → 课程 树 */
export function slugKey(s) {
  return String(s)
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[·・]/g, '-')
    .replace(/[^\w\u4e00-\u9fff-]/g, '')
    || 'misc';
}

export function buildCatalogTree(lessons) {
  const subjects = new Map();

  for (const lesson of lessons) {
    const subjectTitle = lesson.subject || '未分类';
    const chapterTitle = lesson.chapter || '综合';
    const sid = lesson.subjectId || slugKey(subjectTitle);
    const cid = lesson.chapterId || slugKey(chapterTitle);

    if (!subjects.has(sid)) {
      subjects.set(sid, {
        id: sid,
        title: subjectTitle,
        order: lesson.subjectOrder ?? 999,
        chapters: new Map()
      });
    }
    const sub = subjects.get(sid);
    if (lesson.subjectOrder != null && lesson.subjectOrder < sub.order) {
      sub.order = lesson.subjectOrder;
    }

    if (!sub.chapters.has(cid)) {
      sub.chapters.set(cid, {
        id: cid,
        title: chapterTitle,
        order: lesson.chapterOrder ?? 999,
        lessons: []
      });
    }
    const ch = sub.chapters.get(cid);
    if (lesson.chapterOrder != null && lesson.chapterOrder < ch.order) {
      ch.order = lesson.chapterOrder;
    }
    ch.lessons.push(lesson);
  }

  const cmp = (a, b) => (a.order - b.order) || a.title.localeCompare(b.title, 'zh');

  return Array.from(subjects.values())
    .sort(cmp)
    .map(subject => ({
      id: subject.id,
      title: subject.title,
      order: subject.order,
      chapters: Array.from(subject.chapters.values())
        .sort(cmp)
        .map(chapter => ({
          id: chapter.id,
          title: chapter.title,
          order: chapter.order,
          lessons: chapter.lessons.sort(
            (a, b) => (a.order ?? 999) - (b.order ?? 999) || a.title.localeCompare(b.title, 'zh')
          )
        }))
    }));
}
