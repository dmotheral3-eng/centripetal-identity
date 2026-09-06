import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { analyticsState, startAnalytics } from './analytics';

startAnalytics();

// A build marker, not a log line for its own sake: lets a probe tell "sending"
// and "no-key" apart from the artifact itself, not from reading source.
document.documentElement.setAttribute('data-analytics', analyticsState);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
