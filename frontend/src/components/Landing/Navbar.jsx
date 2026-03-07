import React, { useEffect, useState } from "react";
import { MdLightMode, MdDarkMode } from "react-icons/md";
import { useNavigate } from "react-router-dom";
import { useTheme } from "../../contexts/ThemeContext";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const { darkMode, toggleTheme } = useTheme();
  const navigate = useNavigate();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-[1000] flex items-center justify-between px-8 py-4 md:px-20 transition-all duration-300 
      ${scrolled ? (darkMode ? "bg-[#0a0a0a]/90 backdrop-blur-md" : "bg-white/90 backdrop-blur-md shadow-sm") : "bg-transparent"}`}>
      
      {/* Image Wrapper for Logo */}
      <div className="h-12 md:h-14 w-40 flex items-center overflow-hidden">
        <img 
          src="/videobox-logo.png" 
          alt="VideoBox" 
          className="h-80 w-auto object-contain cursor-pointer" 
          onClick={() => navigate("/")} 
        />
      </div>

      <div className="flex items-center gap-6 md:gap-10 font-medium">
        <button onClick={toggleTheme} className="p-2 rounded-full hover:bg-gray-500/10 transition-colors">
          {darkMode ? <MdLightMode size={24} className="text-yellow-400" /> : <MdDarkMode size={24} />}
        </button>
        
        {/* Navigating to /join-room which matches your /:url route */}
        <p onClick={() => navigate("/join-now")} className="hidden md:block cursor-pointer hover:text-[#018CCB] transition-colors">Join as Guest</p>
        
        <button 
          onClick={() => navigate("/auth")}
          className="bg-[#018CCB] text-white px-6 py-2 rounded-xl font-bold shadow-lg hover:brightness-110 active:scale-95 transition-all"
        >
          Login
        </button>
      </div>
    </nav>
  );
}