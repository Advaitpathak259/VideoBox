import React, { useState, useContext } from "react";
import { useLocation } from "react-router-dom";
import { 
  Mail, 
  User, 
  Lock, 
  /* Video, 
  Mic, 
  MicOff, 
  VideoOff, 
  MessageSquare, 
  X, 
  Send,
  PhoneOff */
} from "lucide-react";
import { AuthContext } from "../contexts/AuthContext";
import { useTheme } from "../contexts/ThemeContext";

export default function Authentication() {
  const location = useLocation();
  const searchParams = new URLSearchParams(location.search);
  
  // Logic for Form State
  const initialFormState = searchParams.get("mode") === "signup" ? 1 : 0;
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [formState, setFormState] = useState(initialFormState);
  const [showToast, setShowToast] = useState(false);

  const { handleRegister, handleLogin } = useContext(AuthContext);
  const { darkMode } = useTheme();

  // Handle Auth Submission
  const handleAuth = async () => {
    try {
      if (formState === 0) {
        await handleLogin(username, password);
      } else {
        const result = await handleRegister(name, username, password);
        setUsername("");
        setPassword("");
        setName("");
        setMessage(result);
        setShowToast(true);
        setError("");
        setFormState(0);
        setTimeout(() => setShowToast(false), 4000);
      }
    } catch (err) {
      setError(err?.response?.data?.message || "Something went wrong");
    }
  };

  return (
    <div className={`min-h-screen w-full flex flex-col md:flex-row font-inter transition-colors duration-300 ${darkMode ? 'bg-slate-900 text-white' : 'bg-slate-50 text-slate-900'}`}>
      
      {/* LEFT PANEL - Gradient Branding */}
      <div className="flex-1 bg-gradient-to-br from-blue-600 via-blue-500 to-blue-400 flex flex-col justify-center items-center p-8 md:p-12 text-center text-white">
        <h1 className="text-4xl md:text-6xl font-extrabold mb-4 tracking-tight">
          AdvMeet
        </h1>
        <p className="max-w-xs md:max-w-sm text-lg opacity-90 font-medium">
          A modern platform for seamless video meetings, collaboration, and communication.
        </p>
        
        <div className="mt-10">
          <button
            onClick={() => setFormState(formState === 0 ? 1 : 0)}
            className="px-8 py-3 border-2 border-white rounded-full font-bold hover:bg-white hover:text-blue-600 transition-all duration-300 transform hover:scale-105"
          >
            {formState === 0 ? "Create Account" : "Sign In"}
          </button>
        </div>
      </div>

      {/* RIGHT PANEL - Form */}
      <div className="flex-1 flex items-center justify-center p-8 md:p-16">
        <div className="w-full max-w-md space-y-6">
          <h2 className="text-3xl font-bold text-center mb-8">
            {formState === 0 ? "Sign In" : "Create Account"}
          </h2>

          <div className="space-y-4">
            {formState === 1 && (
              <div className="relative">
                <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                  <User size={20} />
                </span>
                <input
                  type="text"
                  placeholder="Full Name"
                  className={`w-full pl-10 pr-4 py-3 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none transition-all ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
            )}

            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Mail size={20} />
              </span>
              <input
                type="email"
                placeholder="Email Address"
                className={`w-full pl-10 pr-4 py-3 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none transition-all ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}
                value={username}
                onChange={(e) => setUsername(e.target.value)}
              />
            </div>

            <div className="relative">
              <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-slate-400">
                <Lock size={20} />
              </span>
              <input
                type="password"
                placeholder="Password"
                className={`w-full pl-10 pr-4 py-3 rounded-xl border focus:ring-2 focus:ring-blue-500 outline-none transition-all ${darkMode ? 'bg-slate-800 border-slate-700' : 'bg-white border-slate-200'}`}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>

          {error && <p className="text-red-500 text-sm font-medium mt-2">{error}</p>}

          <button
            onClick={handleAuth}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-full shadow-lg shadow-blue-500/30 transition-all transform active:scale-95"
          >
            {formState === 0 ? "Sign In" : "Register"}
          </button>
        </div>
      </div>

      {/* TOAST NOTIFICATION */}
      {showToast && (
        <div className="fixed bottom-6 right-6 bg-slate-800 text-white px-6 py-3 rounded-lg shadow-2xl border border-slate-700 animate-bounce">
          {message}
        </div>
      )}
    </div>
  );
}
