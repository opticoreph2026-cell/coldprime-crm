"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="text-center p-10">
      <h2 className="text-xl font-bold text-red-600 mb-3">
        Something went wrong
      </h2>
      <p className="text-sm text-slate-500 mb-5">
        {error.message || "An unexpected error occurred."}
      </p>
      <button
        onClick={reset} className="px-6 py-2.5 bg-blue-800 text-white cursor-pointer text-sm font-semibold border-0 rounded-md"
      >
        Try again
      </button>
    </div>
  );
}
