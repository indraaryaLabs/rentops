import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { AppStore } from './application/toko';
import './ui/gaya/index.css';

const wadah = document.getElementById('root');

if (!wadah) {
  throw new Error('Elemen #root tidak ditemukan pada index.html.');
}

createRoot(wadah).render(
  <StrictMode>
    <AppStore>
      <App />
    </AppStore>
  </StrictMode>,
);