import { api } from "./api";

export const pagesService = {
  getPage: (slug) => api.get("/pages", { params: { slug } }).then((r) => r.data),
};