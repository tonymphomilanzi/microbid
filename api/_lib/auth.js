import admin from "./firebaseAdmin.js";

export async function requireAuth(req) {
  const header = req.headers.authorization || "";
  const [type, token] = header.split(" ");

  if (type !== "Bearer" || !token) {
    const err = new Error("Unauthorized");
    err.statusCode = 401;
    throw err;
  }

  try {
    const decoded = await admin.auth().verifyIdToken(token);
    return decoded; // { uid, email, ... }
  } catch {
    const err = new Error("Invalid token");
    err.statusCode = 401;
    throw err;
  }
}