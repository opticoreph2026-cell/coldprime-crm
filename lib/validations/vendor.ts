import { z } from "zod";
import { optDate, optEmail, optNumber, optString } from "./index";

export const vendorCreateSchema = z.object({
  name: z.string().trim().min(1, "Vendor name is required").max(200),
  category: optString(100),
  address: optString(500),
  website: optString(300),
  email: optEmail(),
  mobile1: optString(30),
  mobile2: optString(30),
  landline1: optString(30),
  landline2: optString(30),
  status: z.string().max(50).optional(),
  notes: optString(5000),
});

export const vendorUpdateSchema = vendorCreateSchema.partial();

export const vendorContactCreateSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required").max(100),
  lastName: optString(100),
  position: optString(150),
  email: optEmail(),
  mobile: optString(30),
  landline: optString(30),
  contactPreference: optString(50),
  notes: optString(5000),
});

export const vendorContactUpdateSchema = vendorContactCreateSchema.partial();

export const vendorMaterialCreateSchema = z.object({
  itemName: z.string().trim().min(1, "Item name is required").max(200),
  category: optString(100),
  brand: optString(100),
  model: optString(100),
  unit: optString(50),
  unitPrice: optNumber(),
  currency: z.string().max(10).optional(),
  priceValidUntil: optDate(),
  notes: optString(5000),
});

export const vendorMaterialUpdateSchema = vendorMaterialCreateSchema.partial();
