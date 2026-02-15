import { Route, Routes } from "react-router-dom";
import Navbar from "./components/layout/Navbar";
import Footer from "./components/layout/Footer";
import Home from "./pages/Home";
import Pricing from "./pages/Pricing";
import Marketplace from "./pages/Marketplace";
import ListingDetails from "./pages/ListingDetails";
import Dashboard from "./pages/Dashboard";
import CreateListing from "./pages/CreateListing";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import AuthModal from "./components/auth/AuthModal";
import AdminRoute from "./components/auth/AdminRoute";
import AdminShell from "./components/admin/AdminShell";
import AdminHome from "./pages/admin/AdminHome";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminListings from "./pages/admin/AdminListings";
import AdminPlatforms from "./pages/admin/AdminPlatforms";
import AdminCategories from "./pages/admin/AdminCategories";
import Feed from "./pages/Feed";
import AdminFeed from "./pages/admin/AdminFeed";
import FeedPostDetails from "./pages/FeedPostDetails";
import { Toaster } from "./components/ui/toaster";

import usePresencePing from "./hooks/usePresencePing";
import CheckoutPage from "./pages/CheckoutPage";

export default function App() {
  usePresencePing();
  
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <AuthModal />

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/marketplace" element={<Marketplace />} />
        <Route path="/listings/:id" element={<ListingDetails />} />
        <Route path="/checkout/:listingId" element={<CheckoutPage />} />
     

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
</Route>
<Route path="/feed" element={<Feed />} />
<Route path="/feed/:id" element={<FeedPostDetails />} />
<Route path="/pricing" element={<Pricing />} />
      </Routes>

    

      <Footer />
       <Toaster />
    </div>
  );
}