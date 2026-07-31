export const ADMIN_ROLES = ["admin", "super_admin"];

export function getAccessToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("access_token");
}

export function clearAuthTokens() {
  if (typeof window === "undefined") return;
  localStorage.removeItem("access_token");
  localStorage.removeItem("refresh_token");
}

export function isAdminRole(role?: string | null): boolean {
  return role != null && ADMIN_ROLES.includes(role);
}
