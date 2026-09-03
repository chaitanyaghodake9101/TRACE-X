import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ThemeProvider } from './context/ThemeContext';
import { WelcomePage } from './pages/WelcomePage';
import { LoginPage } from './pages/LoginPage';
import { CasesPage } from './pages/CasesPage';
import { CaseDetailPage } from './pages/CaseDetailPage';
import { GraphWorkspacePage } from './pages/GraphWorkspacePage';
import { HypothesesPage } from './pages/HypothesesPage';
import { ActionsPage } from './pages/ActionsPage';
import { ReportsPage } from './pages/ReportsPage';
import { AboutPage } from './pages/AboutPage';
import { TutorialsPage } from './pages/TutorialsPage';
import { AdminOfficersPage } from './pages/AdminOfficersPage';
import { AdminAuditPage } from './pages/AdminAuditPage';
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
          {/* Animated Welcome / Loading Page (Auto-Enters) */}
          <Route path="/" element={<WelcomePage />} />
          <Route path="/welcome" element={<WelcomePage />} />

          {/* Authentication Gateway */}
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<LoginPage />} />
          <Route path="/forgot-password" element={<LoginPage />} />
          <Route path="/reset-password" element={<LoginPage />} />

          {/* App Root & Aliases */}
          <Route path="/app" element={<Navigate to="/cases" replace />} />
          <Route path="/app/dashboard" element={<Navigate to="/cases" replace />} />
          <Route path="/app/evidence" element={<Navigate to="/cases" replace />} />
          <Route path="/app/graph" element={<Navigate to="/cases" replace />} />
          <Route path="/app/admin" element={<Navigate to="/admin/officers" replace />} />

          {/* Protected Case Dossiers & Detail View */}
          <Route
            path="/cases"
            element={
              <ProtectedRoute>
                <CasesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/cases"
            element={
              <ProtectedRoute>
                <CasesPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/cases/:id"
            element={
              <ProtectedRoute>
                <CaseDetailPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/cases/:id"
            element={
              <ProtectedRoute>
                <CaseDetailPage />
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
            path="/app/cases/:id/graph"
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
            path="/app/cases/:id/hypotheses"
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
            path="/app/cases/:id/actions"
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
          <Route
            path="/app/cases/:id/reports"
            element={
              <ProtectedRoute>
                <ReportsPage />
              </ProtectedRoute>
            }
          />

          {/* Knowledge, Academy & Guidance */}
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
            path="/app/tutorials"
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
            path="/app/help"
            element={
              <ProtectedRoute>
                <HelpPage />
              </ProtectedRoute>
            }
          />

          {/* Administration & Studio */}
          <Route
            path="/admin/officers"
            element={
              <ProtectedRoute>
                <AdminOfficersPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/admin/audit"
            element={
              <ProtectedRoute>
                <AdminAuditPage />
              </ProtectedRoute>
            }
          />
          <Route
            path="/app/admin/audit"
            element={
              <ProtectedRoute>
                <AdminAuditPage />
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

          {/* Safe Default Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </ThemeProvider>
  );
};

export default App;
