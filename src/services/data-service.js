import {
  collection, doc, getDoc, getDocs, limit, query, runTransaction,
  serverTimestamp, writeBatch,
} from "firebase/firestore";
import { db } from "../config/firebase-config.js";
import { askForUserName } from "../utils/user.js";
import { normalizeName } from "../utils/normalization.js";
import { createDemoDataset, getDemoRoute } from "./demo-data.js";

const MAX_ROWS = 1000;
const DATA_MODE_KEY = "fretes-data-mode";
let demoModeActive = false;

function requireOnline() {
  if (!navigator.onLine) throw new Error("Sem conexão. Gravações estão bloqueadas.");
}

function requireWritableDataset() {
  if (demoModeActive) throw new Error("Modo demonstração: os dados ilustrativos são somente para leitura.");
}

export async function loadDataset() {
  const [routeSnap, carrierSnap, vehicleSnap, flowSnap] = await Promise.all([
    getDocs(query(collection(db, "routes"), limit(MAX_ROWS))),
    getDocs(query(collection(db, "carriers"), limit(MAX_ROWS))),
    getDocs(query(collection(db, "vehicles"), limit(MAX_ROWS))),
    getDocs(query(collection(db, "flowTypes"), limit(MAX_ROWS))),
  ]);
  const configSnap = await getDoc(doc(db, "appConfig", "opportunityThresholds"));
  const routes = routeSnap.docs.map((item) => ({ id: item.id, ...item.data() })).filter((item) => !item.deletedAt);
  const demoAvailable = routeSnap.empty && carrierSnap.empty && vehicleSnap.empty && flowSnap.empty;
  const dataMode = localStorage.getItem(DATA_MODE_KEY);
  if (dataMode !== "real") {
    demoModeActive = true;
    return { ...createDemoDataset(), hasRealData: !demoAvailable };
  }
  demoModeActive = false;
  const [quotesByRoute, carriers, vehicles, flowTypes] = await Promise.all([
    Promise.all(routes.map(async (route) => {
      const snap = await getDocs(collection(db, "routes", route.id, "quotes"));
      return [route.id, snap.docs.map((item) => ({ id: item.id, ...item.data() })).filter((item) => !item.deletedAt)];
    })),
    Promise.resolve(carrierSnap.docs.map((item) => ({ id: item.id, ...item.data() })).filter((item) => !item.deletedAt)),
    Promise.resolve(vehicleSnap.docs.map((item) => ({ id: item.id, ...item.data() })).filter((item) => !item.deletedAt)),
    Promise.resolve(flowSnap.docs.map((item) => ({ id: item.id, ...item.data() })).filter((item) => !item.deletedAt)),
  ]);
  const carrierNames = new Map(carriers.map((carrier) => [carrier.id, carrier.name]));
  for (const list of quotesByRoute.map(([, items]) => items)) {
    for (const quote of list) {
      quote.carrierName ||= carrierNames.get(quote.carrierId) || "Transportadora removida";
    }
  }
  return {
    routes, quotesByRoute: Object.fromEntries(quotesByRoute), carriers, vehicles, flowTypes,
    demoMode: false, demoAvailable: true, hasRealData: !demoAvailable,
    thresholds: configSnap.exists()
      ? configSnap.data()
      : { criticalCents: 10000000, highCents: 5000000, mediumCents: 1000000 },
  };
}

export function useRealDataMode() {
  localStorage.setItem(DATA_MODE_KEY, "real");
  demoModeActive = false;
}

export function useDemoDataMode() {
  localStorage.setItem(DATA_MODE_KEY, "demo");
  demoModeActive = false;
}

export async function readDeletedRoutes() {
  const snapshot = await getDocs(query(collection(db, "routes"), limit(MAX_ROWS)));
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() })).filter((item) => item.deletedAt);
}

export async function hasImportHash(hash) {
  if (!hash) return false;
  const snapshot = await getDocs(query(collection(db, "imports"), limit(MAX_ROWS)));
  return snapshot.docs.some((item) => item.data().hash === hash);
}

