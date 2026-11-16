import { supabase } from "@/integrations/supabase/client";

export type AuthSyncEventType = "SIGN_IN" | "SIGN_OUT" | "USER_CHANGED" | "TOKEN_REFRESHED";

export interface AuthSyncMessage {
  type: AuthSyncEventType;
  userId?: string | null | undefined;
  email?: string | null | undefined;
  timestamp: number;
}

const BROADCAST_CHANNEL_NAME = "innovedge_cross_tab_auth_channel";
const STORAGE_SYNC_KEY = "innovedge_auth_cross_tab_sync_v1";

let channel: BroadcastChannel | null = null;

function getBroadcastChannel(): BroadcastChannel | null {
  if (typeof window === "undefined") return null;
  if (!("BroadcastChannel" in window)) return null;
  if (!channel) {
    try {
      channel = new BroadcastChannel(BROADCAST_CHANNEL_NAME);
    } catch (e) {
      console.warn("BroadcastChannel not supported or failed to initialize:", e);
      channel = null;
    }
  }
  return channel;
}

/**
 * Broadcast an authentication event to all other open tabs in the same browser session.
 */
export function broadcastAuthChange(event: {
  type: AuthSyncEventType;
  userId?: string | null | undefined;
  email?: string | null | undefined;
}): void {
  if (typeof window === "undefined") return;

  const payload: AuthSyncMessage = {
    type: event.type,
    userId: event.userId ?? null,
    email: event.email ?? null,
    timestamp: Date.now(),
  };

  // 1. Send via BroadcastChannel (instant in modern browsers)
  try {
    const ch = getBroadcastChannel();
    if (ch) {
      ch.postMessage(payload);
    }
  } catch (err) {
    console.warn("Failed to broadcast auth change via BroadcastChannel:", err);
  }

  // 2. Also write to localStorage to fire a storage event in other tabs
  try {
    localStorage.setItem(STORAGE_SYNC_KEY, JSON.stringify(payload));
  } catch {}
}

/**
 * Subscribe to cross-tab authentication synchronization events.
 * Listens to both BroadcastChannel and window "storage" events.
 */
export function subscribeToAuthSync(
  onSync: (message: AuthSyncMessage) => void
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const ch = getBroadcastChannel();

  const handleBroadcast = (event: MessageEvent<AuthSyncMessage>) => {
    if (event.data && typeof event.data === "object" && event.data.type) {
      onSync(event.data);
    }
  };

  const handleStorage = (event: StorageEvent) => {
    // If the sync ping changed
    if (event.key === STORAGE_SYNC_KEY && event.newValue) {
      try {
        const parsed: AuthSyncMessage = JSON.parse(event.newValue);
        if (parsed?.type) {
          onSync(parsed);
        }
      } catch {}
    }

    // If Supabase auth storage changed directly (e.g. user signed out or token refreshed)
    if (event.key && event.key.startsWith("sb-") && event.key.endsWith("-auth-token")) {
      if (!event.newValue) {
        // Token was deleted => SIGN_OUT
        onSync({
          type: "SIGN_OUT",
          userId: null,
          email: null,
          timestamp: Date.now(),
        });
      } else {
        try {
          const parsed = JSON.parse(event.newValue);
          const user = parsed?.user;
          onSync({
            type: "USER_CHANGED",
            userId: user?.id ?? null,
            email: user?.email ?? null,
            timestamp: Date.now(),
          });
        } catch {}
      }
    }

    // If dev auth storage changed
    if (event.key === "dev_admin_auth") {
      if (!event.newValue) {
        onSync({
          type: "SIGN_OUT",
          userId: null,
          email: null,
          timestamp: Date.now(),
        });
      } else {
        try {
          const parsed = JSON.parse(event.newValue);
          onSync({
            type: "USER_CHANGED",
            userId: parsed?.id ?? null,
            email: parsed?.email ?? null,
            timestamp: Date.now(),
          });
        } catch {}
      }
    }
  };

  if (ch) {
    ch.addEventListener("message", handleBroadcast);
  }
  window.addEventListener("storage", handleStorage);

  return () => {
    if (ch) {
      ch.removeEventListener("message", handleBroadcast);
    }
    window.removeEventListener("storage", handleStorage);
  };
}
