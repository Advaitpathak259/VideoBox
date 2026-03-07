import { useTheme } from "../../contexts/ThemeContext";

export default function Screenshots() {
  const { darkMode } = useTheme();
  const shots = [
    { url: "https://images.unsplash.com/photo-1616587226960-4a03badbe8bf?q=80&w=800", title: "Global Dashboard" },
    { url: "https://images.unsplash.com/photo-1516321318423-f06f85e504b3?q=80&w=800", title: "HD Video Grid" },
    { url: "https://images.unsplash.com/photo-1522202176988-66273c2fd55f?q=80&w=800", title: "Live Chat" },
    { url: "https://images.unsplash.com/photo-1551434678-e076c223a692?q=80&w=800", title: "Screen Sharing" }
  ];

  return (
    <section className={`py-24 px-8 md:px-24 ${darkMode ? "bg-[#0f0f0f]" : "bg-gray-100"}`}>
      <h2 className="text-4xl font-black text-center mb-16 uppercase italic">See the Experience</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-10 max-w-6xl mx-auto">
        {shots.map((s, i) => (
          <div key={i} className={`rounded-3xl overflow-hidden border ${darkMode ? "bg-[#1a1a1a] border-gray-800" : "bg-white border-gray-200"} shadow-2xl`}>
            {/* Rigid Image Wrapper */}
            <div className="w-full aspect-video overflow-hidden">
              <img 
                src={s.url} 
                alt={s.title} 
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-700" 
              />
            </div>
            <div className="p-6">
              <h4 className="text-xl font-bold">{s.title}</h4>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}