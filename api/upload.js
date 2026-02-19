import { IncomingForm } from "formidable";
import { v2 as cloudinary } from "cloudinary";
import { prisma } from "./_lib/prisma.js";
import { requireAuth } from "./_lib/auth.js";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const config = {
  api: { bodyParser: false },
};

async function requireAdmin(decoded) {
  const u = await prisma.user.findUnique({
    where: { id: decoded.uid },
    select: { id: true, role: true },
  });
  if (!u || u.role !== "ADMIN") {
    const err = new Error("Admin only");
    err.statusCode = 403;
    throw err;
  }
  return true;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ message: "Method not allowed" });
    }

    const decoded = await requireAuth(req); // must be logged in to upload

    const form = new IncomingForm({
      multiples: false,
      keepExtensions: true,
      maxFileSize: 250 * 1024 * 1024, // allow videos too (adjust if needed)
    });

    const { files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) return reject(err);
        resolve({ fields, files });
      });
    });

    const picked = files?.file;
    const file = Array.isArray(picked) ? picked[0] : picked;

    if (!file) {
      return res.status(400).json({ message: "No file uploaded (field name must be 'file')" });
    }

    const filePath = file.filepath || file.path;
    if (!filePath) return res.status(400).json({ message: "Invalid file payload (missing filepath)" });

    const mimetype = String(file.mimetype || file.type || "").toLowerCase();
    const isVideo = mimetype.startsWith("video/");

    // videos are admin-only
    if (isVideo) await requireAdmin(decoded);

    const upload = await cloudinary.uploader.upload(filePath, {
      folder: isVideo ? "mikrobid-streams" : "flipearn-marketplace",
      resource_type: isVideo ? "video" : "image",
    });

    return res.status(200).json({
      url: upload.secure_url,
      resourceType: isVideo ? "video" : "image",
      bytes: upload.bytes,
      duration: upload.duration,
      format: upload.format,
      publicId: upload.public_id,
    });
  } catch (e) {
    return res.status(e.statusCode ?? 500).json({ message: e.message ?? "Upload error" });
  }
}