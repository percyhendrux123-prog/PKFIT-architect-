import { Link } from 'react-router-dom';

const features = [
  { n: '01', title: 'Diagnosis Protocol', body: 'Baseline intake. Body composition, sleep, stress, lifts. Signal over story.' },
  { n: '02', title: 'Program Architecture', body: 'A lifting split engineered around your recovery and schedule. No filler.' },
  { n: '03', title: 'Nutrition Frame', body: 'Macro floor, meal scaffolding, grocery template. Flexibility inside structure.' },
  { n: '04', title: 'Habit System', body: 'The few daily levers that move the lift. Tracked. Reviewed. Corrected.' },
  { n: '05', title: 'Weekly Check-In', body: 'Data-in, adjustment-out. No guessing. No plateau drift.' },
  { n: '06', title: 'Identity Lock', body: 'The loop that converts a thirty-day sprint into a standing pattern.' },
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
      <section className="mx-auto flex min-h-screen max-w-5xl flex-col justify-center px-5 py-24">
        <div className="label mb-4">The PKFIT Blueprint · A 30-Day System</div>
        <h1 className="font-display text-[clamp(3rem,8vw,7rem)] leading-[0.95] tracking-wider2 text-gold">
          THE PKFIT<br />BLUEPRINT
        </h1>
        <p className="mt-8 max-w-reading font-body text-[clamp(1rem,2vw,1.25rem)] leading-relaxed text-ink/90">
          The system is the structure. The sequence is the code. Thirty days to a body you can run.
        </p>
        <p className="mt-4 max-w-reading text-sm text-mute">
          Built for the man who is done with hype. Mechanism over motivation. Output over theatre.
        </p>
        <div className="mt-10 flex flex-wrap gap-4">
          <a
            href="https://percyhendrux.gumroad.com/l/khcus"
            className="inline-flex items-center border border-gold bg-gold px-6 py-4 font-display tracking-wider2 text-bg hover:bg-[#d8b658]"
          >
            Get the Blueprint · $37
          </a>
          <Link
            to="/signup"
            className="inline-flex items-center border border-line px-6 py-4 font-display tracking-wider2 text-ink hover:border-gold"
          >
            Enter the App
          </Link>
        </div>
      </section>

      <section className="border-t border-line py-20">
        <div className="mx-auto max-w-5xl px-5">
          <div className="label mb-3">Positioning</div>
          <h2 className="max-w-reading font-display text-[clamp(2rem,5vw,3.25rem)] leading-tight tracking-wider2">
            This is not a program. It is a protocol.
          </h2>
          <p className="mt-6 max-w-reading text-mute">
            You will not be told to want it more. You will be shown where the signal is, where the noise is,
            and which lever to pull first. The output is a body that runs quieter, moves heavier, and holds.
          </p>
        </div>
      </section>

      <section className="border-t border-line py-20">
        <div className="mx-auto max-w-5xl px-5">
          <div className="label mb-3">What you get</div>
          <div className="grid grid-cols-1 gap-px border border-line bg-line sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <article key={f.n} className="bg-bg p-6">
                <div className="font-display text-5xl tracking-wider2 text-gold">{f.n}</div>
                <h3 className="mt-3 font-display text-xl tracking-wider2">{f.title}</h3>
                <p className="mt-2 text-sm text-mute">{f.body}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-line py-20">
        <div className="mx-auto max-w-5xl px-5">
          <div className="label mb-3">30-Day Structure</div>
          <div className="divide-y divide-line border border-line">
            {phases.map((p) => (
              <div key={p.range} className="grid grid-cols-1 gap-4 p-6 md:grid-cols-[160px_1fr]">
                <div className="font-display tracking-widest2 text-gold">{p.range}</div>
                <div>
                  <h3 className="font-display text-2xl tracking-wider2">{p.title}</h3>
                  <p className="mt-2 max-w-reading text-sm text-mute">{p.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="border-t border-line py-20">
        <div className="mx-auto max-w-5xl px-5">
          <figure className="grid grid-cols-1 items-center gap-10 md:grid-cols-[260px_1fr]">
            <img
              src="/testimonial.png"
              alt="Client transformation"
              className="w-full border border-line"
              loading="lazy"
            />
            <blockquote className="max-w-reading">
              <div className="label mb-2">Testimonial</div>
              <p className="font-display text-2xl leading-snug tracking-wider2 text-ink">
                Thirty-five pounds down. The structure did the work. I just stayed inside it.
              </p>
              <figcaption className="mt-4 text-sm text-mute">— Dele Bakare</figcaption>
            </blockquote>
          </figure>
        </div>
      </section>

      <section className="border-t border-line py-20">
        <div className="mx-auto max-w-5xl px-5 text-center">
          <div className="label mb-3">Start</div>
          <h2 className="mx-auto max-w-reading font-display text-[clamp(2rem,5vw,3.25rem)] tracking-wider2">
            Thirty days. One protocol. One version of you on the other side.
          </h2>
          <div className="mt-10 flex flex-wrap justify-center gap-4">
            <a
              href="https://percyhendrux.gumroad.com/l/khcus"
              className="border border-gold bg-gold px-6 py-4 font-display tracking-wider2 text-bg hover:bg-[#d8b658]"
            >
              Get the Blueprint
            </a>
            <Link
              to="/signup"
              className="border border-line px-6 py-4 font-display tracking-wider2 text-ink hover:border-gold"
            >
              Create an account
            </Link>
          </div>
        </div>
      </section>

      <footer className="border-t border-line py-10 text-center text-xs uppercase tracking-widest2 text-faint">
        PKFIT · Quiet Work · {new Date().getFullYear()}
      </footer>
    </div>
  );
}
