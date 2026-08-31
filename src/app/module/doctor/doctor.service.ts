import { UploadApiResponse } from "cloudinary";
import { prisma } from "../../lib/prisma";
import { cloudinary } from "../../lib/cloudinary";
import bcrypt from "bcryptjs";
import config from "../../config";
import {
  DoctorVerficationStatus,
  Role,
  ScheduleStatus,
} from "../../../generated/prisma/enums";
import crypto from "crypto";
import { redisClient } from "../../lib/redis";
import path from "path";
import ejs from "ejs";
import { transporter } from "../../lib/nodemailer";
import {
  IApplyAsDoctorPayload,
  IApproveDoctorPayload,
  IUpdateDoctorProfilePayload,
  IVerifyDoctorEmailPayload,
} from "./doctor.interface";
import { RequestUser } from "../../middleware/checkAuth";
import { IQuery } from "../../interfaces";
import { DoctorWhereInput } from "../../../generated/prisma/models";
import { addDays, startOfDay } from "date-fns";
import { AppError } from "../../utils/AppError";
import httpStatus from "http-status";


const applyDoctor = async (
  payload: IApplyAsDoctorPayload,
  resume: Express.Multer.File | null,
  additionalFiles: Express.Multer.File[],
) => {
  const isUserExists = await prisma.user.findUnique({
    where: {
      email: payload?.user?.email,
    },
  });

  if (isUserExists) {
    throw new Error("User Already Exists With This Email");
  }

  const resumeUploadResult = await new Promise<UploadApiResponse>(
    (resolve, reject) => {
      cloudinary.uploader
        .upload_stream(
          {
            resource_type: "auto",
          },

          async (error, result) => {
            if (error) {
              return reject(error);
            }

            if (!result) {
              return reject(new Error("No Result Returened from Cloudinary"));
            }

            resolve(result);
          },
        )
        .end(resume?.buffer);
    },
  );

  const additionalFilesUploadResults = await Promise.all(
    additionalFiles.map((file) => {
      return new Promise<UploadApiResponse>((resolve, reject) => {
        cloudinary.uploader
          .upload_stream(
            {
              resource_type: "auto",
            },

            async (error, result) => {
              if (error) {
                return reject(error);
              }
              if (!result) {
                return reject(new Error("No result returned from cloudinary"));
              }

              resolve(result);
            },
          )
          .end(file.buffer);
      });
    }),
  );

  const randomDoctorPassword = Math.random().toString(36).slice(-8);

  const hashedPassword = await bcrypt.hash(
    randomDoctorPassword,
    Number(config.bcrypt_salt_rounds),
  );

  const doctorApplication = await prisma.user.create({
    data: {
      ...payload.user,
      password: hashedPassword,
      role: Role.DOCTOR,
      needPasswordChange: true,

      doctor: {
        create: {
          name: payload.user.name,
          email: payload.user.email,

          // address: payload.address,
          // specialization: payload.specialization,
          // licenseNumber: payload.licenseNumber,
          // qualifications: payload.qualifications,
          // experienceYears: payload.experienceYears,
          // bio: payload.bio,
          // consultationFee: payload.consultationFee,
          // contactNumber: payload.contactNumber,

          ...payload.doctor,

          resume: resumeUploadResult.secure_url,
          resumePublicId: resumeUploadResult.public_id,

          additionalFiles: additionalFilesUploadResults.map((file) => ({
            url: file.secure_url,
            publicId: file.public_id,
          })),
        },
      },
    },

    include: {
      doctor: true,
    },
  });

  const expirationSeconds = 60 * 60;

  const otpKey = `doctor-application-otp:${payload.user.email}`;
  const otpValue = crypto.randomInt(100000, 1000000).toString();

  await redisClient.set(otpKey, otpValue, {
    expiration: {
      type: "EX",
      value: expirationSeconds,
    },
  });

  const templatePath = path.join(
    process.cwd(),
    "src/app/templates/registration-user-otp.ejs",
  );

  const html = await ejs.renderFile(templatePath, {
    name: payload.user.name,
    email: payload.user.email,
    otp: otpValue,
    expirationSeconds: expirationSeconds / 60,
  });

  await transporter.sendMail({
    from: config.email_sender,
    to: payload.user.email,
    subject: "Doctor Application - Email Verfication",
    html,
  });

  return doctorApplication;
};

