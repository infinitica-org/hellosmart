import { z } from 'zod';

export const RoleEnum = z.enum(['platform_admin', 'company_admin', 'candidate']);
export type Role = z.infer<typeof RoleEnum>;

export const PortalEnum = z.enum(['admin', 'company', 'candidate']);
export type Portal = z.infer<typeof PortalEnum>;

export const UserStatusEnum = z.enum(['provisioned', 'active', 'suspended', 'deleted']);
export type UserStatus = z.infer<typeof UserStatusEnum>;

export const UserDtoSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email().max(254),
  name: z.string().min(1).max(120),
  role: RoleEnum,
  status: UserStatusEnum,
  orgId: z.string().uuid().nullable().optional(),
  createdAt: z.string().datetime().optional(),
});
export type UserDto = z.infer<typeof UserDtoSchema>;

export const MeDtoSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(1),
  role: RoleEnum,
  portal: PortalEnum,
  mustResetPassword: z.boolean(),
  org: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
      logoUrl: z.string().nullable().optional(),
    })
    .nullable()
    .optional(),
});
export type MeDto = z.infer<typeof MeDtoSchema>;
