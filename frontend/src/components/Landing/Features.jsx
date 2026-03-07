import { AiOutlineLock } from "react-icons/ai";
import { FiZap } from "react-icons/fi";
import { HiOutlineVideoCamera } from "react-icons/hi2";
import { MdDevices } from "react-icons/md";
import { useTheme } from "../../contexts/ThemeContext";

const features = [
  { icon: <AiOutlineLock size={40} />, title: "Secure Calls", desc: "End-to-end encryption for every single meeting." },
  { icon: <FiZap size={40} />, title: "Instant Join", desc: "Zero delay. Jump into your meetings with one click." },
  { icon: <HiOutlineVideoCamera size={40} />, title: "HD Quality", desc: "Crystal clear video regardless of your connection." },
  { icon: <MdDevices size={40} />, title: "Any Device", desc: "Optimized for mobile, tablets, and desktops." },
];

export default function Features() {
  const { darkMode } = useTheme();
  return (
    <section className="py-24 px-10 md:px-24">
      <h2 className="text-3xl md:text-4xl font-black text-center mb-16 uppercase italic">Built for Performance</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 max-w-7xl mx-auto">
        {features.map((f, i) => (
          <div key={i} className={`p-10 rounded-[2rem] transition-all border group hover:border-[#018CCB] 
            ${darkMode ? "bg-[#111] border-gray-800" : "bg-white border-gray-100 shadow-xl"}`}>
            <div className="text-[#018CCB] mb-6 group-hover:scale-110 transition-transform duration-300">
              {f.icon}
            </div>
            <h3 className="text-xl font-bold mb-4">{f.title}</h3>
            <p className={`text-sm leading-relaxed ${darkMode ? "text-gray-400" : "text-gray-500"}`}>
              {f.desc}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}