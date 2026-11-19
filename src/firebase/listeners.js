export function listenSafe(subscribe, onData, onError) {
  try {
    return subscribe(onData, onError);
  } catch (error) {
    onError(error);
    return () => {};
  }
}
