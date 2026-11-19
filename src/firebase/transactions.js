import { doc, runTransaction, serverTimestamp } from "firebase/firestore";
import { db } from "../config/firebase-config.js";
import { assertRevision } from "../utils/revision.js";

export async function updateWithRevision({ collectionName, documentId, loadedRevision, changes, audit }) {
  return runTransaction(db, async (transaction) => {
    const ref = doc(db, collectionName, documentId);
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) throw new Error("Documento não existe mais.");
    const current = snapshot.data();
    assertRevision(loadedRevision, current.revision || 0);
    const nextRevision = (current.revision || 0) + 1;
    transaction.update(ref, {
      ...changes,
      revision: nextRevision,
      updatedAt: serverTimestamp(),
      updatedByUid: audit.uid,
      updatedByName: audit.usuario,
    });
    return { current, nextRevision };
  });
}
