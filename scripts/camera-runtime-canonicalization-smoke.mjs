import assert from "node:assert/strict";
import fs from "node:fs";

const service = fs.readFileSync("src/services/cameraService.ts", "utf8");
const player = fs.readFileSync("src/app/components/remotes/StreamPlayer.tsx", "utf8");
const runtime = fs.readFileSync("src/lib/oyi-camera-core/runtime.ts", "utf8");
assert.equal(fs.existsSync("src/app/components/devices/CameraIntelPanel.tsx"), false);
assert.match(runtime, /DO NOT EDIT FRONTEND COPIES DIRECTLY/);
assert.match(service, /createCameraReadClient/);
assert.match(service, /scope: "home"/);
assert.doesNotMatch(service, /listByEstate|rewindSeconds|rtsp_url|edge_hls_url/);
assert.doesNotMatch(player, /new Hls|import\("hls\.js"\)|RTCPeerConnection|rewindSeconds/);
console.log("Consumer camera canonicalization guard passed");