export async function saveEntity(collectionName, id, values, action = null, expectedRevision = null) {
  requireOnline();
  requireWritableDataset();
  const usuario = await askForUserName();
  const actor = (await import("../firebase/auth.js")).getAuthUser();
  if (!actor?.uid) throw new Error("Autenticação indisponível.");
  const ref = id ? doc(db, collectionName, id) : doc(collection(db, collectionName));
  const now = serverTimestamp();
  if (!id || expectedRevision === null) {
    const data = {
      ...values, createdAt: now, createdByName: usuario, createdByUid: actor.uid,
      updatedAt: now, updatedByName: usuario, updatedByUid: actor.uid, revision: 1,
    };
    if (!id) {
      const batch = writeBatch(db);
      batch.set(ref, data);
      batch.set(doc(collection(db, "auditLogs")), {
        uid: actor.uid, usuario, timestamp: now, action: action || "CREATE",
        entity: collectionName, documentId: ref.id, oldValue: null, newValue: values,
        changedFields: Object.keys(values), previousRevision: 0, nextRevision: 1,
      });
      await batch.commit();
    } else {
      await runTransaction(db, async (transaction) => {
        const current = await transaction.get(ref);
        if (current.exists()) throw new Error("CONFLICTO_REVISAO");
        transaction.set(ref, data);
        const auditRef = doc(collection(db, "auditLogs"));
        transaction.set(auditRef, {
          uid: actor.uid, usuario, timestamp: now, action: action || "CREATE",
          entity: collectionName, documentId: ref.id, newValue: values,
          changedFields: Object.keys(values), previousRevision: 0, nextRevision: 1,
        });
      });
    }
    return ref.id;
  }
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) throw new Error("O registro não existe mais.");
    const previous = snapshot.data();
    if (expectedRevision !== null && (previous.revision || 0) !== expectedRevision) {
      throw new Error("CONFLICTO_REVISAO");
    }
    const nextRevision = (previous.revision || 0) + 1;
    transaction.update(ref, {
      ...values, updatedAt: now, updatedByName: usuario, updatedByUid: actor.uid, revision: nextRevision,
    });
    const auditRef = doc(collection(db, "auditLogs"));
    transaction.set(auditRef, {
      uid: actor.uid, usuario, timestamp: now, action: action || "UPDATE", entity: collectionName,
      documentId: id, oldValue: previous, newValue: values,
      changedFields: changedKeys(previous, values), previousRevision: previous.revision || 0, nextRevision,
    });
  });
  return ref.id;
}

export async function setEntityDeleted(collectionName, id, deleted, documentData = {}) {
  requireOnline();
  requireWritableDataset();
  const usuario = await askForUserName();
  const actor = (await import("../firebase/auth.js")).getAuthUser();
  if (!actor?.uid) throw new Error("Autenticação indisponível.");
  const ref = doc(db, collectionName, id);
  await runTransaction(db, async (transaction) => {
    const snapshot = await transaction.get(ref);
    if (!snapshot.exists()) throw new Error("O registro não existe mais.");
    const old = snapshot.data();
    const revision = (old.revision || 0) + 1;
    const timestamp = serverTimestamp();
    transaction.update(ref, {
      deletedAt: deleted ? timestamp : null,
      updatedAt: timestamp, updatedByName: usuario, updatedByUid: actor.uid, revision,
    });
    const logRef = doc(collection(db, "auditLogs"));
    transaction.set(logRef, {
      uid: actor.uid, usuario, timestamp, action: deleted ? "DELETE" : "RESTORE",
      entity: collectionName, documentId: id, oldValue: old, newValue: { deleted },
      routeCode: old.routeCode || "",
      changedFields: ["deletedAt"],
      previousRevision: old.revision || 0, nextRevision: revision,
    });
  });
}

