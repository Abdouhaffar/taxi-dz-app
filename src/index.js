<!DOCTYPE html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no" />
    <meta name="theme-color" content="#0a0f1e" />
    <meta name="description" content="AL-BURAQ - تطبيق النقل الذكي في الجزائر. فاوض على سعرك مع أفضل السائقين." />
    <meta name="keywords" content="taxi, algerie, البراق, تاكسي, الجزائر, نقل" />
    <meta name="author" content="AL-BURAQ Team" />

    <!-- Open Graph -->
    <meta property="og:title" content="AL-BURAQ - تاكسي الجزائر" />
    <meta property="og:description" content="تطبيق النقل الذكي في الجزائر - فاوض على سعرك" />
    <meta property="og:type" content="website" />
    <meta property="og:image" content="/logo512.png" />

    <!-- Apple PWA -->
    <meta name="apple-mobile-web-app-capable" content="yes" />
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
    <meta name="apple-mobile-web-app-title" content="البراق" />
    <link rel="apple-touch-icon" href="/logo192.png" />

    <link rel="icon" href="%PUBLIC_URL%/favicon.ico" />
    <link rel="manifest" href="%PUBLIC_URL%/manifest.json" />

    <!-- Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&family=Scheherazade+New:wght@700&display=swap" rel="stylesheet" />

    <!-- OneSignal -->
    <script src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js" defer></script>
    <script>
      window.OneSignalDeferred = window.OneSignalDeferred || [];
      OneSignalDeferred.push(async function(OneSignal) {
        await OneSignal.init({
          appId: "f9e7686d-1859-497d-a3e1-c758e3b19de6",
          notifyButton: { enable: false },
        });
      });
    </script>

    <title>البراق | AL-BURAQ - تاكسي الجزائر 🇩🇿</title>

    <style>
      * { box-sizing: border-box; margin: 0; padding: 0; }
      body { font-family: 'Cairo', sans-serif; background: #0a0f1e; }
      /* Splash screen */
      #splash {
        position: fixed; inset: 0; background: linear-gradient(160deg, #0a0f1e, #1a2340);
        display: flex; flex-direction: column; align-items: center; justify-content: center;
        z-index: 9999; transition: opacity 0.5s ease;
      }
      #splash.hide { opacity: 0; pointer-events: none; }
      #splash img { width: 160px; height: 160px; margin-bottom: 24px; animation: pulse 2s infinite; }
      #splash h1 { color: #d4a017; font-size: 28px; font-weight: 900; letter-spacing: 4px; }
      #splash p { color: #ffffff55; font-size: 13px; margin-top: 8px; }
      #splash .loader {
        width: 48px; height: 4px; background: #1a2340; border-radius: 4px; margin-top: 32px; overflow: hidden;
      }
      #splash .loader-bar {
        height: 100%; background: linear-gradient(90deg, #d4a017, #f5d485, #d4a017);
        background-size: 200% 100%;
        animation: loading 1.5s ease infinite, shimmer 1.5s linear infinite;
        border-radius: 4px;
      }
      @keyframes pulse { 0%,100%{transform:scale(1)}50%{transform:scale(1.05)} }
      @keyframes loading { 0%{width:0%} 100%{width:100%} }
      @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
    </style>
  </head>
  <body>
    <noscript>يحتاج هذا التطبيق JavaScript للعمل.</noscript>

    <!-- Splash Screen -->
    <div id="splash">
      <img src="/logo192.png" alt="AL-BURAQ" onerror="this.style.display='none'" />
      <h1>AL-BURAQ</h1>
      <p>البُراق · تاكسي الجزائر 🇩🇿</p>
      <div class="loader"><div class="loader-bar"></div></div>
    </div>

    <div id="root"></div>

    <script>
      // Hide splash when app loads
      window.addEventListener('load', () => {
        setTimeout(() => {
          const splash = document.getElementById('splash');
          if (splash) {
            splash.classList.add('hide');
            setTimeout(() => splash.remove(), 500);
          }
        }, 1800);
      });
    </script>
  </body>
</html>
