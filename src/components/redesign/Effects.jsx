// Effects — production-safe utility components from the PKFIT redesign bundle.
// Skips CustomCursor (overkill on mobile) and ScrollBar (browser-native is fine).
import { useEffect, useRef, useState } from 'react';

// CountUp — animates a number into view from 0 with cubic ease-out.
export function CountUp({ to, duration = 1400, suffix = '', prefix = '' }) {
  const ref = useRef(null);
  const startedRef = useRef(false);
  const [n, setN] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !startedRef.current) {
            startedRef.current = true;
            const start = performance.now();
            const tick = (t) => {
              const p = Math.min(1, (t - start) / duration);
              const eased = 1 - Math.pow(1 - p, 3);
              setN(Math.round(to * eased * 10) / 10);
              if (p < 1) requestAnimationFrame(tick);
            };
            requestAnimationFrame(tick);
          }
        });
      },
      { threshold: 0.4 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [to, duration]);

  return (
    <span ref={ref} className="tnum">
      {prefix}
      {n}
      {suffix}
    </span>
  );
}

// FadeUp — opacity + translate enter on view.
export function FadeUp({ children, delay = 0, ...rest }) {
  const ref = useRef(null);
  const [vis, setVis] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) setVis(true);
        });
      },
      { threshold: 0.15 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`fade-up ${vis ? 'in' : ''}`}
      style={{ transitionDelay: `${delay}ms` }}
      {...rest}
    >
      {children}
    </div>
  );
}

// LiveDot — pulsing status indicator.
export function LiveDot({ color = '#4ADE80' }) {
  return (
    <span
      className="live-pulse"
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: 999,
        background: color,
      }}
    />
  );
}

// WordRoll — vertical rotating word ticker.
export function WordRoll({ words = [], interval = 2200 }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!words.length) return undefined;
    const t = setInterval(() => setI((x) => (x + 1) % words.length), interval);
    return () => clearInterval(t);
  }, [words.length, interval]);
  return (
    <span style={{ display: 'inline-block', height: '1em', overflow: 'hidden', verticalAlign: 'bottom' }}>
      <span
        style={{
          display: 'block',
          transform: `translateY(-${i * 100}%)`,
          transition: 'transform .5s cubic-bezier(.7,0,.3,1)',
        }}
      >
        {words.map((w, j) => (
          <span key={j} style={{ display: 'block', lineHeight: 1, color: '#FF5B1F' }}>
            {w}
          </span>
        ))}
      </span>
    </span>
  );
}

// Magnetic — pulls children toward cursor on hover.
export function Magnetic({ children, strength = 18, ...rest }) {
  const ref = useRef(null);
  const onMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const x = e.clientX - (r.left + r.width / 2);
    const y = e.clientY - (r.top + r.height / 2);
    el.style.transform = `translate(${x / strength}px, ${y / strength}px)`;
  };
  const onLeave = () => {
    if (ref.current) ref.current.style.transform = 'translate(0,0)';
  };
  return (
    <span ref={ref} className="magnetic" data-mag onMouseMove={onMove} onMouseLeave={onLeave} {...rest}>
      {children}
    </span>
  );
}

// Spotlight — radial gradient that follows cursor inside the section.
export function Spotlight({ children, ...rest }) {
  const ref = useRef(null);
  const onMove = (e) => {
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    el.style.setProperty('--mx', `${e.clientX - r.left}px`);
    el.style.setProperty('--my', `${e.clientY - r.top}px`);
  };
  return (
    <div ref={ref} className="spotlight" onMouseMove={onMove} {...rest}>
      {children}
    </div>
  );
}

// Marquee — horizontal infinite scroll. Uses CSS keyframe `marquee` from index.css.
export function Marquee({ children, speed = 30, reverse = false }) {
  return (
    <div style={{ overflow: 'hidden', display: 'flex' }}>
      <div
        style={{
          display: 'flex',
          gap: 48,
          whiteSpace: 'nowrap',
          animation: `marquee ${speed}s linear infinite ${reverse ? 'reverse' : ''}`,
        }}
      >
        {children}
        {children}
        {children}
      </div>
    </div>
  );
}

// Parallax — translates Y based on scroll position.
export function Parallax({ children, speed = 0.3, style = {}, ...rest }) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    let raf;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const r = el.getBoundingClientRect();
        const offset = (r.top - window.innerHeight / 2) * speed;
        el.style.transform = `translateY(${-offset}px)`;
      });
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, [speed]);
  return (
    <div ref={ref} {...rest} style={{ willChange: 'transform', ...style }}>
      {children}
    </div>
  );
}
