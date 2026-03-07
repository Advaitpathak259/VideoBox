import { useNavigate } from "react-router-dom";
import { useTheme } from "../../contexts/ThemeContext";

export default function Hero() {
  const { darkMode } = useTheme();
  const navigate = useNavigate();

  return (
    <section className="flex flex-col lg:flex-row items-center justify-center min-h-screen px-10 md:px-24 pt-20 gap-10">
      <div className="flex-1 space-y-8 text-center lg:text-left">
        <h1 className="text-4xl md:text-7xl font-black uppercase tracking-tighter leading-tight">
          Connect <span className="text-[#018CCB]">Now</span> <br /> Anywhere.
        </h1>
        <p className={`text-lg max-w-md mx-auto lg:mx-0 ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
          The most reliable platform for your high-definition video conferences. Simple, secure, and fast.
        </p>
        <button 
          onClick={() => navigate("/auth")}
          className="bg-[#018CCB] text-white px-12 py-4 rounded-full font-extrabold uppercase tracking-widest hover:shadow-[0_0_20px_rgba(1,140,203,0.4)] transition-all"
        >
          Get Started
        </button>
      </div>
      
      {/* Strict Image Wrapper for Hero Illustration */}
      <div className="flex-1 flex justify-center items-center">
        <div className="w-full max-w-[500px] aspect-square relative">
          <img 
            src="/erasebg-transformed.png" 
            alt="Video Illustration" 
            className="w-full h-full object-contain animate-float drop-shadow-2xl"
          />
        </div>
      </div>
    </section>
  );
}