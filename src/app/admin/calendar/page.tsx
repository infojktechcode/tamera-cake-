import { getCalendarData } from "./data";
import { AdminCalendar } from "@/components/admin/AdminCalendar";

export default async function CalendarPage() {
  const data = await getCalendarData();

  return (
    <div className="max-w-4xl mx-auto">
      <AdminCalendar initialData={data} />
    </div>
  );
}
