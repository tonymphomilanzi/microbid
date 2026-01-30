import { api } from "./api";

export const chatService = {
  list: () => api.get("/chat").then((r) => r.data),
  getByListing: (listingId) => api.get("/chat", { params: { listingId } }).then((r) => r.data),
  openOrSendToListing: ({ listingId, text }) =>
    api.post("/chat", { listingId, text }).then((r) => r.data),

  getConversation: (id) => api.get(`/chat/${id}`).then((r) => r.data),
  sendToConversation: ({ id, text }) => api.post(`/chat/${id}`, { text }).then((r) => r.data),
};