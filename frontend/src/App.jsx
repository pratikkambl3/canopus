import { Routes, Route, useLocation } from 'react-router-dom';
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
import AboutPage from './pages/AboutPage';
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
        <Route path="/about"                       element={<AboutPage />} />
        <Route path="/admin"                       element={<AdminPage />} />
        <Route path="*"                            element={<RadioPage />} />
      </Routes>
    </>
  );
}
