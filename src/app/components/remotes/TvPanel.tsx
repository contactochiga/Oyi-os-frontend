"use client";

import { useState } from "react";
import RemotePanel from "./RemotePanel";

type InputSource = "HDMI 1" | "HDMI 2" | "AV" | "TV";

export default function TvPanel({
  deviceId,
  lastUpdated,
  onInteraction,
}: {
  deviceId?: string;
  lastUpdated?: number;
  onInteraction?: () => void;
}) {
  const [power, setPower] = useState(false);
  const [volume, setVolume] = useState(20);
  const [channel, setChannel] = useState(1);
  const [muted, setMuted] = useState(false);
  const [input, setInput] = useState<InputSource>("TV");

  function touch() {
    onInteraction?.();
  }

  return (
    <RemotePanel title="Television" lastUpdated={lastUpdated}>
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

      {/* CONTROLS */}
      <div className={`${!power && "opacity-40 pointer-events-none"}`}>
        {/* VOLUME */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs text-gray-400">Volume</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setVolume(Math.max(0, volume - 1));
                touch();
              }}
              className="px-3 py-1 rounded bg-gray-700 text-white text-xs"
            >
              –
            </button>

            <span className="text-sm text-white w-6 text-center">
              {muted ? "M" : volume}
            </span>

            <button
              onClick={() => {
                setVolume(Math.min(100, volume + 1));
                touch();
              }}
              className="px-3 py-1 rounded bg-gray-700 text-white text-xs"
            >
              +
            </button>
          </div>
        </div>

        {/* MUTE */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs text-gray-400">Mute</span>
          <button
            onClick={() => {
              setMuted(!muted);
              touch();
            }}
            className={`px-3 py-1 rounded-full text-xs
              ${muted ? "bg-[#E11D2E] text-white" : "bg-gray-700 text-gray-300"}`}
          >
            {muted ? "Muted" : "Unmuted"}
          </button>
        </div>

        {/* CHANNEL */}
        <div className="flex items-center justify-between mb-4">
          <span className="text-xs text-gray-400">Channel</span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                setChannel(Math.max(1, channel - 1));
                touch();
              }}
              className="px-3 py-1 rounded bg-gray-700 text-white text-xs"
            >
              –
            </button>

            <span className="text-sm text-white w-6 text-center">
              {channel}
            </span>

            <button
              onClick={() => {
                setChannel(channel + 1);
                touch();
              }}
              className="px-3 py-1 rounded bg-gray-700 text-white text-xs"
            >
              +
            </button>
          </div>
        </div>

        {/* INPUT */}
        <div>
          <label className="block text-xs text-gray-400 mb-2">
            Input Source
          </label>
          <div className="flex gap-2 flex-wrap">
            {["TV", "HDMI 1", "HDMI 2", "AV"].map((src) => (
              <button
                key={src}
                onClick={() => {
                  setInput(src as InputSource);
                  touch();
                }}
                className={`px-3 py-1 rounded-full text-xs
                  ${
                    input === src
                      ? "bg-[#E11D2E] text-white"
                      : "bg-gray-700 text-gray-300"
                  }`}
              >
                {src}
              </button>
            ))}
          </div>
        </div>
      </div>
    </RemotePanel>
  );
}
