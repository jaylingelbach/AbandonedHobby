export default function Loading() {
  return (
    <div
      className="grid grid-cols-1 lg:grid-cols-5"
      role="status"
      aria-live="polite"
      aria-label="Loading sign-up page"
    >
      <div className="bg-[#F4F4F0] h-screen w-full lg:col-span-3 overflow-y-auto flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900" />
      </div>
      <div className="bg-[#3C8F7C] hidden lg:block lg:col-span-2" />
    </div>
  );
}
