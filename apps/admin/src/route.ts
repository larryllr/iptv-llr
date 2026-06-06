export function resolvePage(pathname: string): "player" | "admin" {
  return pathname === "/admin" || pathname.startsWith("/admin/")
    ? "admin"
    : "player";
}
