import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './styles.css';

// npm run dev: the dev server rebuilt public/data/ after a change in data/ or photos/ (event name
// in tools/photo-tool/api.ts, sent by vite.config.ts). Reload to show it.
import.meta.hot?.on('flora:data-rebuilt', () => location.reload());

const root = document.getElementById('root');
if (!root) throw new Error('#root missing from index.html');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
