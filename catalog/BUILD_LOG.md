# Catalog ingestion log

Source revision: `2144afd6f52d56c5b6995b8b589ef1268b3139f0`

## Normalisation rules

- Solo-keyboard declarations may list piano with harpsichord, clavichord, or pianoforte. The former exact-`Piano` test incorrectly excluded these rows.
- Aliases are folded, must contain at least 4 characters, cannot be a stop word, and cannot be a strict substring of the folded visible title.
- Composer spellings are mapped through `scripts/catalog-composers.json`; the original upstream composer remains in each manifest row as `rawComposer`.
- Folded title collisions gain upstream opus/subtitle metadata, falling back to the Mutopia catalogue number when that metadata is not distinguishing.

## Recovered candidates

- Mutopia 1028: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 1045: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 128: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 129: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 1328: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 1375: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 1389: accepted solo-keyboard declaration `Harpsichord,Clavichord,Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 139: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 140: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 141: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 142: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 143: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 144: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 145: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 1496: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 149: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 150: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 151: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 152: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 153: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 154: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 155: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 1563: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 156: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 157: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 158: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 159: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 160: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 161: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 162: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 163: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 164: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 165: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 166: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 167: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 168: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 169: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 171: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 172: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 173: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 174: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 175: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 176: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 177: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 185: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 186: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 187: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 1935: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 1938: accepted solo-keyboard declaration `Piano, Pianoforte, Harpsichord, Clavichord`; the former exact-`Piano` filter excluded it.
- Mutopia 1941: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 199: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 200: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 2049: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 204: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 205: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 206: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 209: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 210: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 211: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 2126: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 212: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 213: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 2155: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 2162: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 2223: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 2225: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 2226: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 2233: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 254: accepted solo-keyboard declaration `Harpsichord, Piano, Clavichord`; the former exact-`Piano` filter excluded it.
- Mutopia 316: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 378: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 379: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 407: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 40: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 414: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 421: accepted solo-keyboard declaration `Harpsichord, Piano, Clavichord`; the former exact-`Piano` filter excluded it.
- Mutopia 474: accepted solo-keyboard declaration `Harpsichord, Piano, Clavichord`; the former exact-`Piano` filter excluded it.
- Mutopia 487: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 492: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 493: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 4: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 538: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 545: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 546: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 550: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 55: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 561: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 562: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 563: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 569: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 58: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 596: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 597: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 59: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 5: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 602: accepted solo-keyboard declaration `Harpsichord, Piano, Clavichord`; the former exact-`Piano` filter excluded it.
- Mutopia 61: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 62: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 63: accepted solo-keyboard declaration `Harpsichord, Piano, Clavichord`; the former exact-`Piano` filter excluded it.
- Mutopia 66: accepted solo-keyboard declaration `Harpsichord, Piano, Clavichord`; the former exact-`Piano` filter excluded it.
- Mutopia 670: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 67: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 68: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 690: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 693: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 69: accepted solo-keyboard declaration `Harpsichord, Piano, Clavichord`; the former exact-`Piano` filter excluded it.
- Mutopia 702: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 70: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 71: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 72: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 73: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 746: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 748: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 749: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 74: accepted solo-keyboard declaration `Harpsichord, Piano, Clavichord`; the former exact-`Piano` filter excluded it.
- Mutopia 750: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 752: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 75: accepted solo-keyboard declaration `Harpsichord, Piano, Clavichord`; the former exact-`Piano` filter excluded it.
- Mutopia 76: accepted solo-keyboard declaration `Harpsichord, Piano, Clavichord`; the former exact-`Piano` filter excluded it.
- Mutopia 77: accepted solo-keyboard declaration `Harpsichord, Piano, Clavichord`; the former exact-`Piano` filter excluded it.
- Mutopia 78: accepted solo-keyboard declaration `Harpsichord, Piano, Clavichord`; the former exact-`Piano` filter excluded it.
- Mutopia 79: accepted solo-keyboard declaration `Harpsichord, Piano, Clavichord`; the former exact-`Piano` filter excluded it.
- Mutopia 805: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 806: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 807: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 82: accepted solo-keyboard declaration `Harpsichord, Piano, Clavichord`; the former exact-`Piano` filter excluded it.
- Mutopia 83: accepted solo-keyboard declaration `Harpsichord, Piano, Clavichord`; the former exact-`Piano` filter excluded it.
- Mutopia 84: accepted solo-keyboard declaration `Harpsichord, Piano, Clavichord`; the former exact-`Piano` filter excluded it.
- Mutopia 85: accepted solo-keyboard declaration `Harpsichord, Piano, Clavichord`; the former exact-`Piano` filter excluded it.
- Mutopia 86: accepted solo-keyboard declaration `Harpsichord, Piano, Clavichord`; the former exact-`Piano` filter excluded it.
- Mutopia 963: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 964: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 974: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 988: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 99: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.
- Mutopia 9: accepted solo-keyboard declaration `Harpsichord, Piano`; the former exact-`Piano` filter excluded it.

## Composer mappings

- `A. Scriabin (1872-1915)` → **Scriabin, Alexander**
- `Adolphe Charles Adam` → **Adam, Adolphe Charles**
- `Alexander Scriabin (1872-1915)` → **Scriabin, Alexander**
- `Andrew Sidwell` → **Sidwell, Andrew**
- `Anon` → **Anonymous**
- `Arranged by A. H. Pease` → **Pease, A. H.**
- `August Eberhardt Müller (1767-1817)` → **Müller, August Eberhardt**
- `Bela Bartok (1881-1945)` → **Bartók, Béla**
- `BrahmsJ` → **Brahms, Johannes**
- `by SCOTT JOPLIN.` → **Joplin, Scott**
- `BY SCOTT JOPLIN.` → **Joplin, Scott**
- `Carl Czerny` → **Czerny, Carl**
- `Carl Philipp Emanuel Bach (1714-1788)` → **Bach, Carl Philipp Emanuel**
- `Charles Hunter` → **Hunter, Charles**
- `Charles-Valentin Alkan` → **Alkan, Charles-Valentin**
- `Chopin` → **Chopin, Frédéric**
- `Chris Brown` → **Brown, Chris**
- `Claude Debussy` → **Debussy, Claude**
- `Claude Debussy (1862-1918)` → **Debussy, Claude**
- `ClementiM` → **Clementi, Muzio**
- `Czerny, C.` → **Czerny, Carl**
- `D. Scarlatti (1685-1757)` → **Scarlatti, Domenico**
- `DebussyC` → **Debussy, Claude**
- `Domenico Scarlatti (1685-1757)` → **Scarlatti, Domenico**
- `Dora Pejacsevich` → **Pejacsevich, Dora**
- `Edvard Grieg` → **Grieg, Edvard**
- `Edvard Grieg (1843 - 1907)` → **Grieg, Edvard**
- `Edvard Grieg (1843-1907)` → **Grieg, Edvard**
- `Erik Satie` → **Satie, Erik**
- `Erik Satie (1866-1925)` → **Satie, Erik**
- `Érik Satie (1866-1925)` → **Satie, Erik**
- `F. BURGMÜLLER` → **Burgmüller, Johann Friedrich Franz**
- `F. Chopin` → **Chopin, Frédéric**
- `F. Chopin. Op.33 No.1` → **Chopin, Frédéric**
- `F. Chopin. Op.6, No.1.` → **Chopin, Frédéric**
- `F. F. Chopin` → **Chopin, Frédéric**
- `F. Liszt` → **Liszt, Franz**
- `F. Mendelssohn-Bartholdy` → **Mendelssohn, Felix**
- `Felix Mendelssohn` → **Mendelssohn, Felix**
- `Felix Mendelssohn Bartholdy` → **Mendelssohn, Felix**
- `Felix Mendelssohn-Bartholdy` → **Mendelssohn, Felix**
- `Fr.Chopin (1810-1849),Op.23` → **Chopin, Frédéric**
- `Franz Behr (1837-1898)` → **Behr, Franz**
- `Franz Joseph Haydn (1732-1809)` → **Haydn, Franz Joseph**
- `Franz Schubert` → **Schubert, Franz**
- `Franz Schubert (1797-1828)` → **Schubert, Franz**
- `Frédéric Chopin` → **Chopin, Frédéric**
- `Frédéric Chopin (1810 - 1849)` → **Chopin, Frédéric**
- `Frederic Chopin (1810-1849)` → **Chopin, Frédéric**
- `Frédéric Chopin (1810-1849)` → **Chopin, Frédéric**
- `Frédéric François Chopin (1810-1849)` → **Chopin, Frédéric**
- `Frederik Kuhlau (1786-1832)` → **Kuhlau, Friedrich**
- `G. F. Handel` → **Handel, George Frideric**
- `G. Verdi` → **Verdi, Giuseppe**
- `Georg Friedrich Händel (1685-1759)` → **Handel, George Frideric**
- `Georges Bizet` → **Bizet, Georges**
- `GEORGES BIZET` → **Bizet, Georges**
- `Grigor Iliev` → **Iliev, Grigor**
- `HanonCL` → **Hanon, Charles-Louis**
- `Ignaz Joseph Pleyel (1757-1831)` → **Pleyel, Ignaz Joseph**
- `Isaac Albéniz (1860-1909)` → **Albéniz, Isaac**
- `J. Brahms` → **Brahms, Johannes**
- `J. K. F. Fischer` → **Fischer, Johann Caspar Ferdinand**
- `J. L. Dussek (1760-1812)` → **Dussek, Jan Ladislav**
- `J. S. Bach` → **Bach, Johann Sebastian**
- `J. S. Bach (1685-1750)` → **Bach, Johann Sebastian**
- `J.S. Bach` → **Bach, Johann Sebastian**
- `J.S. Bach (1685-1750)` → **Bach, Johann Sebastian**
- `Jacques (Jacob) Blumenthal` → **Blumenthal, Jacques**
- `Jean-Philippe Rameau` → **Rameau, Jean-Philippe**
- `Jiři Antonìn Benda` → **Benda, Jiří Antonín**
- `Johann André (1741-1799)` → **André, Johann**
- `Johann Friedrich Franz Burgmüller (1806-1874)` → **Burgmüller, Johann Friedrich Franz**
- `Johann Kuhnau (1660-1722)` → **Kuhnau, Johann**
- `Johann Pachelbel` → **Pachelbel, Johann**
- `Johann Sebastian Bach` → **Bach, Johann Sebastian**
- `Johann Sebastian BACH (1685 - 1750)` → **Bach, Johann Sebastian**
- `Johann Sebastian Bach (1685--1750)` → **Bach, Johann Sebastian**
- `Johann Sebastian Bach (1685-1750)` → **Bach, Johann Sebastian**
- `Johann Sebastian Bach (1685–1750)` → **Bach, Johann Sebastian**
- `Johann Sebastian Bach, BWV 895` → **Bach, Johann Sebastian**
- `Johann Strauss II, Op. 324.` → **Strauss, Johann II**
- `Johann Strauss Jr. (1825 - 1899)` → **Strauss, Johann II**
- `Johann Wanhal (1739-1813)` → **Wanhal, Johann**
- `John Field` → **Field, John**
- `John Philip Sousa` → **Sousa, John Philip**
- `JOHN PHILIP SOUSA.` → **Sousa, John Philip**
- `Joseph Ascher` → **Ascher, Joseph**
- `Kruetzer` → **Kreutzer, Rodolphe**
- `KumarR` → **Kumar, Ramana**
- `L. Streabbog (Louis Gobbaerts)` → **Gobbaerts, Louis**
- `L. van Beethoven` → **Beethoven, Ludwig van**
- `L.V. Beethoven (1770-1827)` → **Beethoven, Ludwig van**
- `Louis Moreau Gottschalk` → **Gottschalk, Louis Moreau**
- `Ludwig MINKUS` → **Minkus, Ludwig**
- `Ludwig van Beethoven` → **Beethoven, Ludwig van**
- `Ludwig Van Beethoven` → **Beethoven, Ludwig van**
- `Ludwig van Beethoven (1770-1827)` → **Beethoven, Ludwig van**
- `Modest Moussorgsky (1839 - 1881)` → **Mussorgsky, Modest Petrovich**
- `Muzio Clementi` → **Clementi, Muzio**
- `N. Rimsky-Korsakov (1844-1908)` → **Rimsky-Korsakov, Nikolai**
- `N. RIMSKY-KORSAKOV (1844-1908)` → **Rimsky-Korsakov, Nikolai**
- `Otis Comeau` → **Comeau, Otis**
- `P. I. Tchaikovsky` → **Tchaikovsky, Pyotr Ilyich**
- `P. Tchaikovskiy` → **Tchaikovsky, Pyotr Ilyich**
- `Peter Ilyich Tchaikovsky (1840 - 1893)` → **Tchaikovsky, Pyotr Ilyich**
- `R. Schumann (1810-1856)` → **Schumann, Robert**
- `Ramana Kumar` → **Kumar, Ramana**
- `Robert Alexander Schumann` → **Schumann, Robert**
- `Robert Schumann (1810-1856)` → **Schumann, Robert**
- `SchubertF` → **Schubert, Franz**
- `Scott Joplin` → **Joplin, Scott**
- `SCOTT JOPLIN` → **Joplin, Scott**
- `Scott Joplin (1868-1905)` → **Joplin, Scott**
- `Scott Joplin (1868-1917)` → **Joplin, Scott**
- `Scott Joplin and Scott Hayden` → **Joplin, Scott & Hayden, Scott**
- `SCOTT JOPLIN.` → **Joplin, Scott**
- `Sergei Rachmaninoff` → **Rachmaninoff, Sergei**
- `Sergei Rachmaninoff (1873-1943)` → **Rachmaninoff, Sergei**
- `Spagnoletti` → **Spagnoletti, Pietro**
- `Stéphane Magnenat` → **Magnenat, Stéphane**
- `Stephen C. Doonan` → **Doonan, Stephen C.**
- `Tom Turpin (1873 - 1922)` → **Turpin, Tom**
- `Traditional` → **Traditional**
- `W. A. Mozart` → **Mozart, Wolfgang Amadeus**
- `W. A. Mozart (1756-1791)` → **Mozart, Wolfgang Amadeus**
- `W. A. Mozart (1756­1791)` → **Mozart, Wolfgang Amadeus**
- `W.A. Mozart` → **Mozart, Wolfgang Amadeus**
- `William Smallwood (1831-1897)` → **Smallwood, William**
- `Wolfgang Amadeus Mozart` → **Mozart, Wolfgang Amadeus**
- `Wolfgang Amadeus Mozart (1756-1791)` → **Mozart, Wolfgang Amadeus**
- `Yaniewicz` → **Yaniewicz, Felix**
- `Алексей Станчинский` → **Stanchinsky, Alexey**
- `Модест Петрович Мусоргский` → **Mussorgsky, Modest Petrovich**
- `Петр И. Чайковский` → **Tchaikovsky, Pyotr Ilyich**

## Dropped candidates

Dropped candidates: **7**

- Mutopia 2207: no MIDI asset found
- missing published Mutopia ID (ftp/BachJS/BWV850/bwv850b/bwv850b-lys/bwv850b-notes.ly)
- missing published Mutopia ID (ftp/BeethovenLv/O27/moonlight/moonlight-lys/moonlight2-a4.ly)
- missing published Mutopia ID (ftp/BeethovenLv/O27/moonlight/moonlight-lys/moonlight2-let.ly)
- missing published Mutopia ID (ftp/BeethovenLv/O27/moonlight/moonlight-lys/moonlight3-a4.ly)
- missing published Mutopia ID (ftp/BeethovenLv/O27/moonlight/moonlight-lys/moonlight3-let.ly)
- missing published Mutopia ID (ftp/SatieE/Gnossienne/no_2/no_2.ly)

## Source adapters

- Mutopia: `2144afd6f52d56c5b6995b8b589ef1268b3139f0` (priority 0; wins duplicate works)
- piano-midi.de: apex HTTP inventory checked 2026-08-16 (priority 1; fetched from `http://piano-midi.de/` over HTTP)

