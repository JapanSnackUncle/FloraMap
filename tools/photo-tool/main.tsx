// Photo tool (npm run dev only; see README.md, "Photo tool"). Not part of the app's build.

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
// The app's own pin rules, so the Species tab's previews look exactly like the map's pins.
import '../../src/pin.css';
import './style.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
