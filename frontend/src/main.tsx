import React from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/manrope';
import '@fontsource/golos-text/400.css';
import '@fontsource/golos-text/500.css';
import '@fontsource/golos-text/600.css';
import App from './App';
import { RuntimeRoot } from './services/runtime';
import './styles.css';
import './responsive.css';
import './theme.css';
import './ml/ml.css';
import './admin/admin.css';
import './ml/rating.css';

createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <RuntimeRoot>
      <App />
    </RuntimeRoot>
  </React.StrictMode>,
);
