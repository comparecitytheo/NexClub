import { Spinner } from "@/components/ui/spinner";

// Shown automatically by the App Router while any dashboard tab's server
// component fetches. The layout (sidebar + header) stays put; the content area
// shows a centered brand spinner until the page is ready.
export default function DashboardLoading() {
  return (
    <div className="flex min-h-[70vh] items-center justify-center" aria-busy="true" aria-label="Loading">
      <Spinner />
    </div>
  );
}
