import { createClient } from '@liveblocks/client';
import { createRoomContext } from '@liveblocks/react';

// 1) Create the low-level client
const client = createClient({
  authEndpoint: '/api/liveblocks-auth'
});

// 2) Create a “generic-free” React context
//    (we’re not passing <Storage, Presence> here)
export const { RoomProvider, useStorage, useMutation } =
  createRoomContext(client);
