import { useEffect } from 'react';
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom';
import { AudioProvider } from './context/AudioContext';
import { CartProvider } from './context/CartContext';
import Header from './components/layout/Header';
import CartDrawer from './components/cart/CartDrawer';
import RadioPage from './pages/RadioPage';
import RecordsPage from './pages/RecordsPage';
import ProductsPage from './pages/ProductsPage';
import ProductDetailsPage from './pages/ProductDetailsPage';
import CheckoutPage from './pages/CheckoutPage';
import OrderConfirmationPage from './pages/OrderConfirmationPage';
import DownloadPage from './pages/DownloadPage';
import AboutPage from './pages/AboutPage';
import SupportPage from './pages/SupportPage';
import AdminPage from './pages/AdminPage';

export default function App() {
  return (
    <AudioProvider>
      <CartProvider>
        <AppInner />
      </CartProvider>
    </AudioProvider>
  );
}

function AppInner() {
  const location = useLocation();
  const navigate = useNavigate();

  // Allow entering secret super creds via query string (e.g. ?loginWithSuperCreds=True)
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const val = params.get('loginWithSuperCreds');
    if (val && val.toLowerCase() === 'true' && location.pathname !== '/loginWithSuperCreds=True') {
      navigate('/loginWithSuperCreds=True', { replace: true });
    }
  }, [location.search, location.pathname, navigate]);

  return (
    <>
      <Header />
      <CartDrawer />
      <Routes location={location} key={location.pathname}>
        <Route path="/"                            element={<RadioPage />} />
        <Route path="/records"                     element={<RecordsPage />} />
        <Route path="/products"                    element={<ProductsPage />} />
        <Route path="/products/:id"                element={<ProductDetailsPage />} />
        <Route path="/checkout"                    element={<CheckoutPage />} />
        <Route path="/order-confirmation/:orderId" element={<OrderConfirmationPage />} />
        <Route path="/orders/:orderId"             element={<OrderConfirmationPage />} />
        <Route path="/download/:token"             element={<DownloadPage />} />
        <Route path="/about"                       element={<AboutPage />} />
        <Route path="/support"                     element={<SupportPage />} />
        <Route path="/loginWithSuperCreds=True"    element={<AdminPage />} />
        <Route path="/loginWithSuperCreds=true"    element={<AdminPage />} />
        <Route path="*"                            element={<RadioPage />} />
      </Routes>
    </>
  );
}

