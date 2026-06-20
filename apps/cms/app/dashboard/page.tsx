export default function DashboardPage() {
  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="font-headline text-2xl font-bold text-on-surface">
          Dashboard
        </h1>
        <p className="text-on-surface-variant text-sm mt-1">
          Visão geral do sistema
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Usuários", value: "—", icon: "👥", color: "primary" },
          { label: "Páginas", value: "—", icon: "📄", color: "secondary" },
          { label: "Episódios", value: "—", icon: "🎬", color: "tertiary" },
          { label: "Lives", value: "—", icon: "🔴", color: "error" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-surface-container rounded-xl p-5 border border-outline-variant"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl">{stat.icon}</span>
            </div>
            <p className="font-headline text-2xl font-bold text-on-surface">
              {stat.value}
            </p>
            <p className="text-on-surface-variant text-sm">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="bg-surface-container rounded-xl p-6 border border-outline-variant">
        <h2 className="font-headline text-lg font-bold text-on-surface mb-4">
          Ações Rápidas
        </h2>
        <div className="flex flex-wrap gap-3">
          <button className="bg-primary/15 text-primary px-4 py-2 rounded-lg text-sm font-bold hover:bg-primary/25 transition-colors">
            + Novo Usuário
          </button>
          <button className="bg-secondary/15 text-secondary px-4 py-2 rounded-lg text-sm font-bold hover:bg-secondary/25 transition-colors">
            + Nova Página
          </button>
          <button className="bg-tertiary/15 text-tertiary px-4 py-2 rounded-lg text-sm font-bold hover:bg-tertiary/25 transition-colors">
            + Novo Episódio
          </button>
        </div>
      </div>
    </div>
  );
}
