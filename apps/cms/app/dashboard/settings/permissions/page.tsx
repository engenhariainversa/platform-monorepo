"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@repo/graphql/react";
import {
  GET_ROLES,
  GET_PERMISSIONS_FOR_ROLE,
  GET_PUBLIC_RESOURCES,
  TOGGLE_PERMISSION,
  TOGGLE_PUBLIC_RESOURCE,
} from "@repo/graphql";
import type { Role, ResourcePermissions, PublicResource } from "@repo/types";

const RESOURCE_LABELS: Record<string, string> = {
  live: "Live",
  episodes: "Episódios",
  users: "Usuários",
  pages: "Páginas",
};

const ACTION_LABELS: Record<string, string> = {
  create: "Criar",
  read: "Ler",
  update: "Editar",
  delete: "Excluir",
};

export default function PermissionsPage() {
  const [selectedRoleId, setSelectedRoleId] = useState<string | null>(null);
  const [permissions, setPermissions] = useState<ResourcePermissions[]>([]);
  const [publicResources, setPublicResources] = useState<PublicResource[]>([]);
  const [toggling, setToggling] = useState<string | null>(null);

  const { data: rolesData, loading: rolesLoading } = useQuery<{ roles: Role[] }>(
    GET_ROLES,
  );
  const { data: publicData, loading: publicLoading } = useQuery<{
    publicResources: PublicResource[];
  }>(GET_PUBLIC_RESOURCES);

  const roles = (rolesData?.roles ?? []).filter((r) => !r.isAdmin);
  const loading = rolesLoading || publicLoading;

  // Seed the public-resources local state (it's mutated optimistically below).
  useEffect(() => {
    if (publicData?.publicResources) {
      setPublicResources(publicData.publicResources);
    }
  }, [publicData]);

  // Default to the first non-admin role once roles have loaded.
  useEffect(() => {
    if (!selectedRoleId && roles.length > 0) {
      setSelectedRoleId(roles[0].id);
    }
  }, [roles, selectedRoleId]);

  // Permissions for the selected role; re-runs when the selection changes.
  const { data: permsData } = useQuery<{
    permissionsForRole: ResourcePermissions[];
  }>(GET_PERMISSIONS_FOR_ROLE, {
    variables: { roleId: selectedRoleId },
    skip: !selectedRoleId,
  });

  useEffect(() => {
    if (permsData?.permissionsForRole) {
      setPermissions(permsData.permissionsForRole);
    }
  }, [permsData]);

  const [togglePermission] = useMutation(TOGGLE_PERMISSION);
  const [togglePublicResource] = useMutation<{
    togglePublicResource: boolean;
  }>(TOGGLE_PUBLIC_RESOURCE);

  const handleToggle = async (resource: string, action: string) => {
    if (!selectedRoleId) return;
    const key = `${resource}:${action}`;
    setToggling(key);

    try {
      await togglePermission({
        variables: { input: { roleId: selectedRoleId, resource, action } },
      });
      // Optimistic update
      setPermissions((prev) =>
        prev.map((p) =>
          p.resource === resource
            ? { ...p, [action]: !p[action as keyof ResourcePermissions] }
            : p,
        ),
      );
    } catch (err) {
      console.error("Toggle failed", err);
    } finally {
      setToggling(null);
    }
  };

  const handleTogglePublic = async (resource: string) => {
    setToggling(`public:${resource}`);
    try {
      const { data } = await togglePublicResource({
        variables: { input: { resource } },
      });

      if (data?.togglePublicResource) {
        setPublicResources((prev) => [...prev, { id: resource, resource }]);
      } else {
        setPublicResources((prev) =>
          prev.filter((p) => p.resource !== resource),
        );
      }
    } catch (err) {
      console.error("Toggle public failed", err);
    } finally {
      setToggling(null);
    }
  };

  const isPublic = (resource: string) =>
    publicResources.some((p) => p.resource === resource);

  const selectedRole = roles.find((r) => r.id === selectedRoleId);

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
      <div>
        <h1 className="font-headline text-2xl font-bold text-on-surface">
          Permissões
        </h1>
        <p className="text-on-surface-variant text-sm mt-1">
          Configure quais ações cada role pode realizar em cada recurso
        </p>
      </div>

      {/* Admin info banner */}
      <div className="bg-primary/10 border border-primary/20 rounded-lg p-4 flex items-center gap-3">
        <span className="text-xl">🔒</span>
        <p className="text-sm text-on-surface">
          <strong>ADMIN</strong> sempre tem acesso total a todos os recursos.
          Configure abaixo as permissões para os demais roles.
        </p>
      </div>

      {/* Role Selector */}
      <div className="bg-surface-container rounded-xl p-6 border border-outline-variant">
        <label className="block text-sm text-on-surface-variant mb-2 font-label">
          Selecione um role
        </label>
        <div className="flex gap-3 flex-wrap">
          {roles.map((role) => (
            <button
              key={role.id}
              onClick={() => setSelectedRoleId(role.id)}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all ${
                selectedRoleId === role.id
                  ? "bg-primary text-on-primary"
                  : "bg-surface-container-high text-on-surface-variant hover:text-on-surface"
              }`}
            >
              {role.label}
              {role.isSystem && (
                <span className="ml-1 text-xs opacity-60">🔒</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Permissions Grid */}
      {selectedRole && (
        <div className="bg-surface-container rounded-xl border border-outline-variant overflow-hidden">
          <div className="p-4 border-b border-outline-variant">
            <h2 className="font-headline text-lg font-bold text-on-surface">
              Permissões de {selectedRole.label}
            </h2>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-outline-variant">
                  <th className="text-left px-4 py-3 text-sm font-label text-on-surface-variant">
                    Recurso
                  </th>
                  {Object.entries(ACTION_LABELS).map(([key, label]) => (
                    <th
                      key={key}
                      className="text-center px-4 py-3 text-sm font-label text-on-surface-variant"
                    >
                      {label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {permissions.map((perm) => (
                  <tr
                    key={perm.resource}
                    className="border-b border-outline-variant/50 last:border-b-0"
                  >
                    <td className="px-4 py-3 text-sm font-bold text-on-surface">
                      {RESOURCE_LABELS[perm.resource] || perm.resource}
                    </td>
                    {(["create", "read", "update", "delete"] as const).map(
                      (action) => (
                        <td key={action} className="text-center px-4 py-3">
                          <button
                            onClick={() =>
                              handleToggle(perm.resource, action)
                            }
                            disabled={
                              toggling === `${perm.resource}:${action}`
                            }
                            className={`w-10 h-6 rounded-full transition-colors relative inline-block ${
                              perm[action]
                                ? "bg-primary"
                                : "bg-outline-variant"
                            } ${toggling === `${perm.resource}:${action}` ? "opacity-50" : ""}`}
                          >
                            <span
                              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                                perm[action]
                                  ? "left-[18px]"
                                  : "left-0.5"
                              }`}
                            />
                          </button>
                        </td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Public Access */}
      <div className="bg-surface-container rounded-xl border border-outline-variant overflow-hidden">
        <div className="p-4 border-b border-outline-variant">
          <h2 className="font-headline text-lg font-bold text-on-surface">
            Acesso Público
          </h2>
          <p className="text-on-surface-variant text-xs mt-1">
            Recursos com leitura pública podem ser acessados sem login (ex:
            landing page)
          </p>
        </div>

        <div className="divide-y divide-outline-variant/50">
          {Object.entries(RESOURCE_LABELS).map(([resource, label]) => (
            <div
              key={resource}
              className="flex items-center justify-between px-4 py-3"
            >
              <span className="text-sm font-bold text-on-surface">
                {label}
              </span>
              <button
                onClick={() => handleTogglePublic(resource)}
                disabled={toggling === `public:${resource}`}
                className={`w-10 h-6 rounded-full transition-colors relative ${
                  isPublic(resource)
                    ? "bg-secondary"
                    : "bg-outline-variant"
                } ${toggling === `public:${resource}` ? "opacity-50" : ""}`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white transition-transform ${
                    isPublic(resource) ? "left-[18px]" : "left-0.5"
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
