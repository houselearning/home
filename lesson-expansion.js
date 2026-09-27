(function () {
  const scriptUrl = document.currentScript && document.currentScript.src;
  const path = location.pathname.split('/').filter(Boolean);
  const subjectIndex = path.findIndex(part => ['math', 'science', 'computerscience'].includes(part));
  if (!scriptUrl || subjectIndex < 0 || !path[path.length - 1].endsWith('.html')) return;

  const subject = path[subjectIndex] === 'computerscience' ? 'cs' : path[subjectIndex];
  const sections = path.slice(subjectIndex + 1, -1);
  const filename = path[path.length - 1];
  if (filename === 'index.html' || sections.some(section => ['bin', 'games'].includes(section))) return;

  const gradeSection = sections.find(section => /^grade\d+$/.test(section) || section === 'k');
  const grade = gradeSection ? (gradeSection === 'k' ? '0' : gradeSection.slice(5)) : '';
  const title = document.title
    .replace(/\s*[|–—-]\s*(HouseLearning|CoolMathTime).*$/i, '')
    .replace(/^(?:Grade\s*\d+|\d+(?:st|nd|rd|th)\s*Grade)\s*[:—-]?\s*/i, '')
    .trim();

  const originalRoot = document.querySelector('main, article') || document.body;
  const paragraphs = Array.from(originalRoot.querySelectorAll('p'))
    .map(node => node.textContent.trim())
    .filter(text => text.length > 35 && !/loading video|complete this part to continue/i.test(text));
  const headings = Array.from(originalRoot.querySelectorAll('h2, h3'))
    .map(node => node.textContent.trim())
    .filter(Boolean);
  const lessonSections = Array.from(originalRoot.querySelectorAll('h2, h3')).map(heading => {
    const content = [];
    for (let node = heading.nextElementSibling; node && !/^H[23]$/.test(node.tagName); node = node.nextElementSibling) {
      if (node.matches('p, ul, ol, pre, table, blockquote')) content.push(node.textContent.trim());
    }
    return { heading: heading.textContent.trim(), content: content.filter(Boolean).join('\n') };
  });
  const firstParagraph = paragraphs[0] || `This lesson introduces ${title || 'the topic'} and develops the ideas through examples and practice.`;
  const sourceVideo = originalRoot.querySelector('iframe[src*="youtube.com/embed"], iframe[src*="youtube-nocookie.com/embed"], video');
  const codeExample = originalRoot.querySelector('pre, code');
  const style = document.createElement('link');
  style.rel = 'stylesheet';
  style.href = new URL('lesson-expansion.css', scriptUrl).href;
  document.head.appendChild(style);

  const toolbar = document.createElement('section');
  toolbar.className = 'hl-lesson-tools';
  toolbar.setAttribute('aria-label', 'Lesson tools');
  toolbar.innerHTML = '<div class="hl-tools-label">Lesson tools</div><div class="hl-tools-actions"><button type="button" data-action="original">Original lesson</button><button type="button" data-action="ivl">IVL lesson</button><button type="button" data-action="quiz">Quiz</button><a data-action="unit-test">Unit test</a></div>';

  const assessmentUrl = new URL('lesson-assessments.html', scriptUrl);
  assessmentUrl.searchParams.set('subject', subject);
  if (grade) assessmentUrl.searchParams.set('grade', grade);
  toolbar.querySelector('[data-action="unit-test"]').href = assessmentUrl.href;

  const dialog = document.createElement('div');
  dialog.className = 'hl-lesson-overlay';
  dialog.hidden = true;
  dialog.setAttribute('role', 'dialog');
  dialog.setAttribute('aria-modal', 'true');
  dialog.setAttribute('aria-labelledby', 'hl-dialog-title');
  dialog.innerHTML = '<div class="hl-lesson-dialog"><div class="hl-dialog-header"><div><p class="hl-eyebrow"></p><h2 id="hl-dialog-title"></h2></div><button type="button" class="hl-close" aria-label="Close lesson tools">Close</button></div><div class="hl-dialog-body"></div></div>';
  document.body.appendChild(dialog);

  const body = dialog.querySelector('.hl-dialog-body');
  const dialogTitle = dialog.querySelector('#hl-dialog-title');
  const eyebrow = dialog.querySelector('.hl-eyebrow');
  const closeButton = dialog.querySelector('.hl-close');
  let activeMode = 'ivl';
  let ivlStep = 0;
  let quizIndex = 0;
  let quizScore = 0;
  let quizLocked = false;

  function openDialog(mode) {
    activeMode = mode;
    dialog.hidden = false;
    document.body.classList.add('hl-tools-open');
    renderMode();
    closeButton.focus();
  }

  function closeDialog() {
    dialog.hidden = true;
    document.body.classList.remove('hl-tools-open');
  }

  function renderMode() {
    body.replaceChildren();
    if (activeMode === 'ivl') renderIvl();
    else renderQuiz();
  }

  function renderIvl() {
    body.replaceChildren();
    eyebrow.textContent = 'Interactive video lesson';
    dialogTitle.textContent = title || 'Guided lesson';
    const content = document.createElement('div');
    content.className = 'hl-ivl-content';
    const totalSteps = 4;
    const progress = document.createElement('p');
    progress.className = 'hl-step-count';
    progress.textContent = `Step ${ivlStep + 1} of ${totalSteps}`;
    content.appendChild(progress);

    if (ivlStep === 0) {
      appendBlock(content, 'Start with the original lesson', firstParagraph);
      appendList(content, 'In this lesson', (headings.length ? headings : ['Build the main idea', 'Study an example', 'Check your understanding']).slice(0, 4));
      const currentVideo = originalRoot.querySelector('iframe[src*="youtube.com/embed"], iframe[src*="youtube-nocookie.com/embed"]') || sourceVideo;
      if (currentVideo && currentVideo.tagName === 'IFRAME') {
        const source = currentVideo.getAttribute('src');
        if (source) {
          const frame = document.createElement('iframe');
          frame.className = 'hl-ivl-video';
          frame.src = source;
          frame.title = `${title || 'Lesson'} video`;
          frame.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share';
          frame.allowFullscreen = true;
          content.appendChild(frame);
        }
      } else {
        const videoSearch = document.createElement('a');
        videoSearch.className = 'hl-video-search';
        videoSearch.href = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${title} ${subject} lesson`)}`;
        videoSearch.target = '_blank';
        videoSearch.rel = 'noopener noreferrer';
        videoSearch.textContent = 'Find a topic video';
        content.appendChild(videoSearch);
      }
    } else if (ivlStep === 1) {
      const section = lessonSections.find(item => item.content) || lessonSections[0];
      const sectionTitle = section ? section.heading : 'Key idea';
      appendBlock(content, sectionTitle, section && section.content ? section.content : (paragraphs[1] || firstParagraph));
      appendBlock(content, 'Connect it to the lesson', `Explain how ${sectionTitle || title || 'the key idea'} relates to the opening explanation. Use a definition, example, or observation from the original lesson.`);
    } else if (ivlStep === 2) {
      appendBlock(content, codeExample ? 'Study the example' : (headings[1] || 'Apply the idea'), codeExample ? codeExample.textContent.trim() : (paragraphs[2] || 'Return to the original lesson and identify an example that demonstrates the central idea.'));
      appendBlock(content, 'Check your reasoning', 'Describe what the example shows and identify one detail that supports your interpretation.');
    } else {
      appendBlock(content, 'Interactive checkpoint', 'In your own words, explain one important idea from the lesson and give a supporting example. A complete response needs at least 12 characters.');
      const response = document.createElement('textarea');
      response.className = 'hl-response';
      response.rows = 4;
      response.placeholder = 'Write your explanation';
      response.setAttribute('aria-label', 'Interactive lesson response');
      content.appendChild(response);
      const feedback = document.createElement('p');
      feedback.className = 'hl-feedback';
      content.appendChild(feedback);
      const finish = document.createElement('button');
      finish.type = 'button';
      finish.className = 'hl-primary';
      finish.textContent = 'Complete IVL';
      finish.addEventListener('click', () => {
        if (response.value.trim().length < 12) {
          feedback.textContent = 'Add a little more detail before completing this checkpoint.';
          response.focus();
          return;
        }
        feedback.textContent = 'Checkpoint complete. Your response is ready to compare with the original lesson.';
        finish.disabled = true;
      });
      content.appendChild(finish);
    }

    const controls = document.createElement('div');
    controls.className = 'hl-step-controls';
    const previous = document.createElement('button');
    previous.type = 'button';
    previous.textContent = 'Back';
    previous.disabled = ivlStep === 0;
    previous.addEventListener('click', () => { ivlStep = Math.max(0, ivlStep - 1); renderIvl(); });
    controls.appendChild(previous);
    if (ivlStep < totalSteps - 1) {
      const next = document.createElement('button');
      next.type = 'button';
      next.className = 'hl-primary';
      next.textContent = 'Continue';
      next.addEventListener('click', () => { ivlStep = Math.min(totalSteps - 1, ivlStep + 1); renderIvl(); });
      controls.appendChild(next);
    }
    content.appendChild(controls);
    body.appendChild(content);
  }

  function renderQuiz() {
    body.replaceChildren();
    eyebrow.textContent = 'Lesson quiz';
    dialogTitle.textContent = title || 'Check your understanding';
    const quiz = makeQuiz();
    if (quizIndex >= quiz.length) {
      const result = document.createElement('div');
      result.className = 'hl-quiz-result';
      const heading = document.createElement('h3');
      heading.textContent = `Score: ${quizScore} of ${quiz.length}`;
      const note = document.createElement('p');
      note.textContent = quizScore === quiz.length ? 'All answers correct. Nice work.' : 'Review the original lesson and try again.';
      const retry = document.createElement('button');
      retry.type = 'button';
      retry.className = 'hl-primary';
      retry.textContent = 'Retake quiz';
      retry.addEventListener('click', () => { quizIndex = 0; quizScore = 0; quizLocked = false; renderQuiz(); });
      result.append(heading, note, retry);
      body.appendChild(result);
      return;
    }

    const item = quiz[quizIndex];
    const count = document.createElement('p');
    count.className = 'hl-step-count';
    count.textContent = `Question ${quizIndex + 1} of ${quiz.length}`;
    const question = document.createElement('h3');
    question.textContent = item.question;
    const choices = document.createElement('div');
    choices.className = 'hl-quiz-choices';
    const feedback = document.createElement('p');
    feedback.className = 'hl-feedback';
    item.options.forEach((option, index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.textContent = option;
      button.addEventListener('click', () => {
        if (quizLocked) return;
        quizLocked = true;
        const correct = index === item.answer;
        if (correct) quizScore++;
        feedback.textContent = correct ? 'Correct.' : `Not quite. Review: ${item.explanation}`;
        const next = document.createElement('button');
        next.type = 'button';
        next.className = 'hl-primary';
        next.textContent = quizIndex === quiz.length - 1 ? 'See results' : 'Next question';
        next.addEventListener('click', () => { quizIndex++; quizLocked = false; renderQuiz(); });
        body.appendChild(next);
      });
      choices.appendChild(button);
    });
    body.append(count, question, choices, feedback);
  }

  function makeQuiz() {
    const category = getCategory(subject, title);
    const topicDistractors = {
      math: ['Geometry and measurement', 'Number operations and algebra', 'Data, statistics, and probability', 'Ratios and proportional reasoning'],
      science: ['Life science and ecosystems', 'Matter and chemical change', 'Forces, energy, and waves', 'Earth and space systems'],
      cs: ['Programming and algorithms', 'Web structure and interface design', 'Data, databases, and formats', 'Version control and software tools']
    }[subject].filter(value => value !== category);
    const topicOptions = shuffle([category, ...topicDistractors.slice(0, 3)]);
    const topicAnswer = topicOptions.indexOf(category);
    const lead = trimText(firstParagraph, 180);
    const headingAnswer = headings[0] || 'Introduction';
    const headingOptions = shuffle([headingAnswer, 'Practice and review', 'Common mistakes', 'Further reading']);
    const leadOptions = shuffle([lead, ...getDistractors(subject, category).slice(0, 3)]);
    return [
      { question: 'Which area best matches the main focus of this lesson?', options: topicOptions, answer: topicAnswer, explanation: `the lesson focuses on ${category.toLowerCase()}.` },
      { question: 'Which statement is supported by the opening of the original lesson?', options: leadOptions, answer: leadOptions.indexOf(lead), explanation: 'the correct statement is described in the opening explanation.' },
      { question: 'Which section heading appears in this lesson?', options: headingOptions, answer: headingOptions.indexOf(headingAnswer), explanation: `the original lesson includes a section called "${headingAnswer}".` }
    ];
  }

  function getCategory(pageSubject, pageTitle) {
    const value = pageTitle.toLowerCase();
    if (pageSubject === 'math') {
      if (/geometry|shape|angle|triangle|circle|area|volume|transform|coordinate/i.test(value)) return 'Geometry and measurement';
      if (/statistic|data|probability|graph|mean|median|mode/i.test(value)) return 'Data, statistics, and probability';
      if (/ratio|rate|percent|proportion/i.test(value)) return 'Ratios and proportional reasoning';
      return 'Number operations and algebra';
    }
    if (pageSubject === 'science') {
      if (/animal|plant|cell|ecosystem|habitat|genetic|evolution|body|organism|photosynthesis/i.test(value)) return 'Life science and ecosystems';
      if (/matter|chemical|atom|molecule|acid|base|periodic|reaction|stoichiometry|gas/i.test(value)) return 'Matter and chemical change';
      if (/force|motion|energy|wave|sound|light|electric|magnet|thermodynamic|machine/i.test(value)) return 'Forces, energy, and waves';
      return 'Earth and space systems';
    }
    if (/html|css|bootstrap|tailwind|web|canvas|three\.js/i.test(value)) return 'Web structure and interface design';
    if (/json|yaml|sql|database|data/i.test(value)) return 'Data, databases, and formats';
    if (/git|github|deploy|version|repository/i.test(value)) return 'Version control and software tools';
    return 'Programming and algorithms';
  }

  function getDistractors(pageSubject, category) {
    const statements = {
      math: ['This lesson focuses on predicting weather patterns from cloud observations.', 'This lesson explains how a historical document is authenticated.', 'This lesson describes the parts of a plant cell.'],
      science: ['This lesson focuses on writing functions in a programming language.', 'This lesson explains how to solve an equation using inverse operations.', 'This lesson describes how a web page is styled.'],
      cs: ['This lesson focuses on identifying rock layers from a field sample.', 'This lesson explains how to calculate triangle area.', 'This lesson describes how energy moves through an ecosystem.']
    }[pageSubject];
    return statements.filter(statement => !statement.toLowerCase().includes(category.toLowerCase()));
  }

  function appendBlock(parent, heading, text) {
    const section = document.createElement('section');
    section.className = 'hl-lesson-block';
    const titleNode = document.createElement('h3');
    titleNode.textContent = heading;
    const paragraph = document.createElement('p');
    paragraph.textContent = text;
    section.append(titleNode, paragraph);
    parent.appendChild(section);
  }

  function appendList(parent, heading, entries) {
    const section = document.createElement('section');
    section.className = 'hl-lesson-block';
    const titleNode = document.createElement('h3');
    titleNode.textContent = heading;
    const list = document.createElement('ol');
    entries.forEach(entry => {
      const item = document.createElement('li');
      item.textContent = entry;
      list.appendChild(item);
    });
    section.append(titleNode, list);
    parent.appendChild(section);
  }

  function trimText(value, maxLength) {
    return value.length <= maxLength ? value : `${value.slice(0, maxLength - 1).trim()}...`;
  }

  function shuffle(items) {
    return items
      .map(value => ({ value, sort: Math.random() }))
      .sort((left, right) => left.sort - right.sort)
      .map(item => item.value);
  }

  toolbar.addEventListener('click', event => {
    const action = event.target.closest('[data-action]');
    if (!action) return;
    if (action.dataset.action === 'original') {
      closeDialog();
      const heading = originalRoot.querySelector('h1') || originalRoot;
      heading.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } else if (action.dataset.action === 'ivl') {
      ivlStep = 0;
      openDialog('ivl');
    } else if (action.dataset.action === 'quiz') {
      quizIndex = 0;
      quizScore = 0;
      quizLocked = false;
      openDialog('quiz');
    }
  });
  closeButton.addEventListener('click', closeDialog);
  dialog.addEventListener('click', event => { if (event.target === dialog) closeDialog(); });
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !dialog.hidden) closeDialog(); });

  const host = document.querySelector('main') || document.body;
  host.insertBefore(toolbar, host.firstChild);
})();