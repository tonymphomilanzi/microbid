import { prisma } from "../../_lib/prisma.js";
import { requireAdmin } from "../../_lib/adminOnly.js";

function readJson(req) {
  const b = req.body;
  if (!b) return {};
  if (typeof b === "object") return b;
  if (Buffer.isBuffer(b)) return JSON.parse(b.toString("utf8"));
  if (typeof b === "string") return JSON.parse(b);
  return {};
}

const addDays = (d, days) => new Date(d.getTime() + days * 24 * 60 * 60 * 1000);

export default async function handler(req, res) {
  try {
    await requireAdmin(req);

    const rawId = req.query?.id;
    const id = Array.isArray(rawId) ? rawId[0] : rawId;

    const escrow = await prisma.escrowTransaction.findUnique({ where: { id } });
    if (!escrow) return res.status(404).json({ message: "Escrow not found" });

    if (req.method !== "POST") {
      res.setHeader("Allow", "POST");
      return res.status(405).json({ message: "Method not allowed" });
    }

    const { action } = readJson(req);
    const AUTO_RELEASE_DAYS = Number(process.env.ESCROW_AUTO_RELEASE_DAYS || "2");

    if (action === "markFeePaid") {
      const updated = await prisma.escrowTransaction.update({
        where: { id },
        data: { status: "FEE_PAID", fundedAt: new Date() },
      });
      return res.status(200).json({ escrow: updated });
    }

    if (action === "markFullyPaid") {
      const updated = await prisma.escrowTransaction.update({
        where: { id },
        data: { status: "FULLY_PAID", fundedAt: new Date() },
      });
      return res.status(200).json({ escrow: updated });
    }

    if (action === "start7DayWait") {
      const updated = await prisma.escrowTransaction.update({
        where: { id },
        data: { status: "WAITING_7_DAYS", ownershipReadyAt: addDays(new Date(), 7) },
      });
      return res.status(200).json({ escrow: updated });
    }

    if (action === "markReadyForFinalTransfer") {
      const updated = await prisma.escrowTransaction.update({
        where: { id },
        data: { status: "READY_FOR_FINAL_TRANSFER" },
      });
      return res.status(200).json({ escrow: updated });
    }

    if (action === "markTransferredToBuyer") {
      const updated = await prisma.escrowTransaction.update({
        where: { id },
        data: {
          status: "TRANSFERRED_TO_BUYER",
          autoReleaseAt: addDays(new Date(), AUTO_RELEASE_DAYS),
        },
      });
      return res.status(200).json({ escrow: updated });
    }

    if (action === "release") {
      const updated = await prisma.escrowTransaction.update({
        where: { id },
        data: { status: "RELEASED", releasedAt: new Date() },
      });
      return res.status(200).json({ escrow: updated });
    }

    return res.status(400).json({ message: "Unknown action" });
  } catch (e) {
    return res.status(e.statusCode ?? 500).json({ message: e.message ?? "Error" });
  }
}