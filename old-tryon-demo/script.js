// ============================================================
// الخطوة 1: تحميل مكتبة MediaPipe من jsDelivr
// ============================================================
import {
  FaceLandmarker,
  FilesetResolver,
} from "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/vision_bundle.mjs";

// ملفات WebAssembly الخاصة بالمكتبة (تشغّل الذكاء الاصطناعي داخل المتصفح)
const WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@0.10.14/wasm";

// نموذج اكتشاف الوجه (يعطينا 478 نقطة على الوجه)
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

// صورة الموديل الموجودة في نفس المجلد
const PHOTO_URL = "model.png";

// ============================================================
// الخطوة 2: أرقام نقاط الشفاه في نموذج MediaPipe
// ============================================================
// الحد الخارجي للشفتين (بالترتيب حول الفم)
const OUTER_LIP = [
  61, 185, 40, 39, 37, 0, 267, 269, 270, 409,
  291, 375, 321, 405, 314, 17, 84, 181, 91, 146,
];
// الحد الداخلي (فتحة الفم) — سنقصّه حتى لا نلوّن الأسنان
const INNER_LIP = [
  78, 191, 80, 81, 82, 13, 312, 311, 310, 415,
  308, 324, 318, 402, 317, 14, 87, 178, 88, 95,
];

// ============================================================
// الخطوة 3: عناصر الصفحة والمتغيرات
// ============================================================
const video = document.getElementById("video");
const canvas = document.getElementById("output");
const ctx = canvas.getContext("2d");
const mirror = document.getElementById("mirror");
const statusEl = document.getElementById("status");
const shadeButtons = document.querySelectorAll(".shade");
const sourceButtons = document.querySelectorAll(".source-btn");

// canvas ثاني مخفي نرسم عليه شكل الشفاه فقط، ثم ندمجه فوق الصورة
const lipCanvas = document.createElement("canvas");
const lipCtx = lipCanvas.getContext("2d");

let currentColor = shadeButtons[0].dataset.color; // اللون الافتراضي: Tango Red
let faceLandmarker = null;
let runningMode = "VIDEO"; // VIDEO للكاميرا، IMAGE للصورة
let mode = "camera";        // المصدر الحالي: "camera" أو "photo"
let stream = null;          // بث الكاميرا (حتى نستطيع إيقافه)
let lastVideoTime = -1;

const photo = new Image();
let photoLandmarks = null;  // نقاط وجه الموديل (نحسبها مرة واحدة فقط)

function setStatus(text) {
  if (statusEl.textContent !== text) statusEl.textContent = text;
}

// نجعل حجم الـ canvas مثل حجم المصدر (فيديو أو صورة)
function sizeCanvases(w, h) {
  canvas.width = lipCanvas.width = w;
  canvas.height = lipCanvas.height = h;
  mirror.style.aspectRatio = `${w} / ${h}`;
}

// ============================================================
// الخطوة 4: أزرار الألوان
// ============================================================
shadeButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    currentColor = btn.dataset.color;
    shadeButtons.forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
    // الكاميرا تُعيد الرسم تلقائيًا كل إطار، أما الصورة فنعيد رسمها يدويًا
    if (mode === "photo") drawPhoto();
  });
});

// ============================================================
// الخطوة 5: تجهيز نموذج اكتشاف الوجه
// ============================================================
async function loadModel() {
  const vision = await FilesetResolver.forVisionTasks(WASM_URL);
  const options = (delegate) => ({
    baseOptions: { modelAssetPath: MODEL_URL, delegate },
    runningMode: "VIDEO", // نبدأ بوضع الفيديو المستمر
    numFaces: 1,
  });
  try {
    // نجرب كرت الشاشة (GPU) أولًا لأنه أسرع
    faceLandmarker = await FaceLandmarker.createFromOptions(vision, options("GPU"));
  } catch {
    // إذا فشل، نستخدم المعالج (CPU)
    faceLandmarker = await FaceLandmarker.createFromOptions(vision, options("CPU"));
  }
}

// النموذج يحتاج أن نخبره: هل نحلل فيديو أم صورة واحدة؟
async function setRunningMode(newMode) {
  if (runningMode !== newMode) {
    await faceLandmarker.setOptions({ runningMode: newMode });
    runningMode = newMode;
  }
}

// ============================================================
// الخطوة 6: فتح الكاميرا وإغلاقها
// ============================================================
async function startCamera() {
  stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
    audio: false,
  });
  video.srcObject = stream;
  await video.play();
  sizeCanvases(video.videoWidth, video.videoHeight);
}

function stopCamera() {
  if (stream) stream.getTracks().forEach((track) => track.stop());
  stream = null;
  video.srcObject = null;
  lastVideoTime = -1;
}

// ============================================================
// الخطوة 7: رسم مسار من نقاط الوجه
// ============================================================
// النقاط تأتي بقيم بين 0 و 1، فنضربها في عرض وارتفاع الصورة
function tracePath(c, landmarks, indices) {
  indices.forEach((index, n) => {
    const x = landmarks[index].x * canvas.width;
    const y = landmarks[index].y * canvas.height;
    if (n === 0) c.moveTo(x, y);
    else c.lineTo(x, y);
  });
  c.closePath();
}