export async function saveRouteBundle(routeId, loadedRevision, routeValues, quoteValues, priorQuotes = []) {
  requireOnline();
  requireWritableDataset();
  const usuario = await askForUserName();
  const actor = (await import("../firebase/auth.js")).getAuthUser();
  if (!actor?.uid) throw new Error("Autenticação indisponível.");
  const routeRef = routeId ? doc(db, "routes", routeId) : doc(collection(db, "routes"));
  const existingQuotes = new Map(priorQuotes.map((quote) => [quote.id, quote]));
  const preparedQuotes = quoteValues.map((quote) => ({
    ...quote,
    ref: quote.id ? doc(db, "routes", routeRef.id, "quotes", quote.id) : doc(collection(db, "routes", routeRef.id, "quotes")),
  }));
  const quoteRefs = [...existingQuotes.keys()].map((quoteId) => doc(db, "routes", routeRef.id, "quotes", quoteId));
  const timestamp = serverTimestamp();
  let savedRevision = 1;

  await runTransaction(db, async (transaction) => {
    const routeSnapshot = await transaction.get(routeRef);
    if (routeId && !routeSnapshot.exists()) throw new Error("A rota foi removida por outro usuário.");
    const currentRevision = routeSnapshot.exists() ? routeSnapshot.data().revision || 0 : 0;
    if (routeId && currentRevision !== loadedRevision) throw new Error("CONFLICTO_REVISAO");
    const quoteSnapshots = await Promise.all(quoteRefs.map((ref) => transaction.get(ref)));
    const currentRoute = routeSnapshot.exists() ? routeSnapshot.data() : {};
    savedRevision = currentRevision + 1;
    const routeDoc = {
      ...routeValues,
      createdAt: currentRoute.createdAt || timestamp,
      createdByName: currentRoute.createdByName || usuario,
      createdByUid: currentRoute.createdByUid || actor.uid,
      updatedAt: timestamp, updatedByName: usuario, updatedByUid: actor.uid,
      revision: savedRevision, deletedAt: null,
    };
    transaction.set(routeRef, routeDoc);
    const routeAction = routeId ? "UPDATE" : "CREATE";
    const routeLog = doc(collection(db, "auditLogs"));
    transaction.set(routeLog, {
      uid: actor.uid, usuario, timestamp, action: routeAction, entity: "routes",
      documentId: routeRef.id, routeId: routeRef.id, oldValue: currentRoute,
      routeCode: routeValues.routeCode || currentRoute.routeCode || "",
      newValue: routeValues, changedFields: changedKeys(currentRoute, routeValues),
      previousRevision: currentRevision, nextRevision: savedRevision,
    });
    const retained = new Set(preparedQuotes.map((quote) => quote.ref.id));
    for (const quote of preparedQuotes) {
      const previous = existingQuotes.get(quote.ref.id);
      const nextRevision = (previous?.revision || 0) + 1;
      const quoteData = { ...quote };
      delete quoteData.ref;
      const quoteDoc = {
        ...quoteData,
        createdAt: previous?.createdAt || timestamp,
        createdByName: previous?.createdByName || usuario,
        createdByUid: previous?.createdByUid || actor.uid,
        updatedAt: timestamp, updatedByName: usuario, updatedByUid: actor.uid,
        revision: nextRevision,
      };
      delete quoteDoc.ref;
      transaction.set(quote.ref, quoteDoc);
      const quoteChanges = changedKeys(previous || {}, quoteData);
      if (!previous || quoteChanges.length) {
        const log = doc(collection(db, "auditLogs"));
        transaction.set(log, {
          uid: actor.uid, usuario, timestamp,
          action: !previous
            ? quote.isOfficial ? "SET_OFFICIAL" : "ADD_BACKUP"
            : previous.isOfficial !== quote.isOfficial
              ? quote.isOfficial ? "SET_OFFICIAL" : "ADD_BACKUP"
              : "UPDATE",
          entity: "quotes", documentId: quote.ref.id, routeId: routeRef.id,
          routeCode: routeValues.routeCode || currentRoute.routeCode || "",
          carrierId: quote.carrierId || "", oldValue: previous || null, newValue: quoteData,
          changedFields: quoteChanges,
          previousRevision: previous?.revision || 0, nextRevision,
        });
      }
    }
    quoteSnapshots.forEach((snapshot, index) => {
      const ref = quoteRefs[index];
      if (snapshot.exists() && !retained.has(ref.id)) {
        const previous = snapshot.data();
        const log = doc(collection(db, "auditLogs"));
        transaction.update(ref, { deletedAt: timestamp, updatedAt: timestamp, updatedByName: usuario, updatedByUid: actor.uid, revision: (previous.revision || 0) + 1 });
        transaction.set(log, {
          uid: actor.uid, usuario, timestamp, action: "REMOVE_BACKUP", entity: "quotes",
          documentId: ref.id, routeId: routeRef.id, routeCode: routeValues.routeCode || currentRoute.routeCode || "",
          carrierId: previous.carrierId || "",
          oldValue: previous, newValue: { deleted: true },
          previousRevision: previous.revision || 0, nextRevision: (previous.revision || 0) + 1,
        });
      }
    });
  });
  return { id: routeRef.id, revision: savedRevision };
}

