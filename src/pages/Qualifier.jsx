import { useMemo, useState } from 'react';

// Native PKFIT qualifier — replaces the Typeform that pkfitelite.co.site has
// been pointing to. 7 questions, branched on the price-anchor gate:
//   ready_to_invest === true  → "Drop the best way to reach you" → Percy reaches out direct
//   ready_to_invest === false → soft path: workbook / diagnose route
//
// Posts to /.netlify/functions/qualifier-submit and renders the appropriate
// confirmation screen.

const BG = '#080808';
const CARD = '#161616';
const BORDER = '#2a2a2a';
const INK = '#F5F5F5';
const MUTE = '#888';
const GOLD = '#C9A84C';
const RADIUS = 14;

const EXPERIENCE_OPTIONS = [
  { value: 'beginner', label: 'Beginner — under 1 year of consistent training' },
  { value: 'intermediate', label: 'Intermediate — 1 to 5 years' },
  { value: 'advanced', label: 'Advanced — 5+ years, lifts and intent are dialed' },
];

const TRAINING_DAYS_OPTIONS = [
  { value: '2-3', label: '2 to 3 days a week' },
  { value: '4-5', label: '4 to 5 days a week' },
  { value: '6-7', label: '6 to 7 days a week' },
];

const TOTAL_STEPS = 7;

export default function Qualifier({ embedded = false }) {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [goals, setGoals] = useState('');
  const [experience, setExperience] = useState('');
  const [trainingDays, setTrainingDays] = useState('');
  const [readyToInvest, setReadyToInvest] = useState(null); // null | true | false
  const [preferredContact, setPreferredContact] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [result, setResult] = useState(null); // { ready_to_invest: bool, application_id }

  const canAdvance = useMemo(() => {
    if (step === 0) return name.trim().length > 1;
    if (step === 1) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    if (step === 2) return goals.trim().length > 8;
    if (step === 3) return experience !== '';
    if (step === 4) return trainingDays !== '';
    if (step === 5) return readyToInvest === true || readyToInvest === false;
    if (step === 6) {
      // Step 6 only appears for the YES branch — collect preferred contact
      if (readyToInvest !== true) return false;
      return preferredContact.trim().length > 2;
    }
    return false;
  }, [step, name, email, goals, experience, trainingDays, readyToInvest, preferredContact]);

  async function submit() {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/.netlify/functions/qualifier-submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          email: email.trim(),
          goals: goals.trim(),
          experience,
          training_days: trainingDays,
          ready_to_invest: readyToInvest,
          preferred_contact: readyToInvest ? preferredContact.trim() : null,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(payload?.error || `submission failed (${res.status})`);
      }
      setResult({
        ready_to_invest: readyToInvest,
        application_id: payload.application_id,
        name: name.trim(),
        email: email.trim(),
      });
    } catch (e) {
      setError(e?.message || 'Submission failed. Try again in a moment.');
    } finally {
      setSubmitting(false);
    }
  }

  function next() {
    if (!canAdvance) return;

    // Submission moment depends on branch
    // - NO branch submits at step 5 (the readiness question)
    // - YES branch advances to step 6 (preferred contact) and submits there
    if (step === 5 && readyToInvest === false) {
      submit();
      return;
    }
    if (step === 6 && readyToInvest === true) {
      submit();
      return;
    }
    setStep((s) => s + 1);
  }

  function back() {
    if (step === 0 || submitting) return;
    setStep((s) => Math.max(0, s - 1));
  }

  if (result) {
    return (
      <Confirmation
        isHot={result.ready_to_invest}
        name={result.name}
        email={result.email}
        embedded={embedded}
      />
    );
  }

  return (
    <div
      style={{
        minHeight: embedded ? 0 : '100dvh',
        background: embedded ? 'transparent' : BG,
        color: INK,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: '"DM Mono", ui-monospace, monospace',
      }}
    >
      {!embedded && <Header />}

      <main
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          maxWidth: embedded ? '100%' : 720,
          width: '100%',
          margin: '0 auto',
          padding: embedded ? 0 : '24px 20px 96px',
          minHeight: 0,
        }}
      >
        <ProgressBar
          step={step}
          total={readyToInvest === true ? TOTAL_STEPS : TOTAL_STEPS - 1}
        />

        <div style={{ marginTop: 32, flex: 1 }}>
          {step === 0 && (
            <Step label="What's your name?" hint="First and last is fine.">
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoFocus
                placeholder="Percy Keith"
                style={fieldStyle}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canAdvance) next();
                }}
              />
            </Step>
          )}

          {step === 1 && (
            <Step label="Best email to reach you?" hint="Where I'll send everything.">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoFocus
                placeholder="you@example.com"
                style={fieldStyle}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canAdvance) next();
                }}
              />
            </Step>
          )}

          {step === 2 && (
            <Step
              label="What are you trying to change?"
              hint="Be specific. Not 'get in shape' — say what's actually moving in your body, your week, your standard."
            >
              <textarea
                value={goals}
                onChange={(e) => setGoals(e.target.value)}
                autoFocus
                rows={6}
                placeholder="What's the actual gap between where you are and where you want to be?"
                style={{ ...fieldStyle, resize: 'vertical', minHeight: 140 }}
              />
            </Step>
          )}

          {step === 3 && (
            <Step label="Where are you with training?" hint="Pick the closest fit.">
              <Choices
                options={EXPERIENCE_OPTIONS}
                value={experience}
                onChange={setExperience}
              />
            </Step>
          )}

          {step === 4 && (
            <Step label="How many days a week can you train?" hint="Realistic, not aspirational.">
              <Choices
                options={TRAINING_DAYS_OPTIONS}
                value={trainingDays}
                onChange={setTrainingDays}
              />
            </Step>
          )}

          {step === 5 && (
            <Step
              label="If we're a fit, are you ready to invest $250 to begin immediately?"
              hint="This is the only money question. Honest answer matters."
            >
              <Choices
                options={[
                  { value: 'yes', label: 'Yes — ready to move' },
                  { value: 'no', label: 'Not yet — need more time' },
                ]}
                value={readyToInvest === true ? 'yes' : readyToInvest === false ? 'no' : ''}
                onChange={(v) => setReadyToInvest(v === 'yes')}
              />
            </Step>
          )}

          {step === 6 && readyToInvest === true && (
            <Step
              label="Best way to reach you?"
              hint="Phone number and a few times that work. I'll reach out personally."
            >
              <textarea
                value={preferredContact}
                onChange={(e) => setPreferredContact(e.target.value)}
                autoFocus
                rows={4}
                placeholder="(555) 123-4567 — weekday evenings after 6pm CDT"
                style={{ ...fieldStyle, resize: 'vertical', minHeight: 100 }}
              />
            </Step>
          )}
        </div>

        {error && (
          <div
            role="alert"
            style={{
              color: GOLD,
              fontSize: 12,
              letterSpacing: '0.06em',
              padding: '12px 0',
              textTransform: 'uppercase',
            }}
          >
            {error}
          </div>
        )}

        <Nav
          step={step}
          submitting={submitting}
          canAdvance={canAdvance}
          isFinal={(step === 5 && readyToInvest === false) || step === 6}
          onBack={back}
          onNext={next}
          embedded={embedded}
        />
      </main>
    </div>
  );
}

