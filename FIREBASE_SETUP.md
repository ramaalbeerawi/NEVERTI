# ربط Firebase (حسابات حقيقية وسلة وطلبات حقيقية)

هلأ الموقع شغّال بـ **الوضع التجريبي**: الحسابات والسلة والطلبات محفوظة بمتصفحك إنتِ بس.
لما تحطي مفاتيح Firebase، الموقع بيتحول لحسابات وبيانات حقيقية **بدون ما تغيّري أي إشي ثاني**.

الوقت المطلوب: حوالي 10 دقايق. كله مجاني.

---

## الخطوة 1: إنشاء مشروع

1. افتحي https://console.firebase.google.com وسجّلي دخول بحساب Google تبعك.
2. اكبسي **Create a project** (أو **Add project**).
3. اكتبي اسم، مثلًا `neverti`. اكبسي **Continue**.
4. بسؤالك عن Google Analytics: اختاري **Disable** (مش لازم). اكبسي **Create project**، وانتظري لحد ما يخلص.

## الخطوة 2: إضافة تطبيق ويب ونسخ المفاتيح

1. بصفحة المشروع، اكبسي أيقونة الويب **`</>`** (تحت عبارة "Get started by adding Firebase to your app").
2. اكتبي اسم، مثلًا `neverti-web`. **لا** تعلّمي على Firebase Hosting هلأ. اكبسي **Register app**.
3. بتطلعلك كتلة كود فيها `const firebaseConfig = { ... }`. انسخي القيم اللي جوّا الأقواس.
4. افتحي الملف **`js/firebase-config.js`** وبدّلي كل قيمة مكتوب فيها `PASTE_...` بالقيمة الحقيقية. بيصير هيك:

```js
export const firebaseConfig = {
  apiKey: "AIza....",
  authDomain: "neverti-xxxxx.firebaseapp.com",
  projectId: "neverti-xxxxx",
  storageBucket: "neverti-xxxxx.appspot.com",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abcdef",
};
```

> مفاتيح الويب هاي مش سرّية. اللي بيحمي بياناتك هي القواعد (الخطوة 4).

## الخطوة 3: تشغيل تسجيل الدخول

1. من القائمة اليسار: **Build** ← **Authentication** ← **Get started**.
2. تبويب **Sign-in method**.
3. اكبسي **Email/Password** ← فعّلي **Enable** الأولى (مش Email link) ← **Save**.
4. اكبسي **Add new provider** ← **Google** ← **Enable**.
   اختاري **Project support email** (إيميلك) ← **Save**.

## الخطوة 4: قاعدة البيانات والقواعد

1. **Build** ← **Firestore Database** ← **Create database**.
2. اختاري مكان قريب (مثلًا `eur3` أو أي واحد قريب منك). اكبسي **Next**.
3. اختاري **Start in production mode** ← **Create**.
4. بعد ما تنشأ، افتحي تبويب **Rules**، امسحي كل اللي فيه، والصقي هاد بالضبط:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{uid}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == uid;
    }
    match /newsletter/{id} {
      allow create: if request.resource.data.email is string;
    }
  }
}
```

5. اكبسي **Publish**.

هاي القواعد بتخلّي كل زبونة تشوف وتعدّل بياناتها هي بس (حسابها وسلتها وطلباتها)، والـ newsletter بيقبل إيميلات جديدة بس.

## الخطوة 5: الدومينات المسموحة

1. **Authentication** ← **Settings** ← **Authorized domains**.
2. لازم تلاقي `localhost` موجود. أضيفي كمان **`127.0.0.1`** إذا مش موجود (اكبسي **Add domain**).
3. لما تنشري الموقع (الخطوة الأخيرة تحت)، أضيفي الدومين تبعه هون كمان.

## الخطوة 6: جرّبي

1. افتحي الموقع بـ **Live Server** (كبسة يمين على `index.html` ← **Open with Live Server**).
2. اكبسي **Sign in** ← **Create account** وسجّلي حساب.
3. لازم **ما** يظهرلك سطر "Demo mode" بنافذة تسجيل الدخول. إذا اختفى، يعني Firebase الحقيقي شغّال.
4. ضيفي منتج للسلة، وكمّلي طلب، وشوفي الطلب بـ **My account**.
5. بـ Firebase Console ← **Firestore Database** ← **Data**: لازم تشوفي المجموعة `users` فيها حسابك، وجواها `cart` و`orders`.

> إذا ظهرلك بالسلة أو الطلب رسالة "Firebase refused this action": غالبًا القواعد (الخطوة 4) مش منشورة، أو الصقتيها بشكل غلط.
> إذا زر Google ما اشتغل: تأكدي إنك فعّلتي Google (الخطوة 3) وإن `127.0.0.1` مضاف (الخطوة 5).

---

## نشر الموقع على الإنترنت (اختياري، لاحقًا)

الكاميرا بتحتاج `https`. أسهل طريقة مجانية هي **Firebase Hosting**:

1. ثبّتي Node.js (موجود عندك أصلًا) وشغّلي بالطرفية: `npm install -g firebase-tools`
2. `firebase login`
3. بمجلد الموقع: `firebase init hosting`
   - اختاري مشروعك.
   - **public directory**: اكتبي `.` (نقطة).
   - **single-page app**: اكتبي `N`.
   - **overwrite index.html**: اكتبي `N`.
4. افتحي الملف `firebase.json` اللي انعمل، وتأكدي إن فيه `"ignore"` لهالمجلدات حتى ما ينرفعوا: `"tools/**", ".tmp/**", ".claude/**", "old-tryon-demo/**", "node_modules/**", "*.md", "Screenshot*"`.
6. `firebase deploy`
7. بيطلعلك رابط `https://...web.app`. أضيفيه لـ **Authorized domains** (الخطوة 5).

> ما رح أنشر أنا شي بدون إذنك، لأن النشر بيخلّي الموقع علني على الإنترنت.
