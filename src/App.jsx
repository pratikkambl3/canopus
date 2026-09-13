import { Routes, Route, useLocation } from 'react-router-dom';
import { AudioProvider } from './context/AudioContext';
import Header from './components/layout/Header';
import RadioPage from './pages/RadioPage';
import RecordsPage from './pages/RecordsPage';
import AboutPage from './pages/AboutPage';
import AdminPage from './pages/AdminPage';

export default function App() {
  return (
    <AudioProvider>
      <AppInner />
    </AudioProvider>
  );
}

function AppInner() {
  const location = useLocation();
  return (
    <>
      <Header />
      <Routes location={location} key={location.pathname}>
        <Route path="/"        element={<RadioPage />} />
        <Route path="/records" element={<RecordsPage />} />
        <Route path="/about"   element={<AboutPage />} />
        <Route path="/admin"   element={<AdminPage />} />
        <Route path="*"        element={<RadioPage />} />
      </Routes>
    </>
  );
}
