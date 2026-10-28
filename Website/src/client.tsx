import { StrictMode, Suspense, lazy } from 'react';
import { WorkspaceProvider } from '@/workspace/Workspace';
import { AIConnectionsProvider } from '@/components/ai/AIConnections';
import { AccountGate } from '@/workspace/AccountGate';
import Responsibilities from '@/screens/Responsibilities';
import Account from '@/screens/Account';
import FamilySettings from '@/screens/FamilySettings';
import Community from '@/screens/Community';
import DemoEntry from '@/screens/DemoEntry';
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
import './styles/workspace.css';
import './styles/courtyard.css';
import './styles/ai-settings.css';
import { Home } from '@/components/family/Home';
import { FamilyPlan } from '@/components/family/Plan';
import { Today } from '@/components/family/Today';
import { AppProvider } from '@/state/store';
import { ToastProvider } from '@/components/shared/Toast';
import { ErrorBoundary } from '@/components/shared/ErrorState';
import { AppShell, SiteLayout } from '@/components/layout/Layouts';
import { LoadingPage } from '@/components/shared/Loading';
import { AuthDialog, authBackground } from '@/components/family/AuthDialog';
import './styles/atelier.css';
import './styles/language.css';
import './styles/about.css';
import { LanguageEffects } from '@/components/family/LanguageControl';

const Onboarding = lazy(() => import('@/screens/Onboarding'));
const Assessment = lazy(() => import('@/screens/Assessment'));
const Results = lazy(() => import('@/screens/Results'));
const Coach = lazy(() => import('@/screens/Coach'));
const Schedule = lazy(() => import('@/screens/Schedule'));
const Student = lazy(() => import('@/screens/Student'));
const Care = lazy(() => import('@/screens/Care'));
const Memories = lazy(() => import('@/screens/Memories'));
const About = lazy(() => import('@/screens/About'));
const Trust = lazy(() => import('@/screens/Trust'));
const Demo = lazy(() => import('@/screens/Demo'));
const NotFound = lazy(() => import('@/screens/NotFound'));

function RoutedApp() {
  const location = useLocation(), { pathname } = location;
  const authentication = ['/sign-in', '/sign-up'].includes(pathname);
  return (
    <ErrorBoundary resetKey={pathname}>
      <Suspense fallback={<LoadingPage />}>
        <div inert={authentication || undefined} aria-hidden={authentication || undefined}>
        <Routes location={authentication ? authBackground(location) : location}>
          <Route element={<SiteLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/assessment" element={<AccountGate><Assessment /></AccountGate>} />
            <Route path="/about" element={<About />} />
            <Route path="/trust" element={<Trust />} />
            <Route path="/demo" element={<DemoEntry />} />
            <Route path="/tour" element={<Demo />} />
            <Route path="/account" element={<Account />} />
            <Route path="/invitations/:token" element={<Account />} />
            <Route path="/home" element={<Navigate to="/" replace />} />
            <Route path="*" element={<NotFound />} />
          </Route>
          <Route element={<AccountGate><AppShell /></AccountGate>}>
            <Route path="/tasks" element={<Responsibilities />} />
            <Route path="/family" element={<FamilySettings />} />
            <Route path="/check-ins" element={<Community />} />
            <Route path="/notifications" element={<Community />} />
            <Route path="/settings" element={<FamilySettings />} />
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
        </div>
        {authentication && <AuthDialog/>}
      </Suspense>
    </ErrorBoundary>
  );
}

export default function FamilyMindClient() {
 return <StrictMode><ErrorBoundary><BrowserRouter><WorkspaceProvider><AppProvider><AIConnectionsProvider><ToastProvider><LanguageEffects /><RoutedApp /></ToastProvider></AIConnectionsProvider></AppProvider></WorkspaceProvider></BrowserRouter></ErrorBoundary></StrictMode>;
}
