import { api } from "./api";

export const adminService = {
  // Users
  getUsers: (params) => api.get("/admin/users", { params }).then((r) => r.data),
  updateUser: (id, payload) => api.patch(`/admin/users/${id}`, payload).then((r) => r.data),

  // Listings
  getListings: (params) => api.get("/admin/listings", { params }).then((r) => r.data),
  deleteListing: (id) => api.delete(`/admin/listings/${id}`).then((r) => r.data),
  updateListing: (id, payload) => api.patch(`/admin/listings/${id}`, payload).then((r) => r.data),

  // Platforms
  getPlatforms: () => api.get("/admin/platforms").then((r) => r.data),
  createPlatform: (payload) => api.post("/admin/platforms", payload).then((r) => r.data),
  updatePlatform: (id, payload) => api.patch(`/admin/platforms/${id}`, payload).then((r) => r.data),
  deletePlatform: (id) => api.delete(`/admin/platforms/${id}`).then((r) => r.data),

  // Categories
  getCategories: () => api.get("/admin/categories").then((r) => r.data),
  createCategory: (payload) => api.post("/admin/categories", payload).then((r) => r.data),
  updateCategory: (id, payload) => api.patch(`/admin/categories/${id}`, payload).then((r) => r.data),
  deleteCategory: (id) => api.delete(`/admin/categories/${id}`).then((r) => r.data),
};