import { useTheme } from "../../contexts/ThemeContext";

const steps = [
  { id: "01", title: "Create Room", desc: "Start a meeting and get your unique link instantly." },
  { id: "02", title: "Invite Team", desc: "Send the link to anyone you want to join the call." },
  { id: "03", title: "Meet & Collab", desc: "Enjoy HD video and real-time screen sharing." }
];

export default function HowItWorks() {
  const { darkMode } = useTheme();
  return (
    <section className={`py-24 px-10 md:px-24 ${darkMode ? "bg-[#0f0f0f]" : "bg-[#f4f7f9]"}`}>
      <div className="max-w-6xl mx-auto">
        <h2 className="text-4xl font-black text-center mb-20 uppercase italic">How It Works</h2>
        <div className="flex flex-col lg:flex-row gap-16">
          {steps.map((s, i) => (
            <div key={i} className="flex-1 text-center group">
              <div className="relative inline-block mb-8">
                <div className="w-24 h-24 rounded-full bg-[#018CCB] text-white text-3xl font-black flex items-center justify-center shadow-2xl relative z-10">
                  {s.id}
                </div>
                {i < 2 && (
                  <div className="hidden lg:block absolute top-1/2 -right-12 w-24 h-[2px] bg-dashed bg-gray-600 opacity-20"></div>
                )}
              </div>
              <h3 className="text-2xl font-bold mb-4">{s.title}</h3>
              <p className={darkMode ? "text-gray-400" : "text-gray-600"}>{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}