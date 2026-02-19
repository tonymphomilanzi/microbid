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

function qv(v) {
  return Array.isArray(v) ? v[0] : v;
}

export default async function handler(req, res) {
  try {
    // ---------------------------------------
    // GET /api/upload?intent=sign&resourceType=video&folder=mikrobid-streams
    // Returns a signed payload to upload DIRECTLY to Cloudinary from browser.
    // ---------------------------------------
    if (req.method === "GET") {
      const decoded = await requireAuth(req);

      const url = new URL(req.url, "http://localhost");
      const intent = (url.searchParams.get("intent") || "").toLowerCase();
      if (intent !== "sign") {
        res.setHeader("Allow", "GET, POST");
        return res.status(400).json({ message: "Unsupported intent" });
      }

      const resourceType = (url.searchParams.get("resourceType") || "image").toLowerCase(); // image | video
      const folder = (url.searchParams.get("folder") || "").trim();

      if (!["image", "video"].includes(resourceType)) {
        return res.status(400).json({ message: "resourceType must be image or video" });
      }

      // videos are admin-only
      if (resourceType === "video") await requireAdmin(decoded);

      const safeFolder =
        folder ||
        (resourceType === "video" ? "mikrobid-streams" : "flipearn-marketplace");

      const timestamp = Math.floor(Date.now() / 1000);

      // Cloudinary signature signs params excluding file/api_key/signature
      const signature = cloudinary.utils.api_sign_request(
        { timestamp, folder: safeFolder },
        process.env.CLOUDINARY_API_SECRET
      );

      return res.status(200).json({
        cloudName: process.env.CLOUDINARY_CLOUD_NAME,
        apiKey: process.env.CLOUDINARY_API_KEY,
        timestamp,
        signature,
        folder: safeFolder,
        resourceType,
      });
    }

    // ---------------------------------------
    // POST /api/upload (existing flow)
    // Keep for IMAGES and small uploads.
    // Videos will often fail with 413 on Vercel, so we recommend direct upload.
    // ---------------------------------------
    if (req.method !== "POST") {
      res.setHeader("Allow", "GET, POST");
      return res.status(405).json({ message: "Method not allowed" });
    }

    const decoded = await requireAuth(req);

    const form = new IncomingForm({
      multiples: false,
      keepExtensions: true,
      maxFileSize: 20 * 1024 * 1024, // keep small on serverless; videos should be direct-uploaded
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

    // If someone tries to send video here, block (direct upload required)
    if (isVideo) {
      await requireAdmin(decoded);
      return res.status(400).json({
        message: "Video uploads must be sent directly to Cloudinary (serverless payload limit).",
      });
    }

    const upload = await cloudinary.uploader.upload(filePath, {
      folder: "flipearn-marketplace",
      resource_type: "image",
    });

    return res.status(200).json({
      url: upload.secure_url,
      resourceType: "image",
      bytes: upload.bytes,
      format: upload.format,
      publicId: upload.public_id,
    });
  } catch (e) {
    return res.status(e.statusCode ?? 500).json({ message: e.message ?? "Upload error" });
  }
}