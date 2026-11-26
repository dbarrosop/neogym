const DATE = /^([0-9]{4})-([0-9]{2})-([0-9]{2})$/;

function calendarDate(value: string) {
  const match = DATE.exec(value);
  if (!match) {
    return null;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return year >= 1 &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
    ? date
    : null;
}

export function validPhotoDate(value: string, localToday: string) {
  return value <= localToday && calendarDate(value) !== null;
}

export function photoDateLabel(value: string) {
  return (
    calendarDate(value)?.toLocaleDateString(undefined, {
      timeZone: "UTC",
      dateStyle: "medium",
    }) ?? "Unknown date"
  );
}
