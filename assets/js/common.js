/* mail.ru 2010 revival — shared helpers & fast data engine */
(function () {
  'use strict';

  /* ===================== LOCAL STORAGE CACHE ===================== */
  window.cacheGet = function (key, maxAgeMs) {
    try {
      var item = localStorage.getItem('mailru_cache_' + key);
      if (!item) return null;
      var data = JSON.parse(item);
      if (Date.now() - data.ts > maxAgeMs) return null;
      return data.val;
    } catch (e) {
      return null;
    }
  };

  window.cacheSet = function (key, val) {
    try {
      localStorage.setItem('mailru_cache_' + key, JSON.stringify({
        ts: Date.now(),
        val: val
      }));
    } catch (e) {}
  };

  /* ===================== BANNERS ===================== */
  window.BANNERS = [
    {
      title: 'Inori Aizawa',
      img: 'assets/img/banners/inori.png',
      remoteImg: 'http://faero.top/ad/inori.png',
      url: 'http://inori.faero.top'
    },
    {
      title: 'LunaStore',
      img: 'assets/img/banners/ls_rek.png',
      remoteImg: 'http://faero.top/ad/ls_rek.png',
      url: 'http://lunastore.app'
    },
    {
      title: 'Renaissance',
      img: 'assets/img/banners/mrim.jpg',
      remoteImg: 'http://faero.top/ad/mrim.jpg',
      url: 'http://mrim.su'
    },
    {
      title: 'FaeroFM',
      img: 'assets/img/banners/faerofm.png',
      remoteImg: 'http://faero.top/ad/faerofm.png',
      url: 'http://fm.faero.top'
    },
    {
      title: 'faero.top',
      img: 'assets/img/banners/faero.png',
      remoteImg: 'http://faero.top/ad/faero.png',
      url: 'http://faero.top'
    }
  ];

  window.initBannerRotator = function (bannerElementId, intervalMs) {
    var el = document.getElementById(bannerElementId);
    if (!el) return;
    var banners = window.BANNERS;
    var curIdx = Math.floor(Math.random() * banners.length);
    var timer = null;
    var isHovered = false;

    function render(idx) {
      var b = banners[idx];
      var html = '<a href="' + b.url + '" target="_blank" title="' + esc(b.title) + '">' +
        '<img src="' + b.img + '" width="300" height="259" border="0" alt="' + esc(b.title) + '" style="width:100%; max-width:300px; height:auto; border-radius:4px; display:block; margin:0 auto;" ' +
        'onerror="if(this.src!=\'' + b.remoteImg + '\'){this.src=\'' + b.remoteImg + '\';}" /></a>';
      el.innerHTML = html;
    }

    function next() {
      if (isHovered) return;
      curIdx = (curIdx + 1) % banners.length;
      render(curIdx);
    }

    el.addEventListener('mouseenter', function () { isHovered = true; });
    el.addEventListener('mouseleave', function () { isHovered = false; });

    render(curIdx);
    timer = setInterval(next, intervalMs || 6000);
  };

  /* ===================== FAST PROXY FETCHING (RACE) ===================== */
  function fetchWithTimeout(url, timeoutMs) {
    if (typeof fetch === 'undefined') {
      return new Promise(function (resolve, reject) {
        try {
          var xhr = new XMLHttpRequest();
          xhr.open('GET', url, true);
          xhr.timeout = timeoutMs;
          xhr.onload = function () {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(xhr.responseText);
            } else {
              reject(new Error('HTTP ' + xhr.status));
            }
          };
          xhr.onerror = function () { reject(new Error('network error')); };
          xhr.ontimeout = function () { reject(new Error('timeout')); };
          xhr.send();
        } catch (e) {
          reject(e);
        }
      });
    }

    return new Promise(function (resolve, reject) {
      var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
      var timer = setTimeout(function () {
        if (ctrl) ctrl.abort();
        reject(new Error('timeout'));
      }, timeoutMs);

      var opts = { mode: 'cors' };
      if (ctrl) opts.signal = ctrl.signal;

      fetch(url, opts).then(function (resp) {
        clearTimeout(timer);
        if (!resp.ok) {
          reject(new Error('HTTP ' + resp.status));
        } else {
          return resp.text();
        }
      }).then(function (text) {
        if (!text || text.length < 20) {
          reject(new Error('empty'));
        } else {
          resolve(text);
        }
      }).catch(function (err) {
        clearTimeout(timer);
        reject(err);
      });
    });
  }

  window.fetchViaProxy = async function (url, timeoutMs) {
    timeoutMs = timeoutMs || 4500;
    var encUrl = encodeURIComponent(url);

    var proxyUrls = [
      'https://api.allorigins.win/raw?url=' + encUrl,
      'https://api.allorigins.win/get?url=' + encUrl
    ];

    if (Promise.any) {
      try {
        var promises = proxyUrls.map(function (pUrl) {
          return fetchWithTimeout(pUrl, timeoutMs).then(function (text) {
            if (!text || text.length < 30) throw new Error('too short');
            if (pUrl.indexOf('allorigins.win/get') !== -1) {
              var j = JSON.parse(text);
              if (j && j.contents) return j.contents;
              throw new Error('no contents');
            }
            return text;
          });
        });
        return await Promise.any(promises);
      } catch (err) {
        return await fetchWithTimeout(url, timeoutMs);
      }
    } else {
      for (var i = 0; i < proxyUrls.length; i++) {
        try {
          var res = await fetchWithTimeout(proxyUrls[i], timeoutMs);
          if (res) return res;
        } catch (e) {}
      }
      return await fetchWithTimeout(url, timeoutMs);
    }
  };

  /* ===================== HABR NEWS (API + RSS FALLBACK) ===================== */
  window.HABR_QUERIES = {
    news:   null,
    auto:   'транспорт',
    afisha: 'кино',
    hitech: 'электроника',
    lady:   'мода',
    games:  'игры'
  };

  window.HABR_FEEDS = {
    news:   'https://habr.com/ru/rss/news/?fl=ru',
    auto:   'https://habr.com/ru/rss/hubs/transport/articles/?fl=ru',
    afisha: 'https://habr.com/ru/rss/search/?q=%D0%BA%D0%B8%D0%BD%D0%BE&target_type=posts&fl=ru',
    hitech: 'https://habr.com/ru/rss/hubs/electronics/articles/?fl=ru',
    lady:   'https://habr.com/ru/rss/search/?q=%D0%BC%D0%BE%D0%B4%D0%B0&target_type=posts&fl=ru',
    games:  'https://habr.com/ru/rss/hubs/gamedev/articles/?fl=ru'
  };

  var FALLBACK_NEWS = {
    news: [
      { title: 'Разработка открытых веб-стандартов продолжается активными темпами', link: 'https://habr.com/ru/news/' },
      { title: 'Новые технологии веб-разработки и оптимизации производительности', link: 'https://habr.com/ru/news/' },
      { title: 'Сообщество открытого ПО выпускает обновления популярных библиотек', link: 'https://habr.com/ru/news/' },
      { title: 'Аналитики отмечают рост интереса к ретро-интерфейсам и классическому вебу', link: 'https://habr.com/ru/news/' },
      { title: 'Инженеры представили новые методы сжатия и кэширования данных', link: 'https://habr.com/ru/news/' }
    ],
    auto: [
      { title: 'Эволюция автомобильной электроники и систем автономного управления', link: 'https://habr.com/ru/hubs/transport/' },
      { title: 'Развитие городского электротранспорта и зарядной инфраструктуры', link: 'https://habr.com/ru/hubs/transport/' },
      { title: 'История цифровых приборных панелей от 90-х до наших дней', link: 'https://habr.com/ru/hubs/transport/' }
    ],
    afisha: [
      { title: 'Культовые научно-фантастические фильмы и их влияние на технологии', link: 'https://habr.com/ru/search/?q=кино' },
      { title: 'Как создавались спецэффекты в кинематографе 2000-х годов', link: 'https://habr.com/ru/search/?q=кино' },
      { title: 'Обзор новинок цифрового кинематографа и анимации', link: 'https://habr.com/ru/search/?q=кино' }
    ],
    hitech: [
      { title: 'Архитектура современных микропроцессоров и оптимизация инструкций', link: 'https://habr.com/ru/hubs/electronics/' },
      { title: 'Новые достижения в полупроводниковой промышленности', link: 'https://habr.com/ru/hubs/electronics/' },
      { title: 'Обзор одноплатных компьютеров и DIY-электроники для энтузиастов', link: 'https://habr.com/ru/hubs/electronics/' }
    ],
    lady: [
      { title: 'Цифровая мода и виртуальные примерочные: как технологии меняют стиль', link: 'https://habr.com/ru/search/?q=мода' },
      { title: 'История развития дизайна пользовательских интерфейсов', link: 'https://habr.com/ru/search/?q=мода' },
      { title: 'Эргономика и дизайн современных рабочих пространств', link: 'https://habr.com/ru/search/?q=мода' }
    ],
    games: [
      { title: 'История создания классических 3D-движков и оптимизация графики', link: 'https://habr.com/ru/hubs/gamedev/' },
      { title: 'Ретроспектива культовых игр эпохи 2000-2010 годов', link: 'https://habr.com/ru/hubs/gamedev/' },
      { title: 'Современные тренды в разработке инди-игр на открытых движках', link: 'https://habr.com/ru/hubs/gamedev/' }
    ]
  };

  function stripHtml(s) {
    var d = document.createElement('div');
    d.innerHTML = s;
    return d.textContent || '';
  }

  window.parseRss = function (xmlText) {
    try {
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
    } catch (e) {
      return [];
    }
  };

  window.loadHabrFeed = async function (key) {
    var cached = window.cacheGet('habr_' + key, 10 * 60 * 1000);
    if (cached && cached.length) return cached;

    // 1. Primary: Official Habr API (CORS enabled, fast, live updates)
    try {
      var q = window.HABR_QUERIES[key];
      var habrApiUrl = (q === undefined || q === null)
        ? 'https://habr.com/kek/v2/articles/?news=true'
        : 'https://habr.com/kek/v2/articles/?query=' + encodeURIComponent(q);

      var habrResp = await fetchWithTimeout(habrApiUrl, 3500);
      var habrData = JSON.parse(habrResp);
      var ids = habrData.publicationIds || habrData.articleIds || [];
      var refs = habrData.publicationRefs || habrData.articleRefs || {};
      var items = [];
      for (var i = 0; i < ids.length; i++) {
        var id = ids[i];
        var ref = refs[String(id)];
        if (ref && ref.titleHtml) {
          items.push({
            title: stripHtml(ref.titleHtml),
            link: 'https://habr.com/ru/articles/' + id + '/',
            date: ref.timePublished || ''
          });
        }
      }
      if (items.length > 0) {
        window.cacheSet('habr_' + key, items);
        return items;
      }
    } catch (e) {}

    // 2. Secondary fallback: RSS2JSON service
    try {
      var feedUrl = window.HABR_FEEDS[key] || window.HABR_FEEDS.news;
      var r2jUrl = 'https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(feedUrl);
      var r2jResp = await fetchWithTimeout(r2jUrl, 3500);
      var r2jData = JSON.parse(r2jResp);
      if (r2jData && r2jData.status === 'ok' && r2jData.items && r2jData.items.length > 0) {
        var r2jItems = r2jData.items.map(function (it) {
          return {
            title: stripHtml(it.title),
            link: it.link || '#',
            date: it.pubDate || ''
          };
        });
        window.cacheSet('habr_' + key, r2jItems);
        return r2jItems;
      }
    } catch (e) {}

    return FALLBACK_NEWS[key] || FALLBACK_NEWS.news;
  };

  /* ===================== WEATHER: WTTR.IN + OPEN-METEO (HTTP & HTTPS) ===================== */
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

  window.WTTR_MAP = {
    113: [7, 'ясно'],
    116: [9, 'переменная облачность'],
    119: [16, 'облачно'],
    122: [16, 'пасмурно'],
    143: [26, 'туман'],
    176: [11, 'небольшой дождь'],
    179: [21, 'небольшой снег'],
    182: [13, 'мокрый снег'],
    185: [5, 'ледяная морось'],
    200: [17, 'гроза'],
    227: [27, 'снег'],
    230: [28, 'метель'],
    248: [26, 'туман'],
    260: [26, 'туман'],
    263: [5, 'морось'],
    266: [5, 'морось'],
    281: [5, 'ледяная морось'],
    284: [5, 'ледяная морось'],
    293: [11, 'небольшой дождь'],
    296: [11, 'небольшой дождь'],
    299: [13, 'дождь'],
    302: [13, 'дождь'],
    305: [17, 'сильный дождь'],
    308: [17, 'сильный дождь'],
    311: [13, 'ледяной дождь'],
    314: [17, 'сильный ледяной дождь'],
    317: [13, 'мокрый снег'],
    320: [13, 'мокрый снег'],
    323: [21, 'небольшой снег'],
    326: [21, 'небольшой снег'],
    329: [27, 'снег'],
    332: [27, 'снег'],
    335: [28, 'сильный снег'],
    338: [28, 'снегопад'],
    350: [17, 'град'],
    353: [11, 'небольшой дождь'],
    356: [13, 'ливень'],
    359: [17, 'сильный ливень'],
    362: [13, 'мокрый снег'],
    365: [13, 'мокрый снег'],
    368: [21, 'небольшой снег'],
    371: [28, 'снегопад'],
    374: [17, 'град'],
    377: [17, 'град'],
    386: [17, 'гроза'],
    389: [17, 'гроза с дождём'],
    392: [17, 'гроза со снегом'],
    395: [28, 'метель']
  };

  window.loadWeather = async function (onData) {
    var moscow = { lat: 55.7558, lon: 37.6173, name: 'Москва' };

    // 1. Instant cache (TTL: 30 minutes)
    var cached = window.cacheGet('weather_data', 30 * 60 * 1000);
    if (cached) {
      onData(cached);
    }

    // 2. Primary provider: wttr.in (CORS *, works seamlessly on HTTP & HTTPS, automatic IP geolocation)
    try {
      var proto = (location.protocol === 'https:') ? 'https:' : 'http:';
      var wttrUrl = proto + '//wttr.in/?format=j1';
      var wttrResp = await fetchWithTimeout(wttrUrl, 3000);
      var wData = JSON.parse(wttrResp);
      if (wData && wData.current_condition && wData.current_condition.length > 0) {
        var cur = wData.current_condition[0];
        var area = (wData.nearest_area && wData.nearest_area[0]) || {};
        var cityName = (area.areaName && area.areaName[0] && area.areaName[0].value) || 'Москва';
        var code = parseInt(cur.weatherCode, 10);
        var w = window.WTTR_MAP[code] || [16, 'облачно'];

        var evening = null;
        if (wData.weather && wData.weather[0] && wData.weather[0].hourly) {
          var hourly = wData.weather[0].hourly;
          for (var i = 0; i < hourly.length; i++) {
            if (hourly[i].time === '2100') {
              evening = parseInt(hourly[i].tempC, 10);
              break;
            }
          }
          if (evening === null && hourly.length > 6) {
            evening = parseInt(hourly[6].tempC, 10);
          }
        }

        var tomorrowMax = null;
        if (wData.weather && wData.weather.length > 1 && wData.weather[1].maxtempC != null) {
          tomorrowMax = parseInt(wData.weather[1].maxtempC, 10);
        }

        var result = {
          temp: parseInt(cur.temp_C, 10),
          evening: evening,
          tomorrow: tomorrowMax,
          icon: w[0],
          label: w[1],
          wind: Math.round(parseFloat(cur.windspeedKmph || 0) / 3.6),
          city: cityName,
          isMoscow: cityName.toLowerCase().indexOf('moscow') !== -1 || cityName.indexOf('Москва') !== -1
        };

        window.cacheSet('weather_data', result);
        onData(result);
        return;
      }
    } catch (e) {}

    // 3. Fallback provider: Open-Meteo (force https: so CORS headers are present)
    try {
      var use = moscow;
      try {
        var ipResp = await fetchWithTimeout('https://ipwho.is/', 2000);
        var ipData = JSON.parse(ipResp);
        if (ipData && ipData.latitude != null) {
          use = { lat: ipData.latitude, lon: ipData.longitude, name: ipData.city || 'Москва' };
        }
      } catch (e) {}

      var omUrl = 'https://api.open-meteo.com/v1/forecast?latitude=' + use.lat +
        '&longitude=' + use.lon +
        '&current=temperature_2m,weather_code,wind_speed_10m' +
        '&hourly=temperature_2m' +
        '&daily=temperature_2m_max,temperature_2m_min,weather_code' +
        '&timezone=auto&forecast_days=2';

      var omResp = await fetchWithTimeout(omUrl, 3000);
      var omData = JSON.parse(omResp);
      var omCur = omData.current;
      var omCode = omCur.weather_code;
      var omW = window.WMO[omCode] || [16, 'облачно'];

      var omEvening = null;
      if (omData.hourly && omData.hourly.time) {
        var now = new Date();
        var target = new Date(now); target.setHours(21, 0, 0, 0);
        if (target < now) target = new Date(now.getTime() + 3 * 3600e3);
        var iso = target.toISOString().slice(0, 13);
        for (var j = 0; j < omData.hourly.time.length; j++) {
          if (omData.hourly.time[j].slice(0, 13) === iso) { omEvening = omData.hourly.temperature_2m[j]; break; }
        }
      }
      var omTomorrow = omData.daily && omData.daily.temperature_2m_max ? omData.daily.temperature_2m_max[1] : null;

      var omResult = {
        temp: Math.round(omCur.temperature_2m),
        evening: omEvening === null ? null : Math.round(omEvening),
        tomorrow: omTomorrow === null ? null : Math.round(omTomorrow),
        icon: omW[0],
        label: omW[1],
        wind: Math.round(omCur.wind_speed_10m),
        city: use.name || moscow.name,
        isMoscow: !use.name || use.name === 'Москва'
      };

      window.cacheSet('weather_data', omResult);
      onData(omResult);
      return;
    } catch (e) {}

    // 4. Final fallback mock data
    if (!cached) {
      var fallbackWeather = {
        temp: 18,
        evening: 15,
        tomorrow: 20,
        icon: 16,
        label: 'облачно',
        wind: 3,
        city: 'Москва',
        isMoscow: true
      };
      onData(fallbackWeather);
    }
  };

  /* ===================== CBR CURRENCY (HTTP & HTTPS) ===================== */
  window.loadCbr = async function (onData) {
    var cached = window.cacheGet('cbr_rates', 60 * 60 * 1000);
    if (cached) onData(cached);

    var proto = (location.protocol === 'https:') ? 'https:' : 'http:';
    var url = proto + '//www.cbr-xml-daily.ru/daily_json.js';

    try {
      var text = await fetchWithTimeout(url, 3000);
      var d = JSON.parse(text);
      var usd = d.Valute.USD, eur = d.Valute.EUR;
      var res = {
        usd: usd.Value.toFixed(4),
        usdDelta: (usd.Value - usd.Previous).toFixed(4),
        eur: eur.Value.toFixed(4),
        eurDelta: (eur.Value - eur.Previous).toFixed(4),
        date: d.Date ? d.Date.slice(8, 10) + '.' + d.Date.slice(5, 7) : ''
      };
      window.cacheSet('cbr_rates', res);
      onData(res);
    } catch (e) {
      if (!cached) {
        onData({
          usd: '92.4500', usdDelta: '+0.1200',
          eur: '100.8200', eurDelta: '-0.0800',
          date: ''
        });
      }
    }
  };

  /* ===================== TV SCHEDULE (DYNAMIC + ONLINE) ===================== */
  window.loadTvSchedule = function (onData) {
    var icons = [
      'assets/img/im/r/tv/channels/8304.gif',
      'assets/img/im/r/tv/channels/17748.gif',
      'assets/img/im/r/tv/channels/8898.gif'
    ];

    var now = new Date();
    var curH = now.getHours();
    var curM = now.getMinutes();

    var CHANNELS = [
      {
        name: 'Первый',
        icon: icons[0],
        url: 'https://www.1tv.ru/live',
        schedule: [
          { time: '05:00', title: 'Доброе утро' },
          { time: '09:00', title: 'Новости' },
          { time: '09:20', title: 'АнтиФейк' },
          { time: '10:00', title: 'Жить здорово!' },
          { time: '12:00', title: 'Новости' },
          { time: '12:15', title: 'Информационный канал' },
          { time: '15:00', title: 'Новости' },
          { time: '15:15', title: 'Давай поженимся!' },
          { time: '16:05', title: 'Мужское / Женское' },
          { time: '18:00', title: 'Вечерние новости' },
          { time: '18:20', title: 'Человек и закон' },
          { time: '19:50', title: 'Поле чудес' },
          { time: '21:00', title: 'Время' },
          { time: '21:45', title: 'Премьера сезона. Сериал' },
          { time: '23:30', title: 'Большая игра' },
          { time: '00:30', title: 'Подкаст.Лаб' },
          { time: '02:00', title: 'Ночной эфир: Кино' }
        ]
      },
      {
        name: 'Россия 1',
        icon: icons[1],
        url: 'https://smotrim.ru/live/21',
        schedule: [
          { time: '05:00', title: 'Утро России' },
          { time: '09:00', title: 'Вести. Местное время' },
          { time: '09:30', title: 'Утро России' },
          { time: '09:55', title: 'О самом главном' },
          { time: '11:00', title: 'Вести' },
          { time: '11:30', title: '60 Минут' },
          { time: '14:00', title: 'Вести' },
          { time: '14:30', title: 'Местное время. Вести' },
          { time: '14:55', title: 'Судьба человека' },
          { time: '16:00', title: 'Прямой эфир' },
          { time: '17:30', title: '60 Минут' },
          { time: '20:00', title: 'Вести в 20:00' },
          { time: '21:15', title: 'Местное время. Вести' },
          { time: '21:30', title: 'Художественный сериал' },
          { time: '23:30', title: 'Вечер с Владимиром Соловьёвым' },
          { time: '02:00', title: 'Ночные Вести' }
        ]
      },
      {
        name: 'НТВ',
        icon: icons[2],
        url: 'https://www.ntv.ru/air/',
        schedule: [
          { time: '04:50', title: 'Улицы разбитых фонарей' },
          { time: '06:30', title: 'Утро. Самое лучшее' },
          { time: '08:00', title: 'Сегодня' },
          { time: '08:25', title: 'Мои университеты' },
          { time: '10:00', title: 'Сегодня' },
          { time: '10:35', title: 'Чрезвычайное происшествие' },
          { time: '11:00', title: 'Живая еда' },
          { time: '12:00', title: 'Квартирный вопрос' },
          { time: '13:00', title: 'Сегодня' },
          { time: '14:00', title: 'Место встречи' },
          { time: '16:00', title: 'Сегодня' },
          { time: '16:45', title: 'За гранью' },
          { time: '17:50', title: 'ДНК' },
          { time: '19:00', title: 'Сегодня' },
          { time: '20:00', title: 'Остросюжетный сериал' },
          { time: '22:15', title: 'Следствие вели...' },
          { time: '23:35', title: 'Своя правда' },
          { time: '01:20', title: 'ЧП. Расследование' }
        ]
      }
    ];

    var rows = [];
    var nowMinutes = curH * 60 + curM;

    CHANNELS.forEach(function (ch) {
      var curItem = ch.schedule[0];
      for (var i = 0; i < ch.schedule.length; i++) {
        var parts = ch.schedule[i].time.split(':');
        var itemMin = parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
        if (itemMin <= nowMinutes) {
          curItem = ch.schedule[i];
        } else {
          break;
        }
      }
      rows.push({
        channelName: ch.name,
        channelIcon: ch.icon,
        url: ch.url,
        time: curItem.time,
        title: curItem.title
      });
    });

    onData(rows);
  };

  /* ===================== FORMATTERS & HELPERS ===================== */
  window.fmtDelta = function (s) {
    var v = parseFloat(s);
    if (v > 0) return { text: '+' + s, cls: 'q_plus' };
    if (v < 0) return { text: '\u2212' + s.replace('-', ''), cls: 'q_minus' };
    return { text: '0.0000', cls: '' };
  };

  window.esc = function (s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  };
})();
