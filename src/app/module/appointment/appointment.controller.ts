import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import httpStatus from "http-status"
import { AppointementServices } from "./appointment.service";

const bookAppointment = catchAsync(async (req: Request, res: Response) => {

  const result = await AppointementServices.bookAppointment()

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User profile fetched successfully",
    data: result,
  });
});


const bookiAppointmentCallback = catchAsync(async (req: Request, res: Response) => {


  console.log(req.query, "req.query")

  const result = await AppointementServices.bookiAppointmentCallback()

  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "User profile fetched successfully",
    data: result,
  });
});

export const AppointementController = {
    bookAppointment,
    bookiAppointmentCallback
}