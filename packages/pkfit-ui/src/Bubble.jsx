import React from 'react';

/**
 * Bubble — the message body inside a Turn. Visual treatment differs based on
 * whether the parent Turn has the client or agent class (handled in tokens.css).
 *
 * Props:
 *   children    Bubble content. Strings render as-is; complex children render literally.
 *   typing      If true, renders the three-dot typing indicator instead of children.
 *   caret       If true, appends a blinking caret (used during streamed output).
 */
export function Bubble({ children, typing = false, caret = false }) {
  if (typing) {
    return (
      <div className="pk-bubble">
        <div className="pk-typing">
          <span /><span /><span />
        </div>
      </div>
    );
  }
  return (
    <div className="pk-bubble">
      {children}
      {caret && <span className="pk-caret" aria-hidden="true" />}
    </div>
  );
}
