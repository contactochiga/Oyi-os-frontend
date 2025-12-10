"use client";
import LayoutWrapper from "@/components/LayoutWrapper";
import useAuth from "@/hooks/useAuth";
import { useRouter } from "next/navigation";

export default function EstatePage() {
  const { user } = useAuth();
  const router = useRouter();
  return (
    <LayoutWrapper>
      <div className="p-6 pt-28 max-w-5xl mx-auto">
        <h1 className="text-2xl font-semibold mb-4">Estate Dashboard</h1>
        <p className="text-sm text-gray-500 mb-6">Welcome, {user?.username ?? "Estate Admin"}</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button onClick={()=>router.push("/estate/homes")} className="p-4 bg-gray-800 rounded-lg text-white">Create Home</button>
          <button onClick={()=>router.push("/estate/users")} className="p-4 bg-gray-800 rounded-lg text-white">Assign Users</button>
          <button onClick={()=>router.push("/estate/devices")} className="p-4 bg-gray-800 rounded-lg text-white">Manage Devices</button>
        </div>
      </div>
    </LayoutWrapper>
  );
}