const verifyDoctorEmail = async (payload: IVerifyDoctorEmailPayload) => {
  const otp = payload.otp;
  const email = payload.email.trim().toLowerCase();

  const existingUser = await prisma.user.findUnique({
    where: {
      email,
      role: Role.DOCTOR,
    },
  });

  if (!existingUser) {
    throw new Error("Doctor Application Not Found. Please Apply Again");
  }

  if (existingUser.emailVerified) {
    throw new Error("Email Already Verified");
  }

  const otpKey = `doctor-application-otp:${email}`;
  const redisOtp = await redisClient.get(otpKey);

  if (!redisOtp) {
    throw new Error(
      "OTP Expired. Your Application Window Has Closed, Please Apply Again.",
    );
  }

  if (redisOtp !== otp) {
    throw new Error("OTP Does Not Match");
  }

  await redisClient.del(otpKey);

  const verifiedUser = await prisma.user.update({
    where: { id: existingUser.id },
    data: { emailVerified: true },
    omit: { password: true },
    include: { doctor: true },
  });

  return verifiedUser;
};

const approveDoctor = async (
  payload: IApproveDoctorPayload,
  reviewer: RequestUser,
) => {
  const { doctorId, verificationStatus, rejectionReason } = payload;

  const existingDoctor = await prisma.doctor.findUnique({
    where: { id: doctorId },
    include: { user: true },
  });

  if (!existingDoctor) {
    throw new Error("Doctor Application Not Found");
  }

  if (existingDoctor.isDeleted) {
    throw new Error("Doctor Application Has Been Deleted");
  }

  if (!existingDoctor.user.emailVerified) {
    throw new Error(
      "Doctor Has Not Verified Their Email Yet. Application Cannot Be Reviewed.",
    );
  }

  if (existingDoctor.verficationStatus !== DoctorVerficationStatus.PENDING) {
    throw new Error(
      `Doctor Application Has Already Been ${existingDoctor.verficationStatus.toLowerCase()}`,
    );
  }

  if (
    verificationStatus === DoctorVerficationStatus.REJECTED &&
    !rejectionReason
  ) {
    throw new Error(
      "Rejection Reason Is Required When Rejecting A Doctor Application",
    );
  }

  const updatedDoctor = await prisma.doctor.update({
    where: { id: doctorId },
    data: {
      verificationStatus,
      rejectionReason:
        verificationStatus === DoctorVerficationStatus.REJECTED
          ? rejectionReason
          : null,
      reviewdBy: reviewer.userId,
      reviewedAt: new Date(),
    },
  });

  const isApproved = verificationStatus === DoctorVerficationStatus.APPROVED;

  const templatePath = path.join(
    process.cwd(),
    `src/app/templates/${
      isApproved
        ? "doctor-application-approved.ejs"
        : "doctor-application-rejected.ejs"
    }`,
  );

  const html = await ejs.renderFile(templatePath, {
    name: updatedDoctor.name,
    reason: updatedDoctor.rejectionReason,
  });

  await transporter.sendMail({
    from: config.email_sender,
    to: updatedDoctor.email,
    subject: isApproved
      ? "Your Doctor Application Has Been Approved"
      : "Your Doctor Application Has Been Rejected",
    html,
  });

  return updatedDoctor;
};

