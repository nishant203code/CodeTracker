import { QueryClient } from "@tanstack/react-query";
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export const getRouter = () => {
  // A freshly issued sign-in token can look "issued in the future" when the
  // device clock is slightly behind the server; waiting a moment fixes it.
  const isClockSkew = (e: unknown) =>
    e instanceof Error && /issued at future/i.test(e.message);
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: (count, e) => (isClockSkew(e) ? count < 5 : count < 1),
        retryDelay: (count) => Math.min(1000 * 2 ** count, 8000),
      },
    },
  });

  const router = createRouter({
    routeTree,
    context: { queryClient },
    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  });

  return router;
};
