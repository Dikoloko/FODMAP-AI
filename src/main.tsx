import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import ErrorBoundary from './components/ErrorBoundary';
import { cleanExpiredCache, startPeriodicCacheCleanup } from './utils/storage';
import { releaseDb } from './utils/fodmapAnalyzer';

cleanExpiredCache();
const stopCacheCleanup = startPeriodicCacheCleanup();

// Release the in-memory FODMAP DB when the app goes to background;
// it will be lazily reloaded on next use via the existing ensureDb() mechanism.
const handleVisibilityChange = () => {
  if (document.visibilityState === 'hidden') {
    releaseDb();
  }
};
document.addEventListener('visibilitychange', handleVisibilityChange);

// Clean up intervals and listeners on HMR hot-reload to avoid duplicates.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    stopCacheCleanup();
    document.removeEventListener('visibilitychange', handleVisibilityChange);
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
