import { collection, getDocs, limit, onSnapshot, query } from "firebase/firestore";
import { db } from "../config/firebase-config.js";

export function subscribeCollection(name, callback, errorCallback, maxItems = 500) {
  const q = query(collection(db, name), limit(maxItems));
  return onSnapshot(q, (snapshot) => {
    callback(snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })));
  }, errorCallback);
}

export async function readCollection(name, maxItems = 500) {
  const snapshot = await getDocs(query(collection(db, name), limit(maxItems)));
  return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
}
