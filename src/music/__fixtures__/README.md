# T02 import fixtures

These small fixtures were written for this project and may be redistributed
with it. `midiFixtures.ts` generates deterministic MIDI bytes. The MusicXML
scores exercise cross-hand staff mapping, repeat expansion, chained ties, and
ornament notices without copying a third-party score.
`cross-hand.mxl` is a ZIP-packaged copy of `cross-hand.musicxml` with the
standard `META-INF/container.xml` manifest.

The two apparent Bach mismatches in S-2 were chained ties. Two source notes had
both `<tie type="stop">` and `<tie type="start">`; the spike treated them as new
attacks, while Verovio correctly joined each into the surrounding sustained
note. `tied-chain.musicxml` reproduces that case.
