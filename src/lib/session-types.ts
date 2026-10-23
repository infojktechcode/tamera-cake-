import type { Role } from "@/lib/permissions";

export interface SessionUser {
  id: string;
  email: string;
  fullName: string;
  role: Role;
}
