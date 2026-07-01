/**
 * .quiz DSL 解析 + 抽题（解析逻辑见 quiz-parse.js）
 */
const QuizDSL = {
  parse(source) {
    return QuizParse.parse(source);
  },

  shuffle(arr, seed) {
    const a = [...arr];
    let s = seed;
    for (let i = a.length - 1; i > 0; i--) {
      s = (s * 1103515245 + 12345) & 0x7fffffff;
      const j = s % (i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  },

  prepareQuestion(q, bank, seed) {
    if (q.style === 'true_false') {
      return {
        ...q,
        opts: ['正确', '错误'],
        displayAnswer: q.answer,
        optMap: [0, 1]
      };
    }
    const indices = q.opts.map((_, i) => i);
    const shuffled = bank.shuffleOptions ? this.shuffle(indices, seed) : indices;
    return {
      ...q,
      opts: shuffled.map(i => q.opts[i]),
      displayAnswer: shuffled.indexOf(q.answer),
      optMap: shuffled
    };
  },

  pickForTrigger(bank, trigger, lessonId, seed) {
    let concepts = [];
    if (trigger.type === 'after_step') concepts = trigger.concepts;
    else if (trigger.type === 'end') {
      concepts = Object.keys(bank.pool);
      const weak = WrongBook.weakConcepts(lessonId);
      concepts = [...new Set([...weak, ...concepts])];
    }

    let questions = [];
    concepts.forEach(c => {
      const variants = bank.pool[c] || [];
      if (variants.length) questions.push(variants[seed % variants.length]);
    });

    if (bank.shufflePool) questions = this.shuffle(questions, seed + 1);
    const limit = trigger.pick || bank.pick || 1;
    return questions.slice(0, limit).map((q, i) => this.prepareQuestion(q, bank, seed + i + 10));
  }
};
