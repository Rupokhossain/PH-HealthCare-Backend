import { NextFunction, Request, Response, Router } from "express";
import { Role } from "../../../generated/prisma/enums";
import { auth } from "../../middleware/checkAuth";
import { AuthController } from "./auth.controller";
import {
  ForgotPasswordZodSchema,
  LoginvalidationSchema,
  PatientEmailVerifyZodSchema,
  PatientRegistration,
  ResetPasseordZodSchema,
} from "./auth.validation";
import { validateRequest } from "../../middleware/validateRequest";

const router = Router();

router.post(
  "/register",
  //   (req: Request, res: Response, next: NextFunction) => {
  // 	try {
  // 		// const payload = req.body ? req.body : {}
  // 		const payload = req.body ?? {}

  // 		const result = PatientRegistration.safeParse(payload);

  // 		if(!result.success) {
  // 			console.log(result.error);
  // 			console.log(result.error.issues);

  // 			throw new Error(result.error.issues[0].message)
  // 		}

  // 		req.body = result.data

  // 		next()

  // 	} catch (error) {
  // 		next(error)
  // 	}
  //   },

  validateRequest(PatientRegistration),

  AuthController.registerPatient,
);

router.post(
  "/verify-email",
  validateRequest(PatientEmailVerifyZodSchema),
  AuthController.verifyPatientEmail,
);

router.post(
  "/login",
  validateRequest(LoginvalidationSchema),
  AuthController.loginUser,
);
router.get(
  "/me",
  auth(Role.ADMIN, Role.DOCTOR, Role.PATIENT, Role.SUPER_ADMIN),
  AuthController.getMe,
);
router.post("/refresh-token", AuthController.refreshToken);
router.post("/google", AuthController.googleLogin);
router.post(
  "/forgot-password",
  validateRequest(ForgotPasswordZodSchema),
  AuthController.forgotPassword,
);
router.post(
  "/reset-password",
  validateRequest(ResetPasseordZodSchema),
  AuthController.resetPassword,
);

export const AuthRoutes = router;
