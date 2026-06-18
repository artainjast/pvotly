import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
// Pivot library styles (imported from source for live HMR in the docs app).
import '../../../packages/web/src/styles/pvotly.css';
import '../../../packages/web/src/styles/themes.css';
import './landing.css';
import './styles.css';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
