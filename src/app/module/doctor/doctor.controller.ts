import { Request, Response } from "express";
import { catchAsync } from "../../utils/catchAsync";
import { sendResponse } from "../../utils/sendResponse";
import httpStatus from "http-status";
import { DoctorServices } from "./doctor.service";

const applyAsDoctor = catchAsync(async (req: Request, res: Response) => {
  // const resume = req.file;

  // const additionalFiles = req.files

  // const data = req.body;

  const files = req.files as { [fieldname: string]: Express.Multer.File[] };

  const resume = files?.["resume"] ? files["resume"][0] : null;
  const additionalFiles = files?.["additionalFiles"] || [];

  //   const data = req.body.data;
  const data = JSON.parse(req.body.data);

  console.log({ resume, additionalFiles, data });

  const result = await DoctorServices.applyDoctor(
    data,
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
