// ScrollEffects — sticky-text, pinned-reveal, image-reveal, useScrollProgress.
// Converted from window-global definitions to ES module exports.
import { useEffect, useRef, useState } from 'react';

export function useScrollProgress(ref, mode = 'through') {
  const [p, setP] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const onScroll = () => {
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      let v = 0;
      if (mode === 'pin') {
        const total = r.height - vh;
        v = total > 0 ? Math.max(0, Math.min(1, -r.top / total)) : r.top < 0 ? 1 : 0;
      } else {
        const total = r.height + vh;
        v = Math.max(0, Math.min(1, (vh - r.top) / total));
      }
      setP(v);
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [ref, mode]);
  return p;
}

function flattenText(node) {
  if (node == null || node === false || node === true) return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(flattenText).join('');
  if (typeof node === 'object' && node.props && node.props.children !== undefined) {
    return flattenText(node.props.children);
  }
  return '';
}

export function StickyText({ children, accent = false, intensity = 1, className = '' }) {
  const ref = useRef(null);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const onScroll = () => {
      const rect = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const total = rect.height + vh;
      const passed = vh - rect.top;
      setProgress(Math.max(0, Math.min(1, passed / total)));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, []);

  const text = flattenText(children);
  const chars = text.split('');
  const litCount = Math.floor(progress * chars.length * (1 + 0.3 * intensity));

  return (
    <span ref={ref} className={`sticky-text ${className}`}>
      {chars.map((c, i) => (
        <span key={i} className={i < litCount ? (accent ? 'ch lit accent' : 'ch lit') : 'ch'}>
          {c === ' ' ? ' ' : c}
        </span>
      ))}
    </span>
  );
}

export function RevealImage({ src, alt = '', intensity = 1, className = '', aspect = '4/5' }) {
  const ref = useRef(null);
  const [p, setP] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const onScroll = () => {
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const total = r.height + vh;
      const passed = vh - r.top;
      setP(Math.max(0, Math.min(1, passed / total)));
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const clipP = Math.min(1, p * 1.4 * intensity);
  const scale = 1.15 - clipP * 0.15;
  const blur = (1 - clipP) * 12 * intensity;
  const gray = (1 - clipP) * 0.6 * intensity;

  return (
    <div ref={ref} className={`reveal-image ${className}`} style={{ aspectRatio: aspect, position: 'relative' }}>
      <div
        style={{
          position: 'absolute',
          inset: 0,
          clipPath: `inset(${(1 - clipP) * 18}% ${(1 - clipP) * 6}% round 2px)`,
          transition: 'clip-path .1s linear',
        }}
      >
        <img
          src={src}
          alt={alt}
          style={{
            transform: `scale(${scale})`,
            filter: `blur(${blur}px) grayscale(${gray}) contrast(${1 + clipP * 0.1})`,
            transition: 'filter .1s linear, transform .1s linear',
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      </div>
    </div>
  );
}
