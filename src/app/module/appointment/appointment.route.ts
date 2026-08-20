import { Router } from "express";
import { AppointementController } from "./appointment.controller";

const router = Router();

router.post("/book-appointment", AppointementController.bookAppointment)

router.get("/book-appointment/payment/callback", AppointementController.bookiAppointmentCallback)
export const AppointementRoutes = router;
