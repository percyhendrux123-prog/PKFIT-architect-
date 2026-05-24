import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import PhoneShell from '../../components/operate/PhoneShell';
import BottomNav from '../../components/operate/BottomNav';
import MicFab from '../../components/operate/MicFab';
import {
  ChevronLeftSvg, ChevronRightSvg, SettingsSvg, EditSvg, UserSvg, CalendarSvg, TrendingSvg,
  CardSvg, BellSvg, MicSvg, ShieldSvg, HelpSvg,
} from '../../components/operate/svg';

function initials(profile) {
  const name = (profile?.name || profile?.email || 'Marcus Cole').trim();
  const parts = name.split(/[\s.@]+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0]?.slice(0, 2).toUpperCase() || 'MC';
}

export default function OperateProfile() {
  const nav = useNavigate();
  const { profile, signOut } = useAuth();
  const displayName = (profile?.name || 'Marcus Cole').toUpperCase();

  async function handleSignOut() {
    try { await signOut(); } finally { nav('/', { replace: true }); }
  }

  return (
    <PhoneShell screen="Profile">
      <div className="op-app">
        <div className="op-header">
          <button type="button" className="op-icon-btn" onClick={() => nav('/dashboard')} aria-label="Back">
            <ChevronLeftSvg />
          </button>
          <div className="op-title">PROFILE</div>
          <button type="button" className="op-icon-btn" aria-label="Settings"><SettingsSvg /></button>
        </div>

        <div className="op-profile-top">
          <div className="op-avatar-wrap">
            <div className="op-avatar">{initials(profile)}</div>
            <div className="op-av-edit"><EditSvg /></div>
          </div>
          <div className="op-p-name">{displayName}</div>
          <div className="op-p-tag">CLIENT SINCE FEB 2026</div>
        </div>

        <div className="op-stats-row">
          <div className="op-stat-cell">
            <div className="op-stat-num">192.4</div>
            <div className="op-stat-unit">LBS</div>
            <div className="op-stat-label">WEIGHT</div>
          </div>
          <div className="op-stat-cell">
            <div className="op-stat-num op-gold">21</div>
            <div className="op-stat-unit">DAYS</div>
            <div className="op-stat-label">STREAK</div>
          </div>
          <div className="op-stat-cell">
            <div className="op-stat-num">102</div>
            <div className="op-stat-unit">DAYS</div>
            <div className="op-stat-label">ACTIVE</div>
          </div>
        </div>

        <div className="op-plan-banner" role="button" tabIndex={0}>
          <div className="op-pb-left">
            <div className="op-pb-label">CURRENT PROTOCOL</div>
            <div className="op-pb-title">12-WEEK CUT · BLOCK 1</div>
            <div className="op-pb-sub">Week 3 of 12 · ends Aug 15</div>
          </div>
          <div className="op-pb-arrow"><ChevronRightSvg /></div>
        </div>

        <div className="op-section-label-mini">COACHING</div>
        <div className="op-menu-group">
          <div className="op-menu-row" role="button" tabIndex={0}>
            <div className="op-menu-icon"><UserSvg /></div>
            <div className="op-menu-body"><div className="op-menu-title">Coach</div><div className="op-menu-sub">Percy Keith · PKFIT</div></div>
            <div className="op-menu-right"><div className="op-menu-chevron"><ChevronRightSvg /></div></div>
          </div>
          <div className="op-menu-row" role="button" tabIndex={0}>
            <div className="op-menu-icon"><CalendarSvg /></div>
            <div className="op-menu-body"><div className="op-menu-title">Check-ins</div><div className="op-menu-sub">Weekly · Sunday 6PM</div></div>
            <div className="op-menu-right"><div className="op-menu-chevron"><ChevronRightSvg /></div></div>
          </div>
          <div className="op-menu-row" role="button" tabIndex={0} onClick={() => nav('/habits')}>
            <div className="op-menu-icon"><TrendingSvg /></div>
            <div className="op-menu-body"><div className="op-menu-title">Current Plan</div><div className="op-menu-sub">Cut · 2400 kcal · 200P</div></div>
            <div className="op-menu-right"><div className="op-menu-chevron"><ChevronRightSvg /></div></div>
          </div>
        </div>

        <div className="op-section-label-mini">ACCOUNT</div>
        <div className="op-menu-group">
          <div className="op-menu-row" role="button" tabIndex={0} onClick={() => nav('/billing')}>
            <div className="op-menu-icon"><CardSvg /></div>
            <div className="op-menu-body"><div className="op-menu-title">Subscription</div><div className="op-menu-sub">Renews Jun 12 · $299/mo</div></div>
            <div className="op-menu-right"><div className="op-menu-chevron"><ChevronRightSvg /></div></div>
          </div>
          <div className="op-menu-row" role="button" tabIndex={0}>
            <div className="op-menu-icon"><BellSvg /></div>
            <div className="op-menu-body"><div className="op-menu-title">Notifications</div><div className="op-menu-sub">Training + check-ins</div></div>
            <div className="op-menu-right"><div className="op-menu-value">ON</div><div className="op-menu-chevron"><ChevronRightSvg /></div></div>
          </div>
          <div className="op-menu-row" role="button" tabIndex={0}>
            <div className="op-menu-icon"><MicSvg /></div>
            <div className="op-menu-body"><div className="op-menu-title">Voice Input</div><div className="op-menu-sub">Default for logging</div></div>
            <div className="op-menu-right"><div className="op-menu-value op-on">ON</div><div className="op-menu-chevron"><ChevronRightSvg /></div></div>
          </div>
          <div className="op-menu-row" role="button" tabIndex={0}>
            <div className="op-menu-icon"><ShieldSvg /></div>
            <div className="op-menu-body"><div className="op-menu-title">Privacy & Data</div><div className="op-menu-sub">Export, integrations</div></div>
            <div className="op-menu-right"><div className="op-menu-chevron"><ChevronRightSvg /></div></div>
          </div>
          <div className="op-menu-row" role="button" tabIndex={0}>
            <div className="op-menu-icon"><HelpSvg /></div>
            <div className="op-menu-body"><div className="op-menu-title">Help & Support</div><div className="op-menu-sub">FAQ, contact PKFIT</div></div>
            <div className="op-menu-right"><div className="op-menu-chevron"><ChevronRightSvg /></div></div>
          </div>
        </div>

        <button type="button" className="op-signout-row" onClick={handleSignOut}>SIGN OUT</button>
        <div className="op-version">PKFIT · v1.2.0 · BUILD 412</div>
      </div>

      <MicFab context="profile" />
      <BottomNav active="profile" />
    </PhoneShell>
  );
}
