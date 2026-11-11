import Link from "next/link";
export function Mark() {
  return (
    <svg
      viewBox="0 0 36 36"
      width="32"
      height="32"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M8 9L27 8L24 27L8 25L8 9ZM8 9L24 27M27 8L8 25"
        stroke="currentColor"
        strokeWidth="1.5"
      />
      <circle cx="8" cy="9" r="3.5" fill="currentColor" />
      <circle cx="27" cy="8" r="3.5" fill="currentColor" />
      <circle cx="24" cy="27" r="3.5" fill="currentColor" />
      <circle cx="8" cy="25" r="3.5" fill="currentColor" />
    </svg>
  );
}
export function Logo() {
  return (
    <Link href="/" className="logo">
      <Mark />
      <span>
        GapForge<span className="logo-ai">AI</span>
      </span>
    </Link>
  );
}
