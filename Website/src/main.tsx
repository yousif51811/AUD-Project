import { StrictMode, Suspense, lazy } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import '@fontsource-variable/inter';
import './styles/tokens.css';
import './styles/base.css';
import './styles/ui.css';
import './styles/layout.css';
import './styles/pages.css';
import './styles/family.css';
import './styles/appearance.css';
import './styles/motion.css';
import { Home } from '@/components/family/Home';
import { FamilyPlan } from '@/components/family/Plan';
import { Today } from '@/components/family/Today';
import { AppProvider } from '@/state/store';
import { ToastProvider } from '@/components/shared/Toast';
import { ErrorBoundary } from '@/components/shared/ErrorState';
import { AppShell, SiteLayout } from '@/components/layout/Layouts';
import { LoadingPage } from '@/components/shared/Loading';

const Onboarding = lazy(() => import('@/pages/Onboarding'));
const Assessment = lazy(() => import('@/pages/Assessment'));
const Results = lazy(() => import('@/pages/Results'));
const Coach = lazy(() => import('@/pages/Coach'));
const Schedule = lazy(() => import('@/pages/Schedule'));
const Student = lazy(() => import('@/pages/Student'));
const Care = lazy(() => import('@/pages/Care'));
const Memories = lazy(() => import('@/pages/Memories'));
const Trust = lazy(() => import('@/pages/Trust'));
const Demo = lazy(() => import('@/pages/Demo'));
const NotFound = lazy(() => import('@/pages/NotFound'));

function RoutedApp() {
  const { pathname } = useLocation();
  return (
    <ErrorBoundary resetKey={pathname}>
      <Suspense fallback={<LoadingPage />}>
        <Routes>
          <Route element={<SiteLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/assessment" element={<Assessment />} />
            <Route path="/trust" element={<Trust />} />
            <Route path="/demo" element={<Demo />} />
            <Route path="/home" element={<Navigate to="/" replace />} />
            <Route path="*" element={<NotFound />} />
          </Route>
          <Route element={<AppShell />}>
            <Route path="/results" element={<Results />} />
            <Route path="/dashboard" element={<Today />} />
            <Route path="/coach" element={<Coach />} />
            <Route path="/plan" element={<FamilyPlan />} />
            <Route path="/schedule" element={<Schedule />} />
            <Route path="/student" element={<Student />} />
            <Route path="/care" element={<Care />} />
            <Route path="/memories" element={<Memories />} />
          </Route>
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}

const root = import.meta.hot?.data.root ?? createRoot(document.getElementById('root')!);
if (import.meta.hot) import.meta.hot.data.root = root;
root.render(
  <StrictMode>
    <ErrorBoundary>
      <AppProvider>
        <ToastProvider>
          <BrowserRouter>
            <RoutedApp />
          </BrowserRouter>
        </ToastProvider>
      </AppProvider>
    </ErrorBoundary>
  </StrictMode>,
);
