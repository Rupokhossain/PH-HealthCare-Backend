import { Router } from "express";
import { AppointementController } from "./appointment.controller";
import { auth } from "../../middleware/checkAuth";
import { Role } from "../../../generated/prisma/enums";

const router = Router();

router.post("/book-appointment", auth(Role.PATIENT), AppointementController.bookAppointment)
router.post("/pay-appointment", auth(Role.PATIENT), AppointementController.payAppointment)
router.post("/cancel-appointment", auth(Role.PATIENT, Role.ADMIN, Role.SUPER_ADMIN), AppointementController.cancelAppointment)

router.get("/book-appointment/payment/callback", AppointementController.bookiAppointmentCallback)
export const AppointementRoutes = router;
