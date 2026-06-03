import Qualifier from './Qualifier.jsx';

// /apply — the rebuilt Performance Standard application page (approved design).
// Sequence: hero (diagnosis, not a pitch) → proof → what you get (5 app screens)
// → the offer + price + fit gate → the application (the REAL working qualifier
// → Supabase → Calendly, embedded unchanged).
//
// Styling is self-contained: a scoped <style> under #apply-root reproduces the
// operatefitness.app brand system (mirrors public/assets/brand.css) so the page
// renders identically to the static marketing pages without colliding with the
// SPA's Tailwind preflight. The booking mechanics live in <Qualifier embedded />
// and are untouched.

const CSS = `
@font-face{font-family:'Anton';font-style:normal;font-weight:400;font-display:swap;src:url('/assets/fonts/anton-v27-latin-400.woff2') format('woff2')}

#apply-root{
  --base:#080808;--body:#0a0a0a;--card:#161616;--card-nested:#0e0e0e;--line:#2a2a2a;
  --ink:#F5F5F5;--muted:#888;--faint:#555;--gold:#C9A84C;--gold-tile:#1a1610;
  --steel:#8A94A6;--maxw:1120px;--radius:14px;
  background:var(--body);
  background-image:radial-gradient(rgba(138,148,166,0.05) 1px, transparent 1px);
  background-size:30px 30px;
  color:var(--ink);font-family:'DM Mono',monospace;line-height:1.6;
  min-height:100vh;-webkit-font-smoothing:antialiased;scroll-behavior:smooth;
}
#apply-root *{box-sizing:border-box}
#apply-root p{color:#cfcfcf;font-size:15px}
#apply-root .wrap{max-width:var(--maxw);margin:0 auto;padding:0 22px}
#apply-root section{padding:64px 0;border-bottom:0.5px solid var(--line)}
#apply-root .anton{font-family:'Anton',sans-serif;text-transform:uppercase;line-height:0.95;letter-spacing:0.5px}
#apply-root .bebas{font-family:'Bebas Neue',sans-serif;letter-spacing:1.5px;line-height:1}
#apply-root .kicker{font-family:'DM Mono',monospace;font-size:11px;letter-spacing:3px;text-transform:uppercase;color:var(--muted)}
#apply-root .kicker.gold{color:var(--gold)}
#apply-root .gold{color:var(--gold)}

/* nav */
#apply-root .nav{position:sticky;top:0;z-index:60;background:rgba(8,8,8,0.86);backdrop-filter:blur(10px);border-bottom:0.5px solid var(--line)}
#apply-root .nav-in{max-width:var(--maxw);margin:0 auto;padding:14px 22px;display:flex;align-items:center;justify-content:space-between}
#apply-root .wordmark{font-family:'DM Mono',monospace;font-weight:500;letter-spacing:4px;font-size:16px;color:var(--ink)}
#apply-root .nav-links{display:none;gap:26px}
#apply-root .nav-links a{color:var(--muted);text-decoration:none;font-size:11px;letter-spacing:2px;text-transform:uppercase}
#apply-root .nav-links a:hover{color:var(--ink)}
#apply-root .nav-cta{font-family:'Bebas Neue',sans-serif;font-size:14px;letter-spacing:2px;background:var(--gold);color:var(--base);padding:9px 16px;border-radius:8px;text-decoration:none}

/* buttons */
#apply-root .btn{display:inline-flex;align-items:center;justify-content:center;gap:10px;font-family:'Bebas Neue',sans-serif;letter-spacing:3px;text-decoration:none;border-radius:10px;cursor:pointer;border:none}
#apply-root .btn-gold{background:var(--gold);color:var(--base);font-size:20px;padding:16px 26px;box-shadow:0 6px 18px rgba(201,168,76,0.22)}
#apply-root .btn-block{width:100%}

/* cards / footer */
#apply-root .card{background:var(--card);border:0.5px solid var(--line);border-radius:var(--radius);padding:22px}
#apply-root .footer{padding:54px 0 70px;background:var(--base);border:0}
#apply-root .footer-mark{opacity:0.55;font-size:11px;letter-spacing:2px;color:var(--faint)}

/* hero */
#apply-root .hero{padding:60px 0 48px;border-bottom:0.5px solid var(--line)}
#apply-root .hero h1{font-family:'Anton',sans-serif;text-transform:uppercase;line-height:0.95;font-size:clamp(34px,9vw,70px);max-width:14ch}
#apply-root .hero-sub{margin:22px 0 0;max-width:48ch;font-size:16px;color:#cfcfcf}
#apply-root .price-strip{display:flex;flex-wrap:wrap;align-items:baseline;gap:14px;margin-top:26px;padding:16px 18px;border:0.5px solid var(--line);border-radius:var(--radius);background:var(--card)}
#apply-root .price-strip .amt{font-family:'Anton',sans-serif;font-size:34px;color:var(--gold);line-height:1}
#apply-root .price-strip .amt .per{font-family:'Bebas Neue',sans-serif;font-size:18px;color:var(--muted);letter-spacing:1px}
#apply-root .price-strip .meta{font-family:'DM Mono',monospace;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--muted)}
#apply-root .price-strip .meta b{color:var(--ink);font-weight:500}
#apply-root .anchor{display:inline-flex;margin-top:24px}

/* proof */
#apply-root .cases{display:grid;gap:18px;margin-top:26px}
#apply-root .case{border:0.5px solid var(--line);border-radius:var(--radius);overflow:hidden;background:var(--card)}
#apply-root .case .pair{display:grid;grid-template-columns:1fr 1fr;gap:2px;background:var(--line)}
#apply-root .shot{position:relative;aspect-ratio:3/4;background:linear-gradient(160deg,#1c1c1c 0%,#0e0e0e 60%,#080808 100%);overflow:hidden}
#apply-root .shot img{position:absolute;inset:0;width:100%;height:100%;object-fit:cover;display:block}
#apply-root .shot .bf{position:absolute;top:10px;left:10px;z-index:2;font-family:'Bebas Neue',sans-serif;font-size:12px;letter-spacing:2px;color:var(--ink);background:rgba(8,8,8,0.7);border:0.5px solid var(--line);padding:3px 9px;border-radius:6px}
#apply-root .shot .bf.after{color:var(--gold);border-color:var(--gold)}
#apply-root .case .cap{padding:16px 18px}
#apply-root .case .cap .tag{font-family:'DM Mono',monospace;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--gold)}
#apply-root .case .cap .name{font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:1px;margin-top:6px}
#apply-root .case .cap .line{font-size:13px;color:#c4c4c4;margin-top:6px;max-width:46ch}
#apply-root .proof-foot{font-size:12px;color:var(--faint);letter-spacing:1px;margin-top:16px}
#apply-root .proof-foot a{color:var(--steel);text-decoration:none}

/* what you get */
#apply-root .appsec{background:var(--base)}
#apply-root .apps{display:grid;gap:18px;margin-top:26px;grid-template-columns:1fr}
#apply-root .appcard{border:0.5px solid var(--line);border-radius:var(--radius);background:var(--card);overflow:hidden;display:flex;flex-direction:column}
#apply-root .appcard .frame{background:linear-gradient(160deg,#141414,#0a0a0a);padding:16px 16px 0;display:flex;justify-content:center}
#apply-root .appcard .frame img{width:100%;max-width:230px;border-radius:14px 14px 0 0;border:0.5px solid var(--line);border-bottom:0;display:block}
#apply-root .appcard .cap{padding:16px 18px 20px}
#apply-root .appcard .cap .k{font-family:'DM Mono',monospace;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:var(--gold)}
#apply-root .appcard .cap .t{font-family:'Bebas Neue',sans-serif;font-size:20px;letter-spacing:1px;margin-top:6px}
#apply-root .appcard .cap .d{font-size:13px;color:var(--muted);margin-top:6px}

/* offer + price */
#apply-root .offer{display:grid;gap:18px;margin-top:26px}
#apply-root .offer .panel{border:0.5px solid var(--line);border-radius:var(--radius);background:var(--card);padding:24px}
#apply-root .offer .panel.price{background:var(--gold-tile);border-color:var(--gold)}
#apply-root .offer .price .amt{font-family:'Anton',sans-serif;font-size:clamp(44px,13vw,72px);color:var(--gold);line-height:0.9}
#apply-root .offer .price .amt .per{font-family:'Bebas Neue',sans-serif;font-size:22px;color:var(--muted);letter-spacing:1px}
#apply-root .offer .price .term{font-family:'DM Mono',monospace;font-size:12px;letter-spacing:2px;text-transform:uppercase;color:var(--ink);margin-top:12px}
#apply-root .offer .price .term b{color:var(--gold)}
#apply-root .offer .price .note{font-size:12px;color:var(--muted);margin-top:14px;max-width:40ch}
#apply-root .inc{list-style:none;display:grid;gap:12px;margin:0;padding:0}
#apply-root .inc li{display:grid;grid-template-columns:20px 1fr;gap:12px;align-items:start;font-size:14px;color:#dcdcdc}
#apply-root .inc li .mk{color:var(--gold);font-family:'Bebas Neue',sans-serif;font-size:16px;line-height:1.4}
#apply-root .offer .panel h3{font-family:'Bebas Neue',sans-serif;font-size:22px;letter-spacing:1px;margin-bottom:16px}
#apply-root .fit{display:grid;gap:18px;margin-top:18px;grid-template-columns:1fr}
#apply-root .fit .col{border:0.5px solid var(--line);border-radius:var(--radius);padding:18px;background:var(--card-nested)}
#apply-root .fit .col .h{font-family:'Bebas Neue',sans-serif;font-size:17px;letter-spacing:1px;margin-bottom:10px}
#apply-root .fit .col.yes .h{color:var(--gold)}
#apply-root .fit .col.no .h{color:var(--steel)}
#apply-root .fit .col p{font-size:13px;color:var(--muted);margin:6px 0}
#apply-root .fit .col a{color:var(--steel)}

/* application + after */
#apply-root .next{display:grid;gap:12px;margin-top:24px}
#apply-root .next .n{display:grid;grid-template-columns:40px 1fr;gap:14px;align-items:start;padding:16px;background:var(--card-nested);border-radius:8px}
#apply-root .next .n .num{font-family:'Anton',sans-serif;font-size:20px;color:var(--gold)}
#apply-root .next .n .t{font-family:'Bebas Neue',sans-serif;font-size:17px;letter-spacing:1px}
#apply-root .next .n .d{font-size:13px;color:var(--muted)}

@media(min-width:768px){
  #apply-root section{padding:84px 0}
  #apply-root .cases{grid-template-columns:repeat(2,1fr)}
  #apply-root .apps{grid-template-columns:repeat(3,1fr)}
  #apply-root .offer{grid-template-columns:1.3fr 1fr;align-items:start}
  #apply-root .fit{grid-template-columns:1fr 1fr}
}
@media(min-width:1024px){
  #apply-root .nav-links{display:flex}
}
`;

