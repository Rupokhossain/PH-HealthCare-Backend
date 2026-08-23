import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import httpStatus from "http-status";
import { AppointementServices } from "./appointment.service";

// 1st api
const bookAppointment = catchAsync(async (req: Request, res: Response) => {
  const payload = req.body;
  const user = req.user!;

  const result = await AppointementServices.bookAppointment(payload, user);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Appointment Payment Initiated Successfully!",
    data: result,
  });
});


// 3rd api
const payAppointment = catchAsync(async (req: Request, res: Response) => {
  const payload = req.body;
  const user = req.user!;

  const result = await AppointementServices.payAppointment(payload, user);

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Appointment Payment Initiated Successfully!",
    data: result,
  });
});


// 2nd api
const bookiAppointmentCallback = catchAsync(
  async (req: Request, res: Response) => {
    console.log(req.query, "req.query");

    const { redirecUrl } = await AppointementServices.bookiAppointmentCallback(
      req.query,
    );

    // console.log(executedPaymentResult, "callback controller")

    res.redirect(redirecUrl);

    // sendResponse(res, {
    //   statusCode: httpStatus.OK,
    //   success: true,
    //   message: "User profile fetched successfully",
    //   data: result,
    // });
  },
);

export const AppointementController = {
  bookAppointment,
  payAppointment,
  bookiAppointmentCallback,
};
