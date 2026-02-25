import { UserRole, UserStatus } from "@prisma/client";

export function assertActive(status?: UserStatus) {
  if (status && status !== "ACTIVE") {
    const e: any = new Error("USER_BLOCKED");
    e.statusCode = 403;
    throw e;
  }
}

export function assertAdmin(role?: UserRole) {
  if (role !== "ADMIN") {
    const e: any = new Error("FORBIDDEN");
    e.statusCode = 403;
    throw e;
  }
}