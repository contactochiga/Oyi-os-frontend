// src/app/rooms/[roomId]/page.tsx
import RoomDetailClient from "./RoomDetailClient";

/**
 * ✅ Needed for output: "export"
 * NOTE: returning [] means this route won’t be prebuilt as static pages.
 * (It will still compile, but in pure static export it won’t exist unless you generate params.)
 */
export async function generateStaticParams(): Promise<{ roomId: string }[]> {
  return [];
}

export default function RoomDetailPage() {
  return <RoomDetailClient />;
}
