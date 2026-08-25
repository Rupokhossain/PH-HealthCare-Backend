import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import httpStatus from "http-status";
import { DoctorServices } from "./doctor.service";
import { ApplyDoctorValidationZodSchema } from "./doctor.validation";

const applyAsDoctor = catchAsync(async (req: Request, res: Response) => {
  // const resume = req.file;

  // const additionalFiles = req.files

  // const data = req.body;

  const files = req.files as { [fieldname: string]: Express.Multer.File[] };

  const resume = files?.["resume"] ? files["resume"][0] : null;
  const additionalFiles = files?.["additionalFiles"] || [];

  const data = JSON.parse(req.body.data);

  const validatedData = ApplyDoctorValidationZodSchema.parse(data);
  console.log({ resume, additionalFiles, validatedData });

  const result = await DoctorServices.applyDoctor(
    validatedData,
    resume,
    additionalFiles,
  );
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Applied As Doctor Successfully",
    data: result,
  });
});

const verifyDoctorEmail = catchAsync(async (req: Request, res: Response) => {
  const payload = req.body;

  const result = await DoctorServices.verifyDoctorEmail(payload);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Doctor Email Verified Successfully",
    data: result,
  });
});

const approveDoctor = catchAsync(async (req: Request, res: Response) => {
  const payload = req.body;
  const user = req.user!;

  const result = await DoctorServices.approveDoctor(payload, user);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Doctor Email Verified Successfully",
    data: result,
  });
});

const getAllDoctors = catchAsync(async (req: Request, res: Response) => {
  const { data, meta } = await DoctorServices.getAllDoctors(req.query);
  sendResponse(res, {
    statusCode: httpStatus.OK,
    success: true,
    message: "Doctors Retrived Successfully",
    data: data,
    meta: meta,
  });
});

export const DoctorController = {
  applyAsDoctor,
  verifyDoctorEmail,
  approveDoctor,
  getAllDoctors,
};
