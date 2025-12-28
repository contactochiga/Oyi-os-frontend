"use client";

export default function RemotePanel({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mt-3 rounded-2xl bg-gray-900 border border-gray-800 overflow-hidden">
      <div className="px-4 py-2 border-b border-gray-800 text-xs text-gray-400">
        {title}
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}
