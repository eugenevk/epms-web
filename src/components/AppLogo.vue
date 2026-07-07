<script setup lang="ts">
withDefaults(
  defineProps<{
    size?: number
    showBackground?: boolean
  }>(),
  {
    size: 72,
    showBackground: false,
  },
)
</script>

<template>
  <svg
    :width="size"
    :height="size"
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    role="img"
    aria-label="EPMS logo"
  >
    <defs>
      <linearGradient id="epms-bg" x1="12" y1="8" x2="52" y2="56" gradientUnits="userSpaceOnUse">
        <stop stop-color="#0c4a6e" />
        <stop offset="1" stop-color="#0369a1" />
      </linearGradient>
      <linearGradient id="epms-gold" x1="16" y1="16" x2="48" y2="44" gradientUnits="userSpaceOnUse">
        <stop stop-color="#fde68a" />
        <stop offset="0.45" stop-color="#fbbf24" />
        <stop offset="1" stop-color="#b45309" />
      </linearGradient>
      <linearGradient id="epms-gold-inner" x1="22" y1="22" x2="42" y2="38" gradientUnits="userSpaceOnUse">
        <stop stop-color="#ffffff" stop-opacity="0.28" />
        <stop offset="1" stop-color="#ffffff" stop-opacity="0" />
      </linearGradient>
      <linearGradient id="epms-band" x1="15" y1="40" x2="49" y2="46" gradientUnits="userSpaceOnUse">
        <stop stop-color="#ffffff" />
        <stop offset="1" stop-color="#dbeafe" />
      </linearGradient>
      <radialGradient id="epms-jewel" cx="0" cy="0" r="1" gradientUnits="userSpaceOnUse" gradientTransform="translate(32 24) rotate(90) scale(4)">
        <stop stop-color="#ffffff" />
        <stop offset="1" stop-color="#7dd3fc" />
      </radialGradient>
    </defs>

    <rect
      v-if="showBackground"
      width="64"
      height="64"
      rx="15"
      fill="url(#epms-bg)"
    />

    <!-- zachte halo -->
    <ellipse
      cx="32"
      cy="30"
      rx="18"
      ry="14"
      fill="#fbbf24"
      opacity="0.08"
    />

    <!-- kroonlichaam -->
    <path
      d="M16.5 39.5L20 25.5C20 25.5 22.5 31.5 25.5 33.5L32 18.5L38.5 33.5C41.5 31.5 44 25.5 44 25.5L47.5 39.5H16.5Z"
      fill="url(#epms-gold)"
    />
    <path
      d="M20.5 34.5L25.5 31.5L32 22L38.5 31.5L43.5 34.5"
      fill="url(#epms-gold-inner)"
    />

    <!-- voetband -->
    <path
      d="M14.5 39.5H49.5C50.3 39.5 51 40.2 51 41V43.5C51 44.3 50.3 45 49.5 45H14.5C13.7 45 13 44.3 13 43.5V41C13 40.2 13.7 39.5 14.5 39.5Z"
      fill="url(#epms-gold)"
    />
    <path
      d="M15.5 41H48.5C49 41 49.5 41.5 49.5 42V42.8C49.5 43.3 49 43.8 48.5 43.8H15.5C15 43.8 14.5 43.3 14.5 42.8V42C14.5 41.5 15 41 15.5 41Z"
      fill="url(#epms-band)"
    />

    <!-- punten -->
    <circle cx="20" cy="25.5" r="1.6" fill="url(#epms-jewel)" stroke="#fbbf24" stroke-width="0.7" />
    <circle cx="32" cy="18.5" r="2" fill="url(#epms-jewel)" stroke="#fbbf24" stroke-width="0.8" />
    <circle cx="44" cy="25.5" r="1.6" fill="url(#epms-jewel)" stroke="#fbbf24" stroke-width="0.7" />

    <!-- centraal accent -->
    <path
      d="M32 29.5L34.3 34.2H29.7L32 29.5Z"
      fill="url(#epms-jewel)"
      stroke="#d97706"
      stroke-width="0.6"
      stroke-linejoin="round"
    />

    <!-- contour for depth -->
    <path
      d="M16.5 39.5L20 25.5L25.5 33.5L32 18.5L38.5 33.5L44 25.5L47.5 39.5"
      stroke="#92400e"
      stroke-width="0.65"
      stroke-linejoin="round"
      opacity="0.35"
    />
  </svg>
</template>
