import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

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
export const googleAuthProvider = new GoogleAuthProvider();
googleAuthProvider.setCustomParameters({ prompt: 'select_account' });
