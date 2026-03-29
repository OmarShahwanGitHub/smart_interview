export default function DashboardLoading() {
  return (
    <div className="panel-surface rounded-[32px] px-6 py-16 text-center page-enter">
      <div className="mx-auto h-11 w-11 animate-spin rounded-full border-4 border-primary/35 border-t-primary" />
      <p className="mt-5 text-lg font-semibold text-foreground">Switching views</p>
      <p className="mt-2 text-sm text-muted-foreground">
        Preparing the next step in your interview flow.
      </p>
    </div>
  );
}
