/**
 * 测验弹层 — 与播放状态解耦
 */
function createLessonQuiz({ layerEl, lessonId }) {
  let open = false;

  function show(questions) {
    if (!layerEl || !questions?.length) return Promise.resolve();
    open = true;
    return new Promise(resolve => {
      let idx = 0;
      const run = () => {
        if (idx >= questions.length) {
          layerEl.classList.remove('show');
          layerEl.innerHTML = '';
          open = false;
          resolve();
          return;
        }
        renderQuizCard(questions[idx], () => { idx++; run(); });
      };
      layerEl.classList.add('show');
      run();
    });
  }

  function renderQuizCard(q, next) {
    const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;');
    layerEl.innerHTML = `
      <div class="quiz-card">
        <div class="quiz-head">小测 · ${esc(q.concept)}</div>
        <div class="quiz-ask">${esc(q.ask)}</div>
        <div class="quiz-opts" id="quizOpts"></div>
        <div class="quiz-feedback" id="quizFb"></div>
        <div class="quiz-actions">
          <button class="btn btn-skip" id="quizSkip">跳过</button>
        </div>
      </div>`;

    const optsEl = document.getElementById('quizOpts');
    const card = { ...q };
    if (card.style === 'true_false') {
      card.opts = ['正确', '错误'];
      card.displayAnswer = card.answer;
    }
    card.opts.forEach((opt, i) => {
      const b = document.createElement('button');
      b.className = 'quiz-opt';
      b.textContent = opt;
      b.onclick = () => submit(i);
      optsEl.appendChild(b);
    });

    document.getElementById('quizSkip').onclick = () => next();

    function submit(choice) {
      const correct = choice === card.displayAnswer;
      WrongBook.record({ lessonId, concept: card.concept, ask: card.ask, correct });
      optsEl.querySelectorAll('.quiz-opt').forEach((b, i) => {
        b.disabled = true;
        if (i === card.displayAnswer) b.classList.add('ok');
        else if (i === choice) b.classList.add('no');
      });
      const fb = document.getElementById('quizFb');
      fb.textContent = (correct ? '✓ ' : '✗ ') + card.explain;
      fb.className = 'quiz-feedback ' + (correct ? 'ok' : 'no');
      if (!correct) fb.textContent += ' · 已记入错题本';
      setTimeout(next, correct ? 900 : 1800);
    }
  }

  return {
    show,
    isOpen() { return open; }
  };
}
