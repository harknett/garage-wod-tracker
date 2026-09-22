/**
 * The manifest that lets the tracker be added to a phone's home screen.
 *
 * Served from a route rather than a static file so the start URL and theme
 * stay beside the rest of the app's configuration. `display: standalone` is
 * what drops the browser chrome, which is most of what makes it feel like an
 * app when you open it between rounds.
 */
export function GET(): Response {
  return Response.json({
    name: "Garage WOD Tracker",
    short_name: "WOD",
    description: "Discipline, written down.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#17181a",
    theme_color: "#17181a",
    icons: [
      {
        // An inline SVG avoids shipping a binary just to get a home-screen
        // icon; `any maskable` lets the platform crop it to its own shape.
        src:
          "data:image/svg+xml," +
          encodeURIComponent(
            `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">` +
              `<rect width="512" height="512" rx="96" fill="#17181a"/>` +
              `<g fill="none" stroke="#f6f5f2" stroke-width="34" stroke-linecap="round">` +
              `<path d="M120 256h272"/><path d="M104 196v120M152 166v180M360 166v180M408 196v120"/>` +
              `</g></svg>`,
          ),
        sizes: "512x512",
        type: "image/svg+xml",
        purpose: "any maskable",
      },
    ],
  });
}
