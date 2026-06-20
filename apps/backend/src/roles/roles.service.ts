import { Injectable, BadRequestException } from "@nestjs/common";
import { prisma } from "@repo/database";
import { CreateRoleInput, UpdateRoleInput } from "./roles.types";

@Injectable()
export class RolesService {
  async getRoles() {
    const roles = await prisma.role.findMany({
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { users: true } } },
    });

    return roles.map((r) => ({
      ...r,
      userCount: r._count.users,
    }));
  }

  async getRole(id: string) {
    return prisma.role.findUnique({ where: { id } });
  }

  async getRoleByName(name: string) {
    return prisma.role.findUnique({ where: { name } });
  }

  async createRole(input: CreateRoleInput) {
    const existing = await prisma.role.findUnique({
      where: { name: input.name.toUpperCase() },
    });

    if (existing) {
      throw new BadRequestException(`Role "${input.name}" já existe`);
    }

    return prisma.role.create({
      data: {
        name: input.name.toUpperCase(),
        label: input.label,
        description: input.description,
        isSystem: false,
        isAdmin: false,
      },
    });
  }

  async updateRole(id: string, input: UpdateRoleInput) {
    const role = await prisma.role.findUnique({ where: { id } });
    if (!role) {
      throw new BadRequestException("Role não encontrada");
    }

    return prisma.role.update({
      where: { id },
      data: input,
    });
  }

  async deleteRole(id: string) {
    const role = await prisma.role.findUnique({
      where: { id },
      include: { _count: { select: { users: true } } },
    });

    if (!role) {
      throw new BadRequestException("Role não encontrada");
    }

    if (role.isSystem) {
      throw new BadRequestException(
        "Roles do sistema não podem ser removidas",
      );
    }

    if (role._count.users > 0) {
      throw new BadRequestException(
        `Não é possível remover. ${role._count.users} usuário(s) atribuído(s) a esta role.`,
      );
    }

    await prisma.role.delete({ where: { id } });
    return true;
  }
}