const getAllDoctors = async (query: IQuery) => {
  const limit = query.limit ? Number(query.limit) : 10;
  const page = query.page ? Number(query.page) : 1;
  const skip = (page - 1) * limit;
  const sortBy = query.sortBy ? query.sortBy : "createdAt";
  const sortOrder = query.sortOrder ? query.sortOrder : "desc";

  const andConditions: DoctorWhereInput[] = [];

  // searching
  if (query.searchTerm) {
    andConditions.push({
      OR: [
        {
          name: {
            contains: query.searchTerm,
            mode: "insensitive",
          },
        },
        {
          email: {
            contains: query.searchTerm,
            mode: "insensitive",
          },
        },
        {
          specialization: {
            contains: query.searchTerm,
            mode: "insensitive",
          },
        },
        {
          licenseNumber: {
            contains: query.searchTerm,
            mode: "insensitive",
          },
        },
      ],
    });
  }

  // filtering
  if (query.specialization) {
    andConditions.push({
      specialization: {
        equals: query.specialization,
        mode: "insensitive",
      },
    });
  }

  if (query.email) {
    andConditions.push({
      specialization: {
        contains: query.email,
        mode: "insensitive",
      },
    });
  }

  if (query.licenseNumber) {
    andConditions.push({
      licenseNumber: { equals: query.licenseNumber, mode: "insensitive" },
    });
  }

  if (query.verificationStatus) {
    andConditions.push({
      verficationStatus: query.verificationStatus as DoctorVerficationStatus,
    });
  }

  if (query.isDeleted) {
    andConditions.push({
      isDeleted: query.isDeleted === "true" ? true : false,
    });
  }

  const allDoctors = await prisma.doctor.findMany({
    where: {
      AND: andConditions.length > 0 ? andConditions : undefined,
    },

    take: limit,
    skip: skip,

    orderBy: {
      [sortBy]: sortOrder,
    },
    include: {
      user: {
        omit: {
          password: true,
        },
      },
      // schedules: true,
      // appointments: true
      // prescriptions: true
    },
  });

  const totalDoctorCount = await prisma.doctor.count({
    where: {
      AND: andConditions,
    },
  });

  return {
    data: allDoctors,
    meta: {
      page: page,
      limit: limit,
      total: totalDoctorCount,
      totalPages: Math.ceil(totalDoctorCount / limit),
    },
  };
};

const updateDoctorProfile = async (payload : IUpdateDoctorProfilePayload, user : RequestUser) => {
	const existingDoctor = await prisma.doctor.findUnique({
		where: { userId: user.userId },
	});

	if (!existingDoctor) {
		throw new AppError(httpStatus.NOT_FOUND, "Doctor Profile Not Found");
	}

	const updatedDoctor = await prisma.doctor.update({
		where: { id: existingDoctor.id },
		data: payload,
	});

	return updatedDoctor;

}

// Fields safe to expose on the public (unauthenticated) doctor-discovery endpoints.
// Deliberately excludes resume/additionalFiles, verification review metadata, and
// anything relation/auth related (user, userId, isDeleted, deletedAt...).

