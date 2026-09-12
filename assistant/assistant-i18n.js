(function () {
  const translations = {
    en: {
      assistantName: 'HouseLearning Assistant',
      idle: 'Hi! I\'m your HouseLearning assistant.',
      listening: 'I\'m listening...',
      thinking: 'Let me think...',
      speaking: 'Talking with you now...',
      error: 'Oops! I couldn\'t do that. Try again?',
      welcome: 'What would you like to learn today?',
      suggestionsTitle: 'What would you like to learn?',
      suggested: 'Recommended for you',
      explainPage: 'Explain this page',
      clearChat: 'Clear conversation',
      mic: 'Voice',
      send: 'Send',
      quickStart: ['Find a lesson', 'Help me with math', 'Learn coding', 'Explore science'],
      labels: {
        language: 'Language',
        inputPlaceholder: 'Ask me anything...',
        explainPageTooltip: 'Explain this page',
        clearChatTooltip: 'Clear conversation'
      },
      defaultPrompts: {
        lesson: 'Find a lesson',
        math: 'Help me with math',
        coding: 'Learn coding',
        science: 'Explore science'
      },
      responseFallback: 'I can help you explore HouseLearning lessons, math, science, and coding. Try asking for a topic or choose one of the suggestions.'
    },
    es: {
      assistantName: 'Asistente de HouseLearning',
      idle: '¡Hola! Soy tu asistente de HouseLearning.',
      listening: 'Estoy escuchando...',
      thinking: 'Déjame pensar...',
      speaking: 'Estoy hablando contigo...',
      error: '¡Ups! No pude hacer eso. ¿Intentamos otra vez?',
      welcome: '¿Qué te gustaría aprender hoy?',
      suggestionsTitle: '¿Qué te gustaría aprender?',
      suggested: 'Recomendado para ti',
      explainPage: 'Explica esta página',
      clearChat: 'Borrar conversación',
      mic: 'Voz',
      send: 'Enviar',
      quickStart: ['Busca una lección', 'Ayúdame con matemáticas', 'Aprende a programar', 'Explora ciencia'],
      labels: {
        language: 'Idioma',
        inputPlaceholder: 'Pregúntame algo...',
        explainPageTooltip: 'Explica esta página',
        clearChatTooltip: 'Borrar conversación'
      },
      defaultPrompts: {
        lesson: 'Busca una lección',
        math: 'Ayúdame con matemáticas',
        coding: 'Aprende a programar',
        science: 'Explora ciencia'
      },
      responseFallback: 'Puedo ayudarte a explorar lecciones de HouseLearning, matemáticas, ciencia y programación. Prueba preguntando por un tema o elige una sugerencia.'
    },
    tr: {
      assistantName: 'HouseLearning Asistanı',
      idle: 'Merhaba! Ben HouseLearning asistanınızım.',
      listening: 'Dinliyorum...',
      thinking: 'Düşünüyorum...',
      speaking: 'Şimdi konuşuyorum...',
      error: 'Hay aksi! Bunu yapamadım. Tekrar dener misin?',
      welcome: 'Bugün ne öğrenmek istersin?',
      suggestionsTitle: 'Ne öğrenmek istersin?',
      suggested: 'Senin için önerilenler',
      explainPage: 'Bu sayfayı açıkla',
      clearChat: 'Konuşmayı temizle',
      mic: 'Ses',
      send: 'Gönder',
      quickStart: ['Bir ders bul', 'Matematikte yardım et', 'Kodlama öğren', 'Bilim keşfet'],
      labels: {
        language: 'Dil',
        inputPlaceholder: 'Bana bir şey sor...',
        explainPageTooltip: 'Bu sayfayı açıkla',
        clearChatTooltip: 'Konuşmayı temizle'
      },
      defaultPrompts: {
        lesson: 'Bir ders bul',
        math: 'Matematikte yardım et',
        coding: 'Kodlama öğren',
        science: 'Bilim keşfet'
      },
      responseFallback: 'HouseLearning derslerini, matematiği, bilimi ve kodlamayı keşfetmene yardımcı olabilirim. Bir konu sor veya önerilerden birini seç.'
    },
    pt: {
      assistantName: 'Assistente do HouseLearning',
      idle: 'Olá! Sou seu assistente do HouseLearning.',
      listening: 'Estou ouvindo...',
      thinking: 'Deixe-me pensar...',
      speaking: 'Estou falando com você...',
      error: 'Ops! Não consegui fazer isso. Tentar de novo?',
      welcome: 'O que você gostaria de aprender hoje?',
      suggestionsTitle: 'O que você gostaria de aprender?',
      suggested: 'Recomendado para você',
      explainPage: 'Explicar esta página',
      clearChat: 'Limpar conversa',
      mic: 'Voz',
      send: 'Enviar',
      quickStart: ['Encontre uma lição', 'Me ajude com matemática', 'Aprenda programação', 'Explore ciência'],
      labels: {
        language: 'Idioma',
        inputPlaceholder: 'Pergunte-me algo...',
        explainPageTooltip: 'Explicar esta página',
        clearChatTooltip: 'Limpar conversa'
      },
      defaultPrompts: {
        lesson: 'Encontre uma lição',
        math: 'Me ajude com matemática',
        coding: 'Aprenda programação',
        science: 'Explore ciência'
      },
      responseFallback: 'Posso ajudar você a explorar aulas do HouseLearning, matemática, ciência e programação. Tente perguntar por um tema ou escolher uma sugestão.'
    }
  };

  function getBrowserLanguage() {
    const saved = localStorage.getItem('hl-assistant-lang');
    if (saved && translations[saved]) return saved;
    const lang = navigator.language || navigator.languages?.[0] || 'en';
    const lower = lang.toLowerCase();
    if (lower.startsWith('es')) return 'es';
    if (lower.startsWith('tr')) return 'tr';
    if (lower.startsWith('pt')) return 'pt';
    return 'en';
  }

  function getLanguagePreference(defaultLanguage) {
    const value = localStorage.getItem('hl-assistant-lang');
    if (value && translations[value]) return value;
    return defaultLanguage || getBrowserLanguage();
  }

  function setLanguagePreference(lang) {
    if (!translations[lang]) return;
    localStorage.setItem('hl-assistant-lang', lang);
  }

  function t(key, lang) {
    const language = translations[lang] ? lang : 'en';
    const section = translations[language];
    if (!section) return key;
    return section[key] || translations.en[key] || key;
  }

  const api = {
    translations,
    getBrowserLanguage,
    getLanguagePreference,
    setLanguagePreference,
    t
  };

  window.HLAssistantI18n = api;
})();
