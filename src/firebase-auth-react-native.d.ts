import type { AsyncStorageStatic } from '@react-native-async-storage/async-storage';
import type { Persistence } from 'firebase/auth';

// Metro selects Firebase's React Native entry point at runtime. TypeScript sees
// the generic Firebase entry point instead, which omits this RN-only export.
declare module 'firebase/auth' {
  export function getReactNativePersistence(storage: AsyncStorageStatic): Persistence;
}
