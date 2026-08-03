import { Router } from "express";
import { search } from "../controllers/search.controller";
import { authenticate } from "../middleware/auth.middleware";

const router = Router();

router.use(authenticate);
router.get("/", search);

export default router;