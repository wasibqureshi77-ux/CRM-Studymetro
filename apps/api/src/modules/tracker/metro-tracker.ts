export const METRO_TRACKER_SDK = `(function() {
  if (window.MetroTracker) return;

  var CONFIG = {
    apiHost: '',
    tenantId: ''
  };

  function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
      var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  var visitorId = localStorage.getItem('sm_visitor_id');
  if (!visitorId) {
    visitorId = uuidv4();
    localStorage.setItem('sm_visitor_id', visitorId);
  }

  var sessionId = sessionStorage.getItem('sm_session_id');
  if (!sessionId) {
    sessionId = uuidv4();
    sessionStorage.setItem('sm_session_id', sessionId);
  }

  function getUtmParams() {
    var params = {};
    var search = window.location.search.substring(1);
    if (search) {
      var pairs = search.split('&');
      for (var i = 0; i < pairs.length; i++) {
        var pair = pairs[i].split('=');
        var key = decodeURIComponent(pair[0]);
        var val = decodeURIComponent(pair[1] || '');
        if (key.indexOf('utm_') === 0) {
          params[key] = val;
        }
      }
    }
    return params;
  }

  function getBrowser() {
    var ua = navigator.userAgent;
    if (ua.indexOf("Chrome") > -1) return "Chrome";
    if (ua.indexOf("Safari") > -1) return "Safari";
    if (ua.indexOf("Firefox") > -1) return "Firefox";
    if (ua.indexOf("MSIE") > -1 || ua.indexOf("Trident/") > -1) return "Internet Explorer";
    if (ua.indexOf("Edge") > -1) return "Edge";
    return "Unknown";
  }

  function getDeviceType() {
    var ua = navigator.userAgent;
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(ua)) {
      return "Tablet";
    }
    if (/Mobile|iP(hone|od)|Android|BlackBerry|IEMobile|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/i.test(ua)) {
      return "Mobile";
    }
    return "Desktop";
  }

  function sendRequest(endpoint, data) {
    if (!CONFIG.tenantId) {
      console.warn('MetroTracker: tenantId not set.');
      return;
    }
    var xhr = new XMLHttpRequest();
    xhr.open('POST', CONFIG.apiHost + endpoint, true);
    xhr.setRequestHeader('Content-Type', 'application/json');
    xhr.setRequestHeader('x-tenant-id', CONFIG.tenantId);
    xhr.send(JSON.stringify(data));
  }

  var MetroTracker = {
    init: function(options) {
      CONFIG.tenantId = options.tenantId || 'studymetro-global';
      
      if (options.apiHost) {
        CONFIG.apiHost = options.apiHost;
      } else {
        var scripts = document.getElementsByTagName('script');
        for (var i = 0; i < scripts.length; i++) {
          if (scripts[i].src && scripts[i].src.indexOf('metro-tracker.js') > -1) {
            var parser = document.createElement('a');
            parser.href = scripts[i].src;
            CONFIG.apiHost = parser.protocol + '//' + parser.host;
            break;
          }
        }
      }
      
      if (!CONFIG.apiHost) {
        CONFIG.apiHost = 'http://localhost:4000';
      }

      this.trackPageView();
      this.setupFormTracking();
    },

    trackPageView: function() {
      var utm = getUtmParams();
      var referrer = document.referrer;
      var landingPage = window.location.href;

      var payload = {
        referrer: referrer,
        landingPage: landingPage,
        deviceType: getDeviceType(),
        browser: getBrowser(),
        utmSource: utm.utm_source || null,
        utmMedium: utm.utm_medium || null,
        utmCampaign: utm.utm_campaign || null,
        utmContent: utm.utm_content || null,
        utmTerm: utm.utm_term || null
      };

      sendRequest('/api/v1/tracker/event', {
        type: 'PAGE_VIEW',
        visitorId: visitorId,
        sessionId: sessionId,
        meta: payload
      });
    },

    track: function(eventType, eventData) {
      sendRequest('/api/v1/tracker/event', {
        type: eventType,
        visitorId: visitorId,
        sessionId: sessionId,
        meta: eventData || {}
      });
    },

    identify: function(email, traits) {
      sendRequest('/api/v1/tracker/identify', {
        visitorId: visitorId,
        email: email,
        traits: traits || {}
      });
    },

    setupFormTracking: function() {
      document.addEventListener('submit', function(event) {
        var form = event.target;
        if (!form) return;

        var fields = {};
        var inputs = form.querySelectorAll('input, select, textarea');
        
        for (var i = 0; i < inputs.length; i++) {
          var input = inputs[i];
          var name = (input.name || input.id || '').toLowerCase();
          var val = input.value;

          if (!name || !val) continue;

          if (name.indexOf('email') > -1) {
            fields.email = val;
          } else if (name.indexOf('phone') > -1 || name.indexOf('tel') > -1 || name.indexOf('mobile') > -1 || name.indexOf('contact') > -1) {
            fields.phone = val;
          } else if (name.indexOf('name') > -1 || name.indexOf('fname') > -1 || name.indexOf('lname') > -1) {
            if (fields.name) {
              fields.name += ' ' + val;
            } else {
              fields.name = val;
            }
          }
        }

        if (fields.email || fields.phone) {
          sendRequest('/api/v1/tracker/form', {
            visitorId: visitorId,
            sessionId: sessionId,
            formFields: fields,
            url: window.location.href
          });
        }
      }, true);
    }
  };

  window.MetroTracker = MetroTracker;

  var currentScript = document.currentScript;
  if (currentScript) {
    var tenantId = currentScript.getAttribute('data-tenant');
    if (tenantId) {
      MetroTracker.init({ tenantId: tenantId });
    }
  }
})();`;
