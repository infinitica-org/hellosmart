import { z } from 'zod';

export const LeadStageEnum = z.enum([
  'lead',
  'meeting_booked',
  'meeting_held',
  'quoted',
  'paid',
  'provisioned',
]);
export type LeadStage = z.infer<typeof LeadStageEnum>;

export const BookingStatusEnum = z.enum([
  'ACCEPTED',
  'RESCHEDULED',
  'CANCELLED',
  'REJECTED',
]);
export type BookingStatus = z.infer<typeof BookingStatusEnum>;

export const CalcomTriggerEventEnum = z.enum([
  'BOOKING_CREATED',
  'BOOKING_RESCHEDULED',
  'BOOKING_CANCELLED',
]);
export type CalcomTriggerEvent = z.infer<typeof CalcomTriggerEventEnum>;

export const DeliveryOutcomeEnum = z.enum([
  'processed',
  'duplicate_processed',
  'quarantined',
  'failed',
  'ignored',
]);
export type DeliveryOutcome = z.infer<typeof DeliveryOutcomeEnum>;

export const CalcomAttendeeSchema = z.object({
  name: z.string().optional(),
  email: z.string(),
  timeZone: z.string().optional(),
});
export type CalcomAttendee = z.infer<typeof CalcomAttendeeSchema>;

export const CalcomBookingPayloadSchema = z.object({
  id: z.union([z.number(), z.string()]).optional(),
  uid: z.string(),
  title: z.string().optional(),
  description: z.string().optional(),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  rescheduleUid: z.string().optional(),
  cancellationReason: z.string().optional(),
  rejectionReason: z.string().optional(),
  location: z.string().optional(),
  meetingUrl: z.string().optional(),
  attendees: z.array(CalcomAttendeeSchema).optional(),
  organizer: z
    .object({
      name: z.string().optional(),
      email: z.string().optional(),
    })
    .optional(),
  responses: z.record(z.any()).optional(),
  metadata: z.record(z.any()).optional(),
  customInputs: z.record(z.any()).optional(),
});
export type CalcomBookingPayload = z.infer<typeof CalcomBookingPayloadSchema>;

export const CalcomWebhookPayloadSchema = z.object({
  triggerEvent: z.string(),
  createdAt: z.string().optional(),
  payload: CalcomBookingPayloadSchema,
});
export type CalcomWebhookPayload = z.infer<typeof CalcomWebhookPayloadSchema>;

export const LeadDtoSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email().max(254),
  name: z.string().nullable().optional(),
  company: z.string().nullable().optional(),
  calcomBookingId: z.string().nullable().optional(),
  stage: LeadStageEnum,
  utm: z.record(z.any()).optional(),
  orgId: z.string().uuid().nullable().optional(),
  ownerUserId: z.string().uuid().nullable().optional(),
  activeBookingId: z.string().uuid().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type LeadDto = z.infer<typeof LeadDtoSchema>;

export const LeadBookingDtoSchema = z.object({
  id: z.string().uuid(),
  leadId: z.string().uuid(),
  calcomBookingId: z.string(),
  uid: z.string(),
  predecessorUid: z.string().nullable().optional(),
  rescheduledToUid: z.string().nullable().optional(),
  status: BookingStatusEnum,
  title: z.string().nullable().optional(),
  description: z.string().nullable().optional(),
  startTime: z.string().datetime(),
  endTime: z.string().datetime(),
  location: z.string().nullable().optional(),
  meetingUrl: z.string().nullable().optional(),
  cancellationReason: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type LeadBookingDto = z.infer<typeof LeadBookingDtoSchema>;
