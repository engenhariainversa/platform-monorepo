"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@repo/graphql/react";
import {
  GET_USERS,
  GET_ROLES,
  CREATE_USER,
  UPDATE_USER_ROLE,
  DELETE_USER,
  type User,
  type Role,
} from "@repo/graphql";

const roleColors: Record<string, string> = {
  ADMIN: "bg-primary/20 text-primary",
  MANAGER: "bg-secondary/20 text-secondary",
  AUTHENTICATED: "bg-tertiary/20 text-tertiary",
};

export default function UsersPage() {
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [form, setForm] = useState({
    firstName: "",
    lastName: "",
    email: "",
    username: "",
    password: "",
    roleName: "AUTHENTICATED",
  });

  const {
    data: usersData,
    loading: usersLoading,
    refetch: refetchUsers,
  } = useQuery<{ users: User[] }>(GET_USERS);
  const { data: rolesData, loading: rolesLoading } = useQuery<{
    roles: Role[];
  }>(GET_ROLES);
  const users = usersData?.users ?? [];
  const roles = rolesData?.roles ?? [];
  const loading = usersLoading || rolesLoading;

  const [createUser, { loading: creating }] = useMutation(CREATE_USER);
  const [updateUserRole] = useMutation(UPDATE_USER_ROLE);
  const [deleteUser] = useMutation(DELETE_USER);

  const handleCreate = async () => {
    setError("");
    try {
      await createUser({ variables: { input: form } });
      setForm({
        firstName: "",
        lastName: "",
        email: "",
        username: "",
        password: "",
        roleName: "AUTHENTICATED",
      });
      setShowForm(false);
      await refetchUsers();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao criar usuário");
    }
  };

  const handleRoleChange = async (id: string, roleName: string) => {
    try {
      await updateUserRole({ variables: { id, roleName } });
      await refetchUsers();
    } catch (err) {
      console.error("Failed to update role", err);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Tem certeza que deseja excluir ${name}?`)) return;
    try {
      await deleteUser({ variables: { id } });
      await refetchUsers();
    } catch (err) {
      console.error("Failed to delete user", err);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-2xl font-bold text-on-surface">
            Usuários
          </h1>
          <p className="text-on-surface-variant text-sm mt-1">
            {users.length} usuário{users.length !== 1 ? "s" : ""} cadastrado
            {users.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="bg-primary text-on-primary font-bold py-2 px-4 rounded-lg text-sm hover:opacity-90 transition-opacity"
        >
          {showForm ? "Cancelar" : "+ Novo Usuário"}
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="bg-surface-container rounded-xl p-6 border border-outline-variant space-y-4">
          <h2 className="font-headline text-lg font-bold text-on-surface">
            Novo Usuário
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <input
              type="text"
              value={form.firstName}
              onChange={(e) =>
                setForm({ ...form, firstName: e.target.value })
              }
              placeholder="Nome"
              className="bg-surface-container-high border border-outline-variant rounded-lg px-4 py-2.5 text-on-surface focus:ring-2 focus:ring-primary focus:outline-none text-sm"
            />
            <input
              type="text"
              value={form.lastName}
              onChange={(e) =>
                setForm({ ...form, lastName: e.target.value })
              }
              placeholder="Sobrenome"
              className="bg-surface-container-high border border-outline-variant rounded-lg px-4 py-2.5 text-on-surface focus:ring-2 focus:ring-primary focus:outline-none text-sm"
            />
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="Email"
              className="bg-surface-container-high border border-outline-variant rounded-lg px-4 py-2.5 text-on-surface focus:ring-2 focus:ring-primary focus:outline-none text-sm"
            />
            <input
              type="text"
              value={form.username}
              onChange={(e) =>
                setForm({ ...form, username: e.target.value })
              }
              placeholder="Username"
              className="bg-surface-container-high border border-outline-variant rounded-lg px-4 py-2.5 text-on-surface focus:ring-2 focus:ring-primary focus:outline-none text-sm"
            />
            <input
              type="password"
              value={form.password}
              onChange={(e) =>
                setForm({ ...form, password: e.target.value })
              }
              placeholder="Senha"
              className="bg-surface-container-high border border-outline-variant rounded-lg px-4 py-2.5 text-on-surface focus:ring-2 focus:ring-primary focus:outline-none text-sm"
            />
            <select
              value={form.roleName}
              onChange={(e) => setForm({ ...form, roleName: e.target.value })}
              className="bg-surface-container-high border border-outline-variant rounded-lg px-4 py-2.5 text-on-surface focus:ring-2 focus:ring-primary focus:outline-none text-sm"
            >
              {roles.map((r) => (
                <option key={r.id} value={r.name}>
                  {r.label}
                </option>
              ))}
            </select>
          </div>
          {error && (
            <p className="text-error text-sm">{error}</p>
          )}
          <button
            onClick={handleCreate}
            disabled={creating}
            className="bg-primary text-on-primary font-bold py-2 px-6 rounded-lg text-sm hover:opacity-90 disabled:opacity-50"
          >
            {creating ? "Criando..." : "Criar Usuário"}
          </button>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-surface-container rounded-xl border border-outline-variant overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-outline-variant">
              <th className="text-left px-6 py-3 text-xs font-label text-on-surface-variant uppercase tracking-wider">
                Usuário
              </th>
              <th className="text-left px-6 py-3 text-xs font-label text-on-surface-variant uppercase tracking-wider">
                Email
              </th>
              <th className="text-left px-6 py-3 text-xs font-label text-on-surface-variant uppercase tracking-wider">
                Role
              </th>
              <th className="text-right px-6 py-3 text-xs font-label text-on-surface-variant uppercase tracking-wider">
                Ações
              </th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr
                key={u.id}
                className="border-b border-outline-variant/50 hover:bg-surface-container-high transition-colors"
              >
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                      {u.firstName[0]}
                      {u.lastName[0]}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-on-surface">
                        {u.firstName} {u.lastName}
                      </p>
                      <p className="text-xs text-on-surface-variant">
                        @{u.username}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4 text-sm text-on-surface-variant">
                  {u.email}
                </td>
                <td className="px-6 py-4">
                  <select
                    value={u.role.name}
                    onChange={(e) => handleRoleChange(u.id, e.target.value)}
                    className={`text-xs font-bold px-3 py-1 rounded-full border-0 cursor-pointer ${roleColors[u.role.name] || "bg-outline-variant/20 text-on-surface-variant"}`}
                  >
                    {roles.map((r) => (
                      <option key={r.id} value={r.name}>
                        {r.label}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="px-6 py-4 text-right">
                  <button
                    onClick={() =>
                      handleDelete(u.id, `${u.firstName} ${u.lastName}`)
                    }
                    className="text-xs text-on-surface-variant hover:text-error transition-colors"
                  >
                    Excluir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
