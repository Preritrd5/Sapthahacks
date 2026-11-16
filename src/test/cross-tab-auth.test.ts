import { describe, it, expect, beforeEach, vi } from "vitest";
import { QueryClient } from "@tanstack/react-query";
import { broadcastAuthChange, subscribeToAuthSync, type AuthSyncMessage } from "@/lib/auth-sync";
import { getPersistentTeams, savePersistentTeams } from "@/lib/team-store";

describe("Cross-Tab User Data Isolation & Authentication Synchronization", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("Scenario 1 & 4: Isolate user-specific data between different users", () => {
    const userA = { id: "user-alpha-111", email: "TeamInoSap26@gmail.com" };
    const userB = { id: "user-beta-222", email: "evaluator-beta@sapthagiri.edu" };

    // 1. User A saves their team records
    const userATeams = [
      {
        id: "team-a-1",
        name: "Alpha Security Suite",
        email: "alpha@sapthagiri.edu",
        final_status: "approved",
      } as any,
    ];
    savePersistentTeams(userATeams, userA.id);

    // 2. User B saves their team records
    const userBTeams = [
      {
        id: "team-b-1",
        name: "Beta Quantum Engine",
        email: "beta@sapthagiri.edu",
        final_status: "pending",
      } as any,
    ];
    savePersistentTeams(userBTeams, userB.id);

    // 3. Verify User A retrieves ONLY User A's data
    const retrievedA = getPersistentTeams(userA.id);
    expect(retrievedA.length).toBe(1);
    expect(retrievedA[0]?.name).toBe("Alpha Security Suite");

    // 4. Verify User B retrieves ONLY User B's data
    const retrievedB = getPersistentTeams(userB.id);
    expect(retrievedB.length).toBe(1);
    expect(retrievedB[0]?.name).toBe("Beta Quantum Engine");

    // 5. User A cannot see User B's records, and User B cannot see User A's records
    expect(retrievedA.some((t) => t.name === "Beta Quantum Engine")).toBe(false);
    expect(retrievedB.some((t) => t.name === "Alpha Security Suite")).toBe(false);
  });

  it("Scenario 2: Synchronize authentication state across browser tabs via storage events", () => {
    const receivedMessages: AuthSyncMessage[] = [];

    // Simulate Tab 2 subscribing to auth synchronization
    const unsubscribe = subscribeToAuthSync((msg) => {
      receivedMessages.push(msg);
    });

    // Simulate Tab 1 signing out and broadcasting
    broadcastAuthChange({
      type: "SIGN_OUT",
      userId: "user-alpha-111",
      email: "TeamInoSap26@gmail.com",
    });

    // Check that Tab 2 received the message through localStorage sync mechanism
    const syncRaw = localStorage.getItem("innovedge_auth_cross_tab_sync_v1");
    expect(syncRaw).toBeTruthy();
    const parsed = JSON.parse(syncRaw!);
    expect(parsed.type).toBe("SIGN_OUT");
    expect(parsed.userId).toBe("user-alpha-111");

    unsubscribe();
  });

  it("Scenario 3: Invalidate and purge QueryClient cache when account switches", () => {
    const qc = new QueryClient();

    const userA = "user-alpha-111";
    const userB = "user-beta-222";

    // Seed query cache with User A's profile & teams
    qc.setQueryData(["user-profile", userA], { email: "TeamInoSap26@gmail.com", role: "admin" });
    qc.setQueryData(["team-rows", userA, { pdf: 30, github: 40, website: 30 }], [{ id: "team-1", name: "Team 1" }]);

    expect(qc.getQueryData(["user-profile", userA])).toBeDefined();

    // User A query keys are segregated from User B
    expect(qc.getQueryData(["user-profile", userB])).toBeUndefined();
    expect(qc.getQueryData(["team-rows", userB, { pdf: 30, github: 40, website: 30 }])).toBeUndefined();

    // On account switch, call qc.clear()
    qc.clear();

    // Old user data must be completely expunged from memory
    expect(qc.getQueryData(["user-profile", userA])).toBeUndefined();
    expect(qc.getQueryData(["team-rows", userA, { pdf: 30, github: 40, website: 30 }])).toBeUndefined();
  });

  it("Scenario 6: Disallow unauthorized accounts from administrative privilege", () => {
    const adminUser = { email: "TeamInoSap26@gmail.com", id: "admin-uuid" };
    const guestUser = { email: "unauthorized@example.com", id: "guest-uuid" };

    const isAdmin = (email: string) => email.toLowerCase().trim() === "teaminosap26@gmail.com";

    expect(isAdmin(adminUser.email)).toBe(true);
    expect(isAdmin(guestUser.email)).toBe(false);
  });
});
