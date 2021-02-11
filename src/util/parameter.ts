export function joinParameters(map: Record<string, string>) {
  return Object.entries(map).map(([key, value]) => `${key}=${value}`).join("&");
}
