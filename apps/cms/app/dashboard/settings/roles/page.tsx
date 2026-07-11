"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@repo/graphql/react";
import { GET_ROLES, CREATE_ROLE, UPDATE_ROLE, DELETE_ROLE } from "@repo/graphql";
import type { Role } from "@repo/types";

export default function RolesPage() {
  const [showCreate, setShowCreate] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [newRole, setNewRole] = useState({
    name: "",
    label: "",
    description: "",
  });

  const { data, loading, refetch } = useQuery<{ roles: Role[] }>(GET_ROLES);
  const roles = data?.roles ?? [];

  const [createRole] = useMutation(CREATE_ROLE);
  const [updateRole] = useMutation(UPDATE_ROLE);
  const [deleteRole] = useMutation(DELETE_ROLE);

  const handleCreate = async () => {
    if (!newRole.name || !newRole.label) return;
    try {
      await createRole({ variables: { input: newRole } });
      setShowCreate(false);
      setNewRole({ name: "", label: "", description: "" });
      await refetch();
    } catch (err) {
      console.error("Create failed", err);
    }
  };

  const handleUpdate = async (id: string, label: string, description: string) => {
    try {
      await updateRole({
        variables: {
          id,
          input: { label, description },
        },
      });
      setEditing(null);
      await refetch();
    } catch (err) {
      console.error("Update failed", err);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!confirm(`Remover role "${name}"?`)) return;
    try {
      await deleteRole({ variables: { id } });
      await refetch();
    } catch (err) {
      alert((err as Error).message);
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
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-headline text-2xl font-bold text-on-surface">
            Roles
          </h1>
          <p className="text-on-surface-variant text-sm mt-1">
            Gerencie os roles do sistema
          </p>
        </div>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="bg-primary text-on-primary font-bold py-2 px-4 rounded-lg text-sm hover:opacity-90"
        >
          + Novo Role
        </button>
      </div>

      {/* Create Form */}
      {showCreate && (
        <div className="bg-surface-container rounded-xl p-6 border border-primary/30 space-y-4">
          <h2 className="font-headline text-lg font-bold text-on-surface">
            Criar Role
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-on-surface-variant mb-1 font-label">
                Nome (identificador)
              </label>
              <input
                type="text"
                value={newRole.name}
                onChange={(e) =>
                  setNewRole({
                    ...newRole,
                    name: e.target.value.toUpperCase().replace(/\s/g, "_"),
                  })
                }
                className="w-full bg-surface-container-high border border-outline-variant rounded-lg px-4 py-2.5 text-on-surface focus:ring-2 focus:ring-primary focus:outline-none text-sm font-code"
                placeholder="EDITOR"
              />
            </div>
            <div>
              <label className="block text-sm text-on-surface-variant mb-1 font-label">
                Label (exibição)
              </label>
              <input
                type="text"
                value={newRole.label}
                onChange={(e) =>
                  setNewRole({ ...newRole, label: e.target.value })
                }
                className="w-full bg-surface-container-high border border-outline-variant rounded-lg px-4 py-2.5 text-on-surface focus:ring-2 focus:ring-primary focus:outline-none text-sm"
                placeholder="Editor"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm text-on-surface-variant mb-1 font-label">
              Descrição (opcional)
            </label>
            <input
              type="text"
              value={newRole.description}
              onChange={(e) =>
                setNewRole({ ...newRole, description: e.target.value })
              }
              className="w-full bg-surface-container-high border border-outline-variant rounded-lg px-4 py-2.5 text-on-surface focus:ring-2 focus:ring-primary focus:outline-none text-sm"
              placeholder="Pode editar conteúdo..."
            />
          </div>
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setShowCreate(false)}
              className="text-on-surface-variant text-sm px-4 py-2 hover:text-on-surface"
            >
              Cancelar
            </button>
            <button
              onClick={handleCreate}
              disabled={!newRole.name || !newRole.label}
              className="bg-primary text-on-primary font-bold px-6 py-2 rounded-lg text-sm disabled:opacity-50"
            >
              Criar
            </button>
          </div>
        </div>
      )}

      {/* Roles List */}
      <div className="space-y-3">
        {roles.map((role) => (
          <div
            key={role.id}
            className="bg-surface-container rounded-xl border border-outline-variant overflow-hidden"
          >
            <div className="flex items-center gap-4 p-4">
              {/* Icon */}
              <div
                className={`w-10 h-10 rounded-lg flex items-center justify-center text-lg ${
                  role.isAdmin
                    ? "bg-primary/15"
                    : role.isSystem
                      ? "bg-secondary/15"
                      : "bg-outline-variant/30"
                }`}
              >
                {role.isAdmin ? "👑" : role.isSystem ? "🔒" : "🏷️"}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-on-surface">
                    {role.label}
                  </span>
                  <span className="text-xs font-code text-on-surface-variant bg-surface-container-high px-1.5 py-0.5 rounded">
                    {role.name}
                  </span>
                  {role.isAdmin && (
                    <span className="text-xs bg-primary/20 text-primary px-1.5 py-0.5 rounded font-bold">
                      ADMIN
                    </span>
                  )}
                </div>
                <p className="text-xs text-on-surface-variant truncate mt-0.5">
                  {role.description || "Sem descrição"}
                </p>
              </div>

              {/* User count */}
              <span className="text-xs text-on-surface-variant">
                {role.userCount ?? 0} usuário(s)
              </span>

              {/* Actions */}
              {!role.isAdmin && (
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      setEditing(editing === role.id ? null : role.id)
                    }
                    className="text-xs text-primary hover:bg-primary/10 px-2 py-1 rounded"
                  >
                    Editar
                  </button>
                  {!role.isSystem && (
                    <button
                      onClick={() => handleDelete(role.id, role.name)}
                      className="text-xs text-error hover:bg-error/10 px-2 py-1 rounded"
                    >
                      Remover
                    </button>
                  )}
                </div>
              )}
            </div>

            {/* Edit inline */}
            {editing === role.id && (
              <EditRoleForm
                role={role}
                onSave={(label, desc) =>
                  handleUpdate(role.id, label, desc)
                }
                onCancel={() => setEditing(null)}
              />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function EditRoleForm({
  role,
  onSave,
  onCancel,
}: {
  role: Role;
  onSave: (label: string, description: string) => void;
  onCancel: () => void;
}) {
  const [label, setLabel] = useState(role.label);
  const [description, setDescription] = useState(role.description || "");

  return (
    <div className="border-t border-outline-variant p-4 bg-surface-container-lowest space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-on-surface-variant mb-1">
            Label
          </label>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            className="w-full bg-surface-container-high border border-outline-variant rounded-lg px-3 py-2 text-on-surface text-sm focus:ring-2 focus:ring-primary focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs text-on-surface-variant mb-1">
            Descrição
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-surface-container-high border border-outline-variant rounded-lg px-3 py-2 text-on-surface text-sm focus:ring-2 focus:ring-primary focus:outline-none"
          />
        </div>
      </div>
      <div className="flex gap-2 justify-end">
        <button
          onClick={onCancel}
          className="text-xs text-on-surface-variant px-3 py-1.5"
        >
          Cancelar
        </button>
        <button
          onClick={() => onSave(label, description)}
          className="text-xs bg-primary text-on-primary font-bold px-4 py-1.5 rounded-lg"
        >
          Salvar
        </button>
      </div>
    </div>
  );
}
