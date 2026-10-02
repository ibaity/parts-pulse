import { Toaster } from "@/components/ui/toaster"
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClientInstance } from '@/lib/query-client'
import { BrowserRouter as Router, Route, Routes } from 'react-router-dom';
import PageNotFound from './lib/PageNotFound';
import { AuthProvider, useAuth } from '@/lib/AuthContext';
import UserNotRegisteredError from '@/components/UserNotRegisteredError';
import ScrollToTop from './components/ScrollToTop';
// Add page imports here
import { lazy, Suspense } from 'react';
import Layout from '@/components/Layout';
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const Vendors = lazy(() => import('@/pages/Vendors'));
const Warehouses = lazy(() => import('@/pages/Warehouses'));
const MasterFiles = lazy(() => import('@/pages/MasterFiles'));
const Analysis = lazy(() => import('@/pages/Analysis'));
const PartList = lazy(() => import('@/pages/PartList'));
const DeviceModels = lazy(() => import('@/pages/DeviceModels'));
const InventoryTracking = lazy(() => import('@/pages/InventoryTracking'));
const Consumption = lazy(() => import('@/pages/Consumption'));

const PageFallback = () => (
  <div className="flex items-center justify-center py-20">
    <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
  </div>
);

const AuthenticatedApp = () => {
  const { isLoadingAuth, isLoadingPublicSettings, authError, navigateToLogin } = useAuth();

  // Show loading spinner while checking app public settings or auth
  if (isLoadingPublicSettings || isLoadingAuth) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-slate-200 border-t-slate-800 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Handle authentication errors
  if (authError) {
    if (authError.type === 'user_not_registered') {
      return <UserNotRegisteredError />;
    } else if (authError.type === 'auth_required') {
      // Redirect to login automatically
      navigateToLogin();
      return null;
    }
  }

  // Render the main app
  return (
    <Suspense fallback={<PageFallback />}>
    <Routes>
      {/* Add your page Route elements here */}
      <Route element={<Layout />}>
        <Route path="/" element={<Dashboard />} />
        <Route path="/vendors" element={<Vendors />} />
        <Route path="/warehouses" element={<Warehouses />} />
        <Route path="/master-files" element={<MasterFiles />} />
        <Route path="/analysis" element={<Analysis />} />
        <Route path="/part-list" element={<PartList />} />
        <Route path="/device-models" element={<DeviceModels />} />
        <Route path="/inventory-tracking" element={<InventoryTracking />} />
        <Route path="/consumption" element={<Consumption />} />
      </Route>
      <Route path="*" element={<PageNotFound />} />
    </Routes>
    </Suspense>
  );
};


function App() {

  return (
    <AuthProvider>
      <QueryClientProvider client={queryClientInstance}>
        <Router>
          <ScrollToTop />
          <AuthenticatedApp />
        </Router>
        <Toaster />
      </QueryClientProvider>
    </AuthProvider>
  )
}

export default App