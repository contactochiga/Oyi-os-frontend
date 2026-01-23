// src/services/roomsService.ts
import API from "./api";

export type RoomDTO = {
  id: string;
  name: string;
  type?: string | null;
  estate_id?: string | null;
  home_id?: string | null;

  // your controller selects: devices(*) and room_assignments(*)
  devices?: any[];
  room_assignments?: any[];

  created_at?: string;
  updated_at?: string;
};

export type CreateRoomPayload = {
  estate_id: string;
  home_id: string;
  name: string;
  type?: string | null;
  ai_profile?: any;
};

export const roomsService = {
  async getRooms(homeId: string): Promise<RoomDTO[]> {
    const res = await API.get("/rooms", { params: { homeId } });
    return res.data ?? [];
  },

  async createRoom(payload: CreateRoomPayload) {
    const res = await API.post("/rooms", payload);
    return res.data;
  },

  async updateAiProfile(roomId: string, ai_profile: any) {
    const res = await API.put(`/rooms/ai/${encodeURIComponent(roomId)}`, { ai_profile });
    return res.data;
  },

  async assignUserToRoom(payload: {
    room_id: string;
    user_id: string;
    role?: string;
    permissions?: any;
  }) {
    const res = await API.post("/rooms/assign", payload);
    return res.data;
  },
};
