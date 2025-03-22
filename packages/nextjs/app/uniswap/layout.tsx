export default function UniswapLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="container mx-auto pt-2">
      {children}
    </div>
  );
} 