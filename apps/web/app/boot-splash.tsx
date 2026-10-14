import { BRAND_COLORS, SITE_NAME } from '@/lib/site'

/**
 * Launch screen shown while the app boots.
 *
 * This is rendered on the server, so the browser paints it before any JavaScript
 * is parsed. That matters for a PWA: an installed app on a cold, slow
 * connection would otherwise show a blank canvas while the bundle downloads.
 *
 * A tiny inline script removes it once React has hydrated. App Router already
 * ships server-rendered markup, so the trigger is an explicit hydration flag set
 * by `AppHydratedMarker` — checking for content would hide the splash instantly.
 * A load/idle listener and a hard timeout are the fallback, so the splash can
 * never get stuck on screen even if scripting is blocked.
 */
export function BootSplash() {
  return (
    <div
      id="boot-splash"
      role="status"
      aria-live="polite"
      aria-label={`${SITE_NAME} sedang memuat`}
      dangerouslySetInnerHTML={{
        __html: `
<style>
  #boot-splash{position:fixed;inset:0;z-index:9999;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:20px;background:${BRAND_COLORS.canvas};font-family:${'system-ui, -apple-system, "Segoe UI", sans-serif'};transition:opacity .28s ease}
  #boot-splash[hidden]{display:none!important}
  #boot-splash.is-leaving{opacity:0;pointer-events:none}
  #boot-splash .bs-mark{width:88px;height:88px;border-radius:22px;background:${BRAND_COLORS.primary};display:grid;place-items:center;box-shadow:0 10px 30px -12px rgba(47,109,245,.65);animation:bs-pulse 1.6s ease-in-out infinite}
  #boot-splash .bs-mark img{width:88px;height:88px;border-radius:22px;display:block}
  #boot-splash .bs-fallback{width:34px;height:26px;border-radius:8px 8px 8px 3px;background:#fff;position:relative;margin-bottom:8px}
  #boot-splash .bs-fallback::after{content:"";position:absolute;left:6px;right:9px;bottom:5px;height:4px;border-radius:2px;background:${BRAND_COLORS.primary};box-shadow:0 -7px 0 ${BRAND_COLORS.primary}}
  #boot-splash .bs-name{font-size:26px;font-weight:800;letter-spacing:-.02em;color:${BRAND_COLORS.text}}
  #boot-splash .bs-name span{color:${BRAND_COLORS.primary}}
  #boot-splash .bs-bar{width:132px;height:3px;border-radius:99px;background:#d2d2d7;overflow:hidden;position:relative}
  #boot-splash .bs-bar::after{content:"";position:absolute;inset:0;width:40%;border-radius:99px;background:${BRAND_COLORS.primary};animation:bs-slide 1.15s ease-in-out infinite}
  #boot-splash .bs-hint{font-size:13px;color:#6e6e73}
  #boot-splash.no-js .bs-bar{display:none}
  @keyframes bs-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.05)}}
  @keyframes bs-slide{0%{transform:translateX(-100%)}100%{transform:translateX(250%)}}
  @media (prefers-reduced-motion:reduce){#boot-splash .bs-mark,#boot-splash .bs-bar::after{animation:none}}
</style>
<div class="bs-mark">
  <img src="/brand/logo-icon.png" alt="" width="88" height="88" decoding="async" />
</div>
<div class="bs-name">Tutur<span>AI</span></div>
<div class="bs-bar"></div>
<div class="bs-hint">Menyiapkan ruang latihan speaking&hellip;</div>
<script>
(function(){
  var splash=document.getElementById('boot-splash');
  if(!splash)return;
  var done=false;
  function hide(){
    if(done||!splash||!splash.parentNode)return;
    done=true;
    splash.classList.add('is-leaving');
    setTimeout(function(){
      if(splash.parentNode)splash.parentNode.removeChild(splash);
    },300);
  }
  // Primary: React finished hydrating (set by AppHydratedMarker).
  var check=function(){
    if(document.documentElement.getAttribute('data-app-ready')==='true'){hide();return true;}
    return false;
  };
  check();
  // Keep a light poll until hydrated; hydration can land after DOMContentLoaded.
  var tries=0;
  var timer=setInterval(function(){tries++;if(check()||tries>120)clearInterval(timer);},50);
  // Fallbacks: window load, an idle tick, and a hard ceiling so it can never stick.
  window.addEventListener('load',function(){setTimeout(hide,150);});
  if(window.requestIdleCallback)window.requestIdleCallback(function(){setTimeout(hide,400);});
  setTimeout(hide,7000);
})();
</script>`,
      }}
    />
  )
}