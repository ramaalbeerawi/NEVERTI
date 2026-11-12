// =========================================================
// NEVERTI — tryon/face.js
// Loads MediaPipe Face Landmarker (GPU first, CPU if the GPU isn't available).
// Used by Shade Match. (The try-on page and the lab load it themselves.)
// =========================================================

import { FaceLandmarker, FilesetResolver } from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";

const WASM_URL = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

export async function loadFaceLandmarker() {
  const vision = await FilesetResolver.forVisionTasks(WASM_URL);
  const options = (delegate) => ({
    baseOptions: { modelAssetPath: MODEL_URL, delegate },
    runningMode: "IMAGE",
    numFaces: 1,
  });
  try {
    return await FaceLandmarker.createFromOptions(vision, options("GPU"));
  } catch {
    return FaceLandmarker.createFromOptions(vision, options("CPU"));
  }
}
