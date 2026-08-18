import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { resolveDatabaseLocation } from "../src/lib/database-url";

const BCRYPT_ROUNDS = 12;
const DEFAULT_EXISTING_ADMIN_EMAIL = "admin@studio.com";

function requiredEnvironmentValue(name: string) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

async function main() {
  const nextEmail = requiredEnvironmentValue("ADMIN_EMAIL").toLowerCase();
  const nextPassword = requiredEnvironmentValue("ADMIN_PASSWORD");
  const nextName = process.env.ADMIN_NAME?.trim() || "Turkuvaz Admin";
  const existingAdminEmail = (process.env.ADMIN_CURRENT_EMAIL?.trim() || DEFAULT_EXISTING_ADMIN_EMAIL).toLowerCase();
  const databaseLocation = resolveDatabaseLocation();
  const prisma = new PrismaClient({ datasourceUrl: databaseLocation.datasourceUrl });

  try {
    const [existingAdmin, targetEmailUser, users] = await Promise.all([
      prisma.user.findUnique({ where: { email: existingAdminEmail } }),
      prisma.user.findUnique({ where: { email: nextEmail } }),
      prisma.user.findMany({ select: { id: true, email: true } }),
    ]);

    const userToUpdate = existingAdmin ?? (users.length === 1 ? users[0] : null);
    if (!userToUpdate) {
      throw new Error(
        `No safe admin account found. Set ADMIN_CURRENT_EMAIL if the existing admin email is not ${DEFAULT_EXISTING_ADMIN_EMAIL}.`,
      );
    }

    if (targetEmailUser && targetEmailUser.id !== userToUpdate.id) {
      throw new Error(`Cannot update admin: ${nextEmail} already belongs to another user.`);
    }

    const passwordHash = await bcrypt.hash(nextPassword, BCRYPT_ROUNDS);
    const updated = await prisma.user.update({
      where: { id: userToUpdate.id },
      data: {
        email: nextEmail,
        name: nextName,
        passwordHash,
      },
      select: {
        id: true,
        email: true,
        name: true,
        updatedAt: true,
      },
    });

    console.log(`Admin account updated: ${updated.email}`);
    console.log(`User ID preserved: ${updated.id}`);
    console.log(`Name: ${updated.name ?? ""}`);
    console.log(`Updated at: ${updated.updatedAt.toISOString()}`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Admin update failed.");
  process.exit(1);
});
