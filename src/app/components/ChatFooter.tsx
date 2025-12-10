"use client";
import { FaMicrophone, FaPaperPlane } from "react-icons/fa";
import { useState } from "react";

export default function ChatFooter({ input, setInput, onSend }: { input: string; setInput: (s:string)=>void; onSend: ()=>void }) {
  const [isRecording, setIsRecording] = useState(false);
  return (
    <div className="max-w-3xl mx-auto">
      <div className="relative flex items-center bg-gray-800 rounded-full p-2 gap-2">
        <button onClick={() => setIsRecording(v=>!v)} className={`w-10 h-10 rounded-full ${isRecording ? "bg-red-600" : "bg-gray-700"}`}><FaMicrophone /></button>
        <input value={input} onChange={(e)=>setInput(e.target.value)} onKeyDown={(e)=> e.key === "Enter" && onSend()} placeholder="Ask Oyi…" className="flex-1 bg-transparent outline-none px-2" />
        <button onClick={onSend} className="w-10 h-10 rounded-full bg-blue-600"><FaPaperPlane /></button>
      </div>
    </div>
  );
}
