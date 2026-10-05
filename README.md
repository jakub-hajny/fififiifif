- [x] Lander
- [x] About
- [x] Nase prace/tvorba (tady hodis ty videa & fotky kdyby byly)
- [x] Klienti
- [x] Nas tym

- [ ] Batch convert na .webp a .webm (uplne nevim)
- [x] Timeline_1.mp4 -> ~50MB (8mb.video)
- [x] Poster tomu videu udelat
- [x] Mobile support (dejme tomu)
- [ ] Tablet support
- [ ] Zkusit ten smooth transition na fullscreen u tech yt videi, tak jak na portfolio jeden moment
- [ ] REBRAND, PROTOZE HOLY FCKN CORPORATE

- slogan: mozna nedavat vubec, kdyz uz: spis co delame jako fineflight
- foceni, toceni videi, litani,
- nejaka kolonka s technikou co mame
- ten text vedler zbaivit
- ted predelat texty
- pak nejakou zakladni reactovinu
- predelat tu galerii, pridat kolonko na fotky
- zakomponovat horizontalni video

test kvuli vercelu

## Hero video (vymena pozadi)
Staci prepsat `vids/hero.mp4` a `vids/hero-poster.webp`, v HTML se nic menit nemusi.

Cil: 1080p, 10–20 s smycka (konec navazuje na zacatek), bez zvuku, ~3–5 MB.

```sh
# video: zmensit na 1080p, H.264, bez zvuku, faststart (zacne hrat driv, nez se cele stahne)
ffmpeg -i zdroj.mov -t 15 -vf "scale=1920:-2" -c:v libx264 -preset slow -crf 26 -pix_fmt yuv420p -an -movflags +faststart vids/hero.mp4

# poster: snimek ze 3. sekundy jako opravdovy WebP (~100 KB)
ffmpeg -ss 3 -i vids/hero.mp4 -frames:v 1 -c:v libwebp -quality 80 vids/hero-poster.webp
```
Pozn.: soucasny `hero-poster.webp` je ve skutecnosti 8 MB PNG – pri vymene videa ho druhy prikaz nahradi.
