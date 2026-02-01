// src/services/roomsService.ts
import API from "./api";

export type RoomDTO = {
  id: string;
  name: string;
  type?: string | null;
  estate_id?: string | null;
  home_id?: string | null;

  ai_profile?: any;

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

export type AssignUserToRoomPayload = {
  room_id: string;
  resident_id?: string;
  user_id?: string;
  role?: string;
  permissions?: any;
};

export const roomsService = {
  async getRooms(homeId: string): Promise<RoomDTO[]> {
    const res = await API.get("/rooms", { params: { homeId } });
    return res.data ?? [];
  },

  async createRoom(payload: CreateRoomPayload) {
    const res = await API.post("/rooms", {
      estate_id: payload.estate_id,
      home_id: payload.home_id,
      name: payload.name,
      type: payload.type ?? null,
      ai_profile: payload.ai_profile ?? null,
    });
    return res.data;
  },

  async updateAiProfile(roomId: string, ai_profile: any) {
    const res = await API.put(`/rooms/ai/${encodeURIComponent(roomId)}`, {
      ai_profile: ai_profile ?? null,
    });
    return res.data;
  },

  async assignUserToRoom(payload: AssignUserToRoomPayload) {
    // normalize for backend which accepts resident_id OR user_id
    const body = {
      room_id: payload.room_id,
      resident_id: payload.resident_id ?? undefined,
      user_id: payload.user_id ?? undefined,
      role: payload.role ?? "member",
      permissions: payload.permissions ?? null,
    };

    const res = await API.post("/rooms/assign", body);
    return res.data;
  },
};