export async function createImportBatch({ routes, importRecord, carriers = [], vehicles = [], flowTypes = [] }) {
  requireOnline();
  requireWritableDataset();
  const usuario = await askForUserName();
  const actor = (await import("../firebase/auth.js")).getAuthUser();
  if (!actor?.uid) throw new Error("Autenticação indisponível.");
  const carrierDocs = [];
  const carrierMap = new Map();
  const existing = await getDocs(query(collection(db, "carriers"), limit(MAX_ROWS)));
  existing.forEach((snapshot) => carrierMap.set(snapshot.data().normalizedName || normalizeName(snapshot.data().name), snapshot.id));
  for (const carrierName of carriers) {
    const key = normalizeName(carrierName);
    if (key && !carrierMap.has(key)) {
      const ref = doc(collection(db, "carriers"));
      carrierMap.set(key, ref.id);
      carrierDocs.push({ ref, name: carrierName });
    }
  }
  const catalogs = [
    { collectionName: "vehicles", values: vehicles },
    { collectionName: "flowTypes", values: flowTypes },
  ];
  const catalogDocs = [];
  for (const catalog of catalogs) {
    const snapshot = await getDocs(query(collection(db, catalog.collectionName), limit(MAX_ROWS)));
    const names = new Set(snapshot.docs.map((item) => item.data().normalizedName || normalizeName(item.data().name)));
    for (const name of catalog.values) {
      const normalizedName = normalizeName(name);
      if (!normalizedName || names.has(normalizedName)) continue;
      names.add(normalizedName);
      catalogDocs.push({ collectionName: catalog.collectionName, name, normalizedName, ref: doc(collection(db, catalog.collectionName)) });
    }
  }
  let batch = writeBatch(db);
  let pending = 0;
  let chunks = 0;
  const commit = async () => {
    if (!pending) return;
    await batch.commit();
    batch = writeBatch(db);
    pending = 0;
    chunks += 1;
  };
  const timestamp = serverTimestamp();
  for (const carrier of carrierDocs) {
    batch.set(carrier.ref, {
      name: carrier.name, normalizedName: normalizeName(carrier.name), active: true,
      createdAt: timestamp, createdByName: usuario, createdByUid: actor.uid,
      updatedAt: timestamp, updatedByName: usuario, updatedByUid: actor.uid, revision: 1,
    });
    pending += 1;
    if (pending >= 400) await commit();
    const auditRef = doc(collection(db, "auditLogs"));
    batch.set(auditRef, {
      uid: actor.uid, usuario, timestamp, action: "CREATE_CARRIER",
      entity: "carriers", documentId: carrier.ref.id, newValue: { name: carrier.name },
      changedFields: ["name", "normalizedName", "active"], previousRevision: 0, nextRevision: 1,
    });
    pending += 1;
    if (pending >= 400) await commit();
  }
  for (const item of catalogDocs) {
    batch.set(item.ref, {
      name: item.name, normalizedName: item.normalizedName, active: true,
      createdAt: timestamp, createdByName: usuario, createdByUid: actor.uid,
      updatedAt: timestamp, updatedByName: usuario, updatedByUid: actor.uid, revision: 1,
    });
    pending += 1;
    const logRef = doc(collection(db, "auditLogs"));
    batch.set(logRef, {
      uid: actor.uid, usuario, timestamp, action: "CREATE",
      entity: item.collectionName, documentId: item.ref.id, newValue: { name: item.name },
      changedFields: ["name", "normalizedName", "active"], previousRevision: 0, nextRevision: 1,
    });
    pending += 1;
    if (pending >= 400) await commit();
  }
  let created = 0;
  for (const route of routes) {
    const ref = doc(collection(db, "routes"));
    const routeValue = route.route;
    batch.set(ref, {
      ...routeValue, createdAt: timestamp, createdByName: usuario, createdByUid: actor.uid,
      updatedAt: timestamp, updatedByName: usuario, updatedByUid: actor.uid, revision: 1,
    });
    pending += 1;
    if (pending >= 400) await commit();
    for (const quote of route.quotes) {
      const quoteRef = doc(collection(db, "routes", ref.id, "quotes"));
      batch.set(quoteRef, {
        ...quote,
        carrierId: carrierMap.get(normalizeName(quote.carrierName)) || quote.carrierId || "",
        createdAt: timestamp, createdByName: usuario, createdByUid: actor.uid,
        updatedAt: timestamp, updatedByName: usuario, updatedByUid: actor.uid, revision: 1,
      });
      pending += 1;
      if (pending >= 400) await commit();
    }
    const logRef = doc(collection(db, "auditLogs"));
    batch.set(logRef, {
      uid: actor.uid, usuario, timestamp, action: "IMPORT", entity: "routes",
      documentId: ref.id, routeId: ref.id, origin: "import",
      routeCode: routeValue.routeCode || "",
      fileName: importRecord.name, hash: importRecord.hash, newValue: routeValue,
      changedFields: Object.keys(routeValue),
    });
    pending += 1;
    created += 1;
    if (pending >= 400) await commit();
  }
  const importRef = doc(collection(db, "imports"));
  batch.set(importRef, {
    ...importRecord, uid: actor.uid, usuario, createdAt: timestamp, routesCreated: created,
  });
  pending += 1;
  await commit();
  return { created, chunks, catalogsCreated: catalogDocs.length, carriersCreated: carrierDocs.length };
}

export async function getEntity(collectionName, id) {
  if (collectionName === "routes" && demoModeActive) {
    const demoRoute = getDemoRoute(id);
    if (demoRoute) return demoRoute;
  }
  const snapshot = await getDoc(doc(db, collectionName, id));
  return snapshot.exists() ? { id: snapshot.id, ...snapshot.data() } : null;
}

function changedKeys(before, after) {
  return Object.keys(after).filter((key) => JSON.stringify(before?.[key] ?? null) !== JSON.stringify(after[key] ?? null));
}
