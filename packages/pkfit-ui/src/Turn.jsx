import React from 'react';

/**
 * Turn — wraps a single message turn (agent or client) with the ATLAS meta-row
 * and animated entry. Mirrors the `addTurn` DOM builder in the intake/checkin HTML.
 *
 * Props:
 *   role       'agent' | 'client'
 *   who        Display label in the meta row (e.g. 'PK', 'Coach', 'You'). Required.
 *   timestamp  Optional preformatted timestamp string. Falls back to current local time.
 *   children   The bubble content (or any extra elements appended after).
 */
export function Turn({ role = 'agent', who, timestamp, children }) {
  const isAgent = role === 'agent';
  const ts = timestamp ?? defaultTimestamp();
  return (
    <div className={`pk-turn ${isAgent ? 'pk-turn--agent' : 'pk-turn--client'}`}>
      <div className="pk-meta-row">
        <span className={`pk-who ${isAgent ? 'pk-who--moon' : ''}`}>{who}</span>
        {ts && <span>{ts}</span>}
      </div>
      {children}
    </div>
  );
}

function defaultTimestamp() {
  const d = new Date();
  return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).toUpperCase();
}
