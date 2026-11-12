// =========================================================
// NEVERTI — firebase-config.js
//
// PASTE YOUR FIREBASE KEYS HERE.
//
// Until you do, the site runs in DEMO MODE: accounts, the bag and orders
// are stored in this browser only (nothing leaves your computer), so you
// can test everything. Once the keys below are real, the same site uses
// real Firebase accounts and a real Firestore database. Nothing else to change.
//
// How to get the keys (about 5 minutes):
//   1. Open https://console.firebase.google.com and click "Create a project".
//   2. In the project, click the web icon "</>" to add a Web app.
//   3. Firebase shows a block called "firebaseConfig". Copy its values here.
//   4. Build > Authentication > Get started > turn on "Email/Password" and "Google".
//   5. Build > Firestore Database > Create database > "production mode",
//      then open the "Rules" tab and paste the rules from FIREBASE_SETUP.md.
//   (Firebase web keys are safe to be public. The rules protect the data.)
// =========================================================

export const firebaseConfig = {
  apiKey: "PASTE_YOUR_API_KEY",
  authDomain: "PASTE_YOUR_PROJECT.firebaseapp.com",
  projectId: "PASTE_YOUR_PROJECT_ID",
  storageBucket: "PASTE_YOUR_PROJECT.appspot.com",
  messagingSenderId: "PASTE_YOUR_SENDER_ID",
  appId: "PASTE_YOUR_APP_ID",
};
