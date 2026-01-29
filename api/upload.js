import { IncomingForm } from "formidable";
import { v2 as cloudinary } from "cloudinary";
import { requireAuth } from "./_lib/auth.js";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const config = {
  api: { bodyParser: false }, // ok to keep
};

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ message: "Method not allowed" });
    }

    await requireAuth(req); // must be logged in to upload

    const form = new IncomingForm({
      multiples: false,
      keepExtensions: true,
    });

    const { files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => {
        if (err) return reject(err);
        resolve({ fields, files });
      });
    });

    // Formidable can return an array or a single file
    const picked = files?.file;
    const file = Array.isArray(picked) ? picked[0] : picked;

    if (!file) return res.status(400).json({ message: "No file uploaded (field name must be 'file')" });

    const filePath = file.filepath || file.path; // filepath (v3), path (older)
    if (!filePath) return res.status(400).json({ message: "Invalid file payload (missing filepath)" });

    const upload = await cloudinary.uploader.upload(filePath, {
      folder: "flipearn-marketplace",
      resource_type: "image",
    });

    return res.status(200).json({ url: upload.secure_url });
  } catch (e) {
    return res.status(e.statusCode ?? 500).json({ message: e.message ?? "Upload error" });
  }
}
