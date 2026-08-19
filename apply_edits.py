#!/usr/bin/env python3
# -*- coding: utf-8 -*-
import re, io

p = 'index.html'
s = io.open(p, encoding='utf-8').read()
orig = s

def rep(old, new, count=1):
    global s
    if old not in s:
        print("!! NOT FOUND:", old[:70].replace("\n"," "))
        return
    s = s.replace(old, new, count)

# 1. Title
rep('<title>@MAIL.RU: почта, поиск, новости, знакомства, видеочат. Почта @MAIL.RU - бесплатная почта #1</title>',
    '<title>@ SOAP.NEKXD.FUN: почта, поиск, новости, знакомства, видеочат. Почта @ SOAP.NEKXD.FUN - бесплатная почта #1</title>')

# 2. Logo alt/title
rep('alt="@MAIL.RU" title="@MAIL.RU"', 'alt="@ SOAP.NEKXD.FUN" title="@ SOAP.NEKXD.FUN"')

# 3. text_adv slot 1
rep('<a href="https://openvk.org/" target="_blank" class="title">Мой Мир теперь на OpenVK!</a><br />Общайся, делись фото и веди страницу в открытой соцсети.',
    '<a href="https://openvk.org/" target="_blank" class="title">OpenVK</a><br />Соц. сеть повторяющая ВКектакте 2000-ых и 2010-ых годов!')

# 4. big button Мой мир -> ПЖ
rep('<li class="l_big_my"><a href="https://openvk.org/" tabindex="11">Мой&nbsp;мир</a></li>',
    '<li class="l_big_my"><a href="https://openvk.org/" tabindex="11">ПЖ</a></li>')

# 5. banner -> faero
rep('<a href="https://openvk.org/" target="_blank"><img src="assets/img/rs/b10540408.jpg" width="300" height="300" border="0" alt="" title="" /></a>',
    '<a href="https://faero.top/" target="_blank"><img src="assets/img/custom/faero.png" width="197" height="170" border="0" alt="faero" title="faero" /></a>')

# 6. games block (regex)
games_new = '''<table width="100%" cellspacing="0" cellpadding="0" style="margin-top:5px"><tr>
      <td style="text-align:center; width:25%; padding:0px 2px" valign="top">
        <a href="https://openvk.org/app531"><img src="assets/img/custom/game_ctr.png" width="50" height="50" alt="Cut the Rope" title="Cut the Rope" border="0" /></a><br />
        <div style="font-size: 10px; line-height:12px; text-align:center;"><a href="https://openvk.org/app531" style="text-decoration:none;">Cut the Rope</a></div>
      </td><td style="text-align:center; width:25%; padding:0px 2px" valign="top">
        <a href="https://openvk.org/app607"><img src="assets/img/custom/game_doom.jpg" width="50" height="50" alt="Doom" title="Doom" border="0" /></a><br />
        <div style="font-size: 10px; line-height:12px; text-align:center;"><a href="https://openvk.org/app607" style="text-decoration:none;">Doom</a></div>
      </td><td style="text-align:center; width:25%; padding:0px 2px" valign="top">
        <a href="https://openvk.org/app578"><img src="assets/img/custom/game_djump.png" width="50" height="50" alt="Doodle Jump" title="Doodle Jump" border="0" /></a><br />
        <div style="font-size: 10px; line-height:12px; text-align:center;"><a href="https://openvk.org/app578" style="text-decoration:none;">Doodle Jump</a></div>
      </td><td style="text-align:center; width:25%; padding:0px 2px" valign="top">
       <a href="https://openvk.org/app560"><img src="assets/img/custom/game_sosed.jpg" width="50" height="50" alt="Как достать соседа" title="Как достать соседа" border="0" /></a><br />
        <div style="font-size: 10px; line-height:12px; text-align:center;"><a href="https://openvk.org/app560" style="text-decoration:none;">Как достать соседа</a></div>
      </td></tr></table>'''
s2 = re.sub(r'<table width="100%" cellspacing="0" cellpadding="0" style="margin-top:5px"><tr>.*?</td></tr></table>',
            games_new, s, count=1, flags=re.DOTALL)
if s2 == s:
    print("!! GAMES regex no match")
s = s2

# 7. photos grid
rep('assets/img/rs/b7550421.jpg', 'assets/img/custom/photo_vdv.png')
rep('assets/img/rs/b7213852.jpg', 'assets/img/custom/photo_arizona.png')
rep('assets/img/rs/b10398442.jpg', 'assets/img/custom/photo_11.png')
rep('assets/img/rs/b10278843.jpg', 'assets/img/custom/photo_goat.png')

# 8. torg image
rep('assets/img/rs/b10018190.jpg', 'assets/img/custom/torg_scr.jpg')

# 9. karty image
rep('assets/img/rs/b8284585.gif', 'assets/img/custom/map_karty.jpg')

