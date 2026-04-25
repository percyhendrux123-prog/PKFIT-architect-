import React, { useState, useRef } from 'react';

/**
 * EmailCard — input card with validation, used by intake's `emailCard()`.
 * Validation matches the original: length > 3, contains '@', contains '.'.
 *
 * Props:
 *   label         Eyebrow. Defaults to 'Email address'.
 *   placeholder   Defaults to 'you@example.com'.
 *   submitLabel   Defaults to 'Continue'.
 *   errorMessage  Error copy. Defaults to 'Needs to be a valid email address.'.
 *   onSubmit      Called with the validated email string.
 */
export function EmailCard({
  label = 'Email address',
  placeholder = 'you@example.com',
  submitLabel = 'Continue',
  errorMessage = 'Needs to be a valid email address.',
  onSubmit,
}) {
  const [value, setValue] = useState('');
  const [error, setError] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const inputRef = useRef(null);

  const trySubmit = () => {
    if (submitted) return;
    const v = value.trim();
    const valid = v.length > 3 && v.includes('@') && v.includes('.');
    if (!valid) {
      setError(true);
      inputRef.current && inputRef.current.focus();
      return;
    }
    setError(false);
    setSubmitted(true);
    onSubmit && onSubmit(v);
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      trySubmit();
    }
  };

  return (
    <div className="pk-input-card" style={submitted ? { opacity: 0.55 } : undefined}>
      <div className="pk-field-label">{label}</div>
      <input
        ref={inputRef}
        type="email"
        autoComplete="email"
        placeholder={placeholder}
        value={value}
        disabled={submitted}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={onKeyDown}
      />
      <div className={`pk-field-err ${error ? 'pk-field-err--visible' : ''}`}>
        {errorMessage}
      </div>
      <button
        type="button"
        className="pk-submit-btn"
        disabled={submitted}
        onClick={trySubmit}
      >
        {submitLabel}
      </button>
    </div>
  );
}
