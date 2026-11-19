import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";

describe("App routing and Navigation", () => {
  const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

  it("matches a page for / instead of falling back to not found", () => {
    const matches = router.matchRoutes("/");
    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });

  const ALL_AUTHENTICATED_ROUTES = [
    { name: "Dashboard", path: "/dashboard", expectedId: "/_authenticated/dashboard" },
    { name: "Plagiarism Detection", path: "/plagiarism", expectedId: "/_authenticated/plagiarism" },
    { name: "Team Qualification", path: "/qualification", expectedId: "/_authenticated/qualification" },
    { name: "Problem Statements", path: "/problem-statements", expectedId: "/_authenticated/problem-statements" },
    { name: "Teams", path: "/teams", expectedId: "/_authenticated/teams/" },
    { name: "Add Team", path: "/teams/new", expectedId: "/_authenticated/teams/new" },
    { name: "Bulk Import", path: "/import", expectedId: "/_authenticated/import" },
    { name: "Evaluation Criteria", path: "/criteria", expectedId: "/_authenticated/criteria" },
    { name: "Evaluation Queue", path: "/queue", expectedId: "/_authenticated/queue" },
    { name: "Evaluations", path: "/evaluations", expectedId: "/_authenticated/evaluations" },
    { name: "Leaderboard", path: "/leaderboard", expectedId: "/_authenticated/leaderboard" },
    { name: "Reports", path: "/reports", expectedId: "/_authenticated/reports" },
    { name: "API Usage", path: "/usage", expectedId: "/_authenticated/usage" },
    { name: "Settings", path: "/settings", expectedId: "/_authenticated/settings" },
    { name: "Activity Logs", path: "/activity", expectedId: "/_authenticated/activity" },
  ];

  it.each(ALL_AUTHENTICATED_ROUTES)(
    "correctly matches and resolves client route for $name ($path)",
    ({ path, expectedId }) => {
      const matches = router.matchRoutes(path);
      expect(matches.length).toBeGreaterThanOrEqual(2);
      const leafMatch = matches.at(-1);
      expect(leafMatch?.routeId).toBe(expectedId);
    }
  );

  it("simulates client-side navigation between consecutive routes without route errors", () => {
    // Navigate sequentially across all modules simulating sidebar clicks
    for (let i = 0; i < ALL_AUTHENTICATED_ROUTES.length - 1; i++) {
      const fromRoute = ALL_AUTHENTICATED_ROUTES[i]!;
      const toRoute = ALL_AUTHENTICATED_ROUTES[i + 1]!;

      const fromMatches = router.matchRoutes(fromRoute.path);
      const toMatches = router.matchRoutes(toRoute.path);

      expect(fromMatches.at(-1)?.routeId).toBe(fromRoute.expectedId);
      expect(toMatches.at(-1)?.routeId).toBe(toRoute.expectedId);

      // Verify parent layout match is preserved (_authenticated)
      const fromParent = fromMatches.find((m) => m.routeId === "/_authenticated");
      const toParent = toMatches.find((m) => m.routeId === "/_authenticated");
      expect(fromParent).toBeDefined();
      expect(toParent).toBeDefined();
    }
  });
});