# 10. footer
rep('<a href="http://corp.mail.ru/">О компании</a>', '<a href="https://nekxd.fun/">О компании</a>')
rep('&#169; 1999-2010, <a href="http://corp.mail.ru/" class="mf_w">Mail.Ru</a>',
    '&#169; 1999-2010, <a href="https://nekxd.fun/" class="mf_w">soap.nekxd.fun</a>')
rep('<a href="#">Реклама на Mail.Ru</a>', '<a href="#">Реклама на soap.nekxd.fun</a>')

# 11. hidden entry-title
rep('Новости@Mail.Ru', 'Новости@soap.nekxd.fun')

# 12. loadTv function + call
loadtv = '''function loadTv(){
  var icons = ['assets/img/im/r/tv/channels/8304.gif','assets/img/im/r/tv/channels/17748.gif','assets/img/im/r/tv/channels/8898.gif'];
  fetch('https://api.tvmaze.com/schedule?country=RU').then(function(r){return r.json();}).then(function(data){
    var now = new Date();
    var nowMin = now.getHours()*60 + now.getMinutes();
    var byChan = {}, order = [];
    data.forEach(function(e){
      var net = e.show.network || e.show.webChannel;
      var ch = net ? net.name : 'ТВ';
      if(!byChan[ch]){ byChan[ch]=[]; order.push(ch); }
      byChan[ch].push(e);
    });
    var rows = [];
    for(var ci=0; ci<order.length && rows.length<3; ci++){
      var ch = order[ci], eps = byChan[ch], cur = null;
      for(var j=0;j<eps.length;j++){
        var ep=eps[j], pp=(ep.airtime||'0:0').split(':');
        var st=parseInt(pp[0],10)*60+parseInt(pp[1]||0,10);
        if(st<=nowMin && nowMin < st+(ep.runtime||30)){ cur=ep; break; }
      }
      var e2 = cur || eps[0];
      rows.push('<tr><td class="channel"><a href="'+esc(e2.show.url)+'" target="_new"><img src="'+icons[rows.length%3]+'" width="17" height="17" alt="" title="'+esc(ch)+'" /></a></td><td nowrap="nowrap" class="transfer"><span>'+esc(e2.airtime||'')+'</span><div class="overflow_block"><div class="gradient"></div><div class="tv_s"><a href="'+esc(e2.show.url)+'" target="_new" title="'+esc(e2.name)+'">'+esc(ch)+' \\u2014 '+esc(e2.show.name)+'</a></div></div></td></tr>');
    }
    if(rows.length) document.getElementById('tvChanTableId').innerHTML = rows.join('');
  }).catch(function(){});
}
document.addEventListener('DOMContentLoaded', function(){'''
rep("document.addEventListener('DOMContentLoaded', function(){", loadtv)
rep("  initClock();\n});", "  initClock();\n  loadTv();\n});")

# 13. 88x31 buttons at bottom
buttons = '''<div style="text-align:center; padding:10px 0 20px;">
<a href="https://nekxd.fun" target="_blank"><img src="https://nekxd.fun/fun.png" width="88" height="31" alt="yandhiev" loading="lazy"></a>
<a href="https://yuno.nya.pub" target="_blank"><img src="https://yuno.nya.pub/img/yuno88x31.png" width="88" height="31" alt="клацни на меня!"></a>
<a href="https://madebydimas.top" target="_blank"><img src="https://madebydimas.top/button.gif" width="88" height="31" alt="madebydimas"></a>
<a href="https://myslivets.com" target="_blank"><img src="https://myslivets.com/img/button.png" width="88" height="31" alt="myslivets"></a>
<a href="https://veselcraft.ru" target="_blank"><img src="https://veselcraft.ru/images/vc.gif" width="88" height="31" alt="veselcraft"></a>
<a href="https://github.com" target="_blank"><img src="https://madebydimas.top/github.gif" width="88" height="31" alt="github"></a>
<a href="https://firefox.com" target="_blank"><img src="http://nekxd.ru/firefox.gif" width="88" height="31" alt="Firefox"></a>
<a href="http://nekxd.ru/posuda.mp4" target="_blank"><img src="http://nekxd.ru/windows-media-player.gif" width="88" height="31" alt="WMP"></a>
<img src="https://88x31.kate.pet/w7-boot.gif" height="31" alt="">
<a href="https://nekxd.ru" target="_blank"><img src="https://nekxd.ru/button.png" width="88" height="31" alt="nekxd"></a>
<a href="https://nekxd.ru/old.html" target="_blank"><img src="https://nekxd.ru/old.png" width="88" height="31" alt="NekxdOld"></a>
</div>

<script src="assets/js/common.js"></script>'''
rep('<script src="assets/js/common.js"></script>', buttons)

io.open(p, 'w', encoding='utf-8').write(s)
print("changed bytes:", len(s)-len(orig))
print("done")
