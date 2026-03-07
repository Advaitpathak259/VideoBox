import React from "react";
import Navbar from "../components/Landing/Navbar";
import Hero from "../components/Landing/Hero";
import Features from "../components/Landing/Features";
import HowItWorks from "../components/Landing/HowItWorks";
import Screenshots from "../components/Landing/Screenshots";
import Footer from "../components/Landing/Footer";
import { useTheme } from "../contexts/ThemeContext";

export default function LandingPage() {
  const { darkMode } = useTheme();

  return (
    <div className={`min-h-screen transition-colors duration-300 font-['Poppins',sans-serif] 
      ${darkMode ? "bg-[#0a0a0a] text-gray-200" : "bg-[#FBFBFB] text-gray-800"}`}>
      
      {/* Animation Styles */}
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes floatImg {
          0%, 100% { transform: translateY(0px); }
          50% { transform: translateY(-20px); }
        }
        .animate-float { animation: floatImg 4s ease-in-out infinite; }
      `}} />

      <Navbar />
      <main>
        <Hero />
        <Features />
        <HowItWorks />
        <Screenshots />
      </main>
      <Footer />
    </div>
  );
}