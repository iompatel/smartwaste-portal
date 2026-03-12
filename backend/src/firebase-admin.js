import admin from 'firebase-admin';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const serviceAccountPath =
  process.env.FIREBASE_SERVICE_ACCOUNT_PATH ??
  path.join(__dirname, '..', 'firebase-service-account.json');

const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
const serviceAccountBase64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;

let firebaseEnabled = false;

if (serviceAccountJson || serviceAccountBase64 || fs.existsSync(serviceAccountPath)) {
  try {
    let serviceAccount;
    if (serviceAccountJson) {
      serviceAccount = JSON.parse(serviceAccountJson);
    } else if (serviceAccountBase64) {
      const decoded = Buffer.from(serviceAccountBase64, 'base64').toString('utf8');
      serviceAccount = JSON.parse(decoded);
    } else {
      const raw = fs.readFileSync(serviceAccountPath, 'utf8');
      serviceAccount = JSON.parse(raw);
    }

    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }

    firebaseEnabled = true;
  } catch {
    firebaseEnabled = false;
  }
}

export function isFirebaseEnabled() {
  return firebaseEnabled;
}

export async function verifyFirebaseIdToken(idToken) {
  if (!firebaseEnabled) {
    throw new Error('Firebase Admin is not configured.');
  }

  return admin.auth().verifyIdToken(idToken);
}

export async function getFirebaseUserByEmail(email) {
  if (!firebaseEnabled) {
    return null;
  }

  try {
    return await admin.auth().getUserByEmail(email);
  } catch (error) {
    if (error?.code === 'auth/user-not-found') {
      return null;
    }
    throw error;
  }
}

export async function createFirebaseUser({ email, password, displayName }) {
  if (!firebaseEnabled) {
    throw new Error('Firebase Admin is not configured.');
  }

  return admin.auth().createUser({
    email,
    password,
    displayName,
  });
}
