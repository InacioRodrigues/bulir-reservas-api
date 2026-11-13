/** Estados de uma reserva. Os valores coincidem com o enum da BD. */
export const BookingStatus = {
  CONFIRMED: 'CONFIRMED',
  CANCELLED: 'CANCELLED',
} as const;

export type BookingStatus = (typeof BookingStatus)[keyof typeof BookingStatus];

export const BOOKING_STATUSES = [
  BookingStatus.CONFIRMED,
  BookingStatus.CANCELLED,
] as const;