const hideOnError = (e) => {
  e.currentTarget.style.display = 'none';
};

export default function Apply() {
  return (
    <div id="apply-root">
      <style>{CSS}</style>

      <nav className="nav">
        <div className="nav-in">
          <a href="/" className="wordmark" style={{ textDecoration: 'none' }}>
            PKFIT
          </a>
          <div className="nav-links">
            <a href="/workbook">THE STANDARD</a>
            <a href="/#ladder">PROGRAMS</a>
            <a href="/proof">RESULTS</a>
            <a href="/field-notes">FIELD NOTES</a>
            <a href="/apply">APPLY</a>
          </div>
          <a href="#apply" className="nav-cta">
            APPLY
          </a>
        </div>
      </nav>

      {/* 1 · HERO — diagnosis, not a pitch */}
      <header className="hero">
        <div className="wrap">
          <div className="kicker gold">PERFORMANCE STANDARD · 1:1</div>
          <h1 className="anton">THIS IS A DIAGNOSIS, NOT A PITCH.</h1>
          <p className="hero-sub">
            You don't need more motivation. You need the structure around your identity rebuilt
            and held to a standard — by name, on your actual life. That's what 1:1 is. Below is
            the record, the app you'll run it in, and the price. Read it before you apply.
          </p>
          <div className="price-strip">
            <div className="amt">
              $250<span className="per">/MO</span>
            </div>
            <div className="meta">
              1:1 COACHING · <b>4-MONTH STANDARD</b> · APPLICATION + CALL
            </div>
          </div>
          <a href="#apply" className="btn btn-gold anchor">
            SEE IF IT'S A FIT →
          </a>
        </div>
      </header>

      {/* 2 · PROOF */}
      <section>
        <div className="wrap">
          <div className="kicker">THE RECEIPT · EARNED, NOT CLAIMED</div>
          <h2 className="bebas" style={{ fontSize: 'clamp(26px,6vw,40px)', margin: '14px 0 6px' }}>
            MEN WHO HELD THE STANDARD
          </h2>
          <p style={{ maxWidth: '48ch' }}>
            Potential means nothing without proof. Real clients, documented — not staged.
          </p>
          <div className="cases">
            <div className="case">
              <div className="pair">
                <div className="shot">
                  <img src="/assets/proof/dele-before.jpg" alt="Dele Bakare — before" onError={hideOnError} />
                  <span className="bf">BEFORE</span>
                </div>
                <div className="shot">
                  <img src="/assets/proof/dele-after.jpg" alt="Dele Bakare — after" onError={hideOnError} />
                  <span className="bf after">AFTER</span>
                </div>
              </div>
              <div className="cap">
                <div className="tag">~5–6 MONTHS · STILL TRAINING</div>
                <div className="name">DELE BAKARE</div>
                <div className="line">
                  No fast promises. The standard held long enough to show. Structure outliving
                  motivation.
                </div>
              </div>
            </div>

            <div className="case">
              <div className="pair">
                <div className="shot">
                  <img src="/assets/proof/darryl-before.jpg" alt="Darryl Garner — before" onError={hideOnError} />
                  <span className="bf">BEFORE</span>
                </div>
                <div className="shot">
                  <img src="/assets/proof/darryl-after.jpg" alt="Darryl Garner — after" onError={hideOnError} />
                  <span className="bf after">AFTER</span>
                </div>
              </div>
              <div className="cap">
                <div className="tag">3 MONTHS · HEADED BACK TO THE STAGE</div>
                <div className="name">DARRYL GARNER</div>
                <div className="line">
                  Three months in, and not done. The trajectory is the proof.
                </div>
              </div>
            </div>
          </div>
          <p className="proof-foot">
            More on the board → <a href="/proof">the full results page →</a>
          </p>
        </div>
      </section>

      {/* 3 · WHAT YOU ACTUALLY GET */}
      <section className="appsec">
        <div className="wrap">
          <div className="kicker">WHAT YOU ACTUALLY GET</div>
          <h2 className="bebas" style={{ fontSize: 'clamp(26px,6vw,40px)', margin: '14px 0 6px' }}>
            THE STANDARD, RUN FROM YOUR PHONE
          </h2>
          <p style={{ maxWidth: '52ch' }}>
            Every client runs inside the app. Training, schedule, nutrition — one place,
            programmed for you, measured against the standard. No guessing. No DIY.
          </p>
          <div className="apps">
            <div className="appcard">
              <div className="frame">
                <img src="/assets/apply/app-dashboard.png" alt="Trainerize dashboard" />
              </div>
              <div className="cap">
                <div className="k">01 · DASHBOARD</div>
                <div className="t">YOUR COMMAND CENTER</div>
                <div className="d">
                  Everything in one view — what's due, what's done, where you stand today.
                </div>
              </div>
            </div>

            <div className="appcard">
              <div className="frame">
                <img src="/assets/apply/app-calendar-reminders.png" alt="Trainerize calendar and reminders" />
              </div>
              <div className="cap">
                <div className="k">02 · CALENDAR + REMINDERS</div>
                <div className="t">STRUCTURE THAT RUNS YOUR WEEK</div>
                <div className="d">
                  Your training schedule laid out and reminded — the week holds shape without you
                  negotiating it.
                </div>
              </div>
            </div>

            <div className="appcard">
              <div className="frame">
                <img src="/assets/apply/app-workout-library.png" alt="Trainerize workout library" />
              </div>
              <div className="cap">
                <div className="k">03 · WORKOUT LIBRARY</div>
                <div className="t">PROGRAMMED FOR YOU</div>
                <div className="d">
                  Demonstrated, sequenced, loaded. You open the app and execute — not invent.
                </div>
              </div>
            </div>

            <div className="appcard">
              <div className="frame">
                <img src="/assets/apply/app-meal-plan.png" alt="Trainerize meal plan" />
              </div>
              <div className="cap">
                <div className="k">04 · MEAL PLAN</div>
                <div className="t">NO GUESSING WHAT TO EAT</div>
                <div className="d">
                  The plan is set. You follow it, not research it. One less open loop burning fuel.
                </div>
              </div>
            </div>

            <div className="appcard">
              <div className="frame">
                <img src="/assets/apply/app-nutrition-graph.png" alt="Trainerize nutrition tracking graph" />
              </div>
              <div className="cap">
                <div className="k">05 · NUTRITION GRAPH</div>
                <div className="t">THE STANDARD, MEASURED</div>
                <div className="d">
                  Adherence on a line you can't argue with. The number keeps the promise honest.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 4 · WHAT IT IS + PRICE */}
      <section>
        <div className="wrap">
          <div className="kicker gold">WHAT IT IS · STATED PLAINLY</div>
          <h2 className="bebas" style={{ fontSize: 'clamp(26px,6vw,40px)', margin: '14px 0 6px' }}>
            THE PERFORMANCE STANDARD
          </h2>
          <div className="offer">
            <div className="panel">
              <h3>1:1 COACHING — INSTALLED, NOT EXPLAINED</h3>
              <ul className="inc">
                <li>
                  <span className="mk">▸</span>
                  <span>Direct 1:1 coaching with Percy — answered by name, on your actual life.</span>
                </li>
                <li>
                  <span className="mk">▸</span>
                  <span>Custom training programmed to your schedule, body, and constraint.</span>
                </li>
                <li>
                  <span className="mk">▸</span>
                  <span>Nutrition plan built and adjusted — not a template handed off.</span>
                </li>
                <li>
                  <span className="mk">▸</span>
                  <span>The full app: dashboard, calendar, library, meal plan, tracking.</span>
                </li>
                <li>
                  <span className="mk">▸</span>
                  <span>
                    Standard-held accountability — the loop diagnosed at M02/M03, not
                    willpower-bombed.
                  </span>
                </li>
              </ul>
            </div>

            <div className="panel price">
              <div className="amt">
                $250<span className="per">/MO</span>
              </div>
              <div className="term">
                4-MONTH STANDARD · <b>1:1</b>
              </div>
              <p className="note">
                Stated up front on purpose. If the number is the wall, this rung isn't yours yet —
                and that's a clean answer, not a rejection. The price qualifies the call before
                it's booked.
              </p>
            </div>
          </div>

          <div className="fit">
            <div className="col yes">
              <div className="h">THIS IS FOR YOU IF</div>
              <p>You're capable and stable — the discipline used to be there.</p>
              <p>You want it rebuilt and held, not cheered on.</p>
              <p>You'll commit four months to put it on the record.</p>
            </div>
            <div className="col no">
              <div className="h">THIS IS NOT FOR YOU IF</div>
              <p>You want a quick fix or a 6-week shred.</p>
              <p>
                The price is a stretch right now — start at <a href="/group">the Group, $97/mo</a>.
              </p>
              <p>You're collecting information, not ready to move.</p>
            </div>
          </div>
        </div>
      </section>

      {/* 5 · THE APPLICATION → BOOKING (real qualifier → Supabase → Calendly, unchanged) */}
      <section id="apply">
        <div className="wrap">
          <div className="kicker gold">THE APPLICATION</div>
          <h2 className="bebas" style={{ fontSize: 'clamp(26px,6vw,40px)', margin: '14px 0 16px' }}>
            SEE IF IT'S A FIT
          </h2>
          <p style={{ maxWidth: '54ch' }}>
            You've seen the proof, the app, and the price. Answer straight — seven questions, then
            book the call. It's how the work begins.
          </p>
          <div className="card" style={{ marginTop: 24 }}>
            <Qualifier embedded />
          </div>

          <div className="kicker" style={{ marginTop: 40 }}>
            AFTER YOU BOOK
          </div>
          <h3 className="bebas" style={{ fontSize: 'clamp(22px,5vw,32px)', margin: '12px 0 4px' }}>
            NO PITCH THEATER
          </h3>
          <div className="next">
            <div className="n">
              <div className="num">01</div>
              <div>
                <div className="t">PERCY REVIEWS YOUR ANSWERS</div>
                <div className="d">
                  Before the call. If it's not a fit, you'll hear that — not a sales script.
                </div>
              </div>
            </div>
            <div className="n">
              <div className="num">02</div>
              <div>
                <div className="t">15 MINUTES, STRAIGHT</div>
                <div className="d">
                  We name where the Standard broke and whether 1:1 is the right rung.
                </div>
              </div>
            </div>
            <div className="n">
              <div className="num">03</div>
              <div>
                <div className="t">YOU DECIDE</div>
                <div className="d">
                  If yes, the Standard gets installed under supervision. If no, you keep the
                  diagnosis.
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <footer className="footer">
        <div className="wrap">
          <div className="footer-mark">
            © 2026 PKFIT · OPERATEFITNESS.APP · PERCY KEITH · IFBB PRO · THE STANDARD IS YOURS TO
            SET.
          </div>
        </div>
      </footer>
    </div>
  );
}
