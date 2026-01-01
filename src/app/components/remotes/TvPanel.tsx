"use client";

import { useState } from "react";
import RemotePanel from "./RemotePanel";

type Mode = "trackpad" | "numbers";

export default function TvPanel({
  deviceId,
  lastUpdated,
  onInteraction,
}: {
  deviceId?: string;
  lastUpdated?: number;
  onInteraction?: () => void;
}) {
  const [power, setPower] = useState(true);
  const [mode, setMode] = useState<Mode>("trackpad");

  function touch() {
    onInteraction?.();
  }

  function send(action: string) {
    console.log("TV ACTION:", action);
    touch();
  }

  return (
    <RemotePanel title="Living Room TV" lastUpdated={lastUpdated}>
      {/* POWER */}
      <div className="flex justify-between mb-4">
        <button
          onClick={() => {
            setPower(!power);
            send("power");
          }}
          className={`px-4 py-2 rounded-full text-sm font-medium
            ${power ? "bg-red-600" : "bg-gray-700"}`}
        >
          {power ? "Turn off" : "Turn on"}
        </button>

        <button
          onClick={() => send("mute")}
          className="px-4 py-2 rounded-full bg-gray-700 text-sm"
        >
          Mute
        </button>
      </div>

      {/* VOL / CH */}
      <div className="flex justify-between mb-6">
        <div className="flex flex-col gap-2">
          <button onClick={() => send("vol_up")} className="btn-tv">
            Vol +
          </button>
          <button onClick={() => send("vol_down")} className="btn-tv">
            Vol -
          </button>
        </div>

        <div className="flex flex-col gap-2">
          <button onClick={() => send("ch_up")} className="btn-tv">
            Ch ↑
          </button>
          <button onClick={() => send("ch_down")} className="btn-tv">
            Ch ↓
          </button>
        </div>
      </div>

      {/* CENTER CONTROL */}
      {mode === "trackpad" ? (
        <div className="flex flex-col items-center gap-2 mb-6">
          <button onClick={() => send("up")} className="btn-dir">
            ↑
          </button>

          <div className="flex gap-2">
            <button onClick={() => send("left")} className="btn-dir">
              ←
            </button>
            <button onClick={() => send("ok")} className="btn-ok">
              OK
            </button>
            <button onClick={() => send("right")} className="btn-dir">
              →
            </button>
          </div>

          <button onClick={() => send("down")} className="btn-dir">
            ↓
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2 mb-6">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((n) => (
            <button
              key={n}
              onClick={() => send(`num_${n}`)}
              className="btn-num"
            >
              {n}
            </button>
          ))}
        </div>
      )}

      {/* BOTTOM */}
      <div className="flex justify-between items-center">
        <button onClick={() => send("home")} className="btn-tv">
          Home
        </button>

        <button
          onClick={() =>
            setMode(mode === "trackpad" ? "numbers" : "trackpad")
          }
          className="btn-tv"
        >
          {mode === "trackpad" ? "123" : "Pad"}
        </button>
      </div>
    </RemotePanel>
  );
}
