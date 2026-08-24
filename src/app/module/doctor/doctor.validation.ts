import { z } from 'zod';

export const ApplyDoctorValidationZodSchema = z.object({
  user: z.object({
    name: z.string().min(2, "Name must be at least 2 characters"),
    email: z.string().email("Invalid email format"),
  }),
  
  doctor: z.object({
    address: z.string().min(5, "Address is required"),
    specialization: z.string().min(2, "Specialization is required"),
    licenseNumber: z.string().min(2, "License number is required"),
    qualifications: z.string().min(2, "Qualifications are required"),
    experienceYears: z.coerce.number().int().min(0, "Years cannot be negative"),
    bio: z.string().max(500, "Bio must be under 500 characters").optional(),
    consultationFee: z.coerce.number().positive("Fee must be greater than 0"),
    contactNumber: z.string().min(6, "Invalid phone format"),
  })
});
