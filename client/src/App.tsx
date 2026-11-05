import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Missing, Shell } from './components/Shell';
import { BoardPage } from './pages/BoardPage';
import { CustomersPage } from './pages/CustomersPage';
import { InventoryPage } from './pages/InventoryPage';
import { InvoicePage } from './pages/InvoicePage';
import { InvoicesPage } from './pages/InvoicesPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { WorkOrderPage } from './pages/WorkOrderPage';
import { SessionProvider } from './session';

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<Shell />}>
        <Route index element={<BoardPage />} />
        <Route path="work-orders/:id" element={<WorkOrderPage />} />
        <Route path="customers" element={<CustomersPage />} />
        <Route path="inventory" element={<InventoryPage />} />
        <Route path="invoices" element={<InvoicesPage />} />
        <Route path="invoices/:id" element={<InvoicePage />} />
        <Route path="*" element={<Missing />} />
      </Route>
    </Routes>
  );
}

export function App() {
  return (
    <SessionProvider>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </SessionProvider>
  );
}
