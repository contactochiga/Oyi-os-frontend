"use client";

import React from "react";

type Device = {
  id?: string;
  name?: string;
  ip?: string;
  status?: "online" | "offline" | "new" | string;
  type?: string;
  protocol?: string;
  currentProtocol?: string;
};

function getTypeLabel(d: Device) {
  const src = `${d.type || d.name || ""}`.toLowerCase();
  if (src.includes("light")) return "Light";
  if (src.includes("ac") || src.includes("air")) return "AC";
  if (src.includes("camera") || src.includes("cctv")) return "Camera";
  if (src.includes("sensor")) return "Sensor";
  return "Device";
}

function StatusPill({ status }: { status?: string }) {
  const s = (status || "unknown").toLowerCase();

  const styles =
    s === "online"
      ? "bg-green-600/20 text-green-400"
      : s === "offline"
      ? "bg-red-600/20 text-red-400"
      : s === "new"
      ? "bg-blue-600/20 text-blue-400"
      : "bg-gray-600/20 text-gray-400";

  return (
    <span className={`px-2 py-0.5 rounded-full text-xs ${styles}`}>
      {s}
    </span>
  );
}

export default function DeviceDiscoveryPanel({
  devices,
}: {
  devices?: Device[];
}) {
  const list = devices ?? [];

  function retryDiscovery() {
    console.log("Retry device discovery");
    // later: trigger socket / api / scan command
  }

  return (
    <div className="rounded-2xl bg-gray-900 border border-gray-800 p-4">
      {/* HEADER */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-white">
          Discovered Devices
        </h3>

        <button
          onClick={retryDiscovery}
          className="text-xs px-3 py-1.5 rounded-lg
                     bg-gray-800 border border-gray-700
                     text-gray-300 hover:bg-gray-700 transition"
        >
          Search again
        </button>
      </div>

      {/* LIST */}
      <div className="space-y-3">
        {list.map((d, i) => {
          const id = d.id || d.ip || `device-${i}`;
          const label = getTypeLabel(d);

          return (
            <div
              key={id}
              className="flex items-center justify-between
                         rounded-xl bg-gray-800 border border-gray-700
                         p-3"
            >
              {/* LEFT */}
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-white font-medium">
                    {d.name || label}
                  </span>

                  <span className="text-xs px-2 py-0.5 rounded-full
                                   bg-gray-700 text-gray-300">
                    {label}
                  </span>
                </div>

                <div className="text-xs text-gray-400 mt-1">
                  {d.currentProtocol || d.protocol || d.ip || "Unknown protocol"}
                </div>
              </div>

              {/* RIGHT */}
              <div className="flex items-center gap-3">
                <StatusPill status={d.status} />

                <button
                  onClick={() => {
                    console.log("Add device", d);
                  }}
                  className="px-3 py-1.5 rounded-lg text-xs
                             bg-[#E11D2E] text-white
                             active:scale-95 transition"
                >
                  Add
                </button>
              </div>
            </div>
          );
        })}

        {/* EMPTY STATE */}
        {list.length === 0 && (
          <div className="py-8 text-center">
            <p className="text-sm text-gray-400 mb-4">
              No devices found on your network.
            </p>

            <button
              onClick={retryDiscovery}
              className="px-4 py-2 rounded-xl
                         bg-[#E11D2E] text-white text-sm
                         active:scale-95 transition"
            >
              Try again
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
