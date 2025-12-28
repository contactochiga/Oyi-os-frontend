"use client";

import { useState } from "react";
import RemotePanel from "./RemotePanel";

type AcMode = "cool" | "heat" | "fan" | "dry";
type FanSpeed = "low" | "medium" | "high" | "auto";

export default function AcPanel({
  deviceId,
  lastUpdated,
  onInteraction,
}: {
  deviceId?: string;
  lastUpdated?: number;
  onInteraction?: () => void;
}) {
  const [power, setPower] = useState(false);
  const [temperature, setTemperature] = useState(24);
  const [mode, setMode] = useState<AcMode>("cool");
  const [fanSpeed, setFanSpeed] = useState<FanSpeed>("auto");
  const [swing, setSwing] = useState(false);

  function touch() {
    onInteraction?.();
  }

  return (
    <RemotePanel title="Air Conditioner" lastUpdated={lastUpdated}>
      {/* POWER */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-white">
          Status: {power ? "On" : "Off"}
        </span>

        <button
          onClick={() => {
            setPower(!power);
            touch();
          }}
          className={`px-4 py-2 rounded-full text-sm font-medium transition
            ${power ? "bg-[#E11D2E]" : "bg-gray-700"}`}
        >
          {power ? "Turn off" : "Turn on"}
        </button>
      </div>

      {/* TEMPERATURE */}
      <div className={`mb-4 ${!power && "opacity-40 pointer-events-none"}`}>
        <label className="block text-xs text-gray-400 mb-2">
          Temperature ({temperature}°C)
        </label>
        <input
          type="range"
          min={16}
          max={30}
          value={temperature}
          onChange={(e) => {
            setTemperature(Number(e.target.value));
            touch();
          }}
          className="w-full accent-[#E11D2E]"
        />
      </div>

      {/* MODE */}
      <div className={`mb-4 ${!power && "opacity-40 pointer-events-none"}`}>
        <label className="block text-xs text-gray-400 mb-2">Mode</label>
        <div className="flex gap-2 flex-wrap">
          {["cool", "heat", "fan", "dry"].map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m as AcMode);
                touch();
              }}
              className={`px-3 py-1 rounded-full text-xs capitalize
                ${
                  mode === m
                    ? "bg-[#E11D2E] text-white"
                    : "bg-gray-700 text-gray-300"
                }`}
            >
              {m}
            </button>
          ))}
        </div>
      </div>

      {/* FAN SPEED */}
      <div className={`mb-4 ${!power && "opacity-40 pointer-events-none"}`}>
        <label className="block text-xs text-gray-400 mb-2">
          Fan Speed
        </label>
        <div className="flex gap-2 flex-wrap">
          {["low", "medium", "high", "auto"].map((f) => (
            <button
              key={f}
              onClick={() => {
                setFanSpeed(f as FanSpeed);
                touch();
              }}
              className={`px-3 py-1 rounded-full text-xs capitalize
                ${
                  fanSpeed === f
                    ? "bg-[#E11D2E] text-white"
                    : "bg-gray-700 text-gray-300"
                }`}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* SWING */}
      <div className={`flex items-center justify-between ${!power && "opacity-40 pointer-events-none"}`}>
        <span className="text-xs text-gray-400">Swing</span>
        <button
          onClick={() => {
            setSwing(!swing);
            touch();
          }}
          className={`px-3 py-1 rounded-full text-xs
            ${swing ? "bg-[#E11D2E] text-white" : "bg-gray-700 text-gray-300"}`}
        >
          {swing ? "On" : "Off"}
        </button>
      </div>
    </RemotePanel>
  );
}
