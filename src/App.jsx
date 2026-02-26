import { Route, Routes } from "react-router-dom";

import Navbar from "./components/layout/Navbar";
import Footer from "./components/layout/Footer";
import { Toaster } from "./components/ui/toaster";

import AuthModal from "./components/auth/AuthModal";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import AdminRoute from "./components/auth/AdminRoute";

import usePresencePing from "./hooks/usePresencePing";

// -----------------------------
// Public pages
// -----------------------------
import Home from "./pages/Home";
import Marketplace from "./pages/Marketplace";
import ListingDetails from "./pages/ListingDetails";
import Feed from "./pages/Feed";
import FeedPostDetails from "./pages/FeedPostDetails";
import Pricing from "./pages/Pricing";
import Streams from "./pages/Streams";
import StreamWatch from "./pages/StreamWatch";

// CMS-rendered pages (footer links)
import SitePage from "./pages/SitePage";

// -----------------------------
// Protected (user)
/// -----------------------------
import Dashboard from "./pages/Dashboard";
import CreateListing from "./pages/CreateListing";
import Notifications from "./pages/Notifications";
import CheckoutPage from "./pages/CheckoutPage";

// -----------------------------
// Admin
// -----------------------------
import AdminShell from "./components/admin/AdminShell";
import AdminHome from "./pages/admin/AdminHome";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminListings from "./pages/admin/AdminListings";
import AdminPlatforms from "./pages/admin/AdminPlatforms";
import AdminCategories from "./pages/admin/AdminCategories";
import AdminFeed from "./pages/admin/AdminFeed";
import AdminSettings from "./pages/admin/AdminSettings";
import AdminEscrows from "./pages/admin/AdminEscrows";
import AdminStreams from "./pages/admin/AdminStreams";
import AdminPages from "./pages/admin/AdminPages"; // NEW
import AdminSubscriptions from "./pages/admin/AdminSubscriptions";
import SubscriptionCheckout from "./pages/SubscriptionCheckout";
import AdminSubscriptionPayments from "./pages/admin/AdminSubscriptionPayments"; // NEW

// In your routes file (e.g., App.jsx or routes.jsx)
import Messages from "./pages/Messages"
import UserProfile from "./pages/UserProfile";

export default function App() {
  usePresencePing();

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Global layout */}
      <Navbar />
      <AuthModal />

      <Routes>
        {/* ============================================================
            PUBLIC ROUTES (no login required)
           ============================================================ */}
        <Route path="/" element={<Home />} />
        <Route path="/marketplace" element={<Marketplace />} />
        <Route path="/listings/:id" element={<ListingDetails />} />

        {/* Streams (public) */}
        <Route path="/streams" element={<Streams />} />
        <Route path="/streams/:id" element={<StreamWatch />} />

        {/* Feed (public) */}
        <Route path="/feed" element={<Feed />} />
        <Route path="/feed/:id" element={<FeedPostDetails />} />

        {/* Pricing (public) */}
        <Route path="/pricing" element={<Pricing />} />

        <Route path="/users/:username" element={<UserProfile />} />

        
<Route path="/messages" element={<Messages />} />
       

        {/* CMS pages (public). */}
        <Route path="/about" element={<SitePage />} />
        <Route path="/sellers" element={<SitePage />} />
        <Route path="/contact" element={<SitePage />} />
        <Route path="/escrow-service" element={<SitePage />} />
        <Route path="/fees" element={<SitePage />} />
        <Route path="/safety" element={<SitePage />} />
        <Route path="/privacy-policy" element={<SitePage />} />
        <Route path="/cookies-policy" element={<SitePage />} />
        <Route path="/terms" element={<SitePage />} />
   

        {/* ============================================================
            PROTECTED USER ROUTES (login required)
           ============================================================ */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <Dashboard />
            </ProtectedRoute>
          }
        />

        <Route
          path="/create"
          element={
            <ProtectedRoute>
              <CreateListing />
            </ProtectedRoute>
          }
        />

        <Route
          path="/notifications"
          element={
            <ProtectedRoute>
              <Notifications />
            </ProtectedRoute>
          }
        />

        {/* Checkout requires login in your flow (creates escrow, proof submission etc.) */}
        <Route
          path="/checkout/:listingId"
          element={
            <ProtectedRoute>
              <CheckoutPage />
            </ProtectedRoute>
          }
        />

{/* Subscription checkout - protected */}
<Route
  path="/subscription-checkout/:planName"
  element={
    <ProtectedRoute>
      <SubscriptionCheckout />
    </ProtectedRoute>
  }
/>

         

        {/* ============================================================
            ADMIN ROUTES (admin-only)
            IMPORTANT: child paths must be RELATIVE (no leading /)
           ============================================================ */}
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminShell />
            </AdminRoute>
          }
        >
          <Route index element={<AdminHome />} />
          <Route path="users" element={<AdminUsers />} />
          <Route path="listings" element={<AdminListings />} />
          <Route path="platforms" element={<AdminPlatforms />} />
          <Route path="categories" element={<AdminCategories />} />
          <Route path="feed" element={<AdminFeed />} />
          <Route path="streams" element={<AdminStreams />} /> {/*  FIXED */}
          <Route path="settings" element={<AdminSettings />} />
          <Route path="escrows" element={<AdminEscrows />} />
          <Route path="subscriptions" element={<AdminSubscriptions />} />
          <Route path="subscription-payments" element={<AdminSubscriptionPayments />} /> {/* NEW */}


          {/* Later: CMS admin page editor */}
           <Route path="pages" element={<AdminPages />} /> *
        </Route>

        {/* Optional: 404
        <Route path="*" element={<NotFound />} />
        */}
      </Routes>

      <Footer />
      <Toaster />
    </div>
  );
}