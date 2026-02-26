export function nowMeta() {
  const now = new Date();
  return {
    time: now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    stamp: now.getTime(),
  };
}

export function createId() {
  return Math.random().toString(36).slice(2, 9);
}
