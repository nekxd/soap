package ru.mail.client2010;

public final class Constants {
    private Constants() {}

    // URLs for Mail.ru 2010 portal
    public static final String URL_MOBILE = "http://soap.nekxd.fun/m.html";
    public static final String URL_DESKTOP = "http://soap.nekxd.fun/index.html";
    public static final String URL_MAIL = "https://e.mail.ru/";
    public static final String URL_SEARCH = "http://soap.nekxd.fun/search.html";
    public static final String URL_NEWS = "https://habr.com/ru/news/";
    public static final String URL_GAMES = "https://openvk.org/apps";

    // Fallback offline HTML template
    public static final String OFFLINE_HTML = "<html><head><meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">"
            + "<style>body{font-family:sans-serif;margin:0;padding:20px;background:#f4f4f4;color:#333;text-align:center;}"
            + ".box{background:#fff;border:1px solid #ccc;padding:20px;border-radius:4px;margin-top:20px;}"
            + "h2{color:#00468c;margin-top:0;}button{background:#00468c;color:#fff;border:none;padding:10px 20px;font-size:14px;border-radius:3px;cursor:pointer;}"
            + "</style></head><body><div class=\"box\"><h2>Mail.ru 2010</h2>"
            + "<p>Нет подключения к сети. Проверьте интернет или повторите попытку позже.</p>"
            + "<p><button onclick=\"location.reload()\">Обновить страницу</button></p></div></body></html>";
}
