// VoiceMode — continuous voice conversation manager.
//
// Two-way live voice for the Architect chat:
//   - Mic stays open. Web Audio AnalyserNode RMS is sampled every 50ms.
//   - VAD: an utterance starts when RMS crosses VOICE_RMS for ≥ MIN_VOICE_MS,
//     and ends when RMS stays below SILENCE_RMS for ≥ SILENCE_HOLD_MS.
//   - On utterance end the MediaRecorder chunks are POSTed to
//     /.netlify/functions/gemini-voice-turn (existing transcription endpoint)
//     and the resulting transcript is handed to onTranscript().
//   - Agent reply tokens are fed via pushTokens(); a sentence buffer flushes
//     full sentences to /.netlify/functions/architect-tts, which streams
//     audio bytes the Audio element plays.
//   - Barge-in: while TTS is playing, voice above BARGE_RMS for ≥ BARGE_MS
//     cuts audio and returns to listening.

const VOICE_RMS = 0.025;
const SILENCE_RMS = 0.015;
const BARGE_RMS = 0.05;
const MIN_VOICE_MS = 280;
const SILENCE_HOLD_MS = 750;
const BARGE_MS = 220;
const SAMPLE_INTERVAL_MS = 50;
const SENTENCE_FLUSH_MIN_CHARS = 8;

export const VOICE_STATES = Object.freeze({
  IDLE: 'idle',
  LISTENING: 'listening',
  PROCESSING: 'processing',
  SPEAKING: 'speaking',
  MUTED: 'muted',
  ERROR: 'error',
});

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

function stripDataUrl(maybeDataUrl) {
  if (typeof maybeDataUrl !== 'string') return maybeDataUrl;
  const m = maybeDataUrl.match(/^data:([^;]+);base64,(.*)$/);
  return m ? m[2] : maybeDataUrl;
}

export class VoiceMode {
  constructor({ onTranscript, onError, onStateChange, getAuthHeaders }) {
    this.onTranscript = onTranscript;
    this.onError = onError;
    this.onStateChange = onStateChange;
    this.getAuthHeaders = getAuthHeaders;

    this.state = VOICE_STATES.IDLE;
    this.stream = null;
    this.audioCtx = null;
    this.analyser = null;
    this.recorder = null;
    this.recorderChunks = [];
    this.mimeType = null;
    this.sampler = null;
    this.voiceStart = 0;
    this.silenceStart = 0;
    this.bargeStart = 0;
    this.utteranceActive = false;

    this.sentenceBuffer = '';
    this.speechQueue = [];
    this.currentAudio = null;
    this.speakingActive = false;
    this.disposed = false;
  }

  _setState(next) {
    if (this.state === next || this.disposed) return;
    this.state = next;
    try { this.onStateChange?.(next); } catch { /* ignore */ }
  }

  _emitError(message) {
    this._setState(VOICE_STATES.ERROR);
    try { this.onError?.(message); } catch { /* ignore */ }
  }

