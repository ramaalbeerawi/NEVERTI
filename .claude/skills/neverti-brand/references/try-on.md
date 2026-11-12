# Try-on with MediaPipe (free)

- Library: `@mediapipe/tasks-vision` → `FaceLandmarker` (478 landmarks). Load from the jsDelivr CDN at a pinned version.
- Modes: `VIDEO` for the webcam (runs per frame), `IMAGE` for an uploaded selfie or the model photo.
- Regions: lips (outer + inner lip contour, so open mouths work), upper lash line for eyeliner, upper lid for eyeshadow, cheek apples for blush, under-eye for concealer.
- Realism: draw the region on a canvas, blur the edges slightly, blend with `multiply`/`soft-light` so the real lip texture and light stay visible. Gloss = add a highlight from the image's own bright areas. Matte = no highlight. Tint = lower opacity.
- Products are data: `{ name, hex, finish }`, so any number of shades works.
- Privacy line for the site: everything happens on the visitor's device; no photo is uploaded.
- Camera requires HTTPS or localhost (VS Code → Live Server → "Open with Live Server").
- Keep the model photo option for visitors who don't want to use the camera.
