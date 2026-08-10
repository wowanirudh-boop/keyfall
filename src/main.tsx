import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './design/globals.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <main>Piano Practice Player</main>
  </StrictMode>,
);
