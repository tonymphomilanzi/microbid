// src/services/listings.service.js
import { api } from "./api";

export const listingsService = {
  // Public
  getListings: (params) =>
    api.get("/listings", { params }).then((r) => r.data),

  getListing: (id) =>
    api.get(`/listings/${id}`).then((r) => r.data),

  // Auth required
  upsertListing: (payload) =>
    api.post("/listings", payload).then((r) => r.data),

  deleteListing: (id) =>
    api.delete(`/listings/${id}`).then((r) => r.data),

  // Auth required (Cloudinary upload endpoint)
  // IMPORTANT: do NOT set Content-Type manually; axios will set the correct boundary.
  uploadImage: (formData) =>
    api.post("/upload", formData).then((r) => r.data),

  // Auth required
  me: () =>
    api.get("/me").then((r) => r.data),

  // Auth required (Stripe checkout intent via allowed endpoint list)
  checkout: (listingId) =>
    api.post("/listings", { intent: "checkout", listingId }).then((r) => r.data),

  getPlatforms: () => api.get("/platforms").then(r => r.data),
  getCategories: () => api.get("/categories").then(r => r.data),

  checkUsername: (username) =>
  api.get("/me", { params: { checkUsername: username } }).then((r) => r.data),

setUsername: (username) =>
  api.post("/me", { username }).then((r) => r.data),

getPlansPublic: () => api.get("/me", { params: { public: "plans" } }).then((r) => r.data),

requestUpgrade: (planName) =>
  api.post("/me", { intent: "requestUpgrade", planName }).then((r) => r.data),


  // Listing social (likes/comments)
  toggleListingLike: (listingId) =>
    api.post("/listings", { intent: "toggleListingLike", listingId }).then((r) => r.data),

  listListingComments: (listingId) =>
    api.get("/listings", { params: { public: "listingComments", listingId } }).then((r) => r.data),

  addListingComment: (listingId, body) =>
    api.post("/listings", { intent: "addListingComment", listingId, body }).then((r) => r.data),

  setAvatar: (avatarUrl) =>
  api.post("/me", { intent: "setAvatar", avatarUrl }).then((r) => r.data),
  
  presencePing: () =>
  api.post("/me", { intent: "presencePing" }).then((r) => r.data),

  listListingBids: (listingId) =>
  api.get("/listings", { params: { public: "listingBids", listingId } }).then((r) => r.data),

addListingBid: (listingId, amount) =>
  api.post("/listings", { intent: "addListingBid", listingId, amount }).then((r) => r.data),
};

