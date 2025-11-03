// import { Home, LifeBuoy, ArrowLeft } from 'lucide-react';
// import Link from 'next/link';

// export default function NotFound() {
//   return (
//     <main className="ah-404 relative isolate flex min-h-[100svh] items-center justify-center px-4 py-8 sm:px-6 md:px-10">
//       <div className="ah-card relative w-full max-w-md sm:max-w-xl rounded-3xl border-4 border-black bg-[#EEF5FF] p-6 sm:p-8 md:p-10 shadow-[6px_6px_0_0_rgba(0,0,0,1)] md:shadow-[10px_10px_0_0_rgba(0,0,0,1)]">
//         {/* Mobile badge (inline) */}
//         <span className="sm:hidden inline-flex items-center rounded-full border-2 border-black bg-pink-400 px-2.5 py-0.5 text-xs font-extrabold uppercase tracking-wider mb-3 shadow-[3px_3px_0_0_rgba(0,0,0,1)]">
//           Abandoned Hobby
//         </span>

//         {/* Desktop badge (absolute chip) */}
//         <div className="hidden sm:block pointer-events-none absolute -top-3 left-6 rounded-full border-4 border-black bg-pink-400 px-3 py-1 text-sm font-extrabold uppercase tracking-wider shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
//           Abandoned Hobby
//         </div>

//         <h1 className="text-5xl sm:text-7xl md:text-8xl font-black leading-none tracking-tight">
//           404
//         </h1>

//         <p className="mt-3 text-base sm:text-lg md:text-xl font-semibold">
//           We couldn’t find that page.
//         </p>
//         <p className="mt-1 text-sm opacity-70">
//           It may have moved, been renamed, or never existed.
//         </p>

//         <div className="mt-8 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3">
//           <Link
//             href="/"
//             className="ah-btn inline-flex w-full sm:w-auto justify-center items-center gap-2 rounded-2xl border-4 border-black bg-pink-400 px-4 py-3 font-bold shadow-[5px_5px_0_0_rgba(0,0,0,1)] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[7px_7px_0_0_rgba(0,0,0,1)] focus:outline-none focus:ring-2 focus:ring-black"
//           >
//             <Home className="h-5 w-5" aria-hidden="true" />
//             Go home
//           </Link>

//           <Link
//             href="/support"
//             className="ah-btn inline-flex w-full sm:w-auto justify-center items-center gap-2 rounded-2xl border-4 border-black bg-white px-4 py-3 font-bold shadow-[5px_5px_0_0_rgba(0,0,0,1)] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[7px_7px_0_0_rgba(0,0,0,1)] focus:outline-none focus:ring-2 focus:ring-black"
//           >
//             <LifeBuoy className="h-5 w-5" aria-hidden="true" />
//             Contact support
//           </Link>

//           <Link
//             href="/features"
//             className="ah-btn inline-flex w-full sm:w-auto justify-center items-center gap-2 rounded-2xl border-4 border-black bg-white px-4 py-3 font-bold shadow-[5px_5px_0_0_rgba(0,0,0,1)] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[7px_7px_0_0_rgba(0,0,0,1)] focus:outline-none focus:ring-2 focus:ring-black"
//           >
//             <ArrowLeft className="h-5 w-5" aria-hidden="true" />
//             Explore features
//           </Link>
//         </div>
//       </div>
//     </main>
//   );
// }
import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="ah-404 relative isolate flex min-h-[100svh] items-center justify-center px-4 py-8 sm:px-6 md:px-10">
      <div className="relative w-full max-w-md sm:max-w-xl rounded-3xl border-4 border-black bg-[#EEF5FF] p-6 sm:p-8 md:p-10 shadow-[6px_6px_0_0_rgba(0,0,0,1)] md:shadow-[10px_10px_0_0_rgba(0,0,0,1)]">
        <span className="sm:hidden inline-flex items-center rounded-full border-2 border-black bg-pink-400 px-2.5 py-0.5 text-xs font-extrabold uppercase tracking-wider mb-3 shadow-[3px_3px_0_0_rgba(0,0,0,1)]">
          Abandoned Hobby
        </span>

        <div className="hidden sm:block pointer-events-none absolute -top-3 left-6 rounded-full border-4 border-black bg-pink-400 px-3 py-1 text-sm font-extrabold uppercase tracking-wider shadow-[4px_4px_0_0_rgba(0,0,0,1)]">
          Abandoned Hobby
        </div>

        <h1 className="text-5xl sm:text-7xl md:text-8xl font-black leading-none tracking-tight">
          404
        </h1>

        <p className="mt-3 text-base sm:text-lg md:text-xl font-semibold">
          We couldn’t find that page.
        </p>
        <p className="mt-1 text-sm opacity-70">
          It may have moved, been renamed, or never existed.
        </p>

        <div className="mt-8 flex flex-col sm:flex-row sm:flex-wrap items-stretch sm:items-center gap-3">
          <Link
            href="/"
            className="inline-flex w-full sm:w-auto justify-center items-center gap-2 rounded-2xl border-4 border-black bg-pink-400 px-4 py-3 font-bold shadow-[5px_5px_0_0_rgba(0,0,0,1)] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[7px_7px_0_0_rgba(0,0,0,1)] focus:outline-none focus:ring-2 focus:ring-black"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M3 10.5 12 3l9 7.5V21a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1v-10.5Z"
                fill="currentColor"
              />
            </svg>
            Go home
          </Link>

          <Link
            href="/support"
            className="inline-flex w-full sm:w-auto justify-center items-center gap-2 rounded-2xl border-4 border-black bg-white px-4 py-3 font-bold shadow-[5px_5px_0_0_rgba(0,0,0,1)] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[7px_7px_0_0_rgba(0,0,0,1)] focus:outline-none focus:ring-2 focus:ring-black"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 5a5 5 0 1 1 0 10 5 5 0 0 1 0-10Z"
                fill="currentColor"
              />
            </svg>
            Contact support
          </Link>

          <Link
            href="/features"
            className="inline-flex w-full sm:w-auto justify-center items-center gap-2 rounded-2xl border-4 border-black bg-white px-4 py-3 font-bold shadow-[5px_5px_0_0_rgba(0,0,0,1)] transition-transform hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[7px_7px_0_0_rgba(0,0,0,1)] focus:outline-none focus:ring-2 focus:ring-black"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M14 6 8 12l6 6M8 12h12"
                stroke="currentColor"
                strokeWidth="2"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            Explore features
          </Link>
        </div>
      </div>
    </main>
  );
}
