import { api } from "./api";

export const feedService = {
  listPublic: (params) =>
    api.get("/me", { params: { public: "feed", ...params } }).then((r) => r.data),

  getPost: (id) =>
    api.get("/me", { params: { public: "feed", id } }).then((r) => {
      const post = r.data?.posts?.[0] ?? null;
      return { post };
    }),

  toggleLike: (postId) =>
    api.post("/me", { intent: "toggleFeedLike", postId }).then((r) => r.data),

  addComment: (postId, body) =>
    api.post("/me", { intent: "addFeedComment", postId, body }).then((r) => r.data),

  unreadCount: () =>
    api.get("/me", { params: { feedUnread: "1" } }).then((r) => r.data),

  markSeen: () =>
    api.post("/me", { intent: "markFeedSeen" }).then((r) => r.data),
  editComment: (commentId, body) =>
  api.post("/me", { intent: "editFeedComment", commentId, body }).then((r) => r.data),

deleteComment: (commentId) =>
  api.post("/me", { intent: "deleteFeedComment", commentId }).then((r) => r.data),
};