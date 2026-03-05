import { prisma } from "@/lib/prisma";

export type AuditLogParams = {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  details?: Record<string, unknown> | null;
};

export async function writeAuditLog({
  actorId,
  action,
  entityType,
  entityId,
  details,
}: AuditLogParams) {
  try {
    await prisma.auditLog.create({
      data: {
        actorId: actorId ?? null,
        action,
        entityType,
        entityId,
        details: details ?? undefined,
      },
    });
  } catch (error) {
    console.error("writeAuditLog failed", error);
  }
}
