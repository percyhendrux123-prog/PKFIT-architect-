import React, { useState, useRef, useEffect } from 'react';

/**
 * ComposerWrap — fixed-bottom input row with the ATLAS pill composer and
 * round send button. Mirrors the `<div class="composer-wrap">` markup in
 * intake/checkin and `setComposer(mode, ...)` behavior.
 *
 * Props:
 *   placeholder    Input placeholder. Defaults to 'Type here…'.
 *   disabled       If true, locks the input + send (matches mode='locked').
 *   autoFocus      Focus the input on mount / when re-enabled.
 *   onSubmit       Called with the trimmed input value when send is pressed
 *                  (or Enter inside the input). Caller is responsible for clearing.
 *   value          Optional controlled value.
 *   onChange       Optional controlled-value handler.
 */
export function ComposerWrap({
  placeholder = 'Type here…',
  disabled = false,
  autoFocus = false,
  onSubmit,
  value: controlledValue,
  onChange,
}) {
  const [internalValue, setInternalValue] = useState('');
  const inputRef = useRef(null);
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : internalValue;

  useEffect(() => {
    if (!disabled && autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [disabled, autoFocus]);

  const setValue = (v) => {
    if (!isControlled) setInternalValue(v);
    onChange && onChange(v);
  };

  const send = () => {
    const trimmed = (value || '').trim();
    if (!trimmed || disabled) return;
    onSubmit && onSubmit(trimmed);
    if (!isControlled) setInternalValue('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    send();
  };

  return (
    <div className="pk-composer-wrap">
      <form className="pk-composer" autoComplete="off" onSubmit={handleSubmit}>
        <input
          ref={inputRef}
          type="text"
          placeholder={placeholder}
          aria-label="Message"
          disabled={disabled}
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <button
          type="submit"
          className="pk-send-btn"
          aria-label="Send"
          disabled={disabled || !value || !value.trim()}
        >
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 8h10M9 4l4 4-4 4" />
          </svg>
        </button>
      </form>
    </div>
  );
}
