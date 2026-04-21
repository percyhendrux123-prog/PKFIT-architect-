// Unit conversions + display. Storage is canonical: kg + cm. Everything else
// is presentation. The pref lives on profiles.units; default imperial.

function round1(n) {
  return Math.round(n * 10) / 10;
}

export function kgToLbs(kg) {
  if (kg == null || kg === '') return null;
  const n = Number(kg);
  if (Number.isNaN(n)) return null;
  return round1(n * 2.20462);
}

export function lbsToKg(lbs) {
  if (lbs == null || lbs === '') return null;
  const n = Number(lbs);
  if (Number.isNaN(n)) return null;
  return round1(n / 2.20462);
}

export function cmToInches(cm) {
  if (cm == null || cm === '') return null;
  const n = Number(cm);
  if (Number.isNaN(n)) return null;
  return round1(n / 2.54);
}

export function inchesToCm(inches) {
  if (inches == null || inches === '') return null;
  const n = Number(inches);
  if (Number.isNaN(n)) return null;
  return round1(n * 2.54);
}

export function cmToFeetInches(cm) {
  const totalInches = cmToInches(cm);
  if (totalInches == null) return null;
  const feet = Math.floor(totalInches / 12);
  const inches = Math.round(totalInches - feet * 12);
  return { feet, inches };
}

export function formatWeight(kg, units = 'imperial') {
  if (kg == null || kg === '') return '—';
  return units === 'imperial' ? `${kgToLbs(kg)} lbs` : `${kg} kg`;
}

export function formatWeightDelta(kg, units = 'imperial') {
  if (kg == null || kg === '') return '—';
  const converted = units === 'imperial' ? kgToLbs(kg) : Number(kg);
  const unit = units === 'imperial' ? 'lbs' : 'kg';
  return `${converted > 0 ? '+' : ''}${converted} ${unit}`;
}

export function formatHeight(cm, units = 'imperial') {
  if (cm == null || cm === '') return '—';
  if (units === 'metric') return `${cm} cm`;
  const fi = cmToFeetInches(cm);
  return fi ? `${fi.feet}' ${fi.inches}"` : '—';
}

export function weightLabel(units = 'imperial') {
  return units === 'imperial' ? 'Weight (lbs)' : 'Weight (kg)';
}

export function heightLabel(units = 'imperial') {
  return units === 'imperial' ? 'Height (in)' : 'Height (cm)';
}

// Parse an input value (string) in the caller's units and return kg for storage.
export function parseWeightToKg(input, units = 'imperial') {
  if (input == null || input === '') return null;
  const n = Number(input);
  if (Number.isNaN(n)) return null;
  return units === 'imperial' ? lbsToKg(n) : round1(n);
}

// Parse a height input (inches for imperial, cm for metric) into cm for storage.
export function parseHeightToCm(input, units = 'imperial') {
  if (input == null || input === '') return null;
  const n = Number(input);
  if (Number.isNaN(n)) return null;
  return units === 'imperial' ? inchesToCm(n) : round1(n);
}
