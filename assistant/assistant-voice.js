(function () {
  const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;

  function getSupportedLanguage(lang) {
    const map = {
      en: 'en-US',
      es: 'es-ES',
      tr: 'tr-TR',
      pt: 'pt-BR'
    };
    return map[lang] || 'en-US';
  }

  function speakText(text, language = 'en', rate = 1, pitch = 1) {
    if (!('speechSynthesis' in window) || !text) return Promise.resolve(false);

    return new Promise((resolve) => {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = getSupportedLanguage(language);
      utterance.rate = rate;
      utterance.pitch = pitch;
      utterance.onend = () => resolve(true);
      utterance.onerror = () => resolve(false);
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(utterance);
    });
  }

  function listenForSpeech({ language = 'en', onResult, onError, onStart, onEnd }) {
    if (!SpeechRecognitionCtor) {
      onError?.(new Error('Speech recognition is not available in this browser.'));
      return null;
    }

    const recognition = new SpeechRecognitionCtor();
    recognition.lang = getSupportedLanguage(language);
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => onStart?.();
    recognition.onresult = (event) => {
      const transcript = event.results?.[0]?.[0]?.transcript || '';
      if (transcript) onResult?.(transcript.trim());
    };
    recognition.onerror = (event) => {
      const message = event?.error || 'Listening failed';
      onError?.(new Error(message));
    };
    recognition.onend = () => onEnd?.();
    recognition.start();
    return recognition;
  }

  window.HLAssistantVoice = {
    speakText,
    listenForSpeech,
    isSupported: !!SpeechRecognitionCtor
  };
})();