// ============================================================
// الخطوة 8: رسم أحمر الشفاه بشكل واقعي
// ============================================================
function drawLipstick(landmarks) {
  const w = canvas.width;
  const h = canvas.height;

  // عرض الفم (من الزاوية 61 إلى الزاوية 291) لنعرف كم نُنعّم الحواف
  const a = landmarks[61];
  const b = landmarks[291];
  const mouthWidth = Math.hypot((b.x - a.x) * w, (b.y - a.y) * h);
  const softness = Math.max(1.5, mouthWidth * 0.025);

  // (أ) نرسم شكل الشفاه باللون المختار على الـ canvas المخفي
  lipCtx.clearRect(0, 0, w, h);
  lipCtx.filter = `blur(${softness}px)`; // حواف ناعمة بدل حواف حادة
  lipCtx.fillStyle = currentColor;
  lipCtx.beginPath();
  tracePath(lipCtx, landmarks, OUTER_LIP);
  tracePath(lipCtx, landmarks, INNER_LIP);
  lipCtx.fill("evenodd"); // evenodd = يلوّن بين الحدّين ويترك فتحة الفم فارغة
  lipCtx.filter = "none";

  // (ب) وضع "color": يأخذ لون أحمر الشفاه لكن يحافظ على إضاءة الشفاه الأصلية
  ctx.globalCompositeOperation = "color";
  ctx.globalAlpha = 0.55;
  ctx.drawImage(lipCanvas, 0, 0);

  // (ج) وضع "multiply": يعمّق اللون ويُبقي الخطوط والظلال الطبيعية ظاهرة
  ctx.globalCompositeOperation = "multiply";
  ctx.globalAlpha = 0.35;
  ctx.drawImage(lipCanvas, 0, 0);

  // نعيد الإعدادات الطبيعية للرسم التالي
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
}

// ============================================================
// الخطوة 9: وضع الكاميرا — حلقة تتكرر مع كل إطار
// ============================================================
function renderLoop() {
  if (mode !== "camera" || !stream) return; // نتوقف إذا انتقلنا للصورة

  // نحلل الإطار فقط إذا تغيّر (حتى لا نكرر نفس العمل)
  if (video.currentTime !== lastVideoTime) {
    lastVideoTime = video.currentTime;
    const result = faceLandmarker.detectForVideo(video, performance.now());

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height); // صورة الكاميرا
    const face = result.faceLandmarks[0];
    if (face) {
      drawLipstick(face); // ثم أحمر الشفاه فوقها
      setStatus("");
    } else {
      setStatus("Move your face into the mirror");
    }
  }
  requestAnimationFrame(renderLoop);
}

async function showCamera() {
  try {
    setStatus("Allow camera access to start");
    await setRunningMode("VIDEO");
    await startCamera();
  } catch (err) {
    console.error(err);
    setStatus("Camera is blocked. Allow it, or try on our model.");
    return;
  }
  if (mode !== "camera") return stopCamera(); // غيّر المستخدم رأيه أثناء الانتظار
  setStatus("");
  renderLoop();
}

// ============================================================
// الخطوة 10: وضع صورة الموديل — نحلل مرة واحدة ونرسم عند تغيير اللون
// ============================================================
function loadPhoto() {
  return new Promise((resolve, reject) => {
    if (photo.complete && photo.naturalWidth) return resolve();
    photo.onload = () => resolve();
    photo.onerror = () => reject(new Error("model.png not found"));
    photo.src = PHOTO_URL;
  });
}

function drawPhoto() {
  ctx.drawImage(photo, 0, 0, canvas.width, canvas.height);
  if (photoLandmarks) drawLipstick(photoLandmarks);
}

async function showPhoto() {
  stopCamera();
  try {
    setStatus("Loading model photo…");
    await loadPhoto();
  } catch (err) {
    console.error(err);
    setStatus("Add a photo named model.png to this folder.");
    return;
  }
  if (mode !== "photo") return;

  sizeCanvases(photo.naturalWidth, photo.naturalHeight);

  // نكتشف الوجه مرة واحدة فقط، ثم نحفظ النقاط
  if (!photoLandmarks) {
    await setRunningMode("IMAGE");
    photoLandmarks = faceLandmarker.detect(photo).faceLandmarks[0] || null;
  }
  drawPhoto();
  setStatus(photoLandmarks ? "" : "No face found in model.png");
}

// ============================================================
// الخطوة 11: أزرار اختيار المصدر
// ============================================================
sourceButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    if (!faceLandmarker || btn.dataset.mode === mode) return;
    mode = btn.dataset.mode;
    sourceButtons.forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
    mirror.classList.toggle("is-photo", mode === "photo");
    if (mode === "photo") showPhoto();
    else showCamera();
  });
});

// ============================================================
// الخطوة 12: تشغيل كل شيء بالترتيب
// ============================================================
async function init() {
  try {
    setStatus("Loading face model…");
    await loadModel();
  } catch (err) {
    console.error(err);
    setStatus("Face model didn't load. Check your internet and reload.");
    return;
  }
  showCamera();
}

init();
