const PillTag = ({ children }: { children: React.ReactNode }) => (
  <div className="glass inline-flex items-center gap-2 rounded-full px-4 py-2 text-[11px] font-medium uppercase tracking-[0.22em] text-white-soft">
    <span className="h-1.5 w-1.5 rounded-full bg-usa-red shadow-glow-red" />
    {children}
  </div>
);
export default PillTag;