  async start() {
    if (this.state !== VOICE_STATES.IDLE && this.state !== VOICE_STATES.ERROR) return;
    if (!navigator.mediaDevices?.getUserMedia) {
      this._emitError('Microphone is not available in this browser.');
      return;
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      });
      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      this.audioCtx = new AudioCtx();
      const source = this.audioCtx.createMediaStreamSource(this.stream);
      this.analyser = this.audioCtx.createAnalyser();
      this.analyser.fftSize = 1024;
      source.connect(this.analyser);
      this._beginRecorder();
      this._startSampler();
      this._setState(VOICE_STATES.LISTENING);
    } catch (e) {
      this._emitError(e?.message || 'Microphone access denied');
    }
  }

  stop() {
    this.disposed = true;
    this._stopSampler();
    this._stopRecorder(true);
    this.cancelSpeech();
    if (this.audioCtx) {
      this.audioCtx.close().catch(() => {});
      this.audioCtx = null;
    }
    if (this.stream) {
      this.stream.getTracks().forEach((t) => t.stop());
      this.stream = null;
    }
    this._setState(VOICE_STATES.IDLE);
  }

  mute() {
    if (this.state === VOICE_STATES.IDLE) return;
    if (this.stream) this.stream.getAudioTracks().forEach((t) => { t.enabled = false; });
    this.cancelSpeech();
    this._setState(VOICE_STATES.MUTED);
  }

  unmute() {
    if (this.state !== VOICE_STATES.MUTED) return;
    if (this.stream) this.stream.getAudioTracks().forEach((t) => { t.enabled = true; });
    this._setState(VOICE_STATES.LISTENING);
  }

  _beginRecorder() {
    if (!this.stream) return;
    const mimeType = window.MediaRecorder && MediaRecorder.isTypeSupported('audio/webm')
      ? 'audio/webm'
      : 'audio/mp4';
    this.mimeType = mimeType;
    this.recorderChunks = [];
    const recorder = new MediaRecorder(this.stream, { mimeType });
    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) this.recorderChunks.push(e.data);
    };
    recorder.onstop = async () => {
      if (this.disposed) return;
      const chunks = this.recorderChunks;
      this.recorderChunks = [];
      const blob = new Blob(chunks, { type: this.mimeType });
      if (blob.size < 1500) {
        // Too short — treat as noise, restart listening.
        this._restartRecorder();
        return;
      }
      this._setState(VOICE_STATES.PROCESSING);
      try {
        const dataUrl = await blobToBase64(blob);
        const headers = {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...((await this.getAuthHeaders?.()) || {}),
        };
        const res = await fetch('/.netlify/functions/gemini-voice-turn', {
          method: 'POST',
          headers,
          body: JSON.stringify({ audio: stripDataUrl(dataUrl), mimeType: this.mimeType }),
        });
        const payload = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(payload?.error || payload?.message || `Transcription failed (${res.status})`);
        }
        const transcript = String(payload?.transcript || '').trim();
        if (transcript) {
          try { this.onTranscript?.(transcript); } catch { /* ignore */ }
        }
      } catch (e) {
        this._emitError(e?.message || 'Transcription failed');
      } finally {
        if (!this.disposed) this._restartRecorder();
      }
    };
    recorder.start();
    this.recorder = recorder;
  }

  _stopRecorder(force = false) {
    if (this.recorder && this.recorder.state === 'recording') {
      try { this.recorder.stop(); } catch { /* ignore */ }
    }
    if (force) this.recorder = null;
  }

  _restartRecorder() {
    if (this.disposed) return;
    this.utteranceActive = false;
    this.voiceStart = 0;
    this.silenceStart = 0;
    if (this.state !== VOICE_STATES.MUTED) this._setState(VOICE_STATES.LISTENING);
    this._beginRecorder();
  }

  _startSampler() {
    const buf = new Uint8Array(this.analyser.fftSize);
    this.sampler = setInterval(() => this._sample(buf), SAMPLE_INTERVAL_MS);
  }

  _stopSampler() {
    if (this.sampler) {
      clearInterval(this.sampler);
      this.sampler = null;
    }
  }

  _sample(buf) {
    if (!this.analyser) return;
    this.analyser.getByteTimeDomainData(buf);
    // RMS over the byte buffer (centered at 128).
    let sum = 0;
    for (let i = 0; i < buf.length; i += 1) {
      const v = (buf[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / buf.length);
    const now = performance.now();

    if (this.state === VOICE_STATES.SPEAKING) {
      // Barge-in detection.
      if (rms > BARGE_RMS) {
        if (!this.bargeStart) this.bargeStart = now;
        if (now - this.bargeStart > BARGE_MS) {
          this.bargeStart = 0;
          this.cancelSpeech();
        }
      } else {
        this.bargeStart = 0;
      }
      return;
    }

    if (this.state !== VOICE_STATES.LISTENING) return;

    if (rms > VOICE_RMS) {
      if (!this.utteranceActive) {
        if (!this.voiceStart) this.voiceStart = now;
        if (now - this.voiceStart >= MIN_VOICE_MS) {
          this.utteranceActive = true;
          this.silenceStart = 0;
        }
      } else {
        this.silenceStart = 0;
      }
    } else if (rms < SILENCE_RMS) {
      if (this.utteranceActive) {
        if (!this.silenceStart) this.silenceStart = now;
        if (now - this.silenceStart >= SILENCE_HOLD_MS) {
          this.utteranceActive = false;
          this.voiceStart = 0;
          this.silenceStart = 0;
          this._stopRecorder();
        }
      } else {
        this.voiceStart = 0;
      }
    }
  }

  pushTokens(text) {
    if (this.disposed || !text) return;
    this.sentenceBuffer += text;
    this._flushSentences();
  }

  finalize() {
    if (this.disposed) return;
    if (this.sentenceBuffer.trim().length >= SENTENCE_FLUSH_MIN_CHARS) {
      this._enqueueSpeech(this.sentenceBuffer.trim());
    }
    this.sentenceBuffer = '';
  }

  _flushSentences() {
    const re = /([^.!?\n]+[.!?\n]+)/g;
    let match;
    let lastIndex = 0;
    const out = [];
    while ((match = re.exec(this.sentenceBuffer)) !== null) {
      out.push(match[1].trim());
      lastIndex = re.lastIndex;
    }
    if (out.length > 0) {
      this.sentenceBuffer = this.sentenceBuffer.slice(lastIndex);
      for (const sentence of out) {
        if (sentence.length >= SENTENCE_FLUSH_MIN_CHARS) this._enqueueSpeech(sentence);
      }
    }
  }

  _enqueueSpeech(text) {
    this.speechQueue.push(text);
    if (!this.speakingActive) this._drainSpeechQueue();
  }

  async _drainSpeechQueue() {
    if (this.speakingActive || this.disposed) return;
    this.speakingActive = true;
    while (this.speechQueue.length > 0 && !this.disposed) {
      const next = this.speechQueue.shift();
      try {
        await this._speak(next);
      } catch (e) {
        this._emitError(e?.message || 'TTS failed');
        break;
      }
    }
    this.speakingActive = false;
    if (!this.disposed && this.state !== VOICE_STATES.MUTED) {
      this._setState(VOICE_STATES.LISTENING);
    }
  }

  async _speak(text) {
    const headers = {
      'Content-Type': 'application/json',
      ...((await this.getAuthHeaders?.()) || {}),
    };
    const res = await fetch('/.netlify/functions/architect-tts', {
      method: 'POST',
      headers,
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      const payload = await res.text().catch(() => '');
      throw new Error(`TTS ${res.status}: ${payload.slice(0, 200)}`);
    }
    const blob = await res.blob();
    const url = URL.createObjectURL(blob);
    const audio = new Audio(url);
    this.currentAudio = audio;
    this._setState(VOICE_STATES.SPEAKING);
    await new Promise((resolve) => {
      audio.onended = resolve;
      audio.onerror = resolve;
      audio.play().catch(resolve);
    });
    URL.revokeObjectURL(url);
    if (this.currentAudio === audio) this.currentAudio = null;
  }

  cancelSpeech() {
    this.speechQueue = [];
    this.sentenceBuffer = '';
    if (this.currentAudio) {
      try { this.currentAudio.pause(); } catch { /* ignore */ }
      try { this.currentAudio.src = ''; } catch { /* ignore */ }
      this.currentAudio = null;
    }
    this.speakingActive = false;
    if (!this.disposed && this.state !== VOICE_STATES.MUTED && this.state !== VOICE_STATES.IDLE) {
      this._setState(VOICE_STATES.LISTENING);
    }
  }
}
