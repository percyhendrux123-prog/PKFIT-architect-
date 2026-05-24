import { useState } from 'react';
import PhoneShell from '../../components/operate/PhoneShell';
import BottomNav from '../../components/operate/BottomNav';
import { HamburgerSvg, PlusSvg, SearchSvg, MicSvg } from '../../components/operate/svg';
import { useVoiceCapture } from '../../hooks/useVoiceCapture';

const CLIENTS = [
  { id: 'derek', initials: 'DV', name: 'DEREK V.', last: '2 missed · no log 3d', checkin: '5D LATE', sub: 'OVERDUE', adh: 42, adhClass: 'op-bad', flag: 'red', flagged: true },
  { id: 'marcus', initials: 'MC', name: 'MARCUS C.', last: 'Logged Push · 14m ago', checkin: 'SUN', sub: '3 DAYS', adh: 94, adhClass: 'op-good', flag: 'green', expanded: true },
  { id: 'jamal', initials: 'JR', name: 'JAMAL R.', last: 'No nutrition log 4d', checkin: '2D LATE', sub: 'OVERDUE', adh: 58, adhClass: 'op-bad', flag: 'red', flagged: true },
  { id: 'sam', initials: 'ST', name: 'SAM T.', last: 'Logged Pull · yesterday', checkin: 'MON', sub: '4 DAYS', adh: 88, adhClass: 'op-good', flag: 'green' },
  { id: 'anthony', initials: 'AP', name: 'ANTHONY P.', last: 'Photos in · weight steady', checkin: 'TODAY', sub: 'DUE 6PM', adh: 76, adhClass: 'op-mid', flag: 'yellow' },
  { id: 'ryan', initials: 'RK', name: 'RYAN K.', last: 'PR · Squat 365 × 3', checkin: 'TUE', sub: '5 DAYS', adh: 97, adhClass: 'op-good', flag: 'green' },
];

export default function OperateCoachInsights() {
  const [expandedId, setExpandedId] = useState('marcus');
  const { listening, transcript, toggle } = useVoiceCapture();

  return (
    <PhoneShell screen="Coach roster">
      <div className="op-app op-app--tight">
        <div className="op-header" style={{ padding: '8px 4px 14px' }}>
          <button type="button" className="op-icon-btn" aria-label="Menu"><HamburgerSvg /></button>
          <div style={{ textAlign: 'center' }}>
            <div className="op-title">ROSTER</div>
            <div style={{ fontSize: 10, color: '#888', letterSpacing: '1.5px', marginTop: 2 }}>23 ACTIVE · 4 FLAGGED</div>
          </div>
          <button type="button" className="op-icon-btn" aria-label="Add client"><PlusSvg /></button>
        </div>

        <div style={{ textAlign: 'center' }}>
          <span className="op-coach-mode-pill">COACH MODE · PERCY</span>
        </div>

        <div className="op-summary-strip">
          <div className="op-ss-cell"><div className="op-ss-num">23</div><div className="op-ss-label">ACTIVE</div></div>
          <div className="op-ss-cell"><div className="op-ss-num op-gold">17</div><div className="op-ss-label">ON TRACK</div></div>
          <div className="op-ss-cell"><div className="op-ss-num">2</div><div className="op-ss-label">SLIPPING</div></div>
          <div className="op-ss-cell"><div className="op-ss-num op-red">4</div><div className="op-ss-label">FLAGGED</div></div>
        </div>

        <div className="op-filter-row" style={{ margin: '0 4px 12px' }}>
          <button type="button" className="op-chip op-active">ALL · 23</button>
          <button type="button" className="op-chip">FLAGGED · 4</button>
          <button type="button" className="op-chip">NEW · 2</button>
          <button type="button" className="op-chip">CHECK-IN DUE</button>
        </div>

        <div className="op-search-bar">
          <SearchSvg />
          <input placeholder="Search clients…" />
        </div>

        <div className="op-table-head">
          <span />
          <span>CLIENT</span>
          <span>CHECK-IN</span>
          <span>ADHERE</span>
          <span />
        </div>

        <div className="op-client-list">
          {CLIENTS.map((c) => {
            const isExpanded = expandedId === c.id;
            const classes = ['op-client-row'];
            if (c.flagged && !isExpanded) classes.push('op-flagged');
            if (isExpanded) classes.push('op-expanded');
            return (
              <div
                key={c.id}
                className={classes.join(' ')}
                onClick={() => setExpandedId(isExpanded ? null : c.id)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') setExpandedId(isExpanded ? null : c.id);
                }}
              >
                <div className="op-cr-avatar">{c.initials}</div>
                <div className="op-cr-body">
                  <div className="op-cr-name">{c.name}</div>
                  <div className="op-cr-last">{c.last}</div>
                </div>
                <div className="op-cr-checkin">{c.checkin}<span className="op-small">{c.sub}</span></div>
                <div className={`op-cr-adh ${c.adhClass}`}>{c.adh}%</div>
                <div className={`op-cr-flag op-flag-${c.flag}`} />

                {isExpanded ? (
                  <div className="op-client-detail" onClick={(e) => e.stopPropagation()}>
                    <div className="op-cd-row"><span className="op-lbl">WEIGHT (7D)</span><span className="op-val">192.4 ↓ 1.2 lb</span></div>
                    <div className="op-cd-row"><span className="op-lbl">PROTEIN AVG</span><span className="op-val op-gold">188g / 200g</span></div>
                    <div className="op-cd-row"><span className="op-lbl">SLEEP AVG</span><span className="op-val op-red">6.1 hr · slipping</span></div>
                    <div className="op-cd-row"><span className="op-lbl">TRAINING</span><span className="op-val">5/6 sessions · pace good</span></div>

                    <div className="op-cd-notes">
                      <div className="op-cd-notes-head">
                        <span className="op-cd-notes-label">COACH NOTE · {listening ? 'DICTATING' : 'TAP MIC TO DICTATE'}</span>
                        <button
                          type="button"
                          className="op-cd-notes-mic"
                          onClick={toggle}
                          aria-pressed={listening}
                          aria-label={listening ? 'Stop dictation' : 'Start dictation'}
                        >
                          <MicSvg />
                        </button>
                      </div>
                      <div className="op-cd-quote">
                        {transcript || '"Sleep is the real issue, not training. Push back start time. Move cardio to AM."'}
                      </div>
                      <div className="op-cd-parsed">→ SAVE TO {c.name.replace(/ .*/, '')} · TAG: SLEEP · ADJUST PROTOCOL</div>
                    </div>

                    <div className="op-cd-actions">
                      <button type="button" className="op-cd-action">MESSAGE</button>
                      <button type="button" className="op-cd-action">OPEN PLAN</button>
                      <button type="button" className="op-cd-action op-gold">CHECK-IN</button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <BottomNav active="roster" variant="coach" />
    </PhoneShell>
  );
}
