import { IncomingForm } from "formidable";
import { v2 as cloudinary } from "cloudinary";
import { prisma } from "../_lib/prisma.js";
import { requireAuth } from "../_lib/auth.js";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const config = {
  api: { bodyParser: false },
};

async function requireAdmin(req) {
  const decoded = await requireAuth(req);
  const u = await prisma.user.findUnique({
    where: { id: decoded.uid },
    select: { id: true, role: true },
  });
  if (!u || u.role !== "ADMIN") {
    const err = new Error("Admin only");
    err.statusCode = 403;
    throw err;
  }
  return decoded;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ message: "Method not allowed" });
    }

    await requireAdmin(req);

    const form = new IncomingForm({
      multiples: false,
      keepExtensions: true,
      maxFileSize: 200 * 1024 * 1024, // 200MB (adjust if needed)
    });

    const { files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) return reject(err);
        resolve({ fields, files });
      });
    });

    const picked = files?.file;
    const file = Array.isArray(picked) ? picked[0] : picked;

    if (!file) return res.status(400).json({ message: "No file uploaded (field name must be 'file')" });

    const filePath = file.filepath || file.path;
    if (!filePath) return res.status(400).json({ message: "Invalid file payload (missing filepath)" });

    const upload = await cloudinary.uploader.upload(filePath, {
      folder: "mikrobid-streams",
      resource_type: "video",
    });

    return res.status(200).json({
      url: upload.secure_url,
      duration: upload.duration,
      bytes: upload.bytes,
      publicId: upload.public_id,
      format: upload.format,
    });
  } catch (e) {
    return res.status(e.statusCode ?? 500).json({ message: e.message ?? "Upload error" });
  }
}