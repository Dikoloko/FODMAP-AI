import { lazy, Suspense, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { useUser } from './hooks/useUser';
import BottomNav from './components/BottomNav';
import { runMigration } from './migration';
import { ensureDb } from './utils/fodmapAnalyzer';

const HomeScreen = lazy(() => import('./screens/HomeScreen'));
const ScanScreen = lazy(() => import('./screens/ScanScreen'));
const PhotoScreen = lazy(() => import('./screens/PhotoScreen'));
const DiaryScreen = lazy(() => import('./screens/DiaryScreen'));
const InsightsScreen = lazy(() => import('./screens/InsightsScreen'));
const RecipeScreen = lazy(() => import('./screens/RecipeScreen'));

function Loading() {
  return (
    <div className="flex-1 flex items-center justify-center">
      <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

function AppInner() {
  const { user, setUser } = useUser();

  return (
    <BrowserRouter>
      <div className="flex flex-col min-h-dvh max-w-lg mx-auto">
        <Suspense fallback={<Loading />}>
          <Routes>
            <Route path="/" element={<HomeScreen user={user} onSwitchUser={setUser} />} />
            <Route path="/scan" element={<ScanScreen user={user} />} />
            <Route path="/photo" element={<PhotoScreen user={user} />} />
            <Route path="/diary" element={<DiaryScreen user={user} />} />
            <Route path="/insights" element={<InsightsScreen user={user} />} />
            <Route path="/recipes" element={<RecipeScreen user={user} />} />
          </Routes>
        </Suspense>
        <BottomNav />
      </div>
    </BrowserRouter>
  );
}

export default function App() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // Run migration and pre-load FODMAP database in parallel.
    // ensureDb() fetches the 108KB JSON chunk so it's cached before first search.
    Promise.all([
      runMigration().catch(() => {}),
      ensureDb().catch(() => {}),
    ]).then(() => setReady(true));
  }, []);

  if (!ready) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <div className="w-8 h-8 border-3 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return <AppInner />;
}