const getAvailableDoctorByTodaysSchedule = async (query: IQuery) => {
  const limit = query.limit ? Number(query.limit) : 10;
  const page = query.page ? Number(query.page) : 1;
  const skip = (page - 1) * limit;
  const sortBy = query.sortBy ? query.sortBy : "createdAt";
  const sortOrder = query.sortOrder ? query.sortOrder : "desc";

  const now = new Date();
  const startOfToday = startOfDay(now);
  const startOfTomorrow = addDays(startOfToday, 1);

  // A doctor is "available today" if they have at least one published,
  // not-yet-started schedule today with open slots left.

  const andConditions: DoctorWhereInput[] = [
    { isDeleted: false },
    { verficationStatus: DoctorVerficationStatus.APPROVED },
    {
      schedules: {
        some: {
          isDeleted: false,
          status: ScheduleStatus.PUBLISHED,
          availableSlots: { gt: 0 },
          startDateTime: {
            gte: startOfToday,
            lt: startOfTomorrow,
            gt: now,
          },
        },
      },
    },
  ];

  if (query.searchTerm) {
    andConditions.push({
      OR: [
        { name: { contains: query.searchTerm, mode: "insensitive" } },
        { specialization: { contains: query.searchTerm, mode: "insensitive" } },
      ],
    });
  }

  if (query.specialization) {
    andConditions.push({
      specialization: { equals: query.specialization, mode: "insensitive" },
    });
  }

  const availableDoctors = await prisma.doctor.findMany({
    where: {
      AND: andConditions,
    },

    take: limit,
    skip,

    orderBy: {
      [sortBy]: sortOrder,
    },

    select: {
      id: true,
      name: true,
      specialization: true,
      licenseNumber: true,
      qualifications: true,
      experienceYears: true,
      bio: true,
      consultationFee: true,
      createdAt: true,
      schedules: {
        where: {
          isDeleted: false,
          status: ScheduleStatus.PUBLISHED,
          availableSlots: { gt: 0 },
          startDateTime: {
            gte: startOfToday,
            lt: startOfTomorrow,
            gt: now,
          },
        },
        orderBy: { [sortBy]: sortOrder },
        select: {
          id: true,
          startDateTime: true,
          endDateTime: true,
          availableSlots: true,
          totalSlots: true,
        },
      },
    },
  });

  const totalAvailableDoctorCount = await prisma.doctor.count({
    where: { AND: andConditions },
  });

  return {
    data: availableDoctors,
    meta: {
      page,
      limit,
      total: totalAvailableDoctorCount,
      totalPages: Math.ceil(totalAvailableDoctorCount / limit),
    },
  };
};

const getAllDoctorsListPublic = async (query: IQuery) => {
  const limit = query.limit ? Number(query.limit) : 10;
  const page = query.page ? Number(query.page) : 1;
  const skip = (page - 1) * limit;
  const sortBy = query.sortBy ? query.sortBy : "createdAt";
  const sortOrder = query.sortOrder ? query.sortOrder : "desc";

  const andConditions: DoctorWhereInput[] = [
    { isDeleted: false },
    { verficationStatus: DoctorVerficationStatus.APPROVED },
  ];

  if (query.searchTerm) {
    andConditions.push({
      OR: [
        { name: { contains: query.searchTerm, mode: "insensitive" } },
        { specialization: { contains: query.searchTerm, mode: "insensitive" } },
        { qualifications: { contains: query.searchTerm, mode: "insensitive" } },
      ],
    });
  }

  if (query.specialization) {
    andConditions.push({
      specialization: { equals: query.specialization, mode: "insensitive" },
    });
  }

  const allDoctors = await prisma.doctor.findMany({
    where: {
      AND: andConditions,
    },

    take: limit,
    skip,

    orderBy: {
      [sortBy]: sortOrder,
    },

    select: {
      id: true,
      name: true,
      specialization: true,
      licenseNumber: true,
      qualifications: true,
      experienceYears: true,
      bio: true,
      consultationFee: true,
      createdAt: true,
    },
  });

  const totalDoctorCount = await prisma.doctor.count({
    where: { AND: andConditions },
  });

  return {
    data: allDoctors,
    meta: {
      page,
      limit,
      total: totalDoctorCount,
      totalPages: Math.ceil(totalDoctorCount / limit),
    },
  };
};


const getSingleDoctorPublicProfile = async (doctorId: string) => {

	const doctor = await prisma.doctor.findUnique({
		where: {
			id: doctorId,
			isDeleted: false,
			verificationStatus: DoctorVerficationStatus.APPROVED,
		},
		select: {
			id: true,
			name: true,
			specialization: true,
			licenseNumber: true,
			qualifications: true,
			experienceYears: true,
			bio: true,
			consultationFee: true,
			createdAt: true,
		},
	});

	if (!doctor) {
		throw new AppError(httpStatus.NOT_FOUND, "Doctor Not Found");
	}

	return doctor;
}


export const DoctorServices = {
  applyDoctor,
  verifyDoctorEmail,
  approveDoctor,
  getAllDoctors,
  updateDoctorProfile,
  getAvailableDoctorByTodaysSchedule,
  getAllDoctorsListPublic,
  getSingleDoctorPublicProfile
};
