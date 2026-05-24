import { useCallback, useEffect, useRef, useState } from 'react';

const Recognition =
  typeof window !== 'undefined'
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

export function useVoiceCapture({ onFinal, lang = 'en-US', interim = true } = {}) {
  const [listening, setListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [supported] = useState(() => Boolean(Recognition));
  const recRef = useRef(null);
  const finalRef = useRef('');

  const stop = useCallback(() => {
    try { recRef.current?.stop(); } catch (_) { /* noop */ }
    setListening(false);
  }, []);

  const start = useCallback(() => {
    if (!Recognition) return;
    finalRef.current = '';
    setTranscript('');
    const rec = new Recognition();
    rec.lang = lang;
    rec.interimResults = interim;
    rec.continuous = false;
    rec.onresult = (event) => {
      let interimText = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const res = event.results[i];
        if (res.isFinal) {
          finalRef.current += res[0].transcript;
        } else {
          interimText += res[0].transcript;
        }
      }
      setTranscript((finalRef.current + interimText).trim());
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => {
      setListening(false);
      const finalText = finalRef.current.trim();
      if (finalText && onFinal) onFinal(finalText);
    };
    recRef.current = rec;
    try {
      rec.start();
      setListening(true);
    } catch (_) {
      setListening(false);
    }
  }, [interim, lang, onFinal]);

  useEffect(() => () => {
    try { recRef.current?.abort(); } catch (_) { /* noop */ }
  }, []);

  const toggle = useCallback(() => {
    if (listening) stop();
    else start();
  }, [listening, start, stop]);

  return { supported, listening, transcript, start, stop, toggle };
}
