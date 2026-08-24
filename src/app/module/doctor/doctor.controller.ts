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

export const DoctorController = {
  applyAsDoctor,
};
