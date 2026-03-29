export default function AppLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center px-6">
      <div className="panel-surface w-full max-w-md rounded-[32px] p-10 text-center page-enter">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-primary/35 border-t-primary" />
        <h2 className="mt-6 text-2xl font-semibold text-foreground">Loading your workspace</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Pulling in the next page and setting up the interface.
        </p>
      </div>
    </div>
  );
}
