import { Router } from "express";
import { DoctorController } from "./doctor.controller";
import { upload } from "../../lib/multer";

const router = Router();

router.post(
  "/apply-as-doctor",

  //   upload.single("resume"),  // can't working this process
  //   upload.array("additionalFiles"),  // can't working this process

  upload.fields([
    {
      name: "resume",
      maxCount: 1,
    },
    {
      name: "additionalFiles",
      maxCount: 10,
    },
  ]),

  DoctorController.applyAsDoctor,
);

export const DoctorRoutes = router;
