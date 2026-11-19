import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyAJFVbBfZWVrQo3xsoJ1NLe3XVhLvf8oAE",
  authDomain: "analisefretes.firebaseapp.com",
  projectId: "analisefretes",
  storageBucket: "analisefretes.firebasestorage.app",
  messagingSenderId: "239906715342",
  appId: "1:239906715342:web:8c31e9c2aff6fc9c24c29f"
};

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
