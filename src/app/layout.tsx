/* src/app/globals.css */
@import "tailwindcss";

/* -------------------------------------------------
   Base reset & mobile-safe defaults
-------------------------------------------------- */

html,
body {
  margin: 0;
  padding: 0;
  height: 100%;
  background: #06080e;
  color-scheme: dark;

  /* ✅ Keep body locked so footer doesn't shake */
  overflow: hidden;
}

/* iOS viewport stability + better layering behavior */
body {
  min-height: 100dvh;
  min-height: -webkit-fill-available;

  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;

  /* ✅ Clean stacking context (helps iOS) */
  isolation: isolate;
}

/* -------------------------------------------------
   Safe-area + keyboard helpers
-------------------------------------------------- */

:root {
  --sat: env(safe-area-inset-top, constant(safe-area-inset-top, 0px));
  --sar: env(safe-area-inset-right, constant(safe-area-inset-right, 0px));
  --sab: env(safe-area-inset-bottom, constant(safe-area-inset-bottom, 0px));
  --sal: env(safe-area-inset-left, constant(safe-area-inset-left, 0px));

  --kb: 0px;

  /* Brand */
  --brand: #2563eb;
  --brand-press: #1d4ed8;
}

/* Prevent iOS zoom on inputs */
@supports (-webkit-touch-callout: none) {
  input,
  textarea,
  select {
    font-size: 16px;
  }
}

/* -------------------------------------------------
   Sidebar-open behavior
-------------------------------------------------- */

body.sidebar-open {
  overflow: hidden;
  touch-action: none;
}

body.sidebar-open .chat-footer,
body.sidebar-open .chat-suggestions {
  display: none !important;
}

/* -------------------------------------------------
   Keyboard-aware bottom spacing
-------------------------------------------------- */

.chat-footer {
  padding-bottom: calc(16px + var(--sab) + var(--kb)) !important;
}

.chat-suggestions {
  bottom: calc(88px + var(--sab) + var(--kb)) !important;
}

/* -------------------------------------------------
   Mobile interaction hygiene
-------------------------------------------------- */

button,
a {
  -webkit-tap-highlight-color: transparent;
}

/* ✅ Don’t force smooth scrolling globally (can feel stuck on iOS) */
* {
  scroll-behavior: auto;
}

/* -------------------------------------------------
   ✅ OYI WhatsApp-style estate wallpaper
   IMPORTANT: z-index must NOT be negative on iOS
-------------------------------------------------- */

.estate-wallpaper {
  position: fixed;
  inset: 0;

  /* ✅ Always behind content (but NOT negative) */
  z-index: 0;

  pointer-events: none;

  background-color: #06080e;

  background-image:
    radial-gradient(circle at 18% 12%, rgba(255,255,255,0.04) 0%, transparent 60%),
    radial-gradient(circle at 82% 18%, rgba(148,163,184,0.06) 0%, transparent 62%),
    radial-gradient(circle at 50% 92%, rgba(255,255,255,0.035) 0%, transparent 60%),
    url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='220' height='220' viewBox='0 0 520 520'%3E%3Cg fill='none' stroke='rgba(255,255,255,0.08)' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M70 120l40-32 40 32v52H70z'/%3E%3Cpath d='M95 172v-26h30v26'/%3E%3Cpath d='M220 120h60v64h-60z'/%3E%3Cpath d='M235 120v-14a15 15 0 0 1 30 0v14'/%3E%3Cpath d='M360 110h80v62h-80z'/%3E%3Ccircle cx='400' cy='141' r='14'/%3E%3Cpath d='M110 290a30 30 0 1 1 40 0'/%3E%3Cpath d='M250 280c22-20 58-20 80 0'/%3E%3Cpath d='M370 284v34'/%3E%3Cpath d='M404 284v34'/%3E%3Cpath d='M150 420c0 18-14 32-32 32s-32-14-32-32'/%3E%3Cpath d='M260 438l26-44h-18l24-44'/%3E%3Cpath d='M420 420c-16-16-44-16-60 0'/%3E%3C/g%3E%3Cg fill='rgba(255,255,255,0.05)'%3E%3Ccircle cx='100' cy='40' r='6'/%3E%3Ccircle cx='470' cy='210' r='6'/%3E%3Crect x='30' y='240' width='12' height='12' rx='3'/%3E%3Crect x='310' y='470' width='12' height='12' rx='3'/%3E%3C/g%3E%3C/svg%3E");

  background-repeat: no-repeat, no-repeat, no-repeat, repeat;
  background-size:
    900px 900px,
    1000px 1000px,
    900px 900px,
    220px 220px;

  background-position:
    left top,
    right top,
    center bottom,
    center;
}

/* -------------------------------------------------
   Remote control button system
-------------------------------------------------- */

@layer components {
  .btn-tv {
    @apply px-4 py-2 rounded-full bg-gray-700 text-sm text-white
           active:scale-95 transition;
  }

  .btn-dir {
    @apply w-12 h-12 rounded-full bg-gray-700 text-white
           flex items-center justify-center
           active:scale-95 transition;
  }

  .btn-ok {
    background: var(--brand);
    color: #fff;
    @apply w-16 h-16 rounded-full font-semibold active:scale-95 transition;
  }

  .btn-ok:active {
    background: var(--brand-press);
  }

  .btn-num {
    @apply h-12 rounded-xl bg-gray-700 text-white text-sm
           flex items-center justify-center
           active:scale-95 transition;
  }
}
