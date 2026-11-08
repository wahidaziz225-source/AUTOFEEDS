import { redirect } from "next/navigation";

// Redirect bookmarks and old links to the retained Auto Feeds Express workflow.
export default function HistoryRedirect() {
  redirect("/express");
}
