export default function Footer() {
  return (
    <footer className="bg-[#050505] text-white py-20 px-10 border-t border-gray-900">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-3 gap-12 items-center">
        {/* Logo Wrapper */}
        <div className="h-24 flex justify-center md:justify-start">
          <img src="/videobox-logo.png" alt="VideoBox" className="h-full object-contain grayscale opacity-50 hover:opacity-100 transition-opacity" />
        </div>

        <div className="flex justify-center gap-8 text-sm font-medium text-gray-400">
          <a href="#" className="hover:text-[#018CCB]">Product</a>
          <a href="#" className="hover:text-[#018CCB]">Privacy</a>
          <a href="#" className="hover:text-[#018CCB]">Terms</a>
        </div>

        <p className="text-center md:text-right text-gray-600 text-xs">
          © {new Date().getFullYear()} VideoBox. All rights reserved.
        </p>
      </div>
    </footer>
  );
}