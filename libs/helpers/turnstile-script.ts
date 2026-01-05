export function getTurnstileScript(turnstileSiteKey: string) {
  return `
    (function() {
      const intervalId = setInterval(() => {
        if (!window.ui) return;
        clearInterval(intervalId);

        const authorized = window.ui.authSelectors.authorized().size > 0;
        if (authorized) return;

        const container = document.createElement('div');
        container.id = 'cf-turnstile';
        container.style.position = 'absolute';
        container.style.top = '0px';
        container.style.right = '0px';
        container.style.zIndex = '100000';
        container.style.height = '59px';
        container.style.display = 'flex';
        container.style.alignItems = 'center';
        container.style.justifyContent = 'center';
        document.body.appendChild(container);

        window.onloadTurnstileCallback = function() {
          const widgetId = turnstile.render('#cf-turnstile', {
            sitekey: '${turnstileSiteKey}',
            theme: 'dark',
            callback: async function(token) {
              try {
                const res = await fetch('/v1/auth/turnstile', {
                  method: 'POST',
                  body: JSON.stringify({ token }),
                  headers: { 'Content-Type': 'application/json' }
                });
                if (!res.ok) throw new Error(res.statusText);
                const data = await res.json();

                if (data.accessToken) {
                  window.ui.authActions.authorize({
                    bearer: {
                      name: 'bearer',
                      schema: { type: 'http', scheme: 'bearer' },
                      value: data.accessToken,
                    },
                  });
                }
              } catch (error) {
                window.ui.authActions.authorize({
                  bearer: {
                    name: 'bearer',
                    schema: { type: 'http', scheme: 'bearer' },
                    value: null,
                  },
                });
              } finally {
                setTimeout(function() {
                  turnstile.reset(widgetId);
                }, 55 * 1000);
              }
            }
          });
        };

        const script = document.createElement('script');
        script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?onload=onloadTurnstileCallback';
        script.async = true;
        script.defer = true;
        document.head.appendChild(script);
      }, 100);
    })();
  `;
}
