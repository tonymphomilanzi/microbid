import formidable from "formidable";
import { v2 as cloudinary } from "cloudinary";
import { requireAuth } from "./_lib/auth.js";

export const config = {
  api: { bodyParser: false },
};

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed" });

    await requireAuth(req); // prevent anonymous abuse

    const form = formidable({ multiples: false });

    const { files } = await new Promise((resolve, reject) => {
      form.parse(req, (err, fields, files) => (err ? reject(err) : resolve({ fields, files })));
    });

    const file = files.file;
    if (!file) return res.status(400).json({ message: "No file uploaded" });

    const upload = await cloudinary.uploader.upload(file.filepath, {
      folder: "Microbid-marketplace",
      resource_type: "image",
    });

    return res.status(200).json({ url: upload.secure_url });
  } catch (e) {
    return res.status(e.statusCode ?? 500).json({ message: e.message ?? "Upload error" });
  }
}