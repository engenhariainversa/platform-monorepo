import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SYSTEM_ROLES = [
  {
    name: "ADMIN",
    label: "Administrador",
    description: "Acesso total ao sistema. Não pode ser removido.",
    isSystem: true,
    isAdmin: true,
  },
  {
    name: "MANAGER",
    label: "Gerente",
    description: "Gerencia conteúdo e usuários conforme permissões configuradas.",
    isSystem: true,
    isAdmin: false,
  },
  {
    name: "AUTHENTICATED",
    label: "Autenticado",
    description: "Usuário padrão com acesso básico ao sistema.",
    isSystem: true,
    isAdmin: false,
  },
];

const DEFAULT_PUBLIC_RESOURCES = ["live", "episodes", "pages"];

async function main() {
  console.log("🌱 Seeding database...\n");

  // ── Roles ───────────────────────────────────────
  for (const role of SYSTEM_ROLES) {
    const existing = await prisma.role.findUnique({
      where: { name: role.name },
    });

    if (existing) {
      console.log(`  ✓ Role "${role.name}" already exists`);
    } else {
      await prisma.role.create({ data: role });
      console.log(`  + Created role "${role.name}"`);
    }
  }

  // ── Public Resources ────────────────────────────
  for (const resource of DEFAULT_PUBLIC_RESOURCES) {
    const existing = await prisma.publicResource.findUnique({
      where: { resource },
    });

    if (existing) {
      console.log(`  ✓ Public resource "${resource}" already exists`);
    } else {
      await prisma.publicResource.create({ data: { resource } });
      console.log(`  + Created public resource "${resource}"`);
    }
  }

  console.log("\n✅ Seed completed!");
}

main()
  .catch((e) => {
    console.error("❌ Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
