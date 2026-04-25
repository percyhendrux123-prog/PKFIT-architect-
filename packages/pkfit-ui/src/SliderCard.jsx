import React, { useState } from 'react';

/**
 * SliderCard — 1–10 (configurable) range input with live readout. Mirrors
 * `sliderCard()` in pkfit-checkin (used for energy / sleep / soreness severity).
 *
 * Props:
 *   label         Required. Card eyebrow.
 *   min           Range minimum. Default 1.
 *   max           Range maximum. Default 10.
 *   defaultValue  Initial value. Default 7.
 *   submitLabel   Submit button copy. Default 'Lock it in'.
 *   sideLabel     The small label to the left of the value (intake uses 'Lower').
 *   onSubmit      Called with the chosen integer when submit is pressed.
 */
export function SliderCard({
  label,
  min = 1,
  max = 10,
  defaultValue = 7,
  submitLabel = 'Lock it in',
  sideLabel = 'Lower',
  onSubmit,
}) {
  const [value, setValue] = useState(defaultValue);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = () => {
    if (submitted) return;
    setSubmitted(true);
    onSubmit && onSubmit(value);
  };

  return (
    <div className="pk-card pk-slider" style={submitted ? { opacity: 0.55 } : undefined}>
      <div className="pk-card-label">{label}</div>
      <div className="pk-slider-head">
        <span className="pk-slider-label">{sideLabel}</span>
        <span className="pk-slider-value">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        disabled={submitted}
        onChange={(e) => setValue(parseInt(e.target.value, 10))}
      />
      <div className="pk-slider-ticks">
        <span>{min}</span>
        <span>{max}</span>
      </div>
      <button
        type="button"
        className="pk-submit-btn"
        disabled={submitted}
        onClick={handleSubmit}
      >
        {submitLabel}
      </button>
    </div>
  );
}
