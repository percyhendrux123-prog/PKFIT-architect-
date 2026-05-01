import { Link } from 'react-router-dom';
import { CinematicIntro } from '../components/CinematicIntro';

// minimalist 2026-05-01: full landing rewrite
//   - $37 price removed
//   - yellow stripped (cream-on-espresso only)
//   - thin outline borders removed; hierarchy via fill vs ghost
//   - hero is an inline SVG anatomical study (vertebral column),
//     not a magazine photo
//   - one supplied photo placed as a subtle, partial-bleed,
//     duotone accent in a later section so it never competes
//     with the SVG

const features = [
  { n: '01', title: 'Diagnosis', body: 'Baseline intake. Body composition, sleep, stress, lifts. Signal over story.' },
  { n: '02', title: 'Architecture', body: 'A lifting split engineered around your recovery and schedule. No filler.' },
  { n: '03', title: 'Nutrition', body: 'Macro floor, meal scaffolding, grocery template. Flexibility inside structure.' },
  { n: '04', title: 'Habit', body: 'The few daily levers that move the lift. Tracked. Reviewed. Corrected.' },
  { n: '05', title: 'Check-In', body: 'Data-in, adjustment-out. No guessing. No plateau drift.' },
  { n: '06', title: 'Identity', body: 'The loop that converts a thirty-day sprint into a standing pattern.' },
];

