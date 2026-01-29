import { Route, Routes } from "react-router-dom";
import Navbar from "./components/layout/Navbar";
import Footer from "./components/layout/Footer";
import Home from "./pages/Home";
import Marketplace from "./pages/Marketplace";
import ListingDetails from "./pages/ListingDetails";
import Dashboard from "./pages/Dashboard";
import CreateListing from "./pages/CreateListing";
import ProtectedRoute from "./components/auth/ProtectedRoute";
import AuthModal from "./components/auth/AuthModal";

export default function App() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Navbar />
      <AuthModal />

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/marketplace" element={<Marketplace />} />
        <Route path="/listings/:id" element={<ListingDetails />} />

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
      </Routes>

      <Footer />
    </div>
  );
}