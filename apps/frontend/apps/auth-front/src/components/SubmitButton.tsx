export function SubmitButton({ label }: { label: string }) {
  return (
    <button
      type="submit"
      className="w-full py-2.5 rounded-lg font-bold text-sm text-white uppercase tracking-[0.15em] transition-all duration-200 mt-1"
      style={{ background: 'linear-gradient(135deg,#7c3aed 0%,#0053db 100%)', boxShadow: '0 4px 20px rgba(124,58,237,0.4)' }}
      onMouseEnter={(e) => { e.currentTarget.style.filter = 'brightness(1.12)'; e.currentTarget.style.boxShadow = '0 6px 28px rgba(124,58,237,0.55)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.filter = ''; e.currentTarget.style.boxShadow = '0 4px 20px rgba(124,58,237,0.4)'; }}
    >
      {label}
    </button>
  );
}
