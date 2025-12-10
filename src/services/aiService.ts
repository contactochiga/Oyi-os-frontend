import API from "./api";

export const aiService = {
  async chat(message: string) {
    try {
      const res = await API.post("/ai/chat", { message }); // You can add this endpoint to backend or proxy to OpenAI
      return res.data || { reply: "AI not available" };
    } catch (err) {
      console.warn("aiService.chat error", err);
      // fallback local simple parser
      return { reply: `Okay — I processed "${message}".` };
    }
  }
};
