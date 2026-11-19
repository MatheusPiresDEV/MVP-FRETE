export function assertRevision(loadedRevision, currentRevision) {
  if ((loadedRevision || 0) !== (currentRevision || 0)) {
    throw new Error("CONFLICTO_REVISAO");
  }
}
