import { api } from "./api";

export const feedService = {
  listPublic: (params) =>
    api.get("/me", { params: { public: "feed", ...params } }).then((r) => r.data),

  unreadCount: () =>
    api.get("/me", { params: { feedUnread: "1" } }).then((r) => r.data),

  markSeen: () =>
    api.post("/me", { intent: "markFeedSeen" }).then((r) => r.data),
};