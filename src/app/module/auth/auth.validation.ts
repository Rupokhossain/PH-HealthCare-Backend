import { z } from "zod";

export const PatientRegistration = z.object({
  name: z.string(),
  email: z.email(),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters long.")
    .max(32, "Password cannot exceed 32 characters.")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter.")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter.")
    .regex(/[0-9]/, "Password must contain at least one number.")
    .regex(
      /[^A-Za-z0-9]/,
      "Password must contain at least one special character.",
    ),
  patient: z
    .object({
      contactNumber: z.string().optional(),
      age: z.number(),
    })
    .optional(),
});

export const PatientEmailVerifyZodSchema = z.object({
  email: z.email(),
  otp: z.string().length(6)
  

});

export const LoginvalidationSchema = z.object({
  email: z.email(),
  password: z
    .string()
    .min(6, "Password must be at least 6 characters long.")
    .max(32, "Password cannot exceed 32 characters.")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter.")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter.")
    .regex(/[0-9]/, "Password must contain at least one number.")
    .regex(
      /[^A-Za-z0-9]/,
      "Password must contain at least one special character.",
    ),
});

export const ForgotPasswordZodSchema = z.object({
  email: z.email(),
});

export const ResetPasseordZodSchema = z.object({
  email: z.email(),
  newPassword: z
    .string()
    .min(6, "Password must be at least 6 characters long.")
    .regex(/[A-Z]/, "Password must contain at least one uppercase letter.")
    .regex(/[a-z]/, "Password must contain at least one lowercase letter.")
    .regex(/[0-9]/, "Password must contain at least one number.")
    .regex(
      /[^A-Za-z0-9]/,
      "Password must contain at least one special character.",
    ),
  otp: z.string().length(6),
});