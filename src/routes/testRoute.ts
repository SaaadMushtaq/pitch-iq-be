import { Router } from "express";
import type { Request, Response } from "express";
import { authMiddleware } from "../middleware/authMiddleware.js";

const router = Router();

router.get("/", authMiddleware, (req: Request, res: Response) => {
  res.json({ message: "You are authenticated!", user: req.user });
});

export default router;
