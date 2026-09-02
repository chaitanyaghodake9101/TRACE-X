import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './components/ThemeProvider';
import { LoginPage } from './pages/LoginPage';
import { CasesPage } from './pages/CasesPage';
import { GraphWorkspacePage } from './pages/GraphWorkspacePage';
import { HypothesesPage } from './pages/HypothesesPage';
import { ActionsPage } from './pages/ActionsPage';
import { ReportsPage } from './pages/ReportsPage';
import { AboutPage } from './pages/AboutPage';
import { TutorialsPage } from './pages/TutorialsPage';
import { AdminOfficersPage } from './pages/AdminOfficersPage';
import { AdminHealthPage } from './pages/AdminHealthPage';
import { AdminContentPage } from './pages/AdminContentPage';
import { AdminTutorialsPage } from './pages/AdminTutorialsPage';
import { AdminThemePage } from './pages/AdminThemePage';
import { AdminFeatureFlagsPage } from './pages/AdminFeatureFlagsPage';
import { HelpPage } from './pages/HelpPage';
import { HelpWidget } from './components/HelpWidget';

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const token = localStorage.getItem('tracex_token');
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return (
    <>
      {children}
      <HelpWidget />
    </>
  );
};

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route
            path="/about"
            element={
              <ProtectedRoute>
                <AboutPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/tutorials"
            element={
              <ProtectedRoute>
                <TutorialsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/help"
            element={
              <ProtectedRoute>
                <HelpPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/officers"
            element={
              <ProtectedRoute>
                <AdminOfficersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/health"
            element={
              <ProtectedRoute>
                <AdminHealthPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/content"
            element={
              <ProtectedRoute>
                <AdminContentPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/tutorials"
            element={
              <ProtectedRoute>
                <AdminTutorialsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/theme"
            element={
              <ProtectedRoute>
                <AdminThemePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/flags"
            element={
              <ProtectedRoute>
                <AdminFeatureFlagsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/cases"
            element={
              <ProtectedRoute>
                <CasesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/cases/:id/graph"
            element={
              <ProtectedRoute>
                <GraphWorkspacePage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/cases/:id/hypotheses"
            element={
              <ProtectedRoute>
                <HypothesesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/cases/:id/actions"
            element={
              <ProtectedRoute>
                <ActionsPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/cases/:id/reports"
            element={
              <ProtectedRoute>
                <ReportsPage />
              </ProtectedRoute>
            }
          />
          <Route path="*" element={<Navigate to="/cases" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
};

export default App;
