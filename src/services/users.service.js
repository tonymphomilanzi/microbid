// services/users.service.js
import axios from "axios";

export const usersService = {
  publicProfile(username) {
    return axios
      .get("/api/users/public-profile", { params: { username } })
      .then((r) => r.data);
  },
};