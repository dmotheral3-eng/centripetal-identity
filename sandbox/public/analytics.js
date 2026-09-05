/* Usage instrumentation for this surface.
 *
 * Silent by design: no banner, no cookie UI, no consent widget, and no personal
 * data. It emits pageviews and page-leaves so this surface can answer "is anyone
 * here" with a number instead of a guess. Every event carries a `site` tag so the
 * estate can tell surfaces apart without parsing URLs.
 *
 * THE KEY BELOW IS NOT A SECRET. It is a public, write-only ingestion key: it can
 * post events and cannot read a single one back. It is publishable by design and
 * already ships inside every bundle on this estate, which is why it is inlined
 * here rather than held as a build-time variable — there is no secret to hold, and
 * a build-time variable would only add a redeploy dependency to a static file.
 *
 * Load it from the document head, before anything else:
 *   <script src="/analytics.js" data-site="<surface-slug>"></script>
 *
 * Installed by D-BEACON-1, 2026-09-05.
 */
(function (window, document) {
  "use strict";

  if (window.__CENTRIPETAL_BEACON__) return;   /* never initialize twice */

  var KEY = "phc_rfXcuJBTeNvL9U2QVe3jCR76nfagETkm69mFZ458bRer";
  var API_HOST = "https://us.i.posthog.com";

  var self = document.currentScript;
  var site = (self && self.getAttribute("data-site")) || "unknown";

  /* Loader stub — queues calls made before the library finishes downloading. */
  !function(t,e){var o,n,p,r;e.__SV||(window.posthog=e,e._i=[],e.init=function(i,s,a){function g(t,e){var o=e.split(".");2==o.length&&(t=t[o[0]],e=o[1]),t[e]=function(){t.push([e].concat(Array.prototype.slice.call(arguments,0)))}}(p=t.createElement("script")).type="text/javascript",p.crossOrigin="anonymous",p.async=!0,p.src=s.api_host+"/static/array.js",(r=t.getElementsByTagName("script")[0]).parentNode.insertBefore(p,r);var u=e;for(void 0!==a?u=e[a]=[]:a="posthog",u.people=u.people||[],u.toString=function(t){var e="posthog";return"posthog"!==a&&(e+="."+a),t||(e+=" (stub)"),e},u.people.toString=function(){return u.toString(1)+".people (stub)"},o="init capture register register_once unregister getFeatureFlag getFeatureFlagPayload isFeatureEnabled reloadFeatureFlags identify setPersonProperties group reset get_distinct_id opt_in_capturing opt_out_capturing has_opted_out_capturing set_config debug".split(" "),n=0;n<o.length;n++)g(u,o[n]);e._i.push([i,s,a])},e.__SV=1)}(document,window.posthog||[]);

  window.posthog.init(KEY, {
    api_host: API_HOST,
    person_profiles: "identified_only",
    capture_pageview: true,
    capture_pageleave: true,
    autocapture: true
  });

  /* Presence marker external sensors check for, independent of any network call. */
  window.__CENTRIPETAL_BEACON__ = true;

  window.posthog.register({ site: site });

  /* Exposed so a page can name its own product events without re-reading the key. */
  window.CENTRIPETAL_TRACK = function (name, props) {
    try { window.posthog.capture(name, props || {}); } catch (e) { /* never break the page */ }
  };
})(window, document);
