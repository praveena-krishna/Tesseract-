import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';

import '@fontsource-variable/space-grotesk';
import '@fontsource/inter/300.css';
import '@fontsource/inter/400.css';
import './styles/global.css';
import './ui/ui.css';

import App from './App';

const container = document.getElementById('root');
if (!container) throw new Error('Root element not found');

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
