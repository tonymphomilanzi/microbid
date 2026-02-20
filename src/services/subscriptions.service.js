import { api } from "./api";

export const subscriptionsService = {
  // Start a subscription payment
  startPayment: (planName, method) =>
    api.post("/subscriptions", { intent: "startPayment", planName, method }).then((r) => r.data),

  // Get payment details
  getPayment: (paymentId) =>
    api.get("/subscriptions", { params: { paymentId } }).then((r) => r.data),

  // Submit payment confirmation
  submitPayment: ({ paymentId, reference, proofUrl, note }) =>
    api.post("/subscriptions", { intent: "submitPayment", paymentId, reference, proofUrl, note }).then((r) => r.data),

  // List my payments
  listPayments: () => api.get("/subscriptions").then((r) => r.data),
};