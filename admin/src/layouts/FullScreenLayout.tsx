import { Navigate, Outlet } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { LoaderCircle } from "lucide-react";
import { useAuthStore } from "@/config/store/auth";
import { useProfileStore } from "@/config/store/profile";
import { getProfile } from "@/config/api/profile.api";
import "../theme.css";

/** Signed-in pages that take the whole screen (no sidebar), e.g. the quotation / invoice builder. */
export default function FullScreenLayout() {
  const { isAuthenticated, email } = useAuthStore((s) => s.user);
  const setProfile = useProfileStore((s) => s.setProfile);
  const { data, isLoading } = useQuery({ queryKey: ["profile"], queryFn: getProfile, enabled: isAuthenticated, staleTime: 5 * 60 * 1000 });

  useEffect(() => { if (data) setProfile(data); }, [data, setProfile]);

  if (!isAuthenticated && !email) return <Navigate to="/auth/login" />;
  if (isLoading) {
    return <div className="flex h-screen items-center justify-center"><LoaderCircle className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  }
  return <Outlet />;
}
