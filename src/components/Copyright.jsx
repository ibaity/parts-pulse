export default function Copyright({ className = '', inline = false }) {
  const email = <a href="mailto:mohbaity@gmail.com" className="hover:underline">mohbaity@gmail.com</a>;
  if (inline) {
    return <p className={`text-[11px] ${className}`}>© 2026 Mohammed Albaity · All rights reserved · {email}</p>;
  }
  return (
    <div className={`text-[11px] leading-relaxed ${className}`}>
      <p>© 2026 Mohammed Albaity</p>
      <p>All rights reserved</p>
      {email}
    </div>
  );
}
