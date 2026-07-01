/**
 * .quiz DSL 解析（浏览器 + Node 共用）
 */
(function (global) {
  function parseQuiz(source) {
    const bank = { title: '', shufflePool: true, shuffleOptions: true, pick: 1, pool: {}, triggers: [] };
    let curQ = null;
    const stack = [{ indent: -1, type: 'root' }];

    for (const raw of source.split('\n')) {
      const line = raw.replace(/\r$/, '');
      if (!line.trim() || line.trim().startsWith('#')) continue;
      const ind = line.match(/^ */)[0].length;
      const text = line.trim();
      while (stack.length > 1 && ind <= stack[stack.length - 1].indent) stack.pop();

      if (stack[stack.length - 1].type === 'root') {
        if (text.startsWith('bank ')) { bank.title = text.slice(5).trim(); continue; }
        if (text === 'shuffle pool') { bank.shufflePool = true; continue; }
        if (text === 'shuffle options') { bank.shuffleOptions = true; continue; }
        if (text.startsWith('pick ')) { bank.pick = +text.slice(5); continue; }
        if (text === 'pool') { stack.push({ indent: ind, type: 'pool' }); continue; }
        if (text === 'trigger') { stack.push({ indent: ind, type: 'trigger' }); continue; }
      }

      const ctx = stack[stack.length - 1];

      if (ctx.type === 'pool' && text.startsWith('q ')) {
        const concept = text.slice(2).trim();
        curQ = { concept, style: 'pick_one', ask: '', opts: [], answer: 0, explain: '' };
        bank.pool[concept] = bank.pool[concept] || [];
        bank.pool[concept].push(curQ);
        stack.push({ indent: ind, type: 'q' });
        continue;
      }

      if (ctx.type === 'q' && curQ) {
        if (text.startsWith('style ')) { curQ.style = text.slice(6).trim(); continue; }
        if (text.startsWith('ask ')) { curQ.ask = text.slice(4).trim(); continue; }
        if (text.startsWith('opt ')) { curQ.opts.push(text.slice(4).trim()); continue; }
        if (text.startsWith('answer ')) { curQ.answer = +text.slice(7); continue; }
        if (text.startsWith('explain ')) { curQ.explain = text.slice(8).trim(); continue; }
        if (text === 'true') { curQ.style = 'true_false'; curQ.answer = 1; continue; }
        if (text === 'false') { curQ.style = 'true_false'; curQ.answer = 0; continue; }
      }

      if (ctx.type === 'trigger') {
        if (text.startsWith('after_step ')) {
          const parts = text.slice(11).split(/\s+/);
          const step = +parts[0];
          const concepts = parts.slice(1).join(' ').split(/[,，]/).map(s => s.trim()).filter(Boolean);
          bank.triggers.push({ type: 'after_step', step, concepts });
        } else if (text.startsWith('end')) {
          const m = text.match(/pick\s+(\d+)/);
          bank.triggers.push({ type: 'end', pick: m ? +m[1] : bank.pick });
        }
      }
    }
    return bank;
  }

  global.QuizParse = { parse: parseQuiz };
})(typeof window !== 'undefined' ? window : globalThis);
