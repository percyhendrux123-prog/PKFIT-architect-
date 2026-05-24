import { useNavigate } from 'react-router-dom';
import PhoneShell from '../../components/operate/PhoneShell';
import BottomNav from '../../components/operate/BottomNav';
import MicFab from '../../components/operate/MicFab';
import { ChevronLeftSvg, ChevronRightSvg, CalendarSvg, MicSvg, CameraSvg, PlusSvg } from '../../components/operate/svg';

const MACROS = [
  { name: 'PROTEIN', left: 55, prog: '145 / 200G', color: '#C9A84C', dasharray: 264, dashoffset: 74 },
  { name: 'CARBS', left: 80, prog: '160 / 240G', color: '#7a8fb5', dasharray: 264, dashoffset: 87 },
  { name: 'FAT', left: 18, prog: '62 / 80G', color: '#a37b5e', dasharray: 264, dashoffset: 61 },
];

export default function OperateNutrition() {
  const nav = useNavigate();
  return (
    <PhoneShell screen="Nutrition">
      <div className="op-app">
        <div className="op-header">
          <button type="button" className="op-icon-btn" onClick={() => nav('/dashboard')} aria-label="Back">
            <ChevronLeftSvg />
          </button>
          <div className="op-title">NUTRITION</div>
          <button type="button" className="op-icon-btn" aria-label="History"><CalendarSvg /></button>
        </div>

        <div className="op-date-bar">
          <button type="button" className="op-icon-btn op-icon-btn--mute" aria-label="Previous day"><ChevronLeftSvg /></button>
          <div className="op-date-current">
            <span className="op-date-day">TODAY · SAT MAY 23</span>
            <span className="op-date-sub">WEEK 3 OF 12 · CUT PHASE</span>
          </div>
          <button type="button" className="op-icon-btn op-icon-btn--mute" aria-label="Next day"><ChevronRightSvg /></button>
        </div>

        <div className="op-summary-card">
          <div className="op-cal-strip">
            <div className="op-cal-cell"><div className="op-cal-num">1840</div><div className="op-cal-lbl">CONSUMED</div></div>
            <div className="op-cal-cell"><div className="op-cal-num op-gold">560</div><div className="op-cal-lbl op-gold">REMAINING</div></div>
            <div className="op-cal-cell"><div className="op-cal-num op-muted">2400</div><div className="op-cal-lbl">TARGET KCAL</div></div>
          </div>
          <div className="op-macro-ring-row">
            {MACROS.map((m) => (
              <div key={m.name} className="op-macro-ring-cell">
                <div className="op-mr-ring">
                  <svg viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="#2a2a2a" strokeWidth="8" />
                    <circle cx="50" cy="50" r="42" fill="none" stroke={m.color} strokeWidth="8" strokeDasharray={m.dasharray} strokeDashoffset={m.dashoffset} strokeLinecap="round" />
                  </svg>
                  <div className="op-mr-center">
                    <div className="op-mr-num">{m.left}</div>
                    <div className="op-mr-unit">G LEFT</div>
                  </div>
                </div>
                <div className="op-mr-name">{m.name}</div>
                <div className="op-mr-prog">{m.prog}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="op-voice-bar">
          <button type="button" className="op-v-btn op-voice">
            <div className="op-v-icon"><MicSvg /></div>
            <div className="op-v-text"><span className="op-v-title">SAY IT</span><span className="op-v-sub">VOICE LOG</span></div>
          </button>
          <button type="button" className="op-v-btn op-photo">
            <div className="op-v-icon"><CameraSvg /></div>
            <div className="op-v-text"><span className="op-v-title">SNAP IT</span><span className="op-v-sub">PHOTO MEAL</span></div>
          </button>
        </div>

        {[
          {
            name: 'BREAKFAST', cals: 620, target: 600,
            foods: [
              { name: 'Egg whites + 2 yolks', meta: '200g · 6oz', cal: '280 kcal' },
              { name: 'Oatmeal + berries', meta: '80g dry · 100g berries', cal: '340 kcal' },
            ],
          },
          {
            name: 'LUNCH', cals: 720, target: 700,
            foods: [
              { name: 'Chicken breast + jasmine rice', meta: '220g · 180g cooked', cal: '560 kcal' },
              { name: 'Mixed greens + olive oil', meta: '150g · 1 tbsp', cal: '160 kcal' },
            ],
          },
          {
            name: 'DINNER', cals: 0, target: 800,
            foods: [],
            empty: 'No items logged. Target 50g protein.',
          },
          {
            name: 'SNACKS', cals: 500, target: 300,
            foods: [
              { name: 'Whey + banana', meta: 'post-training', cal: '320 kcal' },
              { name: 'Greek yogurt + honey', meta: '200g', cal: '180 kcal' },
            ],
            noActions: true,
          },
        ].map((meal) => (
          <div key={meal.name} className="op-meal-section">
            <div className="op-meal-head">
              <span className="op-meal-name">{meal.name}</span>
              <span className="op-meal-cals" style={meal.cals === 0 ? { color: '#666' } : undefined}>
                {meal.cals}
                <span className="op-of"> / {meal.target}</span>
              </span>
            </div>
            {meal.empty ? <div className="op-empty-meal">{meal.empty}</div> : null}
            {meal.foods.map((f, i) => (
              <div key={i} className="op-food-row">
                <div>
                  <div className="op-food-name">{f.name}</div>
                  <div className="op-food-meta">{f.meta}</div>
                </div>
                <div className="op-food-cal">{f.cal}</div>
              </div>
            ))}
            {!meal.noActions ? (
              <div className="op-meal-actions">
                <button type="button" className="op-meal-action"><PlusSvg />ADD FOOD</button>
                <button type="button" className="op-meal-action op-gold"><MicSvg />SAY IT</button>
              </div>
            ) : null}
          </div>
        ))}
      </div>

      <MicFab context="nutrition" />
      <BottomNav active="nutrition" />
    </PhoneShell>
  );
}