The adapters supply ids, titles, raw and canonical composer names, exact asset
bytes and per-row licence records. The merged writer validates, hashes, de-duplicates,
sorts and writes both sources through one path.

## piano-midi.de parser gate

- Accepted rows: **14**
- Rows with `hasHandData === true`: **14/14 (100.0%)**
- The build-time MIDI gate yielded at least one A0–C8 note for every accepted row.
- `tests/build-catalog.test.ts` independently runs every shipped row through the production `parsePieceBytes` path and checks this result and the hand-data fraction.

### Same-licence composites

- **undefined**: [source MIDI](http://piano-midi.de/midis/ravel/rav_ondi.mid), [source MIDI](http://piano-midi.de/midis/ravel/rav_gib.mid), [source MIDI](http://piano-midi.de/midis/ravel/rav_scarbo.mid); concatenated in listed movement order and retained under the same licence.
- **undefined**: [source MIDI](http://piano-midi.de/midis/mussorgsky/muss_1.mid), [source MIDI](http://piano-midi.de/midis/mussorgsky/muss_2.mid), [source MIDI](http://piano-midi.de/midis/mussorgsky/muss_3.mid), [source MIDI](http://piano-midi.de/midis/mussorgsky/muss_4.mid), [source MIDI](http://piano-midi.de/midis/mussorgsky/muss_5.mid), [source MIDI](http://piano-midi.de/midis/mussorgsky/muss_6.mid), [source MIDI](http://piano-midi.de/midis/mussorgsky/muss_7.mid), [source MIDI](http://piano-midi.de/midis/mussorgsky/muss_8.mid); concatenated in listed movement order and retained under the same licence.
- **undefined**: [source MIDI](http://piano-midi.de/midis/beethoven/mond_1.mid), [source MIDI](http://piano-midi.de/midis/beethoven/mond_2.mid), [source MIDI](http://piano-midi.de/midis/beethoven/mond_3.mid); concatenated in listed movement order and retained under the same licence.

### Arrangement rights checks

- Tchaikovsky — Waltz of the Flowers (The Nutcracker, piano arr.): skipped; the source's Tchaikovsky page contains The Seasons, not this arrangement, so there is no file-specific arrangement licence to verify.
- Bach — Toccata and Fugue in D minor, BWV 565 (piano arr.): skipped; the source's Bach page contains only WTC selections, so there is no file-specific arrangement licence to verify.
- Tchaikovsky — Dance of the Sugar Plum Fairy (The Nutcracker, piano arr.): skipped; the source's Tchaikovsky page contains The Seasons, not this arrangement, so there is no file-specific arrangement licence to verify.
- Schubert — Ständchen / Serenade (arr. Liszt, S.560 No. 7): skipped; the source's Schubert page does not list this transcription, so there is no file-specific arrangement licence to verify.
- Bach — Air on the G String (BWV 1068, piano arr.): skipped; the source's Bach page contains only WTC selections, so there is no file-specific arrangement licence to verify.
- Vivaldi — Summer (The Four Seasons, piano arr.): skipped; Vivaldi is absent from the source index, so there is no file-specific arrangement licence to verify.
- Vivaldi — Spring (The Four Seasons, piano arr.): skipped; Vivaldi is absent from the source index, so there is no file-specific arrangement licence to verify.
- Vivaldi — Winter (The Four Seasons, piano arr.): skipped; Vivaldi is absent from the source index, so there is no file-specific arrangement licence to verify.
- Rimsky-Korsakov — Flight of the Bumblebee (arr. Rachmaninoff): skipped; Rimsky-Korsakov is absent from the source index, so there is no file-specific arrangement licence to verify.

### Duplicate-source skips

- mutopia pictures-at-an-exhibition: skipped because piano-midi.de supplies the complete work

### Second-source drops

- None

## Shipped catalog weight

- Pieces: **609**
- Score assets: **7,079,435 bytes (6.75 MiB)**
- 20 MiB deployment flag: **clear at the score-asset stage**

## Deployed catalog weight

- `dist/catalog`: **7,731,579 bytes (7.37 MiB)**
- 20 MiB deployment flag: **clear**
## Playlists

| Source | Resolved | Missing | Excluded |
|---|---:|---:|---:|
| `rousseau-classical.tsv` | 38 | 26 | 7 |
