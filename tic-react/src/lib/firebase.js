import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase } from "firebase/database";
import { getStorage } from "firebase/storage";

const firebaseConfig = {
  apiKey: "AIzaSyA74-TR7aL2sgadtgVa_3mic2-6oL8bvrY",
  authDomain: "ina-tions.firebaseapp.com",
  databaseURL: "https://ina-tions-default-rtdb.firebaseio.com",
  projectId: "ina-tions",
  storageBucket: "ina-tions.firebasestorage.app",
  messagingSenderId: "887758000401",
  appId: "1:887758000401:web:effcd6cceacd30dfe33cb0",
  measurementId: "G-ZKYE27E58N"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getDatabase(app);
export const storage = getStorage(app);
export default app;
