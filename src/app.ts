import cookieParser from "cookie-parser";
import cors from "cors";
import express, {
  NextFunction,
  type Application,
  type Request,
  type Response,
} from "express";
import httpStatus from "http-status";
import config from "./app/config";
import { globalErrorHandler } from "./app/middleware/globalErrorHandler";
import { notFound } from "./app/middleware/notFound";
import { AuthRoutes } from "./app/module/auth/auth.route";
import z from "zod";
import { redisClient } from "./app/lib/redis";
import { UserRoutes } from "./app/module/user/user.route";
import { getBkashIdToken } from "./app/lib/bkash";
import { DoctorRoutes } from "./app/module/doctor/doctor.route";
import { AppointmentRoutes } from "./app/module/appointment/appointment.route";
import { ScheduleRoutes } from "./app/module/schedule/schedule.route";
import { PaymentRoutes } from "./app/module/payment/payment.route";
import { PrescriptionRoutes } from "./app/module/prescription/prescription.route";
import { AnalyticsRoutes } from "./app/module/analytics/analytics.route";

const app: Application = express();

app.use(
  cors({
    origin: config.frontend_url,
    credentials: true,
  }),
);

// Enable URL-encoded form data parsing
app.use(express.urlencoded({ extended: true }));

// Middleware to parse JSON bodies
app.use(express.json());
app.use(cookieParser());

app.use("/api/v1/auth", AuthRoutes);

app.use("/api/v1/user", UserRoutes);

app.use("/api/v1/appointment", AppointmentRoutes);

app.use("/api/v1/doctor", DoctorRoutes)

app.use("/api/v1/schedule", ScheduleRoutes);
app.use("/api/v1/payment", PaymentRoutes);
app.use("/api/v1/prescription", PrescriptionRoutes);
app.use("/api/v1/analytics", AnalyticsRoutes);

// Basic route

app.post("/zod", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const UserZodSchema = z.object({
      name: z.string(),
      email: z.string(),
      age: z.number().optional(),
      isVerified: z.boolean().optional(),
      books: z.array(z.string()).optional(),
    });

    const payload = req.body;

    const result = UserZodSchema.safeParse(payload);

    console.log(result);

    res.status(httpStatus.OK).json({
      success: true,
      message: "Welcome to PH Healthcare System Backend",
      data: result,
    });
  } catch (error) {
    next(error);
  }
});


app.get("/test", async (req: Request, res: Response, next: NextFunction) => {
  try {
  
    // await redisClient.set("forget-password-otp:patient1@gmail.com", "123456", {
    //   expiration: {
    //     type: "EX",
    //     value: 60
    //   }
    // })

    const grantIdTokenResult = await getBkashIdToken()

    console.log(grantIdTokenResult);

    res.status(httpStatus.OK).json({
      success: true,
      message: "Welcome to PH Healthcare System Backend",
      data: null,
    });
  } catch (error) {
    next(error);
  }
});

app.get("/", async (req: Request, res: Response) => {
  res.status(httpStatus.OK).json({
    success: true,
    message: "Welcome to PH Healthcare System Backend",
  });
});

app.use(globalErrorHandler);
app.use(notFound);

export default app;
