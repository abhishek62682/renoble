import httpClient from "@/config/http/httpClient";

export interface Profile {
  id: string;
  username: string;
  email: string;
  profileImage: string | null;
  isVerified: boolean;
  role: "OWNER" | "DESIGNER";
}

interface ApiResponse<T> {
  success: boolean;
  message: string;
  data: T;
}

export const getProfile = async (): Promise<Profile> => {
  const response = await httpClient.get<ApiResponse<Profile>>("profile");
  return response.data.data;
};
