// utils/paths.js
export function userProfilePath(user, { prefer = "username" } = {}) {
  const u = user || {};
  if (prefer === "username" && u.username) {
    return `/users/${encodeURIComponent(u.username)}`; // change to /u/ or /@ if you prefer
  }
  if (u.id) {
    return `/users/id/${encodeURIComponent(u.id)}`;
  }
  return null; // can't link
}