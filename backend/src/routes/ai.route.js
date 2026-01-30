import express from "express";
import { generateSmartReplies } from "../controllers/ai.controller.js";
import { protectRoute } from "../middleware/auth.middleware.js";

const router = express.Router();

router.post("/reply", protectRoute, generateSmartReplies);

export default router;
