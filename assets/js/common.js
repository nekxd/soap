/* mail.ru 2010 revival — shared helpers */
(function () {
  'use strict';

  /* ---------- proxy fetching (Habr RSS / DDG have no CORS) ---------- */
  function proxied(url) {
    return [
      'https://api.allorigins.win/raw?url=' + encodeURIComponent(url),
      'https://api.allorigins.win/get?url=' + encodeURIComponent(url),
      'https://corsproxy.io/?url=' + encodeURIComponent(url),
      'https://r.jina.ai/' + url
    ];
  }

  window.fetchViaProxy = async function (url, timeoutMs) {
    timeoutMs = timeoutMs || 20000;
    var variants = proxied(url);
    var lastErr = null;
    for (var i = 0; i < variants.length; i++) {
      try {
        var ctrl = new AbortController();
        var timer = setTimeout(function () { ctrl.abort(); }, timeoutMs);
        var resp = await fetch(variants[i], { signal: ctrl.signal });
        clearTimeout(timer);
        if (!resp.ok) { lastErr = new Error('HTTP ' + resp.status); continue; }
        var text = await resp.text();
        if (!text || text.length < 20) { lastErr = new Error('empty'); continue; }
        if (/^\s*<!doctype html/i.test(text) && i === 0) {
          /* allorigins raw sometimes returns its own error page */
          lastErr = new Error('error page'); continue;
        }
        if (variants[i].indexOf('allorigins.win/get') !== -1) {
          try {
            var j = JSON.parse(text);
            if (j && j.contents) return j.contents;
            lastErr = new Error('no contents'); continue;
          } catch (e) { lastErr = e; continue; }
        }
        if (variants[i].indexOf('r.jina.ai') !== -1) {
          return { jina: true, text: text };
        }
        return text;
      } catch (e) { lastErr = e; }
    }
    throw lastErr || new Error('all proxies failed');
  };

  /* ---------- Habr RSS ---------- */
  window.HABR_FEEDS = {
    news:   'https://habr.com/ru/rss/news/?fl=ru',
    auto:   'https://habr.com/ru/rss/hubs/transport/articles/?fl=ru',
    afisha: 'https://habr.com/ru/rss/search/?q=%D0%BA%D0%B8%D0%BD%D0%BE&target_type=posts&fl=ru',
    hitech: 'https://habr.com/ru/rss/hubs/electronics/articles/?fl=ru',
    lady:   'https://habr.com/ru/rss/search/?q=%D0%BC%D0%BE%D0%B4%D0%B0&target_type=posts&fl=ru',
    games:  'https://habr.com/ru/rss/hubs/gamedev/articles/?fl=ru'
  };

  function stripHtml(s) {
    var d = document.createElement('div');
    d.innerHTML = s;
    return d.textContent || '';
  }

  window.parseRss = function (xmlText) {
    var doc = new DOMParser().parseFromString(xmlText, 'text/xml');
    var items = doc.querySelectorAll('item');
    var out = [];
    items.forEach(function (it) {
      var t = it.querySelector('title');
      var l = it.querySelector('link');
      var d = it.querySelector('description');
      var date = it.querySelector('pubDate');
      out.push({
        title: t ? stripHtml(t.textContent) : '',
        link: l ? l.textContent.trim() : '#',
        desc: d ? stripHtml(d.textContent) : '',
        date: date ? date.textContent : ''
      });
    });
    return out;
  };

  var feedCache = {};
  window.loadHabrFeed = async function (key) {
    if (feedCache[key]) return feedCache[key];
    var url = window.HABR_FEEDS[key] || key;
    var text = await window.fetchViaProxy(url);
    if (text && text.jina) throw new Error('jina markdown instead of RSS');
    var items = window.parseRss(text);
    if (!items.length) throw new Error('no items');
    feedCache[key] = items;
    return items;
  };

  /* ---------- weather: open-meteo (free, works from RF) ---------- */
  /* WMO code -> [icon number from pict_weather_big_N.gif, label] */
  window.WMO = {
    0: [7, 'ясно'], 1: [6, 'малооблачно'], 2: [9, 'переменная облачность'],
    3: [16, 'облачно'], 45: [26, 'туман'], 48: [26, 'туман'],
    51: [5, 'морось'], 53: [5, 'морось'], 55: [5, 'морось'],
    56: [5, 'ледяная морось'], 57: [5, 'ледяная морось'],
    61: [11, 'небольшой дождь'], 63: [13, 'дождь'], 65: [17, 'сильный дождь'],
    66: [13, 'ледяной дождь'], 67: [13, 'ледяной дождь'],
    71: [21, 'небольшой снег'], 73: [27, 'снег'], 75: [28, 'сильный снег'],
    77: [27, 'снежные зёрна'],
    80: [13, 'ливень'], 81: [13, 'ливень'], 82: [17, 'сильный ливень'],
    85: [28, 'снегопад'], 86: [28, 'снегопад'],
    95: [17, 'гроза'], 96: [17, 'гроза с градом'], 99: [17, 'гроза с градом']
  };

  window.loadWeather = async function (onData) {
    var moscow = { lat: 55.7558, lon: 37.6173, name: 'Москва' };
    var use = null;
    /* 1) try browser geolocation */
    var tryGeo = new Promise(function (resolve) {
      if (!navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        function (p) { resolve({ lat: p.coords.latitude, lon: p.coords.longitude, name: '' }); },
        function () { resolve(null); },
        { timeout: 4000, maximumAge: 600000 }
      );
    });
    use = await Promise.race([tryGeo, new Promise(function (r) { setTimeout(function(){r(null);}, 4500); })]);
    /* 2) fallback: IP geolocation (ipwho.is — free, CORS enabled) */
    if (!use) {
      try {
        var gr = await fetch('https://ipwho.is/');
        var gd = await gr.json();
        if (gd && gd.success && gd.latitude != null) {
          use = { lat: gd.latitude, lon: gd.longitude, name: gd.city || '' };
        }
      } catch (e) {}
    }
    /* 3) fallback: ip-api.com */
    if (!use) {
      try {
        var gr2 = await fetch('http://ip-api.com/json/?fields=lat,lon,city');
        var gd2 = await gr2.json();
        if (gd2 && gd2.lat != null) use = { lat: gd2.lat, lon: gd2.lon, name: gd2.city || '' };
      } catch (e) {}
    }
    if (!use) use = moscow;

    var url = 'https://api.open-meteo.com/v1/forecast?latitude=' + use.lat +
      '&longitude=' + use.lon +
      '&current=temperature_2m,weather_code,wind_speed_10m' +
      '&hourly=temperature_2m' +
      '&daily=temperature_2m_max,temperature_2m_min,weather_code' +
      '&timezone=auto&forecast_days=2';
    var resp = await fetch(url);
    var data = await resp.json();
    var cur = data.current;
    var code = cur.weather_code;
    var w = window.WMO[code] || [1, 'облачно'];
    /* evening temp: today's 21:00 */
    var evening = null;
    if (data.hourly && data.hourly.time) {
      var now = new Date();
      var target = new Date(now); target.setHours(21, 0, 0, 0);
      if (target < now) target = new Date(now.getTime() + 3 * 3600e3);
      var iso = target.toISOString().slice(0, 13);
      for (var i = 0; i < data.hourly.time.length; i++) {
        if (data.hourly.time[i].slice(0, 13) === iso) { evening = data.hourly.temperature_2m[i]; break; }
      }
    }
    var tomorrowMax = data.daily && data.daily.temperature_2m_max ? data.daily.temperature_2m_max[1] : null;
    /* resolve city name if we only have coordinates */
    if (!use.name) {
      try {
        var rr = await fetch('https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=' + use.lat + '&longitude=' + use.lon + '&localityLanguage=ru');
        var rd = await rr.json();
        use.name = rd.city || rd.locality || '';
      } catch (e) {}
    }
    onData({
      temp: Math.round(cur.temperature_2m),
      evening: evening === null ? null : Math.round(evening),
      tomorrow: tomorrowMax === null ? null : Math.round(tomorrowMax),
      icon: w[0], label: w[1],
      wind: Math.round(cur.wind_speed_10m),
      city: use.name || moscow.name,
      isMoscow: !use.name
    });
  };

  /* ---------- CBR currency (CORS enabled) ---------- */
  window.loadCbr = async function (onData) {
    var resp = await fetch('https://www.cbr-xml-daily.ru/daily_json.js');
    var d = await resp.json();
    var usd = d.Valute.USD, eur = d.Valute.EUR;
    onData({
      usd: usd.Value.toFixed(4), usdDelta: (usd.Value - usd.Previous).toFixed(4),
      eur: eur.Value.toFixed(4), eurDelta: (eur.Value - eur.Previous).toFixed(4),
      date: d.Date ? d.Date.slice(8, 10) + '.' + d.Date.slice(5, 7) : ''
    });
  };

  /* ---------- misc ---------- */
  window.fmtDelta = function (s) {
    var v = parseFloat(s);
    if (v > 0) return { text: '+' + s, cls: 'q_plus' };
    if (v < 0) return { text: '\u2212' + s.replace('-', ''), cls: 'q_minus' };
    return { text: '0.0000', cls: '' };
  };

  window.esc = function (s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  };
})();
