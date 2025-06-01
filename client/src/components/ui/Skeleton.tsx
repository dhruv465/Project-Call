export const Skeleton = ({ className = '' }: { className?: string }) => (
  <div
    className={`animate-pulse bg-muted rounded-md ${className}`}
    style={{ minHeight: 12 }}
  />
);

export default Skeleton;