const phases = [
  { range: 'Week 01', title: 'Diagnosis', body: 'Baseline everything. Find the constraint.' },
  { range: 'Week 02', title: 'Correction', body: 'Remove the drag. Install the stack.' },
  { range: 'Week 03', title: 'Identity Shift', body: 'The pattern becomes a preference.' },
  { range: 'Week 04', title: 'The Lock', body: 'The stack becomes the default. The loop runs without you.' },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-bg text-ink">
      <CinematicIntro />

      {/* HERO — anatomical study left/centered, copy right
          minimalist 2026-05-01: SVG carries the visual weight,
          typography stays restrained, no decorative borders. */}
      <section className="mx-auto grid min-h-screen max-w-6xl grid-cols-1 items-center gap-12 px-5 py-24 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-20">
        <div className="order-2 lg:order-1">
          <VertebralStudy className="mx-auto w-full max-w-[340px]" />
        </div>

        <div className="order-1 lg:order-2">
          <div className="label mb-4">A 30-Day System</div>
          <h1 className="font-display text-[clamp(3rem,9vw,7.5rem)] leading-[0.92] tracking-wider2">
            THE PKFIT<br />BLUEPRINT
          </h1>
          <p className="mt-8 max-w-reading font-body text-[clamp(1rem,1.6vw,1.15rem)] leading-relaxed text-ink/85">
            The system is the structure. The sequence is the code. Thirty days to a body you can run.
          </p>
          <p className="mt-3 max-w-reading text-sm text-mute">
            Built for the man who is done with hype. Mechanism over motivation. Output over theatre.
          </p>

          {/* CTA hierarchy: solid fill (primary) vs ghost-no-border (secondary).
              minimalist 2026-05-01: removed thin borders + $37 price tag. */}
          <div className="mt-10 flex flex-wrap items-center gap-x-2 gap-y-3">
            <Link
              to="/signup"
              className="inline-flex h-12 items-center bg-ink px-7 font-display tracking-wider2 text-bg transition-opacity hover:opacity-90"
            >
              Enter the App
            </Link>
            <a
              href="https://percyhendrux.gumroad.com/l/khcus"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center px-5 font-display tracking-wider2 text-ink transition-opacity hover:opacity-70"
            >
              Get the Blueprint
            </a>
          </div>
        </div>
      </section>

      {/* POSITIONING — pure type, generous whitespace */}
      <section className="py-28">
        <div className="mx-auto max-w-5xl px-5">
          <div className="label mb-3">Positioning</div>
          <h2 className="max-w-reading font-display text-[clamp(2rem,5vw,3.5rem)] leading-[1.05] tracking-wider2">
            This is not a program.<br />It is a protocol.
          </h2>
          <p className="mt-8 max-w-reading text-mute">
            You will not be told to want it more. You will be shown where the signal is, where the noise is,
            and which lever to pull first. The output is a body that runs quieter, moves heavier, and holds.
          </p>
        </div>
      </section>

      {/* WHAT YOU GET — bordered grid removed, replaced with a typographic list
          minimalist 2026-05-01: zero outlines; rely on indexing + spacing. */}
      <section className="py-28">
        <div className="mx-auto max-w-5xl px-5">
          <div className="label mb-10">What you get</div>
          <ul className="grid grid-cols-1 gap-y-12 sm:grid-cols-2 sm:gap-x-12 lg:grid-cols-3">
            {features.map((f) => (
              <li key={f.n}>
                <div className="font-display text-5xl tracking-wider2 text-ink/55">{f.n}</div>
                <h3 className="mt-3 font-display text-xl tracking-wider2">{f.title}</h3>
                <p className="mt-2 max-w-reading text-sm text-mute">{f.body}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* 30-DAY STRUCTURE — single hairline divider between rows; nothing else.
          minimalist 2026-05-01: subtle photo accent partial-bleeds off the right.
          Photo is desaturated + low opacity so it reads as atmosphere, not subject. */}
      <section className="relative overflow-hidden py-28">
        <img
          src="/hero/back.jpg"
          alt=""
          aria-hidden="true"
          loading="lazy"
          decoding="async"
          className="pointer-events-none absolute -right-24 top-1/2 hidden h-[120%] w-[42%] -translate-y-1/2 object-cover object-center md:block"
          style={{
            filter: 'grayscale(100%) brightness(0.55) contrast(1.15)',
            opacity: 0.18,
            WebkitMaskImage: 'linear-gradient(to left, black 0%, transparent 92%)',
            maskImage: 'linear-gradient(to left, black 0%, transparent 92%)',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-bg via-bg/70 to-transparent md:via-bg/40" aria-hidden="true" />
        <div className="relative mx-auto max-w-5xl px-5">
          <div className="label mb-10">30-Day Structure</div>
          <ol className="divide-y divide-line">
            {phases.map((p) => (
              <li key={p.range} className="grid grid-cols-1 gap-3 py-7 md:grid-cols-[160px_1fr] md:gap-8">
                <div className="font-display tracking-widest2 text-mute">{p.range}</div>
                <div>
                  <h3 className="font-display text-2xl tracking-wider2">{p.title}</h3>
                  <p className="mt-2 max-w-reading text-sm text-mute">{p.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* TESTIMONIAL — image kept (existing client transformation), border stripped */}
      <section className="py-28">
        <div className="mx-auto max-w-5xl px-5">
          <figure className="grid grid-cols-1 items-center gap-10 md:grid-cols-[260px_1fr]">
            <img
              src="/testimonial.jpg"
              alt="Dele Bakare, PKFIT client transformation"
              width="720"
              height="720"
              className="w-full"
              loading="lazy"
              decoding="async"
            />
            <blockquote className="max-w-reading">
              <div className="label mb-3">Testimonial</div>
              <p className="font-display text-2xl leading-snug tracking-wider2 text-ink">
                Thirty-five pounds down. The structure did the work. I just stayed inside it.
              </p>
              <figcaption className="mt-4 text-sm text-mute">— Dele Bakare</figcaption>
            </blockquote>
          </figure>
        </div>
      </section>

      {/* CLOSING CTA — same fill-vs-ghost hierarchy as hero */}
      <section className="py-28">
        <div className="mx-auto max-w-5xl px-5 text-center">
          <div className="label mb-3">Start</div>
          <h2 className="mx-auto max-w-reading font-display text-[clamp(2rem,5vw,3.5rem)] leading-[1.05] tracking-wider2">
            Thirty days. One protocol.<br />One version of you on the other side.
          </h2>
          <div className="mt-12 flex flex-wrap items-center justify-center gap-x-2 gap-y-3">
            <Link
              to="/signup"
              className="inline-flex h-12 items-center bg-ink px-7 font-display tracking-wider2 text-bg transition-opacity hover:opacity-90"
            >
              Create an account
            </Link>
            <a
              href="https://percyhendrux.gumroad.com/l/khcus"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-12 items-center px-5 font-display tracking-wider2 text-ink transition-opacity hover:opacity-70"
            >
              Get the Blueprint
            </a>
          </div>
        </div>
      </section>

      <footer className="py-12 text-center text-xs uppercase tracking-widest2 text-faint">
        PKFIT · Quiet Work · {new Date().getFullYear()}
      </footer>
    </div>
  );
}

// minimalist 2026-05-01: anatomical study hero
// Inline SVG vertebral column rendered as a master-study line drawing.
// Cream lines on espresso, single soft gradient down the central canal,
// a tiny DM Mono "PLATE I · AXIS" label like a textbook plate.
// 22 stacked vertebrae following an anatomical S-curve (cervical lordosis,
// thoracic kyphosis, lumbar lordosis), then a triangular sacrum and coccyx.
function VertebralStudy({ className = '' }) {
  const CREAM = '#F5F1E8';
  const TOTAL = 22;
  const TOP_Y = 32;
  const BOTTOM_Y = 510;
  const CENTER_X = 100;

  const vertebrae = Array.from({ length: TOTAL }, (_, i) => {
    const t = i / (TOTAL - 1);
    // Region thresholds: cervical [0..0.32), thoracic [0.32..0.77), lumbar [0.77..1]
    const cervicalCurve = t < 0.32 ? -Math.sin((t / 0.32) * Math.PI) * 5.5 : 0;
    const thoracicCurve = t >= 0.32 && t < 0.77 ? Math.sin(((t - 0.32) / 0.45) * Math.PI) * 7 : 0;
    const lumbarCurve = t >= 0.77 ? -Math.sin(((t - 0.77) / 0.23) * Math.PI) * 6.5 : 0;
    const xc = CENTER_X + cervicalCurve + thoracicCurve + lumbarCurve;
    const yc = TOP_Y + t * (BOTTOM_Y - TOP_Y);
    // Vertebral body grows L-ward: cervical small (C1-C7), thoracic medium, lumbar largest
    const bw = 18 + t * 18;
    const bh = 12 + t * 7;
    return { xc, yc, bw, bh };
  });

  // Central canal path traced through the vertebrae centers
  const canalPath = vertebrae
    .map((v, i) => `${i === 0 ? 'M' : 'L'}${v.xc.toFixed(2)} ${v.yc.toFixed(2)}`)
    .join(' ');

  return (
    <svg
      viewBox="0 0 200 600"
      role="img"
      aria-label="Anatomical study, vertebral column"
      className={className}
      preserveAspectRatio="xMidYMid meet"
    >
      <defs>
        <linearGradient id="pkfit-canal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={CREAM} stopOpacity="0.85" />
          <stop offset="55%" stopColor={CREAM} stopOpacity="0.45" />
          <stop offset="100%" stopColor={CREAM} stopOpacity="0.05" />
        </linearGradient>
      </defs>

      {/* Textbook-plate label, top-left like an anatomical illustration */}
      <g fontFamily='"DM Mono", ui-monospace, monospace' fill={CREAM}>
        <text x="14" y="22" fontSize="10" letterSpacing="3" opacity="0.62">PLATE I</text>
        <text x="14" y="36" fontSize="9" letterSpacing="2.4" opacity="0.42">AXIS · STRUCTURA</text>
      </g>

      {/* Central canal — soft gradient line tracing the S-curve */}
      <path
        d={canalPath}
        stroke="url(#pkfit-canal)"
        strokeWidth="2.25"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* Vertebrae — body + spinous + transverse processes */}
      <g stroke={CREAM} fill="none" strokeLinecap="round">
        {vertebrae.map((v, i) => {
          const rx = v.bw / 2;
          const ry = v.bh / 2;
          // spinous process angles slightly downward (posterior-inferior)
          const spX1 = v.xc + rx;
          const spY1 = v.yc;
          const spX2 = spX1 + (10 + i * 0.4);
          const spY2 = spY1 + 4 + i * 0.15;
          // transverse processes (left short tick)
          const txX1 = v.xc - rx;
          const txX2 = txX1 - 5;
          return (
            <g key={i}>
              <ellipse
                cx={v.xc}
                cy={v.yc}
                rx={rx}
                ry={ry}
                strokeWidth={i % 6 === 0 ? 1.5 : 1.15}
                opacity={0.78 + (i / TOTAL) * 0.18}
              />
              <line
                x1={spX1}
                y1={spY1}
                x2={spX2}
                y2={spY2}
                strokeWidth="1"
                opacity="0.7"
              />
              <line
                x1={txX1}
                y1={v.yc}
                x2={txX2}
                y2={v.yc}
                strokeWidth="0.9"
                opacity="0.55"
              />
            </g>
          );
        })}
      </g>

      {/* Sacrum — triangular fused mass below L5 */}
      <path
        d="M 88 522 L 112 522 L 116 562 L 84 562 Z"
        stroke={CREAM}
        strokeWidth="1.4"
        fill="none"
        opacity="0.85"
      />
      {/* sacral fusion lines */}
      <g stroke={CREAM} strokeWidth="0.7" opacity="0.45">
        <line x1="86" y1="532" x2="114" y2="532" />
        <line x1="86" y1="542" x2="114" y2="542" />
        <line x1="86" y1="552" x2="114" y2="552" />
      </g>

      {/* Coccyx — three small fused tail segments */}
      <g stroke={CREAM} strokeWidth="1" fill="none" opacity="0.7" strokeLinecap="round">
        <line x1="100" y1="562" x2="101" y2="572" />
        <line x1="101" y1="574" x2="103" y2="582" />
        <line x1="103" y1="584" x2="106" y2="590" />
      </g>

      {/* hairline annotation tick at C1 (atlas) and L5 — the start and end of the load chain */}
      <g stroke={CREAM} strokeWidth="0.7" opacity="0.4">
        <line x1="60" y1={vertebrae[0].yc} x2="78" y2={vertebrae[0].yc} />
        <line x1="60" y1={vertebrae[TOTAL - 1].yc} x2="78" y2={vertebrae[TOTAL - 1].yc} />
      </g>
      <g fontFamily='"DM Mono", ui-monospace, monospace' fontSize="8" fill={CREAM} opacity="0.45" letterSpacing="1.5">
        <text x="36" y={vertebrae[0].yc + 3}>C1</text>
        <text x="36" y={vertebrae[TOTAL - 1].yc + 3}>L5</text>
      </g>
    </svg>
  );
}
