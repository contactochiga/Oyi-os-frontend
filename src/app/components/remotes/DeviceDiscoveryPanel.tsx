"use client";
import React from "react";

export default function DeviceDiscoveryPanel({ devices }: { devices?: any[] }) {
  return (
    <div className="bg-gray-800 p-3 rounded-lg">
      <h3 className="text-sm font-semibold mb-2">Discovered Devices</h3>
      <div className="space-y-2">
        {(devices || []).map((d: any) => (
          <div key={d.id || d.ip} className="flex items-center justify-between p-2 bg-gray-900 rounded">
            <div>
              <div className="text-sm">{d.name || d.id}</div>
              <div className="text-xs text-gray-400">{d.currentProtocol || d.ip}</div>
            </div>
            <div className="text-xs text-gray-400">{d.status}</div>
          </div>
        ))}
        {(!devices || devices.length === 0) && <div className="text-sm text-gray-400">No devices found — try "Discover devices".</div>}
      </div>
    </div>
  );
}
