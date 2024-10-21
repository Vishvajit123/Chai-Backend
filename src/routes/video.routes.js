import { Router } from "express";
import { upload } from "../middlewares/multer.middleware.js";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import { getAllVideos, getUserVideos } from "../controllers/video.controller.js";

const router = Router();

router.route("/").get(getAllVideos);
router.route("/:id").get(getUserVideos);

router.route("/").post(verifyJWT,
    upload.fields([
        {
            name: "videoFile",
            maxCount: 1
        },
        {
            name: "thubnail",
            maxCount: 1
        }
    ]),
    // publishAVideo
);

export default router;