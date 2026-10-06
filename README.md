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

## 3D modely v sekci Technika
Bez modelu se kresli rucne kresleny dratovy model (`gear3d.js`). S modelem ho nahradi otexturovany model (`gear-models.js`, three.js z `vendor/`), ktery se nacte az pri scrollu k sekci.

1. Zdrojove soubory modelu NEDAVAT do repa (vse v repu je na webu volne ke stazeni). Do `models/` patri jen optimalizovany GLB:
```sh
npx @gltf-transform/cli optimize zdroj.glb models/air3s.glb --compress meshopt --texture-compress webp --texture-size 2048 \
  --flatten false --join false --instance false --palette false --simplify false
```
(`--flatten/--join false` zachova oddelene dily – ramena, vrtule, displej – jinak by nesly animovat.)
2. V `index.html` pridat k `.gear-scroll` atribut `data-model="models/air3s.glb"`.
3. V `gear-models.js` v `RIGS` nastavit `transform` (meritko/natoceni do jednotek sceny) a `hinges` (ktere uzly se otaci kolem ktereho bodu – nazvy uzlu ukaze `npx @gltf-transform/cli inspect`).

Bundle three.js se prestavuje podle navodu v `vendor/three-entry.js`.
