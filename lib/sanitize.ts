export function sanitizeText(input: string) {
  return input.replace(/[<>]/g, "");
}