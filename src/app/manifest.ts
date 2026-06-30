import type { MetadataRoute } from "next";

export const dynamic = "force-static";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Oyi Consumer OS",
    short_name: "Oyi",
    description: "Consumer OS for devices, activity, visitors, wallet activity and Oyi assistance.",
    start_url: "/",
    display: "standalone",
    background_color: "#000000",
    theme_color: "#000000",
    orientation: "portrait",
    icons: [
      {
        src: "/oyi-logo-transparent.png",
        sizes: "512x512",
        type: "image/png",
      },
    ],
  };
}
