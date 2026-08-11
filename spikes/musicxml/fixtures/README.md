# MusicXML spike fixtures

The three piano scores are real public-domain repertoire files from the
music21 corpus, used only by the T00 converter spike:

- `bach-bwv846.musicxml` — J. S. Bach, BWV 846, source:
  <https://github.com/cuthbertLab/music21/blob/master/music21/corpus/bach/bwv846.mxl>
- `clara-schumann-op1-no1.musicxml` — Clara Schumann, Op. 1 No. 1, source:
  <https://github.com/cuthbertLab/music21/blob/master/music21/corpus/schumann_clara/opus1/movement1.mxl>
- `mozart-k545-exposition.musicxml` — W. A. Mozart, K. 545 exposition, source:
  <https://github.com/cuthbertLab/music21/blob/master/music21/corpus/mozart/k545/movement1_exposition.mxl>

The `.mxl` archives were expanded so the harness can inspect their source
`<staff>` values. The underlying compositions are public-domain repertoire;
the fixtures stay confined to this throwaway spike.

`structure-repeats-jumps.musicxml` is W3C MusicXML 4.0 conformance example
`45e-Repeats-Fine-InvalidEndings.musicxml`, used to probe repeat, volta, D.C.,
D.S., coda, and Fine performance ordering. The W3C MusicXML repository is at
<https://github.com/w3c/musicxml>.
