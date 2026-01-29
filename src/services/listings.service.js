import { api } from "./api";

export const listingsService = {
  getListings: (params) => api.get("/listings", { params }).then((r) => r.data),
  getListing: (id) => api.get(`/listings/${id}`).then((r) => r.data),
  upsertListing: (payload) => api.post("/listings", payload).then((r) => r.data),
  deleteListing: (id) => api.delete(`/listings/${id}`).then((r) => r.data),
  uploadImage: (formData) =>
    api.post("/upload", formData, { headers: { "Content-Type": "multipart/form-data" } }).then((r) => r.data),
  me: () => api.get("/me").then((r) => r.data),
  checkout: (listingId) => api.post("/listings", { intent: "checkout", listingId }).then((r) => r.data),
};