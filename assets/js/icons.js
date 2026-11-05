/* ==========================================================================
   Ular Tangga Modern — icons.js
   Sprite ikon SVG. Semua ikon fungsional memakai SVG garis, bukan emoji,
   supaya bentuknya konsisten di semua sistem operasi dan bisa diwarnai
   lewat CSS (currentColor).

   Pakai di HTML:  <svg class="..." aria-hidden="true"><use href="#i-play"></use></svg>
   ========================================================================== */

(function () {
  'use strict';

  const SPRITE = `
<svg xmlns="http://www.w3.org/2000/svg" style="display:none" aria-hidden="true" focusable="false">
  <defs>
    <style>
      .st { fill: none; stroke: currentColor; stroke-width: 1.9; stroke-linecap: round; stroke-linejoin: round; }
      .sf { fill: currentColor; }
    </style>
  </defs>

  <!-- Identitas -->
  <symbol id="i-dice" viewBox="0 0 24 24">
    <rect class="st" x="3.2" y="3.2" width="17.6" height="17.6" rx="3.4"/>
    <circle class="sf" cx="8.4" cy="8.4" r="1.5"/>
    <circle class="sf" cx="15.6" cy="8.4" r="1.5"/>
    <circle class="sf" cx="12" cy="12" r="1.5"/>
    <circle class="sf" cx="8.4" cy="15.6" r="1.5"/>
    <circle class="sf" cx="15.6" cy="15.6" r="1.5"/>
  </symbol>

  <symbol id="i-dice-pair" viewBox="0 0 24 24">
    <rect class="st" x="2.6" y="2.6" width="12" height="12" rx="2.6"/>
    <circle class="sf" cx="6.4" cy="6.4" r="1.25"/>
    <circle class="sf" cx="10.8" cy="10.8" r="1.25"/>
    <rect class="st" x="10.4" y="10.4" width="11" height="11" rx="2.4"/>
    <circle class="sf" cx="13.6" cy="13.6" r="1.1"/>
    <circle class="sf" cx="18.2" cy="18.2" r="1.1"/>
    <circle class="sf" cx="13.6" cy="18.2" r="1.1"/>
  </symbol>

  <!-- Aksi -->
  <symbol id="i-play" viewBox="0 0 24 24">
    <path class="sf" d="M7.4 4.6a1 1 0 0 1 1.5-.87l10.2 6.1a1.05 1.05 0 0 1 0 1.8L8.9 17.7a1 1 0 0 1-1.5-.87Z"/>
  </symbol>

  <symbol id="i-book" viewBox="0 0 24 24">
    <path class="st" d="M4 4.8h5.2a3 3 0 0 1 2.8 1.9A3 3 0 0 1 14.8 4.8H20v13.4h-5.2a3 3 0 0 0-2.8 1.9 3 3 0 0 0-2.8-1.9H4Z"/>
    <path class="st" d="M12 6.7v13.4"/>
  </symbol>

  <symbol id="i-sliders" viewBox="0 0 24 24">
    <path class="st" d="M4 7.5h10M18 7.5h2M4 16.5h4M12 16.5h8"/>
    <circle class="st" cx="16" cy="7.5" r="2.2"/>
    <circle class="st" cx="10" cy="16.5" r="2.2"/>
  </symbol>

  <symbol id="i-help" viewBox="0 0 24 24">
    <circle class="st" cx="12" cy="12" r="9"/>
    <path class="st" d="M9.4 9.3a2.7 2.7 0 1 1 3.6 2.5c-.8.3-1 .9-1 1.7v.4"/>
    <circle class="sf" cx="12" cy="17.2" r="1.15"/>
  </symbol>

  <symbol id="i-reset" viewBox="0 0 24 24">
    <path class="st" d="M20 12a8 8 0 1 1-2.6-5.9"/>
    <path class="st" d="M20 3.6v4.8h-4.8"/>
  </symbol>

  <symbol id="i-home" viewBox="0 0 24 24">
    <path class="st" d="M4 10.6 12 4l8 6.6"/>
    <path class="st" d="M6.2 9.4V20h11.6V9.4"/>
    <path class="st" d="M10 20v-5.4h4V20"/>
  </symbol>

  <symbol id="i-check" viewBox="0 0 24 24">
    <path class="st" d="m5 12.8 4.4 4.4L19 7.6"/>
  </symbol>

  <symbol id="i-close" viewBox="0 0 24 24">
    <path class="st" d="m6.4 6.4 11.2 11.2M17.6 6.4 6.4 17.6"/>
  </symbol>

  <!-- Suara -->
  <symbol id="i-music-on" viewBox="0 0 24 24">
    <path class="st" d="M9 17.4V7.1l8-1.7v10.3"/>
    <ellipse class="sf" cx="6.6" cy="17.6" rx="2.5" ry="2"/>
    <ellipse class="sf" cx="14.6" cy="15.9" rx="2.5" ry="2"/>
  </symbol>

  <symbol id="i-music-off" viewBox="0 0 24 24">
    <path class="st" d="M9 17.4V7.1l8-1.7v6"/>
    <ellipse class="sf" cx="6.6" cy="17.6" rx="2.5" ry="2"/>
    <path class="st" d="m15.4 16.2 5 5M20.4 16.2l-5 5"/>
  </symbol>

  <!-- Status & data -->
  <symbol id="i-trophy" viewBox="0 0 24 24">
    <path class="st" d="M7.4 4h9.2v5.1a4.6 4.6 0 0 1-9.2 0Z"/>
    <path class="st" d="M7.4 5.4H4.8v1.5a3 3 0 0 0 2.9 3M16.6 5.4h2.6v1.5a3 3 0 0 1-2.9 3"/>
    <path class="st" d="M12 13.7V17M8.6 20h6.8l-.8-3H9.4Z"/>
  </symbol>

  <symbol id="i-podium" viewBox="0 0 24 24">
    <path class="st" d="M4 20V13h4.4v7M9.8 20V8.4H14.2V20M15.6 20v-5.2H20V20"/>
    <path class="st" d="M3 20h18"/>
  </symbol>

  <symbol id="i-crown" viewBox="0 0 24 24">
    <path class="st" d="m4 8.4 3.4 3L12 5.6l4.6 5.8 3.4-3-1.5 9.2H5.5Z"/>
    <path class="st" d="M5.5 17.6h13"/>
  </symbol>

  <symbol id="i-flame" viewBox="0 0 24 24">
    <path class="st" d="M12 3.4c3.4 3 5.4 5.6 5.4 8.6a5.4 5.4 0 0 1-10.8 0c0-1.6.6-3 1.8-4.4.5 1.2 1.2 1.9 2.1 2.1.3-2.4.8-4.5 1.5-6.3Z"/>
  </symbol>

  <!-- Pion -->
  <symbol id="i-person" viewBox="0 0 24 24">
    <circle class="sf" cx="12" cy="8.2" r="3.4"/>
    <path class="sf" d="M4.9 20c.5-4 3.4-6 7.1-6s6.6 2 7.1 6Z"/>
  </symbol>

  <symbol id="i-robot" viewBox="0 0 24 24">
    <rect class="st" x="4.4" y="7.6" width="15.2" height="11.4" rx="3"/>
    <path class="st" d="M12 4.2v3.4M9.4 4.2h5.2"/>
    <circle class="sf" cx="9.2" cy="12.6" r="1.4"/>
    <circle class="sf" cx="14.8" cy="12.6" r="1.4"/>
    <path class="st" d="M9.8 16.2h4.4"/>
  </symbol>

  <!-- Skill -->
  <symbol id="i-rocket" viewBox="0 0 24 24">
    <path class="st" d="M13.4 4.2c3.4.8 6.4 3.8 6.4 6.4 0 0-2 3.2-5.2 4.6l-2.8-2.8c1.4-3.2 1.6-8.2 1.6-8.2Z"/>
    <path class="st" d="M11.8 12.4 6.6 17.6"/>
    <path class="st" d="M8.2 9.6 4.4 11c-.6.2-.7 1-.2 1.4l2 1.4M14.4 15.8l1.4 2c.4.5 1.2.4 1.4-.2l1.4-3.8"/>
    <path class="st" d="M6 18c-.8.8-1 2.6-1 2.6s1.8-.2 2.6-1"/>
  </symbol>

  <symbol id="i-clover" viewBox="0 0 24 24">
    <path class="st" d="M12 11.4C10.4 9.8 9 8.6 9 7.2a3 3 0 1 1 3 3 3 3 0 1 1 3-3c0 1.4-1.4 2.6-3 4.2Z"/>
    <path class="st" d="M12 11.4c1.6 1.6 3 2.8 3 4.2a3 3 0 1 1-3-3 3 3 0 1 1-3 3c0-1.4 1.4-2.6 3-4.2Z"/>
  </symbol>

  <symbol id="i-ladder" viewBox="0 0 24 24">
    <path class="st" d="M8.4 3.4 6 20.6M15.6 3.4 18 20.6"/>
    <path class="st" d="M7.6 7.6h8.8M7 12h10M6.4 16.4h10.8"/>
  </symbol>

  <symbol id="i-shield" viewBox="0 0 24 24">
    <path class="st" d="M12 3.4 5.2 5.8v6c0 4 2.9 7.4 6.8 8.8 3.9-1.4 6.8-4.8 6.8-8.8v-6Z"/>
    <path class="st" d="m9.2 11.8 2.1 2.1 3.6-3.9"/>
  </symbol>

  <symbol id="i-clock" viewBox="0 0 24 24">
    <circle class="st" cx="12" cy="12" r="8.4"/>
    <path class="st" d="M12 7.4V12l3 2.1"/>
  </symbol>

  <symbol id="i-sparkles" viewBox="0 0 24 24">
    <path class="sf" d="M11 4.4 12.4 9l4.6 1.4-4.6 1.4L11 16.4 9.6 11.8 5 10.4 9.6 9Z"/>
    <path class="sf" d="m17.6 14.2.9 2.7 2.7.9-2.7.9-.9 2.7-.9-2.7-2.7-.9 2.7-.9Z"/>
    <path class="sf" d="m5.4 15.6.6 1.8 1.8.6-1.8.6-.6 1.8-.6-1.8-1.8-.6 1.8-.6Z"/>
  </symbol>

  <symbol id="i-swap" viewBox="0 0 24 24">
    <path class="st" d="M4.6 8.4h13.2M14.6 5.2l3.2 3.2-3.2 3.2"/>
    <path class="st" d="M19.4 15.6H6.2M9.4 12.4l-3.2 3.2 3.2 3.2"/>
  </symbol>

  <symbol id="i-backward" viewBox="0 0 24 24">
    <path class="st" d="M19.4 12H5.6M10.4 6.6 5 12l5.4 5.4"/>
  </symbol>

  <symbol id="i-burst" viewBox="0 0 24 24">
    <path class="st" d="m12 3.6 2 4.2 4.6-1.2-1.2 4.6 4.2 2-4.2 2 1.2 4.6-4.6-1.2-2 4.2-2-4.2-4.6 1.2 1.2-4.6-4.2-2 4.2-2-1.2-4.6 4.6 1.2Z"/>
  </symbol>

  <!-- Penanda papan -->
  <symbol id="i-flag" viewBox="0 0 24 24">
    <path class="st" d="M6.4 3.6v17"/>
    <path class="st" d="M6.4 4.6h11l-2.4 3.6 2.4 3.6h-11Z"/>
  </symbol>

  <symbol id="i-snake-mark" viewBox="0 0 24 24">
    <path class="st" d="M5.6 18.4c3.2 0 3.2-3.4 6.4-3.4s3.2-3.4 6.4-3.4"/>
    <circle class="sf" cx="17.4" cy="9.2" r="2.1"/>
    <circle class="sf" cx="6" cy="19" r="1.6"/>
  </symbol>

  <symbol id="i-ladder-mark" viewBox="0 0 24 24">
    <path class="st" d="M8 4.6 6.4 19.4M16 4.6l1.6 14.8"/>
    <path class="st" d="M7.5 9h9M7 13h10M6.5 17h11"/>
  </symbol>

  <!-- Bentuk abstrak untuk pion (double-coding: warna + bentuk) -->
  <symbol id="i-token-triangle" viewBox="0 0 24 24">
    <path class="sf" d="M12 4.6 20.2 19.4H3.8Z"/>
  </symbol>

  <symbol id="i-token-square" viewBox="0 0 24 24">
    <rect class="sf" x="5.2" y="5.2" width="13.6" height="13.6" rx="2.4"/>
  </symbol>

  <symbol id="i-skull" viewBox="0 0 24 24">
    <path class="st" d="M12 3.6c4.2 0 7 2.9 7 6.8 0 2.3-1 3.6-1.6 4.4-.4.5-.6.9-.6 1.6v1.2a1.6 1.6 0 0 1-1.6 1.6H8.8A1.6 1.6 0 0 1 7.2 17.6v-1.2c0-.7-.2-1.1-.6-1.6-.6-.8-1.6-2.1-1.6-4.4 0-3.9 2.8-6.8 7-6.8Z"/>
    <circle class="sf" cx="9.2" cy="10.4" r="1.6"/>
    <circle class="sf" cx="14.8" cy="10.4" r="1.6"/>
    <path class="st" d="M11 14.4h2"/>
  </symbol>

  <!-- Bagikan -->
  <symbol id="i-share" viewBox="0 0 24 24">
    <path class="st" d="M12 3.8v10.8"/>
    <path class="st" d="m7.8 7.9 4.2-4.1 4.2 4.1"/>
    <path class="st" d="M5.2 12.6v5.6a2 2 0 0 0 2 2h9.6a2 2 0 0 0 2-2v-5.6"/>
  </symbol>
</svg>`;

  function inject() {
    if (document.getElementById('ut-icon-sprite')) return;
    const holder = document.createElement('div');
    holder.innerHTML = SPRITE;
    const sprite = holder.firstElementChild;
    sprite.id = 'ut-icon-sprite';
    document.body.insertBefore(sprite, document.body.firstChild);
  }

  if (document.body) inject();
  else document.addEventListener('DOMContentLoaded', inject);

  /** Helper: buat elemen <svg><use> siap pakai. */
  window.UT = window.UT || {};
  window.UT.icon = (name, className) => {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    if (className) svg.setAttribute('class', className);
    svg.setAttribute('aria-hidden', 'true');
    svg.setAttribute('focusable', 'false');
    const use = document.createElementNS('http://www.w3.org/2000/svg', 'use');
    use.setAttribute('href', `#i-${name}`);
    // Fallback Safari <12.
    use.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', `#i-${name}`);
    svg.appendChild(use);
    return svg;
  };
})();
