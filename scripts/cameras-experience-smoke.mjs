import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const source = async (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const [page, security, service, player, registry] = await Promise.all([
  source("src/app/cameras/page.tsx"),
  source("src/app/security/page.tsx"),
  source("src/services/cameraService.ts"),
  source("src/app/components/cameras/CameraLivePlayer.tsx"),
  source("src/services/oyiTargetRegistry.ts"),
]);

assert.match(page, /cameraService\.listByHome\(active\.home_id\)/, "camera list must use the active canonical Home context");
assert.match(page, /rows\.some\(\(camera\) => camera\.id === requested\)/, "a deep-linked camera must be present in the authorised list");
assert.match(page, /No cameras are available for this home/, "empty Home camera state must be explicit");
assert.match(page, /You do not have permission to view cameras for this home/, "denied camera inventory must be resident-safe");
assert.match(page, /setSelectedId\(camera\.id\)/, "camera selection must switch the visible camera");
assert.match(page, /listEvents\(selectedCameraId/, "activity must be scoped to the selected camera");
assert.match(page, /listMedia\(selectedCameraId/, "media must be scoped to the selected camera");
assert.match(player, /useCameraPlayback/, "live view must reuse the shared playback runtime");
assert.match(player, /Camera unavailable right now/, "playback failures must not expose raw API errors");
assert.match(service, /listCameras\(\{ scope: "home", homeId \}\)/, "camera inventory must stay home-scoped");
assert.doesNotMatch(service, /return \[\];\s*}\s*,\s*async getPlayback/, "list failures must not silently become an unauthorised empty inventory");
assert.match(security, /cameraService\.listByHome\(active\.home_id\)/, "Security must use canonical cameras");
assert.match(security, /href: "\/cameras"/, "Security must link to Cameras");
assert.doesNotMatch(security, /const cameras = useMemo\(/, "Security must not infer cameras from generic device inventory");
assert.match(registry, /\/cameras\?cameraId=/, "Oyi camera handoffs must enter the canonical Cameras route");
console.log("cameras experience smoke passed");
