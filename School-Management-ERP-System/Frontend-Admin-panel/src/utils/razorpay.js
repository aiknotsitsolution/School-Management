// Minimal Razorpay checkout.js loader + modal helper. Used by the fee
// online-payment page and the subscription upgrade flow (platform gateway).
// The modal returns the payment signature triple which the backend verifies
// before applying any side effects.

let cachedRazorpay = null;

export function loadRazorpay() {
  if (cachedRazorpay) return Promise.resolve(cachedRazorpay);
  if (window.Razorpay) {
    cachedRazorpay = window.Razorpay;
    return Promise.resolve(cachedRazorpay);
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => {
      cachedRazorpay = window.Razorpay;
      resolve(cachedRazorpay);
    };
    script.onerror = () => reject(new Error("Could not load the Razorpay checkout script"));
    document.body.appendChild(script);
  });
}

/**
 * Opens the Razorpay payment modal.
 * @returns Promise resolving to { razorpay_order_id, razorpay_payment_id, razorpay_signature }
 */
export async function openRazorpayCheckout({ keyId, orderId, amount, currency = "INR", name = "School ERP", description = "" }) {
  if (!keyId || !orderId) throw new Error("Razorpay checkout is not configured for this school yet");
  const Razorpay = await loadRazorpay();
  return new Promise((resolve, reject) => {
    const payment = new Razorpay({
      key: keyId,
      amount: Math.round(Number(amount) * 100),
      currency,
      order_id: orderId,
      name,
      description,
      theme: { color: "#4f46e5" },
      handler: (payload) =>
        resolve({
          razorpay_order_id: payload.razorpay_order_id,
          razorpay_payment_id: payload.razorpay_payment_id,
          razorpay_signature: payload.razorpay_signature,
        }),
      modal: { ondismiss: () => reject(new Error("Payment modal was closed")) },
    });
    payment.on("payment.failed", (resp) => {
      reject(new Error(resp?.error?.description || "Payment failed"));
    });
    payment.open();
  });
}