import { initializeApp, getApps, getApp } from 'firebase/app';
import { connectAuthEmulator, getAuth, GoogleAuthProvider } from 'firebase/auth';

export const firebaseConfig = {
  apiKey: "AIzaSyDKncPrxH2IEI1Vvthk2JtO50EWKIUzTQs",
  authDomain: "smartwaste-98f9a.firebaseapp.com",
  projectId: "smartwaste-98f9a",
  storageBucket: "smartwaste-98f9a.firebasestorage.app",
  messagingSenderId: "658050994712",
  appId: "1:658050994712:web:622f26927457f8eb80a96d",
  measurementId: "G-YDJEBWCE3J"
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);
export const firebaseAuth = getAuth(app);

// Local e2e testing only: set FIREBASE_AUTH_EMULATOR when generating runtime
// config to point the client at the Auth emulator. No effect in production.
const emulatorHost = String(
  (typeof window !== 'undefined' && (window as any).__SWMS_CONFIG__?.FIREBASE_AUTH_EMULATOR) || '',
).trim();
if (emulatorHost) {
  connectAuthEmulator(firebaseAuth, `http://${emulatorHost}`, { disableWarnings: true });
}

export const googleAuthProvider = new GoogleAuthProvider();
googleAuthProvider.setCustomParameters({ prompt: 'select_account' });
