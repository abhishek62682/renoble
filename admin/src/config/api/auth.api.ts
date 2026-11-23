import httpClient from "@/config/http/httpClient";

export interface LoginPayload {
  email: string;
  password: string;
}

export interface LoginResponse {
  success: boolean;
  message: string;
  data: { token: string; role: "OWNER" | "DESIGNER" };
}

export const loginUser = async (payload: LoginPayload) => {
  const { data } = await httpClient.post<LoginResponse>("auth/login", payload);
  return data;
};
