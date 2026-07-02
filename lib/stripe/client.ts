import Stripe from "stripe";

if (!process.env.STRIPE_SECRET_KEY) {
  throw new Error("STRIPE_SECRET_KEY is not set");
}

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: "2024-10-28.acacia",
  typescript: true,
  appInfo: {
    name: "Múul",
    version: "0.1.0",
    url: "https://muul.mx",
  },
});
