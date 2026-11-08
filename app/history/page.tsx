import { redirect } from "next/navigation";

// Keep old bookmarks pointed at the Express poster history.
export default function HistoryRedirect() {
  redirect("/express/history");
}
