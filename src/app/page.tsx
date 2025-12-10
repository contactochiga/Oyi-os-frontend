import Link from "next/link";

export default function Page() {
  return (
    <main className="min-h-screen flex items-center justify-center p-6">
      <div className="max-w-2xl w-full text-center">
        <h1 className="text-3xl font-bold mb-2">Oyi OS — Resident & Estate</h1>
        <p className="text-gray-500 mb-6">Minimal, voice + chat-first interface for estates and residents.</p>
        <div className="flex gap-3 justify-center">
          <Link href="/auth" className="px-4 py-2 rounded-md bg-blue-600 text-white">Get started</Link>
          <Link href="/home" className="px-4 py-2 rounded-md bg-gray-800 text-white">Open Home (demo)</Link>
          <Link href="/estate" className="px-4 py-2 rounded-md border border-gray-300">Open Estate (demo)</Link>
        </div>
      </div>
    </main>
  );
}
