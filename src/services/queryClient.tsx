"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { useEffect, useState } from "react";

export default function ReactQueryProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
            staleTime: 1000 * 30,
          },
        },
      })
  );
  const [showDevtools, setShowDevtools] = useState(false);

  useEffect(() => {
    setShowDevtools(
      process.env.NODE_ENV === "development" &&
        typeof window !== "undefined" &&
        window.innerWidth >= 1024
    );
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      {children}

      {showDevtools && (
        <ReactQueryDevtools initialIsOpen={false} />
      )}
    </QueryClientProvider>
  );
}
