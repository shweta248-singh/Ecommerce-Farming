import React from 'react'
import { Routes, Route, useLocation, useNavigate } from 'react-router-dom'
import Navbar from './components/Navbar.jsx'
import Footer from './components/Footer.jsx'
import Home from './pages/Home.jsx'
import Products from './pages/Products.jsx'
import ProductDetail from './pages/ProductDetail.jsx'
import Contact from './pages/Contact.jsx'
import Register from './pages/Register.jsx'
import BuyerLogin from './pages/BuyerLogin.jsx'
import SellerLogin from './pages/SellerLogin.jsx'
import ForgotPassword from './pages/ForgotPassword.jsx'
import ResetPassword from './pages/ResetPassword.jsx'
import Chatbot from "./components/chatbot.jsx";
import Cart from './pages/Cart.jsx'
import Checkout from './pages/Checkout.jsx'
import CategoryProducts from './pages/CategoryProducts.jsx'
import CollectiveBuying from './pages/CollectiveBuying.jsx'
import CollectiveSession from './pages/CollectiveSession.jsx'
import CollectiveCheckout from './pages/CollectiveCheckout.jsx'
import CollectiveOrderConfirmation from './pages/CollectiveOrderConfirmation.jsx'
import Notifications from './pages/Notifications.jsx'
import Payment from './pages/Payment.jsx'
import Addresses from './pages/Addresses.jsx'
import MyOrders from './pages/MyOrders.jsx'
import OrderTracking from './pages/OrderTracking.jsx'
import Profile from './pages/Profile.jsx'
import PaymentSuccess from './pages/PaymentSuccess.jsx'
import OrderConfirmed from './pages/OrderConfirmed.jsx'
import SellerDashboard from "./pages/SellerDashboard";
import ModernSellerDashboard from "./pages/ModernSellerDashboard";
import AddProduct from "./pages/AddProduct";
import "./components/landing.css";

import ProtectedRoute from './components/ProtectedRoute.jsx'

// Routes that have their own full-screen layout (no public navbar/footer)
const STANDALONE_ROUTES = ['/seller-dashboard'];

function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const isStandalone = STANDALONE_ROUTES.includes(location.pathname);

  React.useEffect(() => {
    console.log("ROUTE CHANGED TO:", location.pathname);
  }, [location.pathname]);

  React.useEffect(() => {
    const params = new URLSearchParams(location.search);
    const openTarget = params.get('open');

    const targetRoutes = {
      notifications: '/notifications',
      collectiveBuying: '/collective-buying',
    };

    if (location.pathname === '/' && targetRoutes[openTarget]) {
      params.delete('open');
      const rest = params.toString();
      navigate(`${targetRoutes[openTarget]}${rest ? `?${rest}` : ''}`, { replace: true });
    }
  }, [location.pathname, location.search, navigate]);

  return (
    <>
      {!isStandalone && <Navbar />}

      <main>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<Home />} />
          <Route path="/register" element={<Register />} />
          <Route path="/buyer-login" element={<BuyerLogin />} />
          <Route path="/seller-login" element={<SellerLogin />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/products" element={<Products />} />
          <Route path="/product/:id" element={<ProductDetail />} />
          <Route path="/products/category/:categorySlug" element={<CategoryProducts />} />
          <Route path="/collective-buying" element={
            <ProtectedRoute requiredRole="buyer" redirectTo="/seller-dashboard">
              <CollectiveBuying />
            </ProtectedRoute>
          } />
          <Route path="/collective/session/:id" element={
            <ProtectedRoute requiredRole="buyer" redirectTo="/seller-dashboard">
              <CollectiveSession />
            </ProtectedRoute>
          } />
          <Route path="/collective/checkout/:id" element={
            <ProtectedRoute requiredRole="buyer" redirectTo="/seller-dashboard">
              <CollectiveCheckout />
            </ProtectedRoute>
          } />
          <Route path="/collective/order/:orderId" element={
            <ProtectedRoute requiredRole="buyer" redirectTo="/seller-dashboard">
              <CollectiveOrderConfirmation />
            </ProtectedRoute>
          } />

          {/* Buyer-Only Protected Routes */}
          <Route path="/cart" element={
            <ProtectedRoute requiredRole="buyer" redirectTo="/seller-dashboard">
              <Cart />
            </ProtectedRoute>
          } />
          <Route path="/checkout" element={
            <ProtectedRoute requiredRole="buyer" redirectTo="/seller-dashboard">
              <Checkout />
            </ProtectedRoute>
          } />
          <Route path="/payment" element={
            <ProtectedRoute requiredRole="buyer" redirectTo="/seller-dashboard">
              <Payment />
            </ProtectedRoute>
          } />
          <Route path="/addresses" element={
            <ProtectedRoute requiredRole="buyer" redirectTo="/seller-dashboard">
              <Addresses />
            </ProtectedRoute>
          } />
          <Route path="/my-orders" element={
            <ProtectedRoute requiredRole="buyer" redirectTo="/seller-dashboard">
              <MyOrders />
            </ProtectedRoute>
          } />
          <Route path="/profile" element={
            <ProtectedRoute requiredRole="buyer" redirectTo="/seller-dashboard">
              <Profile />
            </ProtectedRoute>
          } />
          <Route path="/payment-success" element={
            <ProtectedRoute requiredRole="buyer" redirectTo="/seller-dashboard">
              <PaymentSuccess />
            </ProtectedRoute>
          } />
          <Route path="/order-confirmed" element={
            <ProtectedRoute requiredRole="buyer" redirectTo="/seller-dashboard">
              <OrderConfirmed />
            </ProtectedRoute>
          } />
          <Route path="/order-tracking" element={
            <ProtectedRoute requiredRole="buyer" redirectTo="/seller-dashboard">
              <OrderTracking />
            </ProtectedRoute>
          } />
          <Route path="/notifications" element={
            <ProtectedRoute requiredRole="buyer" redirectTo="/seller-dashboard">
              <Notifications />
            </ProtectedRoute>
          } />

          {/* Seller-Only Protected Routes */}
          <Route path="/seller-dashboard" element={
            <ProtectedRoute requiredRole="seller" redirectTo="/">
              <ModernSellerDashboard />
            </ProtectedRoute>
          } />
          <Route path="/add-product" element={
            <ProtectedRoute requiredRole="seller" redirectTo="/">
              <AddProduct />
            </ProtectedRoute>
          } />
        </Routes>
      </main>

      {!isStandalone && <Footer />}

      <Chatbot />
    </>
  );
}

export default App;
