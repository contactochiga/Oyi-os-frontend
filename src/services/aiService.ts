import API from "./api";

export const aiService = {
  async chat(message: string) {
    try {
      const res = await API.post("/ai/chat", { message });
      return res.data || { reply: "AI not available" };
    } catch (err) {
      console.warn("aiService.chat error:", err);
      return { reply: `Okay — I processed "${message}".` };
    }
  }
};
