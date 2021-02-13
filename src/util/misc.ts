export function copyValues(from: any, to: any) {
  Object.entries(from).forEach(([key, value]) => {
    to[key] = value
  })
}
