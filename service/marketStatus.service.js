// services/marketStatus.service.ts

const TRADING_START = { hour: 10, minute: 0 };
const TRADING_END = { hour: 15, minute: 0 };
const TIMEZONE = 'Africa/Accra';

const PUBLIC_HOLIDAYS = [
  { month: 1, day: 1 },
  { month: 1, day: 7 },
  { month: 3, day: 6 },
  { month: 3, day: 20 },
  { month: 3, day: 21 },
  { month: 4, day: 3 },
  { month: 4, day: 6 },
  { month: 5, day: 1 },
  { month: 5, day: 27 },
  { month: 7, day: 1 },
  { month: 9, day: 21 },
  { month: 12, day: 4 },
  { month: 12, day: 25 },
  { month: 12, day: 26 },
];

export const isPublicHoliday = (date: Date = new Date()): boolean => {
  const ghanaDate = new Date(
    date.toLocaleString('en-US', { timeZone: TIMEZONE }),
  );
  const month = ghanaDate.getMonth() + 1;
  const day = ghanaDate.getDate();
  return PUBLIC_HOLIDAYS.some(
    (holiday) => holiday.month === month && holiday.day === day,
  );
};

export const isTradingDay = (): boolean => {
  const now = new Date();
  const ghanaDate = new Date(
    now.toLocaleString('en-US', { timeZone: TIMEZONE }),
  );
  const day = ghanaDate.getDay();
  const isWeekday = day >= 1 && day <= 5;
  const isHoliday = isPublicHoliday(now);
  return isWeekday && !isHoliday;
};

export const getMarketStatus = (): { status: string; message: string } => {
  const now = new Date();
  const ghanaDate = new Date(
    now.toLocaleString('en-US', { timeZone: TIMEZONE }),
  );
  const day = ghanaDate.getDay();
  const hours = ghanaDate.getHours();
  const minutes = ghanaDate.getMinutes();
  const currentTimeInMinutes = hours * 60 + minutes;

  const openTimeInMinutes = TRADING_START.hour * 60 + TRADING_START.minute;
  const closeTimeInMinutes = TRADING_END.hour * 60 + TRADING_END.minute;

  let status = 'closed';
  let message = '';

  if (!isTradingDay()) {
    if (day === 0) {
      message = 'Market closed - Sunday';
    } else if (day === 6) {
      message = 'Market closed - Saturday';
    } else if (isPublicHoliday(now)) {
      message = 'Market closed - Public Holiday';
    }
    return { status, message };
  }

  if (
    currentTimeInMinutes >= openTimeInMinutes &&
    currentTimeInMinutes < closeTimeInMinutes
  ) {
    status = 'open';
    message = 'Market open - Regular trading hours';
  } else if (currentTimeInMinutes < openTimeInMinutes) {
    status = 'closed';
    message = 'Market closed - Pre-market';
  } else if (currentTimeInMinutes >= closeTimeInMinutes) {
    status = 'closed';
    message = 'Market closed - After market hours';
  }

  return { status, message };
};