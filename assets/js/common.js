/* mail.ru 2010 revival — shared helpers & fast data engine */
(function () {
  /* ===================== RETRO SYSTEM POLYFILLS ===================== */
  if (!Date.now) {
    Date.now = function () { return new Date().getTime(); };
  }
  if (!String.prototype.trim) {
    String.prototype.trim = function () {
      return this.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, '');
    };
  }
  if (!String.prototype.startsWith) {
    String.prototype.startsWith = function (s, pos) {
      return this.indexOf(s, pos || 0) === (pos || 0);
    };
  }
  if (!Array.prototype.forEach) {
    Array.prototype.forEach = function (fn, scope) {
      for (var i = 0, len = this.length; i < len; ++i) {
        if (i in this) fn.call(scope, this[i], i, this);
      }
    };
  }
  if (!Array.prototype.indexOf) {
    Array.prototype.indexOf = function (search, fromIndex) {
      var len = this.length;
      var i = fromIndex || 0;
      if (i < 0) i = Math.max(0, len + i);
      for (; i < len; i++) {
        if (i in this && this[i] === search) return i;
      }
      return -1;
    };
  }
  if (!Array.prototype.map) {
    Array.prototype.map = function (fn, scope) {
      var res = [];
      for (var i = 0, len = this.length; i < len; ++i) {
        if (i in this) res.push(fn.call(scope, this[i], i, this));
      }
      return res;
    };
  }
  if (!window.JSON) {
    window.JSON = {
      parse: function (s) { return eval('(' + s + ')'); },
      stringify: function (o) {
        if (o === null) return 'null';
        var t = typeof o;
        if (t === 'number' || t === 'boolean') return String(o);
        if (t === 'string') return '"' + o.replace(/"/g, '\\"') + '"';
        if (o instanceof Array) {
          var a = [];
          for (var i = 0; i < o.length; i++) a.push(window.JSON.stringify(o[i]));
          return '[' + a.join(',') + ']';
        }
        var p = [];
        for (var k in o) {
          if (o.hasOwnProperty && o.hasOwnProperty(k)) {
            p.push('"' + k + '":' + window.JSON.stringify(o[k]));
          }
        }
        return '{' + p.join(',') + '}';
      }
    };
  }
  if (typeof Promise === 'undefined') {
    window.Promise = function (executor) {
      var self = this;
      self.state = 'pending';
      self.value = undefined;
      self.callbacks = [];

      function resolve(val) {
        if (self.state !== 'pending') return;
        self.state = 'fulfilled';
        self.value = val;
        for (var i = 0; i < self.callbacks.length; i++) {
          if (self.callbacks[i].onFulfilled) {
            try { self.callbacks[i].onFulfilled(val); } catch (e) {}
          }
        }
      }

      function reject(reason) {
        if (self.state !== 'pending') return;
        self.state = 'rejected';
        self.value = reason;
        for (var i = 0; i < self.callbacks.length; i++) {
          if (self.callbacks[i].onRejected) {
            try { self.callbacks[i].onRejected(reason); } catch (e) {}
          }
        }
      }

      try {
        executor(resolve, reject);
      } catch (err) {
        reject(err);
      }
    };

    window.Promise.prototype.then = function (onFulfilled, onRejected) {
      var self = this;
      return new window.Promise(function (resolve, reject) {
        function handle() {
          if (self.state === 'fulfilled') {
            if (typeof onFulfilled === 'function') {
              try {
                var res = onFulfilled(self.value);
                if (res && typeof res.then === 'function') res.then(resolve, reject);
                else resolve(res);
              } catch (err) { reject(err); }
            } else {
              resolve(self.value);
            }
          } else if (self.state === 'rejected') {
            if (typeof onRejected === 'function') {
              try {
                var res = onRejected(self.value);
                if (res && typeof res.then === 'function') res.then(resolve, reject);
                else resolve(res);
              } catch (err) { reject(err); }
            } else {
              reject(self.value);
            }
          } else {
            self.callbacks.push({
              onFulfilled: function (v) {
                if (typeof onFulfilled === 'function') {
                  try {
                    var r = onFulfilled(v);
                    if (r && typeof r.then === 'function') r.then(resolve, reject);
                    else resolve(r);
                  } catch (e) { reject(e); }
                } else { resolve(v); }
              },
              onRejected: function (rj) {
                if (typeof onRejected === 'function') {
                  try {
                    var r = onRejected(rj);
                    if (r && typeof r.then === 'function') r.then(resolve, reject);
                    else resolve(r);
                  } catch (e) { reject(e); }
                } else { reject(rj); }
              }
            });
          }
        }
        setTimeout(handle, 0);
      });
    };

    window.Promise.prototype['catch'] = function (onRejected) {
      return this.then(null, onRejected);
    };

    window.Promise.resolve = function (v) {
      return new window.Promise(function (res) { res(v); });
    };

    window.Promise.reject = function (err) {
      return new window.Promise(function (res, rej) { rej(err); });
    };
  }

  var esc = window.esc = function (s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  };

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
      title: 'Faero.Top',
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

    if (el.addEventListener) {
      el.addEventListener('mouseenter', function () { isHovered = true; }, false);
      el.addEventListener('mouseleave', function () { isHovered = false; }, false);
    } else if (el.attachEvent) {
      el.attachEvent('onmouseenter', function () { isHovered = true; });
      el.attachEvent('onmouseleave', function () { isHovered = false; });
    } else {
      el.onmouseenter = function () { isHovered = true; };
      el.onmouseleave = function () { isHovered = false; };
    }

    render(curIdx);
    timer = setInterval(next, intervalMs || 6000);
  };

  /* ===================== FAST PROXY FETCHING (CROSS-BROWSER) ===================== */
  function getXHR() {
    if (typeof XMLHttpRequest !== 'undefined') {
      try { return new XMLHttpRequest(); } catch (e) {}
    }
    if (typeof ActiveXObject !== 'undefined') {
      try { return new ActiveXObject('Msxml2.XMLHTTP.6.0'); } catch (e) {}
      try { return new ActiveXObject('Msxml2.XMLHTTP.3.0'); } catch (e) {}
      try { return new ActiveXObject('Msxml2.XMLHTTP'); } catch (e) {}
      try { return new ActiveXObject('Microsoft.XMLHTTP'); } catch (e) {}
    }
    return null;
  }

  function fetchWithTimeout(url, timeoutMs) {
    timeoutMs = timeoutMs || 4000;
    return new Promise(function (resolve, reject) {
      var settled = false;
      var timer = setTimeout(function () {
        if (settled) return;
        settled = true;
        try { if (xhr && xhr.abort) xhr.abort(); } catch (e) {}
        reject(new Error('timeout'));
      }, timeoutMs);

      function onDone(err, text) {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        if (err) reject(err);
        else resolve(text);
      }

      // Try modern fetch if available
      if (typeof fetch !== 'undefined') {
        try {
          var ctrl = (typeof AbortController !== 'undefined') ? new AbortController() : null;
          fetch(url, { mode: 'cors', signal: ctrl ? ctrl.signal : undefined })
            .then(function (resp) {
              if (!resp.ok) {
                onDone(new Error('HTTP ' + resp.status));
              } else {
                return resp.text();
              }
            })
            .then(function (text) {
              if (typeof text === 'string') onDone(null, text);
            })
            ['catch'](function (err) {
              onDone(err);
            });
          return;
        } catch (e) {}
      }

      // Try XHR
      var xhr = getXHR();
      if (xhr) {
        try {
          xhr.open('GET', url, true);
          xhr.onreadystatechange = function () {
            if (xhr.readyState === 4) {
              if (xhr.status >= 200 && xhr.status < 300) {
                onDone(null, xhr.responseText);
              } else if (xhr.status === 0 && typeof XDomainRequest !== 'undefined') {
                tryXDR();
              } else {
                onDone(new Error('HTTP ' + xhr.status));
              }
            }
          };
          xhr.send(null);
          return;
        } catch (e) {
          if (typeof XDomainRequest !== 'undefined') {
            tryXDR();
            return;
          }
          onDone(e);
          return;
        }
      }

      function tryXDR() {
        try {
          var xdr = new XDomainRequest();
          xdr.onload = function () { onDone(null, xdr.responseText); };
          xdr.onerror = function () { onDone(new Error('XDR error')); };
          xdr.ontimeout = function () { onDone(new Error('timeout')); };
          xdr.open('GET', url);
          xdr.send();
        } catch (e) {
          onDone(e);
        }
      }

      if (typeof XDomainRequest !== 'undefined') {
        tryXDR();
        return;
      }

      onDone(new Error('no transport'));
    });
  }

  window.fetchViaProxy = function (url, timeoutMs) {
    timeoutMs = timeoutMs || 4500;
    var encUrl = encodeURIComponent(url);
    var pUrl1 = 'https://api.allorigins.win/raw?url=' + encUrl;
    var pUrl2 = 'https://api.allorigins.win/get?url=' + encUrl;

    return fetchWithTimeout(pUrl1, timeoutMs).then(function (text) {
      if (!text || text.length < 30) throw new Error('too short');
      return text;
    })['catch'](function () {
      return fetchWithTimeout(pUrl2, timeoutMs).then(function (text) {
        var j = JSON.parse(text);
        if (j && j.contents) return j.contents;
        throw new Error('no contents');
      });
    })['catch'](function () {
      return fetchWithTimeout(url, timeoutMs);
    });
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
    if (!s) return '';
    var d = document.createElement('div');
    d.innerHTML = s;
    return d.textContent || d.innerText || '';
  }

  window.parseRss = function (xmlText) {
    try {
      if (window.DOMParser) {
        var doc = new DOMParser().parseFromString(xmlText, 'text/xml');
        var items = doc.querySelectorAll ? doc.querySelectorAll('item') : doc.getElementsByTagName('item');
        var out = [];
        for (var i = 0; i < items.length; i++) {
          var it = items[i];
          var t = it.querySelector ? it.querySelector('title') : it.getElementsByTagName('title')[0];
          var l = it.querySelector ? it.querySelector('link') : it.getElementsByTagName('link')[0];
          var d = it.querySelector ? it.querySelector('description') : it.getElementsByTagName('description')[0];
          var date = it.querySelector ? it.querySelector('pubDate') : it.getElementsByTagName('pubDate')[0];
          var titleText = t ? (t.textContent || t.text || t.innerText || '') : '';
          var linkText = l ? (l.textContent || l.text || l.innerText || '') : '#';
          var descText = d ? (d.textContent || d.text || d.innerText || '') : '';
          var dateText = date ? (date.textContent || date.text || date.innerText || '') : '';
          out.push({
            title: stripHtml(titleText),
            link: linkText.replace(/^\s+|\s+$/g, ''),
            desc: stripHtml(descText),
            date: dateText
          });
        }
        if (out.length) return out;
      }
      // Legacy regex fallback if DOMParser missing or returned 0 items
      var itemMatches = xmlText.match(/<item[\s\S]*?<\/item>/gi) || [];
      var regexOut = [];
      for (var j = 0; j < itemMatches.length; j++) {
        var raw = itemMatches[j];
        var titleM = raw.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
        var linkM = raw.match(/<link[^>]*>([\s\S]*?)<\/link>/i);
        var descM = raw.match(/<description[^>]*>([\s\S]*?)<\/description>/i);
        var dateM = raw.match(/<pubDate[^>]*>([\s\S]*?)<\/pubDate>/i);
        regexOut.push({
          title: titleM ? stripHtml(titleM[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')) : '',
          link: linkM ? linkM[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/^\s+|\s+$/g, '') : '#',
          desc: descM ? stripHtml(descM[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')) : '',
          date: dateM ? dateM[1] : ''
        });
      }
      return regexOut;
    } catch (e) {
      return [];
    }
  };

  window.loadHabrFeed = function (key) {
    var cached = window.cacheGet('habr_' + key, 10 * 60 * 1000);
    if (cached && cached.length) return Promise.resolve(cached);

    var q = window.HABR_QUERIES[key];
    var habrApiUrl = (q === undefined || q === null)
      ? 'https://habr.com/kek/v2/articles/?news=true'
      : 'https://habr.com/kek/v2/articles/?query=' + encodeURIComponent(q);

    return fetchWithTimeout(habrApiUrl, 3500).then(function (habrResp) {
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
      throw new Error('empty');
    })['catch'](function () {
      var feedUrl = window.HABR_FEEDS[key] || window.HABR_FEEDS.news;
      var r2jUrl = 'https://api.rss2json.com/v1/api.json?rss_url=' + encodeURIComponent(feedUrl);
      return fetchWithTimeout(r2jUrl, 3500).then(function (r2jResp) {
        var r2jData = JSON.parse(r2jResp);
        if (r2jData && r2jData.status === 'ok' && r2jData.items && r2jData.items.length > 0) {
          var r2jItems = [];
          for (var j = 0; j < r2jData.items.length; j++) {
            var it = r2jData.items[j];
            r2jItems.push({
              title: stripHtml(it.title),
              link: it.link || '#',
              date: it.pubDate || ''
            });
          }
          window.cacheSet('habr_' + key, r2jItems);
          return r2jItems;
        }
        throw new Error('empty');
      });
    })['catch'](function () {
      return FALLBACK_NEWS[key] || FALLBACK_NEWS.news;
    });
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

  function getSeasonalWeather() {
    var m = new Date().getMonth();
    var seasons = {
      0:  { temp: -8, night: -11, morn: -10, day: -7, evening: -9, tomorrow: -7, tomorrowMin: -11, label: 'небольшой снег', icon: 21 },
      1:  { temp: -7, night: -10, morn: -9, day: -6, evening: -8, tomorrow: -6, tomorrowMin: -10, label: 'пасмурно', icon: 16 },
      2:  { temp: 0, night: -4, morn: -2, day: 2, evening: -1, tomorrow: 1, tomorrowMin: -3, label: 'облачно', icon: 16 },
      3:  { temp: 9, night: 4, morn: 6, day: 11, evening: 8, tomorrow: 10, tomorrowMin: 5, label: 'переменная облачность', icon: 9 },
      4:  { temp: 17, night: 10, morn: 13, day: 19, evening: 15, tomorrow: 18, tomorrowMin: 11, label: 'ясно', icon: 7 },
      5:  { temp: 21, night: 14, morn: 17, day: 23, evening: 19, tomorrow: 22, tomorrowMin: 15, label: 'малооблачно', icon: 6 },
      6:  { temp: 24, night: 16, morn: 19, day: 25, evening: 21, tomorrow: 24, tomorrowMin: 16, label: 'ясно', icon: 7 },
      7:  { temp: 22, night: 15, morn: 18, day: 23, evening: 19, tomorrow: 22, tomorrowMin: 15, label: 'переменная облачность', icon: 9 },
      8:  { temp: 15, night: 9, morn: 11, day: 16, evening: 13, tomorrow: 15, tomorrowMin: 9, label: 'облачно', icon: 16 },
      9:  { temp: 8, night: 4, morn: 5, day: 9, evening: 6, tomorrow: 8, tomorrowMin: 4, label: 'небольшой дождь', icon: 11 },
      10: { temp: 1, night: -2, morn: -1, day: 2, evening: 0, tomorrow: 1, tomorrowMin: -2, label: 'пасмурно', icon: 16 },
      11: { temp: -5, night: -8, morn: -7, day: -4, evening: -6, tomorrow: -5, tomorrowMin: -8, label: 'небольшой снег', icon: 21 }
    };
    var s = seasons[m] || seasons[9];
    return {
      temp: s.temp,
      night: s.night,
      morn: s.morn,
      day: s.day,
      evening: s.evening,
      todayMin: s.night,
      todayMax: s.day,
      tomorrow: s.tomorrow,
      tomorrowMin: s.tomorrowMin,
      icon: s.icon,
      label: s.label,
      wind: 3,
      city: 'Москва',
      isMoscow: true
    };
  }

  window.loadWeather = function (onData, cityQuery) {
    var moscow = { lat: 55.7558, lon: 37.6173, name: 'Москва' };
    var cached = window.cacheGet('weather_data', 30 * 60 * 1000);
    if (cached) onData(cached);

    var targetCity = cityQuery || 'Moscow';
    var proto = (location.protocol === 'https:') ? 'https:' : 'http:';
    var wttrUrl = proto + '//wttr.in/' + encodeURIComponent(targetCity) + '?format=j1&lang=ru';

    fetchWithTimeout(wttrUrl, 4000).then(function (wttrResp) {
      var wData = JSON.parse(wttrResp);
      if (wData && wData.current_condition && wData.current_condition.length > 0) {
        var cur = wData.current_condition[0];
        var code = parseInt(cur.weatherCode, 10);
        var w = window.WTTR_MAP[code] || [16, 'облачно'];
        var label = (cur.lang_ru && cur.lang_ru[0] && cur.lang_ru[0].value) ? cur.lang_ru[0].value.toLowerCase() : w[1];

        var night = null, morn = null, day = null, evening = null;
        var todayMin = null, todayMax = null;
        if (wData.weather && wData.weather[0]) {
          var w0 = wData.weather[0];
          if (w0.mintempC != null) todayMin = parseInt(w0.mintempC, 10);
          if (w0.maxtempC != null) todayMax = parseInt(w0.maxtempC, 10);
          if (w0.hourly) {
            var hourly = w0.hourly;
            for (var i = 0; i < hourly.length; i++) {
              var t = parseInt(hourly[i].tempC, 10);
              var hTime = hourly[i].time;
              if (hTime === '0' || hTime === '300') {
                if (night === null) night = t;
              } else if (hTime === '600' || hTime === '900') {
                if (morn === null) morn = t;
              } else if (hTime === '1200' || hTime === '1500') {
                if (day === null) day = t;
              } else if (hTime === '1800' || hTime === '2100') {
                if (evening === null) evening = t;
              }
            }
          }
        }

        var tomorrowMax = null, tomorrowMin = null;
        if (wData.weather && wData.weather.length > 1) {
          var w1 = wData.weather[1];
          if (w1.maxtempC != null) tomorrowMax = parseInt(w1.maxtempC, 10);
          if (w1.mintempC != null) tomorrowMin = parseInt(w1.mintempC, 10);
        }

        var result = {
          temp: parseInt(cur.temp_C, 10),
          night: night,
          morn: morn,
          day: day,
          evening: evening,
          todayMin: todayMin,
          todayMax: todayMax,
          tomorrow: tomorrowMax,
          tomorrowMin: tomorrowMin,
          icon: w[0],
          label: label,
          wind: Math.round(parseFloat(cur.windspeedKmph || 0) / 3.6),
          city: 'Москва',
          isMoscow: true
        };

        window.cacheSet('weather_data', result);
        onData(result);
        return true;
      }
      throw new Error('empty wttr');
    })['catch'](function () {
      var omUrl = proto + '//api.open-meteo.com/v1/forecast?latitude=' + moscow.lat +
        '&longitude=' + moscow.lon +
        '&current=temperature_2m,weather_code,wind_speed_10m' +
        '&hourly=temperature_2m' +
        '&daily=temperature_2m_max,temperature_2m_min,weather_code' +
        '&timezone=auto&forecast_days=2';

      return fetchWithTimeout(omUrl, 4000).then(function (omResp) {
        var omData = JSON.parse(omResp);
        var omCur = omData.current;
        var omCode = omCur.weather_code;
        var omW = window.WMO[omCode] || [16, 'облачно'];

        var omNight = null, omMorn = null, omDay = null, omEvening = null;
        if (omData.hourly && omData.hourly.temperature_2m) {
          var hTemps = omData.hourly.temperature_2m;
          if (hTemps.length > 3) omNight = Math.round(hTemps[3]);
          if (hTemps.length > 9) omMorn = Math.round(hTemps[9]);
          if (hTemps.length > 14) omDay = Math.round(hTemps[14]);
          if (hTemps.length > 21) omEvening = Math.round(hTemps[21]);
        }

        var omTomorrowMax = (omData.daily && omData.daily.temperature_2m_max) ? Math.round(omData.daily.temperature_2m_max[1]) : null;
        var omTomorrowMin = (omData.daily && omData.daily.temperature_2m_min) ? Math.round(omData.daily.temperature_2m_min[1]) : null;
        var omTodayMax = (omData.daily && omData.daily.temperature_2m_max) ? Math.round(omData.daily.temperature_2m_max[0]) : null;
        var omTodayMin = (omData.daily && omData.daily.temperature_2m_min) ? Math.round(omData.daily.temperature_2m_min[0]) : null;

        var omResult = {
          temp: Math.round(omCur.temperature_2m),
          night: omNight,
          morn: omMorn,
          day: omDay,
          evening: omEvening,
          todayMin: omTodayMin,
          todayMax: omTodayMax,
          tomorrow: omTomorrowMax,
          tomorrowMin: omTomorrowMin,
          icon: omW[0],
          label: omW[1],
          wind: Math.round(omCur.wind_speed_10m),
          city: moscow.name,
          isMoscow: true
        };

        window.cacheSet('weather_data', omResult);
        onData(omResult);
      });
    })['catch'](function () {
      if (!cached) {
        var fallback = getSeasonalWeather();
        onData(fallback);
      }
    });
  };

  /* ===================== CBR CURRENCY (HTTP & HTTPS) ===================== */
  window.loadCbr = function (onData) {
    var cached = window.cacheGet('cbr_rates', 60 * 60 * 1000);
    if (cached) onData(cached);

    var proto = (location.protocol === 'https:') ? 'https:' : 'http:';
    var url = proto + '//www.cbr-xml-daily.ru/daily_json.js';

    fetchWithTimeout(url, 3000).then(function (text) {
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
    })['catch'](function () {
      if (!cached) {
        onData({
          usd: '92.4500', usdDelta: '+0.1200',
          eur: '100.1500', eurDelta: '+0.0800',
          date: '14.10'
        });
      }
    });
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