const fieldStyle = {
  width: '100%',
  background: CARD,
  border: `0.5px solid ${BORDER}`,
  borderRadius: RADIUS,
  padding: '14px 16px',
  color: INK,
  fontSize: 16,
  fontFamily: 'inherit',
  outline: 'none',
  boxSizing: 'border-box',
};

function Header() {
  return (
    <header
      style={{
        borderBottom: `0.5px solid ${BORDER}`,
        padding: '16px 20px',
        background: BG,
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}
    >
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <div
          style={{
            fontFamily: '"Bebas Neue", "DM Mono", system-ui, sans-serif',
            letterSpacing: '0.08em',
            fontSize: 22,
            lineHeight: 1,
          }}
        >
          <span style={{ color: INK }}>PKFIT</span>
          <span style={{ color: BORDER, margin: '0 8px' }}>×</span>
          <span style={{ color: GOLD }}>QUALIFIER</span>
        </div>
        <p
          style={{
            margin: '8px 0 0',
            color: MUTE,
            fontSize: 12,
            letterSpacing: '0.04em',
          }}
        >
          Apply for 1-on-1 coaching. Seven questions.
        </p>
      </div>
    </header>
  );
}

function ProgressBar({ step, total }) {
  const pct = Math.min(100, Math.max(0, ((step + 1) / total) * 100));
  return (
    <div>
      <div
        style={{
          height: 3,
          background: BORDER,
          borderRadius: 2,
          overflow: 'hidden',
        }}
      >
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: GOLD,
            transition: 'width 200ms ease',
          }}
        />
      </div>
      <div
        style={{
          marginTop: 8,
          fontSize: 11,
          letterSpacing: '0.08em',
          color: MUTE,
          textTransform: 'uppercase',
        }}
      >
        Question {step + 1} of {total}
      </div>
    </div>
  );
}

function Step({ label, hint, children }) {
  return (
    <div>
      <h2
        style={{
          fontFamily: '"Bebas Neue", "DM Mono", system-ui, sans-serif',
          letterSpacing: '0.04em',
          fontSize: 28,
          lineHeight: 1.15,
          color: INK,
          margin: '0 0 12px',
        }}
      >
        {label}
      </h2>
      {hint && (
        <p style={{ margin: '0 0 20px', color: MUTE, fontSize: 13, lineHeight: 1.5 }}>{hint}</p>
      )}
      {children}
    </div>
  );
}

