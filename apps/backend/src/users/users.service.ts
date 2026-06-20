import { Injectable } from "@nestjs/common";
import { prisma } from "@repo/database";
import * as bcrypt from "bcryptjs";
import { CreateUserInput, UpdateUserInput } from "./users.types";

const USER_INCLUDE = { role: true };

@Injectable()
export class UsersService {
  async create(input: CreateUserInput) {
    const roleName = input.roleName || "AUTHENTICATED";
    const role = await prisma.role.findUnique({
      where: { name: roleName },
    });

    if (!role) {
      throw new Error(`Role "${roleName}" não encontrada`);
    }

    const hashedPassword = await bcrypt.hash(input.password, 12);
    return prisma.user.create({
      data: {
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email,
        username: input.username,
        password: hashedPassword,
        roleId: role.id,
      },
      include: USER_INCLUDE,
    });
  }

  async findAll() {
    return prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      include: USER_INCLUDE,
    });
  }

  async findById(id: string) {
    return prisma.user.findUnique({
      where: { id },
      include: USER_INCLUDE,
    });
  }

  async findByEmail(email: string) {
    return prisma.user.findUnique({
      where: { email },
      include: USER_INCLUDE,
    });
  }

  async findByUsername(username: string) {
    return prisma.user.findUnique({
      where: { username },
      include: USER_INCLUDE,
    });
  }

  async findByEmailOrUsername(identifier: string) {
    return prisma.user.findFirst({
      where: {
        OR: [{ email: identifier }, { username: identifier }],
      },
      include: USER_INCLUDE,
    });
  }

  async update(id: string, input: UpdateUserInput) {
    const data: Record<string, unknown> = {};

    if (input.firstName) data.firstName = input.firstName;
    if (input.lastName) data.lastName = input.lastName;
    if (input.email) data.email = input.email;

    if (input.roleName) {
      const role = await prisma.role.findUnique({
        where: { name: input.roleName },
      });
      if (!role) throw new Error(`Role "${input.roleName}" não encontrada`);
      data.roleId = role.id;
    }

    return prisma.user.update({
      where: { id },
      data,
      include: USER_INCLUDE,
    });
  }

  async updateRole(id: string, roleName: string) {
    const role = await prisma.role.findUnique({
      where: { name: roleName },
    });
    if (!role) throw new Error(`Role "${roleName}" não encontrada`);

    return prisma.user.update({
      where: { id },
      data: { roleId: role.id },
      include: USER_INCLUDE,
    });
  }

  async delete(id: string) {
    return prisma.user.delete({ where: { id } });
  }

  async count() {
    return prisma.user.count();
  }

  async countAdmins() {
    const adminRole = await prisma.role.findUnique({
      where: { name: "ADMIN" },
    });
    if (!adminRole) return 0;
    return prisma.user.count({ where: { roleId: adminRole.id } });
  }

  async validatePassword(plaintext: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plaintext, hash);
  }
}
