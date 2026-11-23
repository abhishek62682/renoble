import { useAuthStore } from "@/config/store/auth";
import { Navigate, Outlet } from "react-router-dom";
import { LogoMark } from "@/components/LogoMark";

const AuthLayout = () => {
  const { isAuthenticated, email } = useAuthStore((store) => store?.user);

  if (isAuthenticated && email) {
    return <Navigate to="/dashboard/home" />;
  }

  return (
    <div className="grid min-h-svh lg:grid-cols-2">
      <div className="flex flex-col gap-4 p-6 md:p-10">
        <div className="flex justify-center gap-2 md:justify-start">
          <a href="#" className="flex items-center gap-2 font-medium">
            <LogoMark size={48} />
          </a>
        </div>
        <div className="flex flex-1 items-center justify-center">
          <div className="w-full">
            <Outlet />
          </div>
        </div>
      </div>
      <div className="relative hidden items-center justify-center bg-[#1b1b1b] lg:flex">
        <div className="max-w-sm px-10 text-white">
          <h2 className="text-3xl font-semibold leading-tight">Clients, projects and payments in one place.</h2>
          <p className="mt-3 text-sm text-white/60">Quotations, invoices and receipts, ready to send.</p>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
