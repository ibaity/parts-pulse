export default function Copyright({ className = '' }) {
  return (
    <div className={`text-[11px] leading-relaxed ${className}`}>
      <p>© 2026 Mohammed Albaity</p>
      <p>All rights reserved</p>
      <a href="mailto:mohbaity@gmail.com" className="hover:underline">mohbaity@gmail.com</a>
    </div>
  );
}
