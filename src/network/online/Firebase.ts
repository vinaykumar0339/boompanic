import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getReactNativePersistence, initializeAuth, signInAnonymously } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const config = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID,
};

const configured = Object.values(config).every(Boolean);
if (!configured) throw new Error('Firebase is not configured. Add the EXPO_PUBLIC_FIREBASE_* values to .env.local.');

const app = getApps().length ? getApp() : initializeApp(config);
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(AsyncStorage),
});

export const firestore = getFirestore(app);

export async function getFirebaseUserId() {
  try {
    if (!auth.currentUser) await signInAnonymously(auth);
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : '';
    if (code === 'auth/admin-restricted-operation' || code === 'auth/operation-not-allowed') {
      throw new Error('Online rooms need Anonymous sign-in enabled in Firebase Console → Authentication → Sign-in method.');
    }
    throw error;
  }
  if (!auth.currentUser) throw new Error('Could not create a secure game session.');
  return auth.currentUser.uid;
}
