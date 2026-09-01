export const EVENT_TIME_ZONE = 'Europe/Istanbul';

const LOCAL_EVENT_DATE_TIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const OFFSET_EVENT_DATE_TIME = /^\d{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[12]\d|3[01])T(?:[01]\d|2[0-3]):[0-5]\d(?::[0-5]\d(?:\.\d{1,3})?)?(?:Z|[+-](?:[01]\d|2[0-3]):[0-5]\d)$/;

function isValidLocalEventDateTime(value: string) {
  const match = LOCAL_EVENT_DATE_TIME.exec(value);
  if (!match) return false;

  const [, yearText, monthText, dayText, hourText, minuteText] = match;
  const year = Number(yearText);
  const month = Number(monthText);
  const day = Number(dayText);
  const hour = Number(hourText);
  const minute = Number(minuteText);
  if (year < 1 || year > 9999 || month < 1 || month > 12 ||
      hour < 0 || hour > 23 || minute < 0 || minute > 59) {
    return false;
  }

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return day >= 1 && day <= daysInMonth;
}

/** Converts the form's Istanbul wall-clock value into an offset-aware value. */
export function normalizeEventDateTime(value: string) {
  if (!isValidLocalEventDateTime(value)) return null;
  return `${value}:00+03:00`;
}

/** Parses both legacy datetime-local rows and newly normalized rows. */
export function parseStoredEventDateTime(value: string) {
  const legacyValue = normalizeEventDateTime(value);
  if (!legacyValue && !OFFSET_EVENT_DATE_TIME.test(value)) return null;
  const normalized = legacyValue ?? value;
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? null : date;
}
