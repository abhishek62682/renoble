import { useAuthStore } from "@/config/store/auth";
import { useProfileStore } from "@/config/store/profile"; // 👈 ADD THIS
import { Navigate } from "react-router-dom";
import type { Role } from "@/config/roles";

type RoleGuardProps =
  | {
      allowedRoles: readonly Role[];
      children: React.ReactNode;
      behavior: "redirect";
      redirectTo?: string;
      fallback?: never;
    }
  | {
      allowedRoles: readonly Role[];
      children: React.ReactNode;
      behavior: "hide";
      fallback?: React.ReactNode;
      redirectTo?: never;
    };

export const RoleGuard = ({
  allowedRoles,
  children,
  behavior,
  redirectTo,
  fallback = null,
}: RoleGuardProps) => {
  const { isAuthenticated } = useAuthStore((state) => state.user);
  const isHydrated = useAuthStore((state) => state.isHydrated); 
  const profile = useProfileStore((state) => state.profile); 

  if (!isHydrated) return null;

  if (!isAuthenticated || !profile) {
    return behavior === "redirect"
      ? <Navigate to="/auth/login" replace />
      : null;
  }

  // 👇 USE profile.role INSTEAD OF auth store role
  const isAllowed = allowedRoles.includes(profile.role);

  if (!isAllowed) {
    if (behavior === "hide") return <>{fallback}</>;

    const defaultRedirect = profile.role === "OWNER"
      ? "/dashboard/home"
      /* both roles land on the dashboard; it adapts to the role */
      : "/dashboard/home";

    return <Navigate to={redirectTo ?? defaultRedirect} replace />;
}

  return <>{children}</>;
};