// Bumped when the corresponding /content/legal/*.md file changes materially.
// Stored on profiles.consent so the app can detect a stale acceptance and
// re-prompt the user. Kept here (not in env) so a deploy is the unit of
// change, not a config tweak.

export const TOS_V = 1;
export const COACHING_V = 1;
export const PRIVACY_V = 1;

export const CURRENT = { tos_v: TOS_V, coaching_v: COACHING_V, privacy_v: PRIVACY_V };

export function consentIsCurrent(consent) {
  if (!consent) return false;
  return (
    consent.tos_v === TOS_V &&
    consent.coaching_v === COACHING_V &&
    consent.privacy_v === PRIVACY_V
  );
}
