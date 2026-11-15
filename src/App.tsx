import { Suspense, lazy, useEffect } from 'react';
import {
  BrowserRouter,
  Navigate,
  Route,
  Routes,
  useNavigate,
} from 'react-router-dom';
import { BerandaPage } from './pages/BerandaPage';
import { ReaderPage } from './pages/ReaderPage';

const NovelStudioPage = lazy(() => import('./studio/pages/NovelStudioPage'));

function LegacyHashRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    const hash = window.location.hash;
    if (hash.startsWith('#/editor') || hash.startsWith('#/read/')) {
      navigate(hash.slice(1), { replace: true });
    }
  }, [navigate]);

  return null;
}

export function App() {
  return (
    <BrowserRouter>
      <LegacyHashRedirect />
      <Routes>
        <Route path="/" element={<BerandaPage />} />
        <Route path="/read/:slug" element={<ReaderPage />} />
        <Route path="/read/:slug/:chapterId" element={<ReaderPage />} />
        <Route
          path="/editor/*"
          element={
            <Suspense
              fallback={
                <div
                  style={{
                    minHeight: '100vh',
                    display: 'grid',
                    placeItems: 'center',
                    fontFamily: 'var(--font-sans)',
                  }}
                >
                  Memuat Studio Editor…
                </div>
              }
            >
              <NovelStudioPage />
            </Suspense>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
