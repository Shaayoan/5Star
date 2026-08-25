'use client';

import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { cn } from '@/lib/utils';

/** Minimal shape of the Web Speech API we rely on. It is still vendor-prefixed
 *  in Chrome and Safari and absent in Firefox, so it is treated as optional. */
interface SpeechRecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  onresult: ((event: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
}

type Ctor = new () => SpeechRecognitionLike;

function getRecognition(): Ctor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as {
    SpeechRecognition?: Ctor;
    webkitSpeechRecognition?: Ctor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

/**
 * Dictation for the check-in. Talking through a day is far faster than typing
 * it, which matters most on a phone. Uses the browser's own speech engine, so
 * it costs nothing and needs no extra service.
 */
export function VoiceButton({
  onTranscript,
  disabled,
}: {
  onTranscript: (text: string) => void;
  disabled?: boolean;
}) {
  const [listening, setListening] = useState(false);
  const recognition = useRef<SpeechRecognitionLike | null>(null);

  // Reading a browser capability is exactly what useSyncExternalStore's server
  // snapshot is for: it renders `false` during SSR, so there is no hydration
  // mismatch, and never triggers a cascading render the way an effect would.
  const supported = useSyncExternalStore(
    () => () => {},
    () => getRecognition() !== null,
    () => false,
  );

  useEffect(() => () => recognition.current?.stop(), []);

  if (!supported) return null;

  const toggle = () => {
    if (listening) {
      recognition.current?.stop();
      return;
    }

    const Ctor = getRecognition();
    if (!Ctor) return;

    const rec = new Ctor();
    rec.lang = navigator.language || 'en-US';
    rec.continuous = true;
    rec.interimResults = false;

    rec.onresult = (event) => {
      let text = '';
      for (let i = 0; i < event.results.length; i++) {
        text += event.results[i][0].transcript;
      }
      const trimmed = text.trim();
      if (trimmed) onTranscript(trimmed);
    };
    rec.onerror = () => setListening(false);
    rec.onend = () => setListening(false);

    recognition.current = rec;
    rec.start();
    setListening(true);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={disabled}
      aria-label={listening ? 'Stop dictating' : 'Dictate your day'}
      aria-pressed={listening}
      className={cn(
        'grid h-10 w-10 shrink-0 place-items-center rounded-lg transition-colors',
        'disabled:pointer-events-none disabled:opacity-50',
        listening
          ? 'bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/40'
          : 'bg-ink-700 text-ink-200 hover:bg-ink-600',
      )}
    >
      <span className={cn('text-lg', listening && 'animate-pulse')}>🎙️</span>
    </button>
  );
}
