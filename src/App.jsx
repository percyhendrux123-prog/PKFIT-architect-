import { Routes, Route } from 'react-router-dom';

export default function App() {
  return (
    <Routes>
      <Route
        path="*"
        element={
          <div className="mx-auto max-w-reading p-10">
            <div className="label mb-2">Scaffold</div>
            <h1 className="font-display text-4xl tracking-wider2 text-gold">PKFIT</h1>
            <p className="mt-3 text-sm text-mute">Routing arrives in phase 3.</p>
          </div>
        }
      />
    </Routes>
  );
}
