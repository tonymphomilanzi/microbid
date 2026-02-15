import Stripe from "stripe";

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;

  if (!key) {
    const err = new Error("STRIPE_SECRET_KEY is missing");
    err.statusCode = 500;
    throw err;
  }

  return new Stripe(key, {
    apiVersion: "2024-06-20",
  });
}
