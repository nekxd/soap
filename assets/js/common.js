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
        '<img src="' + b.img + '" width="260" height="224" border="0" alt="' + esc(b.title) + '" style="max-width:100%; height:auto; border-radius:3px; display:block; margin:0 auto;" ' +
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
    timeoutMs = timeoutMs || 4000;
    var encUrl = encodeURIComponent(url);

    // List of fast proxy endpoints (supports HTTP & HTTPS environments)
    var proxyUrls = [
      'https://corsproxy.io/?url=' + encUrl,
      'https://api.allorigins.win/raw?url=' + encUrl,
      'https://api.allorigins.win/get?url=' + encUrl,
      'https://r.jina.ai/' + url,
      'https://api.codetabs.com/v1/proxy?quest=' + encUrl
    ];

    // Parallel race: launch first batch immediately
    var promises = proxyUrls.map(function (pUrl) {
      return fetchWithTimeout(pUrl, timeoutMs).then(function (text) {
        if (pUrl.indexOf('allorigins.win/get') !== -1) {
          try {
            var j = JSON.parse(text);
            if (j && j.contents) return j.contents;
            throw new Error('no contents');
          } catch (e) {
            throw e;
          }
        }
        if (pUrl.indexOf('r.jina.ai') !== -1) {
          return { jina: true, text: text };
        }
        if (/^\s*<!doctype html/i.test(text) && pUrl.indexOf('allorigins') !== -1 && url.indexOf('duckduckgo') === -1) {
          throw new Error('allorigins error page');
        }
        return text;
      });
    });

    if (Promise.any) {
      try {
        return await Promise.any(promises);
      } catch (err) {
        return await fetchWithTimeout(url, 3000);
      }
    } else {
      for (var i = 0; i < proxyUrls.length; i++) {
        try {
          var res = await fetchWithTimeout(proxyUrls[i], 3000);
          if (res) return res;
        } catch (e) {}
      }
      return await fetchWithTimeout(url, 3000);
    }
  };

  /* ===================== HABR RSS NEWS ===================== */
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
    var cached = window.cacheGet('habr_' + key, 15 * 60 * 1000);
    if (cached && cached.length) return cached;

    var url = window.HABR_FEEDS[key] || key;
    try {
      var text = await window.fetchViaProxy(url, 4000);
      if (text && text.jina) throw new Error('jina markdown');
      var items = window.parseRss(text);
      if (items && items.length > 0) {
        window.cacheSet('habr_' + key, items);
        return items;
      }
    } catch (e) {}

    return FALLBACK_NEWS[key] || FALLBACK_NEWS.news;
  };

  /* ===================== WEATHER: OPEN-METEO (HTTP & HTTPS) ===================== */
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

    // 1. Instant cache (TTL: 30 minutes)
    var cached = window.cacheGet('weather_data', 30 * 60 * 1000);
    if (cached) {
      onData(cached);
    }

    // 2. Resolve coordinates via fast IP lookup (works on HTTP and HTTPS)
    var use = null;
    try {
      var proto = (location.protocol === 'https:') ? 'https:' : 'http:';
      var ipApiUrl = proto + '//ip-api.com/json/?fields=lat,lon,city,country';
      var gr = await fetchWithTimeout(ipApiUrl, 2500);
      var gd = JSON.parse(gr);
      if (gd && gd.lat != null) {
        use = { lat: gd.lat, lon: gd.lon, name: gd.city || '' };
      }
    } catch (e) {}

    if (!use) use = moscow;

    // 3. Fetch Open-Meteo weather (protocol-relative or HTTP/HTTPS)
    try {
      var weatherProto = (location.protocol === 'https:') ? 'https:' : 'http:';
      var url = weatherProto + '//api.open-meteo.com/v1/forecast?latitude=' + use.lat +
        '&longitude=' + use.lon +
        '&current=temperature_2m,weather_code,wind_speed_10m' +
        '&hourly=temperature_2m' +
        '&daily=temperature_2m_max,temperature_2m_min,weather_code' +
        '&timezone=auto&forecast_days=2';

      var respText = await fetchWithTimeout(url, 3500);
      var data = JSON.parse(respText);
      var cur = data.current;
      var code = cur.weather_code;
      var w = window.WMO[code] || [16, 'облачно'];

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

      var result = {
        temp: Math.round(cur.temperature_2m),
        evening: evening === null ? null : Math.round(evening),
        tomorrow: tomorrowMax === null ? null : Math.round(tomorrowMax),
        icon: w[0],
        label: w[1],
        wind: Math.round(cur.wind_speed_10m),
        city: use.name || moscow.name,
        isMoscow: !use.name
      };

      window.cacheSet('weather_data', result);
      onData(result);
    } catch (e) {
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
