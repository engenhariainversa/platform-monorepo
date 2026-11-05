/** Shown only while the viewer's slide differs from the presenter's. */
export function FollowButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full bg-primary px-5 py-2 text-sm font-bold text-on-primary shadow-lg hover:brightness-110"
    >
      Seguir apresentador
    </button>
  );
}