function Choices({ options, value, onChange }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            style={{
              textAlign: 'left',
              width: '100%',
              background: selected ? '#1c1c1c' : CARD,
              border: `0.5px solid ${selected ? GOLD : BORDER}`,
              borderRadius: RADIUS,
              padding: '14px 16px',
              color: INK,
              fontSize: 15,
              fontFamily: 'inherit',
              cursor: 'pointer',
              transition: 'border-color 120ms ease',
            }}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

function Nav({ step, submitting, canAdvance, isFinal, onBack, onNext, embedded }) {
  return (
    <div
      style={{
        position: embedded ? 'static' : 'sticky',
        bottom: 0,
        background: embedded ? 'transparent' : BG,
        paddingTop: 16,
        display: 'flex',
        gap: 10,
      }}
    >
      <button
        type="button"
        onClick={onBack}
        disabled={step === 0 || submitting}
        style={{
          flex: '0 0 auto',
          padding: '12px 18px',
          background: 'transparent',
          border: `0.5px solid ${BORDER}`,
          borderRadius: RADIUS,
          color: step === 0 ? MUTE : INK,
          fontFamily: 'inherit',
          fontSize: 13,
          letterSpacing: '0.06em',
          cursor: step === 0 || submitting ? 'not-allowed' : 'pointer',
        }}
      >
        BACK
      </button>
      <button
        type="button"
        onClick={onNext}
        disabled={!canAdvance || submitting}
        style={{
          flex: 1,
          padding: '12px 18px',
          background: canAdvance ? GOLD : '#3a3a3a',
          color: canAdvance ? BG : MUTE,
          border: `0.5px solid ${canAdvance ? GOLD : BORDER}`,
          borderRadius: RADIUS,
          fontFamily: '"Bebas Neue", "DM Mono", system-ui, sans-serif',
          fontSize: 14,
          letterSpacing: '0.08em',
          cursor: canAdvance && !submitting ? 'pointer' : 'not-allowed',
          opacity: submitting ? 0.7 : 1,
        }}
      >
        {submitting ? 'SENDING…' : isFinal ? 'SUBMIT APPLICATION' : 'NEXT'}
      </button>
    </div>
  );
}

function Confirmation({ isHot, name, email, embedded }) {
  const calendlyUrl =
    'https://calendly.com/percyhendrux123/30min?hide_gdpr_banner=1' +
    (name ? `&name=${encodeURIComponent(name)}` : '') +
    (email ? `&email=${encodeURIComponent(email)}` : '');
  return (
    <div
      style={{
        minHeight: embedded ? 0 : '100dvh',
        background: embedded ? 'transparent' : BG,
        color: INK,
        display: 'flex',
        flexDirection: 'column',
        fontFamily: '"DM Mono", ui-monospace, monospace',
      }}
    >
      {!embedded && <Header />}
      <main
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: embedded ? 0 : '40px 20px',
        }}
      >
        <div
          style={{
            background: CARD,
            border: `0.5px solid ${GOLD}`,
            borderRadius: RADIUS,
            padding: '28px 24px',
            maxWidth: embedded ? '100%' : isHot ? 680 : 540,
            width: '100%',
            textAlign: 'left',
          }}
        >
          <div
            style={{
              fontFamily: '"Bebas Neue", "DM Mono", system-ui, sans-serif',
              letterSpacing: '0.08em',
              fontSize: 22,
              color: GOLD,
              marginBottom: 14,
            }}
          >
            {isHot ? 'APPLICATION IN' : 'APPLICATION IN — SOFT TRACK'}
          </div>

          {isHot ? (
            <>
              <p style={{ color: INK, fontSize: 15, lineHeight: 1.55, margin: '0 0 14px' }}>
                I review every submission personally — you're in.
              </p>
              <p style={{ color: INK, fontSize: 15, lineHeight: 1.55, margin: '0 0 18px' }}>
                Book your Application Review Call below. That's where we move forward.
              </p>
              <div
                style={{
                  border: `0.5px solid ${BORDER}`,
                  borderRadius: RADIUS,
                  overflow: 'hidden',
                  background: '#fff',
                }}
              >
                <iframe
                  title="Book your PKFIT Application Review Call"
                  src={calendlyUrl}
                  style={{ width: '100%', height: 700, border: 'none', display: 'block' }}
                />
              </div>
            </>
          ) : (
            <>
              <p style={{ color: INK, fontSize: 15, lineHeight: 1.55, margin: '0 0 14px' }}>
                Got it. Not ready isn't a problem — early is a problem only if you wait too long
                to find the mechanism.
              </p>
              <p style={{ color: INK, fontSize: 15, lineHeight: 1.55, margin: '0 0 18px' }}>
                Run the diagnose surface in the meantime. It walks the breakdown — appetite,
                system, structure, standard.
              </p>
              <a
                href="/standard"
                style={{
                  display: 'inline-block',
                  background: GOLD,
                  color: BG,
                  padding: '12px 20px',
                  borderRadius: RADIUS,
                  textDecoration: 'none',
                  fontFamily: '"Bebas Neue", "DM Mono", system-ui, sans-serif',
                  letterSpacing: '0.08em',
                  fontSize: 14,
                }}
              >
                RUN /STANDARD
              </a>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
