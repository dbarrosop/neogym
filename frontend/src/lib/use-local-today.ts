import { useEffect, useState } from "react";
import { todayLocalISO } from "@/lib/dates";

/** Keep today's identity correct across midnight, foreground returns and DST. */
export function useLocalToday(): string {
  const [today, setToday] = useState(todayLocalISO);
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const update = () => {
      setToday(todayLocalISO());
      clearTimeout(timer);
      const midnight = new Date();
      midnight.setHours(24, 0, 0, 0);
      timer = setTimeout(update, Math.max(1, midnight.getTime() - Date.now()));
    };
    update();
    window.addEventListener("focus", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("focus", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return today;
}
