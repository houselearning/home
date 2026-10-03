(function () {
  function getCurrentPageInfo() {
    return {
      url: window.location.href,
      path: window.location.pathname,
      title: document.title || 'HouseLearning',
      origin: window.location.origin
    };
  }

  function detectSubject(path, title) {
    const text = `${path} ${title}`.toLowerCase();
    if (text.includes('/math') || text.includes('math')) return 'math';
    if (text.includes('/science') || text.includes('science')) return 'science';
    if (text.includes('/comput') || text.includes('python') || text.includes('javascript') || text.includes('coding')) return 'coding';
    if (text.includes('/games') || text.includes('game')) return 'games';
    if (text.includes('/blog')) return 'blog';
    return 'general';
  }

  function detectGrade(path, title) {
    const text = `${path} ${title}`.toLowerCase();
    const match = text.match(/grade\s*([1-9]|1[0-2])/i);
    if (match) return `Grade ${match[1]}`;
    return '';
  }

  function detectTopicFromPage(pageInfo) {
    const text = `${pageInfo.title} ${pageInfo.path}`.toLowerCase();
    if (text.includes('fraction')) return 'fractions';
    if (text.includes('algebra') || text.includes('equation')) return 'algebra';
    if (text.includes('python') || text.includes('javascript') || text.includes('coding')) return 'coding';
    if (text.includes('science')) return 'science';
    if (text.includes('math')) return 'math';
    return '';
  }

  function buildContext(session) {
    const currentPage = getCurrentPageInfo();
    const activeTopic = session && session.activeTopic ? session.activeTopic : detectTopicFromPage(currentPage);
    return {
      currentPage,
      previousPage: session && session.currentPage ? session.currentPage : null,
      subject: detectSubject(currentPage.path, currentPage.title),
      grade: detectGrade(currentPage.path, currentPage.title),
      activeTopic
    };
  }

  window.HLAssistantContext = {
    getCurrentPageInfo,
    detectSubject,
    detectGrade,
    detectTopicFromPage,
    buildContext
  };
})();
