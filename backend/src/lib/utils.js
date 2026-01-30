import jwt from "jsonwebtoken";
import { ENV } from "./env.js";

export const generateToken = (userId, res) => {
  const { JWT_SECRET, NODE_ENV } = ENV;

  if (!JWT_SECRET) {
    throw new Error("JWT_SECRET is not configured");
  }

  const token = jwt.sign({ userId }, JWT_SECRET, {
    expiresIn: "7d",
  });

  res.cookie("jwt", token, {
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    httpOnly: true,                  // prevent XSS
    sameSite: NODE_ENV === "development" ? "lax" : "none", // allow cross-site in prod
    secure: NODE_ENV !== "development", // must be true for sameSite "none"
  });

  return token;
};
