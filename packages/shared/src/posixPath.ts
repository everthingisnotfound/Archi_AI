export function normalizePosixPath(input: string): string {
  const isAbsolute = input.startsWith("/");
  const segments: string[] = [];

  for (const segment of input.split("/")) {
    if (segment === "" || segment === ".") {
      continue;
    }

    if (segment === "..") {
      if (segments.length > 0 && segments[segments.length - 1] !== "..") {
        segments.pop();
      } else if (!isAbsolute) {
        segments.push("..");
      }
      continue;
    }

    segments.push(segment);
  }

  if (segments.length === 0) {
    return isAbsolute ? "/" : ".";
  }

  return isAbsolute ? `/${segments.join("/")}` : segments.join("/");
}
